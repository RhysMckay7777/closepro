'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Target, Users, Package } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface Analysis {
  id: string;
  overallScore: number;
  valueScore: number;
  trustScore: number;
  fitScore: number;
  logisticsScore: number;
  valueDetails: string;
  trustDetails: string;
  fitDetails: string;
  logisticsDetails: string;
  skillScores: string;
  coachingRecommendations: string;
  timestampedFeedback: string;
}

interface Session {
  id: string;
  offerName?: string;
  overallScore: number | null;
  actualDifficultyTier: string | null;
  prospectAvatar?: {
    difficultyIndex: number;
    difficultyTier: string;
    positionProblemAlignment: number;
    painAmbitionIntensity: number;
    perceivedNeedForHelp: number;
    authorityLevel: string;
    funnelContext: number;
    executionResistance?: number;
    offerId?: string;
  } | null;
}

export default function RoleplayResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/roleplay/${sessionId}`);
      const data = await response.json();
      setSession({
        ...data.session,
        prospectAvatar: data.prospectAvatar || null,
      });

      // Analysis is included in session response when scored (from roleplay_analysis)
      if (data.analysis) {
        setAnalysis(data.analysis);
        setLoading(false);
        return;
      }


      if (data.session.status === 'completed' && !data.session.analysisId) {
        // Session completed but not scored yet — score it now
        const scoreResponse = await fetch(`/api/roleplay/${sessionId}/score`, {
          method: 'POST',
        });
        if (scoreResponse.ok) {
          const updatedResponse = await fetch(`/api/roleplay/${sessionId}`);
          const updatedData = await updatedResponse.json();
          setSession(updatedData.session);
          if (updatedData.analysis) setAnalysis(updatedData.analysis);
        }
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-blue-500/20 border-blue-500/50';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading results...</div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No analysis available yet</p>
          <Link href={`/dashboard/roleplay/${sessionId}`}>
            <Button>Back to Session</Button>
          </Link>
        </div>
      </div>
    );
  }

  const valueDetails = JSON.parse(analysis.valueDetails || '{}');
  const trustDetails = JSON.parse(analysis.trustDetails || '{}');
  const fitDetails = JSON.parse(analysis.fitDetails || '{}');
  const logisticsDetails = JSON.parse(analysis.logisticsDetails || '{}');
  const recommendations = JSON.parse(analysis.coachingRecommendations || '[]');
  const skillScores = JSON.parse(analysis.skillScores || '{}');
  const parsedTimestampedFeedback = (() => {
    try {
      const p = JSON.parse(analysis.timestampedFeedback || '[]');
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  })();

  // Generate diagnostic insight
  const getDiagnosticInsight = () => {
    if (!analysis) return null;

    const scores = {
      value: analysis.valueScore,
      trust: analysis.trustScore,
      fit: analysis.fitScore,
      logistics: analysis.logisticsScore,
    };

    const lowest = Math.min(scores.value, scores.trust, scores.fit, scores.logistics);
    const lowestPillar = Object.entries(scores).find(([, score]) => score === lowest)?.[0];

    if (lowestPillar === 'value') {
      return 'This sale was lost in Value, not the Close. Focus on building stronger value before presenting.';
    } else if (lowestPillar === 'trust') {
      return 'This sale was lost in Trust, not the Close. Build more credibility and rapport.';
    } else if (lowestPillar === 'fit') {
      return 'This sale was lost in Discovery, not the Close. Better qualification and fit assessment needed.';
    } else if (lowestPillar === 'logistics') {
      return 'This sale was lost in Logistics, not the Close. Address time, money, and commitment concerns earlier.';
    }

    return 'Review all four pillars to identify improvement areas.';
  };

  const diagnosticInsight = getDiagnosticInsight();

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/roleplay">Roleplay</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/dashboard/roleplay">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Roleplays
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Roleplay Results</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {session?.offerName || 'Session Analysis'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {session?.prospectAvatar && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-base sm:text-lg px-3 sm:px-4 py-2">
                Difficulty: {session.prospectAvatar.difficultyIndex}/{session.prospectAvatar.executionResistance !== undefined ? '50' : '40'}
              </Badge>
              {session.actualDifficultyTier && (
                <Badge variant="secondary" className="text-base sm:text-lg px-3 sm:px-4 py-2">
                  {session.actualDifficultyTier.toUpperCase()} Tier
                </Badge>
              )}
            </div>
          )}
          {!session?.prospectAvatar && session?.actualDifficultyTier && (
            <Badge variant="outline" className="text-base sm:text-lg px-3 sm:px-4 py-2 w-fit">
              {session.actualDifficultyTier.toUpperCase()} Difficulty
            </Badge>
          )}
        </div>
      </div>

      {/* Overall Score */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Overall Score</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Your performance in this roleplay</p>
            {diagnosticInsight && (
              <p className="text-sm text-orange-500 font-medium mt-2">
                💡 {diagnosticInsight}
              </p>
            )}
          </div>
          <div className={`text-5xl sm:text-6xl font-bold ${getScoreColor(analysis.overallScore)}`}>
            {analysis.overallScore}
          </div>
        </div>
      </Card>

      {/* Prospect Difficulty Details */}
      {session?.prospectAvatar && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-4">
            Prospect Difficulty Profile {session.prospectAvatar.executionResistance !== undefined ? '(50-Point Model)' : '(40-Point Model)'}
          </h2>

          {/* Layer A: Persuasion Difficulty (40 points) */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Layer A: Persuasion Difficulty (40 points)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Position & Problem Alignment</p>
                <p className="text-2xl font-bold">{session.prospectAvatar.positionProblemAlignment}/10</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pain / Ambition Intensity</p>
                <p className="text-2xl font-bold">{session.prospectAvatar.painAmbitionIntensity}/10</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Authority & Perceived Need</p>
                <p className="text-2xl font-bold">{session.prospectAvatar.perceivedNeedForHelp}/10</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Funnel Context</p>
                <p className="text-2xl font-bold">{session.prospectAvatar.funnelContext}/10</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-muted-foreground">Authority Level</p>
              <Badge variant="outline" className="mt-1">
                {session.prospectAvatar.authorityLevel.charAt(0).toUpperCase() + session.prospectAvatar.authorityLevel.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Layer B: Execution Resistance (10 points) */}
          {session.prospectAvatar.executionResistance !== undefined && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Layer B: Execution Resistance (10 points)</h3>
              <div>
                <p className="text-sm text-muted-foreground">Ability to Proceed</p>
                <p className="text-2xl font-bold">{session.prospectAvatar.executionResistance}/10</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {session.prospectAvatar.executionResistance >= 8
                    ? 'Fully Able - Has money, time, authority'
                    : session.prospectAvatar.executionResistance >= 5
                      ? 'Partial Ability - Needs reprioritization'
                      : 'Extreme Resistance - Severe constraints'}
                </p>
              </div>
            </div>
          )}

          {/* Total Score */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Total Difficulty Score</p>
              <p className="text-3xl font-bold">
                {session.prospectAvatar.difficultyIndex}/{session.prospectAvatar.executionResistance !== undefined ? '50' : '40'}
              </p>
            </div>
            {session.prospectAvatar.executionResistance !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Layer A ({session.prospectAvatar.positionProblemAlignment + session.prospectAvatar.painAmbitionIntensity + session.prospectAvatar.perceivedNeedForHelp + session.prospectAvatar.funnelContext}) + Layer B ({session.prospectAvatar.executionResistance})
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Four Pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(analysis.valueScore)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <h3 className="font-semibold">Value</h3>
            </div>
            <span className={`text-2xl font-bold ${getScoreColor(analysis.valueScore)}`}>
              {analysis.valueScore}
            </span>
          </div>
          <div className="space-y-2">
            {valueDetails.strengths?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Strengths:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {valueDetails.strengths.slice(0, 2).map((s: string, i: number) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {valueDetails.weaknesses?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Areas to Improve:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {valueDetails.weaknesses.slice(0, 2).map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(analysis.trustScore)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h3 className="font-semibold">Trust</h3>
            </div>
            <span className={`text-2xl font-bold ${getScoreColor(analysis.trustScore)}`}>
              {analysis.trustScore}
            </span>
          </div>
          <div className="space-y-2">
            {trustDetails.strengths?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Strengths:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {trustDetails.strengths.slice(0, 2).map((s: string, i: number) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {trustDetails.weaknesses?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Areas to Improve:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {trustDetails.weaknesses.slice(0, 2).map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(analysis.fitScore)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <h3 className="font-semibold">Fit</h3>
            </div>
            <span className={`text-2xl font-bold ${getScoreColor(analysis.fitScore)}`}>
              {analysis.fitScore}
            </span>
          </div>
          <div className="space-y-2">
            {fitDetails.strengths?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Strengths:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {fitDetails.strengths.slice(0, 2).map((s: string, i: number) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {fitDetails.weaknesses?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Areas to Improve:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {fitDetails.weaknesses.slice(0, 2).map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(analysis.logisticsScore)}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <h3 className="font-semibold">Logistics</h3>
            </div>
            <span className={`text-2xl font-bold ${getScoreColor(analysis.logisticsScore)}`}>
              {analysis.logisticsScore}
            </span>
          </div>
          <div className="space-y-2">
            {logisticsDetails.strengths?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Strengths:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {logisticsDetails.strengths.slice(0, 2).map((s: string, i: number) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {logisticsDetails.weaknesses?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Areas to Improve:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {logisticsDetails.weaknesses.slice(0, 2).map((w: string, i: number) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Skill Scores Breakdown */}
      {Object.keys(skillScores).length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">10-Category Skill Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(skillScores as Record<string, Record<string, number> | number>).slice(0, 10).map(([category, scores]) => (
              <div key={category} className="border rounded-lg p-3">
                <h3 className="font-semibold mb-2 capitalize">{category.replace(/_/g, ' ')}</h3>
                {typeof scores === 'object' && scores !== null ? (
                  <div className="space-y-1">
                    {Object.entries(scores).slice(0, 3).map(([skill, score]) => (
                      <div key={skill} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{skill}</span>
                        <span className="font-medium">{score}/100</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Score: {scores}/100</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Coaching Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">3-5 Prioritized Fixes</h2>
          <div className="space-y-3">
            {recommendations.slice(0, 5).map((rec: { priority?: string; category?: string; timestamp?: number; issue?: string; explanation?: string; action?: string; transcriptSegment?: string }, i: number) => (
              <div
                key={i}
                className="border-l-4 border-primary pl-4 hover:bg-muted/50 rounded-r-lg p-2 transition-colors cursor-pointer"
                onClick={() => {
                  if (rec.timestamp) {
                    // Navigate to session page with timestamp to jump to that moment
                    router.push(`/dashboard/roleplay/${sessionId}?timestamp=${rec.timestamp}`);
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      rec.priority === 'high'
                        ? 'destructive'
                        : rec.priority === 'medium'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {rec.priority}
                  </Badge>
                  <span className="font-medium">{rec.category}</span>
                  {rec.timestamp && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {Math.floor(rec.timestamp / 1000 / 60)}:{(Math.floor(rec.timestamp / 1000) % 60).toString().padStart(2, '0')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-1">{rec.issue}</p>
                {rec.explanation && (
                  <p className="text-xs text-muted-foreground mb-1">{rec.explanation}</p>
                )}
                {rec.action && (
                  <p className="text-sm font-medium">{rec.action}</p>
                )}
                {rec.transcriptSegment && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
                    &quot;{rec.transcriptSegment}&quot;
                  </div>
                )}
                {rec.timestamp && (
                  <p className="text-xs text-primary mt-2">
                    Click to jump to this moment in the call
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Timestamped Feedback */}
      {parsedTimestampedFeedback.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">Moment-by-Moment Feedback</h2>
          <div className="space-y-3">
            {parsedTimestampedFeedback.slice(0, 10).map((feedback: { type?: string; pillar?: string; timestamp?: number; message?: string; transcriptSegment?: string }, i: number) => (
              <div
                key={i}
                className={`border-l-4 pl-4 p-2 rounded-r-lg transition-colors cursor-pointer hover:bg-muted/50 ${feedback.type === 'strength' ? 'border-green-500' :
                  feedback.type === 'weakness' ? 'border-red-500' :
                    feedback.type === 'opportunity' ? 'border-blue-500' :
                      'border-yellow-500'
                  }`}
                onClick={() => {
                  if (feedback.timestamp) {
                    router.push(`/dashboard/roleplay/${sessionId}?timestamp=${feedback.timestamp}`);
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      feedback.type === 'strength' ? 'default' :
                        feedback.type === 'weakness' ? 'destructive' :
                          feedback.type === 'opportunity' ? 'secondary' :
                            'outline'
                    }
                  >
                    {feedback.type}
                  </Badge>
                  {feedback.pillar && (
                    <Badge variant="outline">{feedback.pillar}</Badge>
                  )}
                  {feedback.timestamp && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {Math.floor(feedback.timestamp / 1000 / 60)}:{(Math.floor(feedback.timestamp / 1000) % 60).toString().padStart(2, '0')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium mb-1">{feedback.message}</p>
                {feedback.transcriptSegment && (
                  <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
                    &quot;{feedback.transcriptSegment}&quot;
                  </div>
                )}
                {feedback.timestamp && (
                  <p className="text-xs text-primary mt-2">
                    Click to jump to this moment • <Link href={`/dashboard/roleplay/new?offerId=${session?.prospectAvatar?.offerId ?? ''}&rerunFrom=${feedback.timestamp}`} className="underline">Rerun from here</Link>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/dashboard/roleplay/new">
          <Button>Start New Roleplay</Button>
        </Link>
        <Link href="/dashboard/roleplay">
          <Button variant="outline">Back to All Roleplays</Button>
        </Link>
      </div>
    </div>
  );
}
