'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, AlertTriangle, Wrench } from 'lucide-react';
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
  skillScores: string;
  coachingRecommendations: string;
  timestampedFeedback: string;
  // Fields from Section 6
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const scoringTriggeredRef = useRef(false);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Check if analysis is ready (just fetch session data, no scoring)
  const checkForAnalysis = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/api/roleplay/${sessionId}`);
      const data = await response.json();
      setSession({
        ...data.session,
        prospectAvatar: data.prospectAvatar || null,
      });

      if (data.analysis) {
        setAnalysis(data.analysis);
        setLoading(false);
        stopPolling();
        return true; // Analysis is ready
      }
      return false; // Still waiting
    } catch (error) {
      console.error('Error checking for analysis:', error);
      return false;
    }
  }, [sessionId, stopPolling]);

  // Trigger scoring (fire and forget — don't await)
  const triggerScoring = useCallback(async () => {
    if (scoringTriggeredRef.current) return;
    scoringTriggeredRef.current = true;

    try {
      const scoreResponse = await fetch(`/api/roleplay/${sessionId}/score`, { method: 'POST' });
      if (!scoreResponse.ok) {
        const scoreData = await scoreResponse.json().catch(() => ({}));
        setScoringError(scoreData.error || 'Scoring failed');
        setLoading(false);
        stopPolling();
      }
      // On success, polling will pick up the analysis
    } catch (err) {
      console.error('Error triggering scoring:', err);
      setScoringError('Scoring request failed. Please retry.');
      setLoading(false);
      stopPolling();
    }
  }, [sessionId, stopPolling]);

  const fetchResults = useCallback(async () => {
    // First check: does the analysis already exist?
    const hasAnalysis = await checkForAnalysis();
    if (hasAnalysis) return;

    // No analysis yet — trigger scoring in background and start polling
    triggerScoring(); // Fire and forget

    // Poll every 3 seconds to check if analysis is ready
    pollingRef.current = setInterval(async () => {
      const ready = await checkForAnalysis();
      if (ready) {
        stopPolling();
      }
    }, 3000);

    // Safety: stop polling after 90 seconds
    setTimeout(() => {
      if (pollingRef.current) {
        stopPolling();
        if (!analysis) {
          setScoringError('Analysis is taking longer than expected. Please try again.');
          setLoading(false);
        }
      }
    }, 90000);
  }, [sessionId, checkForAnalysis, triggerScoring, stopPolling, analysis]);

  useEffect(() => {
    fetchResults();
    return () => stopPolling();
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


  const recommendations = safeParse(analysis.coachingRecommendations, []);

  // Extract flat category scores from skillScores (can be array or object)
  const rawSkillScores = safeParse(analysis.skillScores, {});
  const flatCategoryScores: Record<string, number> = {};
  if (Array.isArray(rawSkillScores)) {
    // Array format: [{ category: "Authority", subSkills: { authority: 7 } }]
    for (const item of rawSkillScores) {
      if (item.subSkills && typeof item.subSkills === 'object') {
        for (const [key, val] of Object.entries(item.subSkills)) {
          if (typeof val === 'number') flatCategoryScores[key] = val;
        }
      }
    }
  } else if (typeof rawSkillScores === 'object' && rawSkillScores !== null) {
    // Object format: { authority: 7, discovery: 5 } or { authority: { score: 7 } }
    for (const [key, val] of Object.entries(rawSkillScores)) {
      if (typeof val === 'number') {
        flatCategoryScores[key] = val;
      } else if (typeof val === 'object' && val !== null && typeof (val as any).score === 'number') {
        flatCategoryScores[key] = (val as any).score;
      }
    }
  }

  // If categoryFeedback is empty but we have scores, build minimal entries so the accordion still renders
  const effectiveCategoryFeedback: CategoryFeedback =
    Object.keys(categoryFeedback).length > 0
      ? categoryFeedback
      : Object.fromEntries(
          Object.keys(flatCategoryScores).map(key => [key, { good: '', missing: '', next: '' }])
        );



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

      {/* Category Feedback Accordion - Section 6.6/6.7 */}
      {Object.keys(effectiveCategoryFeedback).length > 0 && (
        <CategoryFeedbackSection categoryFeedback={effectiveCategoryFeedback} categoryScores={flatCategoryScores} />
      )}

      {/* Objection Analysis - Section 6.9 */}
      {objectionItems.length > 0 && (
        <ObjectionAnalysis items={objectionItems} />
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
