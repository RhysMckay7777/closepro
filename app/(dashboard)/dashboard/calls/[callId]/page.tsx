'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, AlertCircle, ChevronDown, ChevronUp, Trash2, RefreshCw, Play } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import Link from 'next/link';
import { getCategoryLabel } from '@/lib/ai/scoring-framework';
import { CallSnapshotBar, ProspectDifficultyPanel, PhaseAnalysisTabs, ActionPointCards, SalesFiguresPanel, TranscriptView } from '@/components/call-review';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params?.callId as string;
  const [call, setCall] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [reanalyzing, setReanalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);

  useEffect(() => {
    if (!callId) return;

    const fetchCall = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch call');
        }

        const data = await response.json();

        // If call is pending confirmation, redirect to confirm page
        if (data.status === 'pending_confirmation') {
          router.replace(`/dashboard/calls/${callId}/confirm`);
          return;
        }

        setCall(data.call);
        setAnalysis(data.analysis);

        // If still processing, poll for updates
        if (data.status !== 'completed' && data.status !== 'failed') {
          const interval = setInterval(async () => {
            const statusResponse = await fetch(`/api/calls/${callId}/status`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              setCall(statusData.call);
              setAnalysis(statusData.analysis);

              if (statusData.status === 'completed' || statusData.status === 'failed') {
                clearInterval(interval);
              }
            }
          }, 5000); // Poll every 5 seconds

          return () => clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load call');
      } finally {
        setLoading(false);
      }
    };

    fetchCall();
  }, [callId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Completed</Badge>;
      case 'processing':
      case 'transcribing':
      case 'analyzing':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleReplayInRoleplay = async () => {
    setReplayLoading(true);
    try {
      const res = await fetch('/api/roleplay/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create replay session');
      }
      const data = await res.json();
      router.push(`/dashboard/roleplay/${data.sessionId}`);
    } catch (err: any) {
      toastError(err.message || 'Failed to start replay');
    } finally {
      setReplayLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading call...</p>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Call not found'}</AlertDescription>
        </Alert>
        <Link href="/dashboard/calls">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calls
          </Button>
        </Link>
      </div>
    );
  }

  const isProcessing = call.status === 'processing' || call.status === 'transcribing' || call.status === 'analyzing';
  const isV2 = analysis?.phaseScores && typeof analysis.phaseScores === 'object';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/calls">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Calls
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight">
              Call Analysis
            </h1>
            {getStatusBadge(call.status)}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {call.fileName}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive self-start mt-6"
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Call</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this call? This will also remove it from your figures and commission calculations.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/calls/${callId}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Failed to delete');
                    toastSuccess('Call deleted');
                    router.push('/dashboard/calls');
                  } catch {
                    toastError('Failed to delete call');
                    setDeleting(false);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="font-medium text-lg">Processing call...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {call.status === 'transcribing' && 'Transcribing audio...'}
                  {call.status === 'analyzing' && 'Analyzing call with AI...'}
                  {call.status === 'processing' && 'Processing your call...'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  This may take a few minutes. The page will update automatically when complete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed but analysis missing — offer re-analyse */}
      {call.status === 'completed' && !analysis && (
        <Card className="border border-amber-500/20 bg-linear-to-br from-amber-500/5 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <div>
                <p className="font-medium text-lg">Analysis not found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  The call was saved but the AI analysis is missing. This can happen if the analysis timed out or encountered an error.
                </p>
              </div>
              <Button
                onClick={async () => {
                  setReanalyzing(true);
                  try {
                    const res = await fetch(`/api/calls/${callId}/analyze`, { method: 'POST' });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || 'Failed to start re-analysis');
                    }
                    toastSuccess('Re-analysis started. This page will update automatically.');
                    // Start polling for completion
                    const interval = setInterval(async () => {
                      const statusRes = await fetch(`/api/calls/${callId}/status`);
                      if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        setCall(statusData.call);
                        setAnalysis(statusData.analysis);
                        if (statusData.status === 'completed' || statusData.status === 'failed') {
                          clearInterval(interval);
                          setReanalyzing(false);
                        }
                      }
                    }, 5000);
                  } catch (err: any) {
                    toastError(err.message || 'Failed to re-analyse');
                    setReanalyzing(false);
                  }
                }}
                disabled={reanalyzing}
              >
                {reanalyzing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Re-analysing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Re-analyse Call</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed State - Show 7-Section Analysis */}
      {call.status === 'completed' && analysis && (
        <div className="space-y-6">

          {/* ══════ SECTION 1: CALL OVERVIEW ══════ */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif text-xl">1. Call Overview</CardTitle>
              <CardDescription>Immediate context for this call</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Audio player */}
              {call.fileUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">Recording</p>
                  <audio controls className="w-full" preload="metadata">
                    <source src={call.fileUrl} type="audio/mpeg" />
                    <source src={call.fileUrl} type="audio/mp4" />
                    <source src={call.fileUrl} type="audio/webm" />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}

              {/* Transcript — structured with speaker labels & timestamps */}
              {(call.transcript || call.transcriptJson) && (
                <div>
                  <p className="text-sm font-medium mb-2">Transcript</p>
                  <TranscriptView
                    transcript={call.transcript}
                    transcriptJson={call.transcriptJson}
                  />
                </div>
              )}

              {/* Call metadata + difficulty snapshot */}
              <CallSnapshotBar
                callDate={call.callDate}
                offerName={call.offerName}
                prospectName={call.prospectName || analysis.prospectName}
                outcome={call.result || analysis.outcome?.result}
                prospectDifficultyTotal={analysis.prospectDifficulty}
                difficultyTier={analysis.prospectDifficultyTier}
                closerEffectiveness={analysis.closerEffectiveness}
                overallScore={analysis.overallScore ?? analysis.phaseScores?.overall ?? null}
              />
            </CardContent>
          </Card>

          {/* ══════ V2 SECTIONS (phase-based scoring) ══════ */}
          {isV2 && (
            <>
              <ProspectDifficultyPanel
                justifications={analysis.prospectDifficultyJustifications}
                sectionNumber={2}
              />
              <PhaseAnalysisTabs
                phaseScores={analysis.phaseScores}
                phaseAnalysis={analysis.phaseAnalysis}
                overallScore={analysis.overallScore ?? 0}
                callId={callId}
                sectionNumber={3}
              />
              <ActionPointCards
                actionPoints={analysis.actionPoints ?? []}
                callId={callId}
                sectionNumber={4}
              />
            </>
          )}

          {/* Replay in Roleplay */}
          {analysis?.prospectDifficultyJustifications && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardContent className="py-4">
                <Button
                  onClick={handleReplayInRoleplay}
                  disabled={replayLoading}
                  className="w-full"
                  variant="outline"
                >
                  {replayLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Replay This Call in Roleplay
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ══════ V1 SECTIONS (10-category scoring — backward compat) ══════ */}
          {!isV2 && (
            <>
              {/* ══════ SECTION 2: OUTCOME DIAGNOSTIC (V1) ══════ */}
              {analysis.outcomeDiagnostic && (
                <Card className="border border-amber-500/20 bg-linear-to-br from-amber-500/5 to-card/40 backdrop-blur-xl shadow-xl">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl">2. Outcome Diagnostic</CardTitle>
                    <CardDescription>Why this call ended the way it did</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed">{analysis.outcomeDiagnostic}</p>
                  </CardContent>
                </Card>
              )}

              {/* ══════ SECTION 3: SCORE BREAKDOWN (V1) ══════ */}
              <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">3. Score Breakdown</CardTitle>
                  <CardDescription>10 categories from the Sales Call Scoring Framework. Click to expand.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Overall score — single source of truth from DB */}
                  <div className="text-center py-4">
                    <div className="text-6xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                      {analysis.overallScore ?? 0}
                    </div>
                    <p className="text-muted-foreground mt-1">out of 100</p>
                  </div>

                  {/* 10 categories */}
                  <div className="space-y-1">
                    {(() => {
                      const CATEGORY_ORDER = ['authority', 'structure', 'communication', 'discovery', 'gap', 'value', 'trust', 'adaptation', 'objection_handling', 'closing'];
                      const rawScores = analysis.categoryScores && typeof analysis.categoryScores === 'object'
                        ? analysis.categoryScores
                        : (analysis.skillScores && typeof analysis.skillScores === 'object' && !Array.isArray(analysis.skillScores) ? analysis.skillScores : {});
                      const feedback = analysis.categoryFeedback && typeof analysis.categoryFeedback === 'object' ? analysis.categoryFeedback : {};

                      return CATEGORY_ORDER.map((catId) => {
                        const score = typeof rawScores[catId] === 'number' ? rawScores[catId] : (typeof rawScores[catId] === 'object' && rawScores[catId]?.score != null ? rawScores[catId].score : null);
                        if (score == null) return null;
                        const isExpanded = expandedCategories.has(catId);
                        const detail = feedback[catId] || (typeof rawScores[catId] === 'object' ? rawScores[catId] : null);
                        const scoreColor = score >= 8 ? 'text-emerald-400' : score >= 6 ? 'text-blue-400' : score >= 4 ? 'text-amber-400' : 'text-red-400';

                        return (
                          <div key={catId} className="rounded-lg border border-white/10 overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                              onClick={() => {
                                const next = new Set(expandedCategories);
                                next.has(catId) ? next.delete(catId) : next.add(catId);
                                setExpandedCategories(next);
                              }}
                            >
                              <span className="text-sm font-medium">{getCategoryLabel(catId)}</span>
                              <div className="flex items-center gap-3">
                                <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div className={`h-full rounded-full ${score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-blue-500' : score >= 4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${(score / 10) * 100}%` }} />
                                </div>
                                <span className={`text-sm font-bold w-8 text-right ${scoreColor}`}>{score}</span>
                                {detail ? (isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />) : <div className="w-4" />}
                              </div>
                            </button>
                            {isExpanded && detail && (
                              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/10">
                                {detail.whyThisScore && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Why This Score</p><p className="text-sm">{detail.whyThisScore}</p></div>}
                                {detail.whatWasDoneWell && <div><p className="text-xs font-semibold text-emerald-500 mb-1">What Was Done Well</p><p className="text-sm">{detail.whatWasDoneWell}</p></div>}
                                {detail.whatWasMissing && <div><p className="text-xs font-semibold text-amber-500 mb-1">What Was Missing</p><p className="text-sm">{detail.whatWasMissing}</p></div>}
                                {detail.howItAffectedOutcome && <div><p className="text-xs font-semibold text-blue-500 mb-1">How It Affected Outcome</p><p className="text-sm">{detail.howItAffectedOutcome}</p></div>}
                              </div>
                            )}
                          </div>
                        );
                      }).filter(Boolean);
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* ══════ SECTION 4: MOMENT-BY-MOMENT COACHING (V1) ══════ */}
              {Array.isArray(analysis.momentCoaching) && analysis.momentCoaching.length > 0 && (
                <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl">4. Moment-by-Moment Coaching</CardTitle>
                    <CardDescription>Specific moments where execution broke down or opportunities were missed</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.momentCoaching.map((moment: any, idx: number) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-lg border border-white/10 bg-white/5">
                          <div className="flex-shrink-0 w-16 text-center">
                            <span className="inline-block px-2 py-1 rounded bg-primary/20 text-primary text-xs font-mono font-bold">{moment.timestamp || '—'}</span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-red-400 mb-0.5">What Happened</p>
                              <p className="text-sm">{moment.whatHappened}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-emerald-400 mb-0.5">What Should Have Happened</p>
                              <p className="text-sm">{moment.whatShouldHaveHappened}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {moment.affectedCategory && <Badge variant="secondary" className="text-xs">{getCategoryLabel(moment.affectedCategory)}</Badge>}
                              {moment.whyItMatters && <p className="text-xs text-muted-foreground italic">{moment.whyItMatters}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ══════ SECTION 5: OBJECTION ANALYSIS (V1) ══════ */}
              <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">5. Objection Analysis</CardTitle>
                  <CardDescription>Diagnose resistance and improve objection prevention and handling</CardDescription>
                </CardHeader>
                <CardContent>
                  {analysis.objections && Array.isArray(analysis.objections) && analysis.objections.length > 0 ? (
                    <div className="space-y-4">
                      {analysis.objections.map((obj: any, i: number) => {
                        const pillarColors: Record<string, string> = {
                          value: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                          trust: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                          fit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                          logistics: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                        };
                        return (
                          <div key={i} className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium italic">&quot;{obj.objection}&quot;</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {obj.pillar && <Badge className={pillarColors[obj.pillar] || 'bg-gray-500/20 text-gray-400'}>{obj.pillar.charAt(0).toUpperCase() + obj.pillar.slice(1)}</Badge>}
                                {obj.handlingQuality != null && (
                                  <span className={`text-sm font-bold ${obj.handlingQuality >= 7 ? 'text-emerald-400' : obj.handlingQuality >= 4 ? 'text-amber-400' : 'text-red-400'}`}>{obj.handlingQuality}/10</span>
                                )}
                              </div>
                            </div>
                            {obj.rootCause && <div><p className="text-xs font-semibold text-muted-foreground mb-0.5">Root Cause</p><p className="text-sm">{obj.rootCause}</p></div>}
                            {obj.preventionOpportunity && <div><p className="text-xs font-semibold text-muted-foreground mb-0.5">Prevention Opportunity</p><p className="text-sm">{obj.preventionOpportunity}</p></div>}
                            {(obj.handling || obj.howRepHandled) && <div><p className="text-xs font-semibold text-muted-foreground mb-0.5">How Rep Handled</p><p className="text-sm">{obj.handling || obj.howRepHandled}</p></div>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No objections were raised during this call.</p>
                  )}
                </CardContent>
              </Card>

              {/* ══════ SECTION 6: PRIORITY FIXES (V1) ══════ */}
              {Array.isArray(analysis.priorityFixes) && analysis.priorityFixes.length > 0 && (
                <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                  <CardHeader>
                    <CardTitle className="font-serif text-xl">6. Priority Fixes</CardTitle>
                    <CardDescription>Actionable, behavioural, context-aware improvements — ordered by impact</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {analysis.priorityFixes.map((fix: any, idx: number) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-lg border border-white/10 bg-white/5">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">{idx + 1}</span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <div><p className="text-xs font-semibold text-red-400 mb-0.5">The Problem</p><p className="text-sm font-medium">{fix.problem}</p></div>
                            <div><p className="text-xs font-semibold text-emerald-400 mb-0.5">What To Do Differently</p><p className="text-sm">{fix.whatToDoDifferently}</p></div>
                            <div className="flex gap-6">
                              {fix.whenToApply && <div><p className="text-xs font-semibold text-blue-400 mb-0.5">When To Apply</p><p className="text-xs text-muted-foreground">{fix.whenToApply}</p></div>}
                              {fix.whyItMatters && <div><p className="text-xs font-semibold text-amber-400 mb-0.5">Why It Matters</p><p className="text-xs text-muted-foreground">{fix.whyItMatters}</p></div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

        </div>
      )}

      {/* ══════ SECTION: FIGURES OUTCOME ══════ */}
      {call.status === 'completed' && (
        <SalesFiguresPanel call={call} callId={callId} />
      )}

      {/* Failed State */}
      {call.status === 'failed' && (
        <Card className="border border-destructive/20 bg-linear-to-br from-destructive/5 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div>
                <p className="font-medium text-lg">Analysis Failed</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {(() => {
                    try {
                      const meta = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
                      if (meta?.failureReason) return meta.failureReason;
                    } catch {
                      // ignore invalid metadata
                    }
                    return 'Call processing failed. This can happen if the AI analysis timed out or there was an API error.';
                  })()}
                </p>
              </div>
              <Button
                onClick={async () => {
                  setReanalyzing(true);
                  try {
                    const res = await fetch(`/api/calls/${callId}/analyze`, { method: 'POST' });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      throw new Error(data.error || 'Failed to start re-analysis');
                    }
                    toastSuccess('Re-analysis started. This page will update automatically.');
                    const interval = setInterval(async () => {
                      const statusRes = await fetch(`/api/calls/${callId}/status`);
                      if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        setCall(statusData.call);
                        setAnalysis(statusData.analysis);
                        if (statusData.status === 'completed' || statusData.status === 'failed') {
                          clearInterval(interval);
                          setReanalyzing(false);
                        }
                      }
                    }, 5000);
                  } catch (err: any) {
                    toastError(err.message || 'Failed to re-analyse');
                    setReanalyzing(false);
                  }
                }}
                disabled={reanalyzing}
              >
                {reanalyzing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Re-analysing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Retry Analysis</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Catch-all for unexpected statuses — prevents blank page */}
      {!isProcessing && call.status !== 'completed' && call.status !== 'failed' && (
        <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="font-medium text-lg">Processing call...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Your call is being processed. This page will update automatically when analysis is complete.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Current status: {call.status || 'unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
