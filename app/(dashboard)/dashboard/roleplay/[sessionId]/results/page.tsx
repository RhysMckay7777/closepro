'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Target, Users, Package, AlertTriangle, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StageChips } from '@/components/roleplay/StageChips';
import { MomentFeedbackList } from '@/components/roleplay/MomentFeedbackList';
import { ObjectionAnalysis } from '@/components/roleplay/ObjectionAnalysis';
import { CategoryFeedbackSection } from '@/components/roleplay/CategoryFeedbackSection';
import { extractMomentFeedback } from '@/lib/roleplayApi';
import {
  parseStagesCompleted,
  parseCategoryFeedback,
  parsePriorityFixes,
  parseObjectionAnalysis,
  type StagesCompleted,
  type CategoryFeedback,
  type PriorityFix,
  type ObjectionAnalysisItem
} from '@/types/roleplay';

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
  // New fields from Section 6
  isIncomplete?: boolean;
  stagesCompleted?: string;
  categoryFeedback?: string;
  priorityFixes?: string;
  objectionAnalysis?: string;
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
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

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
        // Session completed but not scored yet — try to score once
        const scoreResponse = await fetch(`/api/roleplay/${sessionId}/score`, {
          method: 'POST',
        });
        const scoreData = await scoreResponse.json().catch(() => ({}));
        if (scoreResponse.ok) {
          const updatedResponse = await fetch(`/api/roleplay/${sessionId}`);
          const updatedData = await updatedResponse.json();
          setSession(updatedData.session);
          if (updatedData.analysis) setAnalysis(updatedData.analysis);
        } else {
          setScoringError(scoreData.error || 'Scoring failed');
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

  const handleRetryScoring = useCallback(async () => {
    setScoringError(null);
    setRetrying(true);
    try {
      const res = await fetch(`/api/roleplay/${sessionId}/score`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScoringError(data.error || 'Scoring failed');
        return;
      }
      const updated = await fetch(`/api/roleplay/${sessionId}`);
      const updatedData = await updated.json();
      if (updatedData.analysis) setAnalysis(updatedData.analysis);
    } finally {
      setRetrying(false);
    }
  }, [sessionId]);

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
      <div className="container mx-auto p-4 sm:p-6 max-w-lg">
        <Card className="p-8 sm:p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Analyzing your roleplay session…</h2>
            <p className="text-sm text-muted-foreground">This usually takes 10–20 seconds</p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-left mx-auto w-fit">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-foreground">Scoring performance…</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '1s' }} />
              <span className="text-muted-foreground">Generating feedback…</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: '2s' }} />
              <span className="text-muted-foreground">Building report…</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12 max-w-md mx-auto space-y-4">
          <p className="text-muted-foreground">No analysis available yet.</p>
          {scoringError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{scoringError}</p>
          )}
          <p className="text-sm text-muted-foreground">
            If scoring failed due to API credits, add credits in Plans & Billing or set GROQ_API_KEY in .env for a free-tier option.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={handleRetryScoring} disabled={retrying}>
              {retrying ? 'Scoring…' : 'Retry scoring'}
            </Button>
            <Link href={`/dashboard/roleplay/${sessionId}`}>
              <Button variant="outline">Back to Session</Button>
            </Link>
            <Link href="/dashboard/billing">
              <Button variant="outline">Plans & Billing</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Parse new Section 6 fields
  const stagesCompleted: StagesCompleted = parseStagesCompleted(analysis.stagesCompleted);
  const categoryFeedback: CategoryFeedback = parseCategoryFeedback(analysis.categoryFeedback);
  const priorityFixes: PriorityFix[] = parsePriorityFixes(analysis.priorityFixes);
  const objectionItems: ObjectionAnalysisItem[] = parseObjectionAnalysis(analysis.objectionAnalysis);
  const momentFeedback = extractMomentFeedback(analysis.timestampedFeedback);
  const isIncomplete = analysis.isIncomplete === true;

  // Safe parse helper - handles both string and already-parsed object responses
  const safeParse = (val: unknown, fallback: unknown = {}) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val; // Already parsed
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return fallback;
      }
    }
    return fallback;
  };

  const valueDetails = safeParse(analysis.valueDetails, {});
  const trustDetails = safeParse(analysis.trustDetails, {});
  const fitDetails = safeParse(analysis.fitDetails, {});
  const logisticsDetails = safeParse(analysis.logisticsDetails, {});
  const recommendations = safeParse(analysis.coachingRecommendations, []);
  // skillScores can be array (e.g. [{ category, subSkills }]) or object; normalize to list of { categoryName, skills: [name, score][] }
  const rawSkillScores = safeParse(analysis.skillScores, []);
  const skillScoresList: { categoryName: string; skills: [string, number][] }[] = Array.isArray(rawSkillScores)
    ? rawSkillScores.map((item: { category?: string; subSkills?: Record<string, number> }) => ({
      categoryName: item.category ?? 'Category',
      skills: Object.entries(item.subSkills ?? {}),
    }))
    : typeof rawSkillScores === 'object' && rawSkillScores !== null
      ? Object.entries(rawSkillScores).map(([categoryName, val]) => {
        const skills =
          typeof val === 'object' && val !== null && !Array.isArray(val)
            ? (Object.entries(val as Record<string, number>).filter(
              (entry) => typeof entry[1] === 'number'
            ) as [string, number][])
            : [];
        return { categoryName, skills };
      })
      : [];

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

      {/* Incomplete Warning Banner - Section 6.5 */}
      {isIncomplete && (
        <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-orange-700">Roleplay Incomplete</p>
            <p className="text-sm text-orange-600">
              This roleplay ended before a full sales conversation was completed.
              Score is partial and not comparable to full-call scores.
            </p>
          </div>
        </div>
      )}

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

      {/* Stage Chips - Section 6.5 */}
      {Object.keys(stagesCompleted).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Conversation Stages</h3>
          <StageChips stagesCompleted={stagesCompleted} />
        </Card>
      )}

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
          <div className="flex items-center gap-3">
            <div className={`text-5xl sm:text-6xl font-bold ${getScoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}
            </div>
            {isIncomplete && (
              <Badge variant="outline" className="bg-orange-500/20 text-orange-700 border-orange-500/50">
                Partial
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Priority Fixes - Section 6.6 */}
      {priorityFixes.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Priority Fixes
          </h2>
          <div className="space-y-4">
            {priorityFixes.map((fix, index) => (
              <div key={index} className="border-l-4 border-primary pl-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={fix.priority === 1 ? 'destructive' : fix.priority === 2 ? 'default' : 'secondary'}>
                    Priority #{fix.priority}
                  </Badge>
                  <span className="font-medium">{fix.category}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-red-600">What went wrong: </span>
                    <span>{fix.whatWentWrong}</span>
                  </div>
                  <div>
                    <span className="font-medium text-orange-600">Why it mattered: </span>
                    <span>{fix.whyItMattered}</span>
                  </div>
                  <div>
                    <span className="font-medium text-green-600">What to do differently: </span>
                    <span>{fix.whatToDoDifferently}</span>
                  </div>
                  {fix.transcriptSegment && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
                      &quot;{fix.transcriptSegment}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Category Feedback - Section 6.6/6.7 */}
      {Object.keys(categoryFeedback).length > 0 && (
        <CategoryFeedbackSection categoryFeedback={categoryFeedback} />
      )}

      {/* Objection Analysis - Section 6.9 */}
      {objectionItems.length > 0 && (
        <ObjectionAnalysis items={objectionItems} />
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
      {skillScoresList.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4">10-Category Skill Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillScoresList.slice(0, 10).map(({ categoryName, skills }, idx) => (
              <div key={idx} className="border rounded-lg p-3">
                <h3 className="font-semibold mb-2 capitalize">{categoryName.replace(/_/g, ' ')}</h3>
                <div className="space-y-1">
                  {skills.slice(0, 5).map(([skill, score]) => (
                    <div key={skill} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{skill}</span>
                      <span className="font-medium">{typeof score === 'number' ? `${score}/100` : '—'}</span>
                    </div>
                  ))}
                </div>
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

      {/* Moment-by-Moment Feedback with Re-Practice - Section 6.8 */}
      {momentFeedback.length > 0 && (
        <MomentFeedbackList sessionId={sessionId} items={momentFeedback} />
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
