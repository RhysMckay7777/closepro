'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  RotateCw,
  Wrench,
  Star,
  MessageSquareQuote,
  Target,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { StageChips } from '@/components/roleplay/StageChips';
import { MomentFeedbackList } from '@/components/roleplay/MomentFeedbackList';
import { ObjectionAnalysis } from '@/components/roleplay/ObjectionAnalysis';
import { CategoryFeedbackSection } from '@/components/roleplay/CategoryFeedbackSection';
import { extractMomentFeedback } from '@/lib/roleplayApi';
import { ProspectDifficultyPanel, PhaseAnalysisTabs, ActionPointCards } from '@/components/call-review';
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
  // V2 fields (phase-based scoring) — available once backend persists them
  phaseScores?: string;
  phaseAnalysis?: string;
  outcomeDiagnosticP1?: string;
  outcomeDiagnosticP2?: string;
  closerEffectiveness?: string;
  prospectDifficultyJustifications?: string;
  actionPoints?: string;
  roleplayFeedback?: string;
}

interface Session {
  id: string;
  offerName?: string;
  overallScore: number | null;
  actualDifficultyTier: string | null;
  replayPhase?: string | null;
  replaySourceCallId?: string | null;
  replaySourceSessionId?: string | null;
  offerId?: string | null;
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

  // Replay comparison: fetch original phase score for comparison banner
  const isReplay = !!(session?.replayPhase);
  const [originalPhaseScore, setOriginalPhaseScore] = useState<number | null>(null);

  useEffect(() => {
    if (!isReplay || !session) return;
    const fetchOriginalScore = async () => {
      try {
        if (session.replaySourceCallId) {
          const res = await fetch(`/api/calls/${session.replaySourceCallId}/status`);
          const data = await res.json();
          const phaseScores = data?.analysis?.phaseScores;
          if (phaseScores) {
            const parsed = typeof phaseScores === 'string' ? JSON.parse(phaseScores) : phaseScores;
            const phase = session.replayPhase === 'skill' ? 'overall' : session.replayPhase!;
            if (parsed[phase] !== undefined) setOriginalPhaseScore(parsed[phase]);
          }
        } else if (session.replaySourceSessionId) {
          const res = await fetch(`/api/roleplay/${session.replaySourceSessionId}`);
          const data = await res.json();
          const phaseScores = data?.analysis?.phaseScores;
          if (phaseScores) {
            const parsed = typeof phaseScores === 'string' ? JSON.parse(phaseScores) : phaseScores;
            const phase = session.replayPhase === 'skill' ? 'overall' : session.replayPhase!;
            if (parsed[phase] !== undefined) setOriginalPhaseScore(parsed[phase]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch original score for comparison:', err);
      }
    };
    fetchOriginalScore();
  }, [isReplay, session]);

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

  // V2 detection — phase-based scoring
  const v2PhaseScores = safeParse(analysis.phaseScores, null) as Record<string, number> | null;
  const isV2 = v2PhaseScores !== null && typeof v2PhaseScores === 'object';
  const v2PhaseAnalysis = isV2 ? (safeParse(analysis.phaseAnalysis, {}) as any) : null;
  const v2ActionPoints = isV2 ? (safeParse(analysis.actionPoints, []) as any[]) : [];
  const v2Justifications = isV2 ? (safeParse(analysis.prospectDifficultyJustifications, {}) as Record<string, string>) : {};

  // Roleplay Feedback (5 dimensions: pre_set, authority, objection_handling, close_attempt, overall)
  const roleplayFeedbackData = safeParse(analysis.roleplayFeedback, null) as {
    dimensions?: Record<string, { score: number; feedback: string }>;
    authorityLevelUsed?: string;
    whatWorked?: string[];
    whatDidntWork?: string[];
    keyImprovement?: string;
    transcriptMoment?: { quote: string; whatTheyShoulHaveSaid?: string; whatTheyShouldHaveSaid?: string };
  } | null;

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

      {/* Replay Comparison Banner */}
      {isReplay && analysis && (
        (() => {
          const phaseLabels: Record<string, string> = {
            intro: 'Introduction',
            discovery: 'Discovery',
            pitch: 'Pitch / Presentation',
            close: 'Closing',
            objection: 'Objection Handling',
            skill: 'Skill Practice',
          };
          const phaseName = phaseLabels[session?.replayPhase || ''] || session?.replayPhase || 'Phase';
          const practiceScore = v2PhaseScores
            ? (session?.replayPhase === 'skill' ? v2PhaseScores.overall : v2PhaseScores[session?.replayPhase || ''])
            : analysis.overallScore;
          const improved = originalPhaseScore !== null && practiceScore !== undefined && practiceScore > originalPhaseScore;
          const diff = originalPhaseScore !== null && practiceScore !== undefined ? practiceScore - originalPhaseScore : null;
          const sourceUrl = session?.replaySourceCallId
            ? `/dashboard/calls/${session.replaySourceCallId}`
            : session?.replaySourceSessionId
              ? `/dashboard/roleplay/${session.replaySourceSessionId}/results`
              : null;
          const practiceAgainUrl = session?.replaySourceCallId
            ? `/dashboard/roleplay?phase=${session.replayPhase}&callId=${session.replaySourceCallId}`
            : session?.replaySourceSessionId
              ? `/dashboard/roleplay?phase=${session.replayPhase}&sessionId=${session.replaySourceSessionId}`
              : '/dashboard/roleplay/new';

          return (
            <Card className="p-4 border-l-4 border-primary">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base">Phase Practice: {phaseName}</h3>
                  {originalPhaseScore !== null && practiceScore !== undefined && (
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <span className="text-muted-foreground">Original: <strong>{originalPhaseScore}</strong>/100</span>
                      <ArrowRight className={`h-4 w-4 ${improved ? 'text-green-500' : diff === 0 ? 'text-muted-foreground' : 'text-orange-500'}`} />
                      <span className={improved ? 'text-green-600 font-semibold' : diff === 0 ? 'text-muted-foreground font-semibold' : 'text-orange-600 font-semibold'}>
                        Practice: <strong>{practiceScore}</strong>/100
                      </span>
                      {diff !== null && diff !== 0 && (
                        <Badge variant={improved ? 'default' : 'secondary'} className={improved ? 'bg-green-100 text-green-700 border-green-300' : 'bg-orange-100 text-orange-700 border-orange-300'}>
                          {diff > 0 ? '+' : ''}{diff}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Link href={practiceAgainUrl}>
                    <Button size="sm" variant="outline" className="gap-1">
                      <RotateCw className="h-3.5 w-3.5" />
                      Practice Again
                    </Button>
                  </Link>
                  {sourceUrl && (
                    <Link href={sourceUrl}>
                      <Button size="sm" variant="ghost">Back to Original</Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          );
        })()
      )}

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

      {/* ══════ V2 SECTIONS (phase-based scoring) ══════ */}
      {isV2 ? (
        <>
          {/* Overall Score */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold mb-2">Overall Score</h2>
                <p className="text-base text-muted-foreground">Your performance in this roleplay</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`text-5xl sm:text-6xl font-bold ${getScoreColor(v2PhaseScores?.overall ?? analysis.overallScore)}`}>
                  {v2PhaseScores?.overall ?? analysis.overallScore}
                </div>
                {isIncomplete && (
                  <Badge variant="outline" className="bg-orange-500/20 text-orange-700 border-orange-500/50">
                    Partial
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <ProspectDifficultyPanel
            justifications={v2Justifications}
            sectionNumber={2}
          />
          <PhaseAnalysisTabs
            phaseScores={v2PhaseScores!}
            phaseAnalysis={v2PhaseAnalysis}
            overallScore={analysis.overallScore}
            sessionId={sessionId}
            sectionNumber={3}
            defaultTab={isReplay && session?.replayPhase && session.replayPhase !== 'skill' ? session.replayPhase : undefined}
          />
          <ActionPointCards
            actionPoints={v2ActionPoints}
            sessionId={sessionId}
            sectionNumber={4}
          />

          {/* Roleplay Coaching Feedback — 5 Dimensions */}
          {roleplayFeedbackData && roleplayFeedbackData.dimensions && (
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Roleplay Coaching Feedback
              </h2>

              {/* Authority Level Badge */}
              {roleplayFeedbackData.authorityLevelUsed && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Authority Level Used</p>
                  <p className="text-sm">{roleplayFeedbackData.authorityLevelUsed}</p>
                </div>
              )}

              {/* 5 Dimension Scores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                {(['pre_set', 'authority', 'objection_handling', 'close_attempt', 'overall'] as const).map((dim) => {
                  const d = roleplayFeedbackData.dimensions?.[dim];
                  if (!d) return null;
                  const labels: Record<string, string> = { pre_set: 'Pre-Set', authority: 'Authority', objection_handling: 'Objection Handling', close_attempt: 'Close Attempt', overall: 'Overall' };
                  const scoreColor = d.score >= 8 ? 'text-green-500' : d.score >= 5 ? 'text-blue-500' : d.score >= 3 ? 'text-orange-500' : 'text-red-500';
                  const barColor = d.score >= 8 ? 'bg-green-500' : d.score >= 5 ? 'bg-blue-500' : d.score >= 3 ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div key={dim} className="p-3 rounded-lg border bg-card">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{labels[dim]}</p>
                      <p className={`text-2xl font-bold ${scoreColor}`}>{d.score}<span className="text-sm text-muted-foreground">/10</span></p>
                      <div className="w-full h-1.5 rounded-full bg-muted mt-2">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${d.score * 10}%` }} />
                      </div>
                      {d.feedback && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{d.feedback}</p>}
                    </div>
                  );
                })}
              </div>

              {/* What Worked / Didn't Work */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {roleplayFeedbackData.whatWorked && roleplayFeedbackData.whatWorked.length > 0 && (
                  <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-green-700">
                      <ThumbsUp className="h-4 w-4" /> What Worked
                    </h3>
                    <ul className="space-y-1.5">
                      {roleplayFeedbackData.whatWorked.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-green-500 flex-shrink-0">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {roleplayFeedbackData.whatDidntWork && roleplayFeedbackData.whatDidntWork.length > 0 && (
                  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-700">
                      <ThumbsDown className="h-4 w-4" /> What Didn&apos;t Work
                    </h3>
                    <ul className="space-y-1.5">
                      {roleplayFeedbackData.whatDidntWork.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-red-500 flex-shrink-0">✗</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Key Improvement Area */}
              {roleplayFeedbackData.keyImprovement && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5 text-amber-700">
                    <Target className="h-4 w-4" /> Key Improvement Area
                  </h3>
                  <p className="text-sm">{roleplayFeedbackData.keyImprovement}</p>
                </div>
              )}

              {/* Specific Transcript Moment */}
              {roleplayFeedbackData.transcriptMoment && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquareQuote className="h-4 w-4" /> Specific Transcript Moment
                  </h3>
                  <div className="space-y-2">
                    <div className="p-2 bg-muted rounded text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">What was said:</p>
                      <p className="italic">&ldquo;{roleplayFeedbackData.transcriptMoment.quote}&rdquo;</p>
                    </div>
                    {(roleplayFeedbackData.transcriptMoment.whatTheyShoulHaveSaid || roleplayFeedbackData.transcriptMoment.whatTheyShouldHaveSaid) && (
                      <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-sm">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> What they should have said:
                        </p>
                        <p className="italic text-green-800">&ldquo;{roleplayFeedbackData.transcriptMoment.whatTheyShoulHaveSaid || roleplayFeedbackData.transcriptMoment.whatTheyShouldHaveSaid}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      ) : (
        <>
          {/* ══════ V1 SECTIONS (10-category scoring) ══════ */}

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
                <h2 className="text-xl sm:text-2xl font-semibold mb-2">Overall Score</h2>
                <p className="text-base text-muted-foreground">Your performance in this roleplay</p>
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4">
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
              <h2 className="text-xl sm:text-2xl font-semibold mb-4">3-5 Prioritized Fixes</h2>
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec: { priority?: string; category?: string; timestamp?: number; issue?: string; explanation?: string; action?: string; transcriptSegment?: string }, i: number) => (
                  <div
                    key={i}
                    className="border-l-4 border-primary pl-4 hover:bg-muted/50 rounded-r-lg p-2 transition-colors cursor-pointer"
                    onClick={() => {
                      if (rec.timestamp) {
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

          {/* Roleplay Coaching Feedback (V1 fallback path) */}
          {roleplayFeedbackData && roleplayFeedbackData.dimensions && (
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Roleplay Coaching Feedback
              </h2>

              {roleplayFeedbackData.authorityLevelUsed && (
                <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Authority Level Used</p>
                  <p className="text-sm">{roleplayFeedbackData.authorityLevelUsed}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                {(['pre_set', 'authority', 'objection_handling', 'close_attempt', 'overall'] as const).map((dim) => {
                  const d = roleplayFeedbackData.dimensions?.[dim];
                  if (!d) return null;
                  const labels: Record<string, string> = { pre_set: 'Pre-Set', authority: 'Authority', objection_handling: 'Objection Handling', close_attempt: 'Close Attempt', overall: 'Overall' };
                  const scoreColor = d.score >= 8 ? 'text-green-500' : d.score >= 5 ? 'text-blue-500' : d.score >= 3 ? 'text-orange-500' : 'text-red-500';
                  const barColor = d.score >= 8 ? 'bg-green-500' : d.score >= 5 ? 'bg-blue-500' : d.score >= 3 ? 'bg-orange-500' : 'bg-red-500';
                  return (
                    <div key={dim} className="p-3 rounded-lg border bg-card">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{labels[dim]}</p>
                      <p className={`text-2xl font-bold ${scoreColor}`}>{d.score}<span className="text-sm text-muted-foreground">/10</span></p>
                      <div className="w-full h-1.5 rounded-full bg-muted mt-2">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${d.score * 10}%` }} />
                      </div>
                      {d.feedback && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{d.feedback}</p>}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {roleplayFeedbackData.whatWorked && roleplayFeedbackData.whatWorked.length > 0 && (
                  <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-green-700">
                      <ThumbsUp className="h-4 w-4" /> What Worked
                    </h3>
                    <ul className="space-y-1.5">
                      {roleplayFeedbackData.whatWorked.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-green-500 flex-shrink-0">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {roleplayFeedbackData.whatDidntWork && roleplayFeedbackData.whatDidntWork.length > 0 && (
                  <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-700">
                      <ThumbsDown className="h-4 w-4" /> What Didn&apos;t Work
                    </h3>
                    <ul className="space-y-1.5">
                      {roleplayFeedbackData.whatDidntWork.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-red-500 flex-shrink-0">✗</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {roleplayFeedbackData.keyImprovement && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 mb-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-1.5 text-amber-700">
                    <Target className="h-4 w-4" /> Key Improvement Area
                  </h3>
                  <p className="text-sm">{roleplayFeedbackData.keyImprovement}</p>
                </div>
              )}

              {roleplayFeedbackData.transcriptMoment && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <MessageSquareQuote className="h-4 w-4" /> Specific Transcript Moment
                  </h3>
                  <div className="space-y-2">
                    <div className="p-2 bg-muted rounded text-sm">
                      <p className="text-xs font-medium text-muted-foreground mb-1">What was said:</p>
                      <p className="italic">&ldquo;{roleplayFeedbackData.transcriptMoment.quote}&rdquo;</p>
                    </div>
                    {(roleplayFeedbackData.transcriptMoment.whatTheyShoulHaveSaid || roleplayFeedbackData.transcriptMoment.whatTheyShouldHaveSaid) && (
                      <div className="p-2 bg-green-500/10 border border-green-500/20 rounded text-sm">
                        <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> What they should have said:
                        </p>
                        <p className="italic text-green-800">&ldquo;{roleplayFeedbackData.transcriptMoment.whatTheyShoulHaveSaid || roleplayFeedbackData.transcriptMoment.whatTheyShouldHaveSaid}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
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
