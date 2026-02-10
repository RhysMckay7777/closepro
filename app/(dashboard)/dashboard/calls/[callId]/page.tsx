'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileAudio, Clock, DollarSign, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toastError, toastSuccess } from '@/lib/toast';
import { SALES_CATEGORIES, getCategoryLabel } from '@/lib/ai/scoring-framework';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callId = params?.callId as string;
  const openOutcome = searchParams?.get('openOutcome') === '1';
  const [call, setCall] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offers, setOffers] = useState<Array<{ id: string; name: string }>>([]);
  const [editingOutcome, setEditingOutcome] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [editCallDate, setEditCallDate] = useState('');
  const [editOfferId, setEditOfferId] = useState('');
  const [editProspectName, setEditProspectName] = useState('');
  const [editCallType, setEditCallType] = useState<string>('closing_call');
  const [editResult, setEditResult] = useState<string>('');
  const [editQualified, setEditQualified] = useState(false);
  const [editCash, setEditCash] = useState('');
  const [editRevenue, setEditRevenue] = useState('');
  const [editCommissionRatePct, setEditCommissionRatePct] = useState('');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    if (!callId) return;

    const fetchCall = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch call');
        }

        const data = await response.json();
        setCall(data.call);
        setAnalysis(data.analysis);
        if (openOutcome && data.call) {
          const c = data.call;
          const d = c?.callDate ? new Date(c.callDate) : new Date();
          setEditCallDate(isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10));
          setEditOfferId(c?.offerId ?? '');
          setEditProspectName(c?.prospectName ?? '');
          setEditCallType(c?.callType === 'follow_up' ? 'follow_up' : 'closing_call');
          setEditResult(c?.result ?? '');
          setEditQualified(c?.result === 'unqualified' ? false : (c?.qualified !== false));
          setEditCash(c?.cashCollected != null ? String((c.cashCollected / 100).toFixed(2)) : '');
          setEditRevenue(c?.revenueGenerated != null ? String((c.revenueGenerated / 100).toFixed(2)) : '');
          setEditCommissionRatePct(c?.commissionRatePct != null ? String(c.commissionRatePct) : '');
          setEditReason(c?.reasonForOutcome ?? '');
          setEditingOutcome(true);
          // Fetch offers for the dropdown
          try {
            const offersRes = await fetch('/api/offers');
            if (offersRes.ok) {
              const offersData = await offersRes.json();
              setOffers(offersData.offers || []);
            }
          } catch { /* ignore */ }
        } else {
          setEditingOutcome(false);
        }

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

  const refetchCall = async () => {
    if (!callId) return;
    try {
      const res = await fetch(`/api/calls/${callId}/status`);
      if (res.ok) {
        const data = await res.json();
        setCall(data.call);
        setAnalysis(data.analysis);
      }
    } catch {
      // ignore
    }
  };

  const openOutcomeEdit = async () => {
    const d = call?.callDate ? new Date(call.callDate) : new Date();
    setEditCallDate(isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10));
    setEditOfferId(call?.offerId ?? '');
    setEditProspectName(call?.prospectName ?? '');
    setEditCallType(call?.callType === 'follow_up' ? 'follow_up' : 'closing_call');
    setEditResult(call?.result ?? '');
    setEditQualified(call?.qualified === true);
    setEditCash(call?.cashCollected != null ? String((call.cashCollected / 100).toFixed(2)) : '');
    setEditRevenue(call?.revenueGenerated != null ? String((call.revenueGenerated / 100).toFixed(2)) : '');
    setEditCommissionRatePct(call?.commissionRatePct != null ? String(call.commissionRatePct) : '');
    setEditReason(call?.reasonForOutcome ?? '');
    setEditingOutcome(true);
    // Fetch offers for the dropdown
    if (offers.length === 0) {
      try {
        const res = await fetch('/api/offers');
        if (res.ok) {
          const data = await res.json();
          setOffers(data.offers || []);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleSaveOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashDollars = parseFloat(editCash) || 0;
    const revenueDollars = parseFloat(editRevenue) || 0;
    setSavingOutcome(true);
    try {
      const body: Record<string, unknown> = {
        ...(editResult && VALID_RESULTS.includes(editResult as (typeof VALID_RESULTS)[number]) && { result: editResult }),
        qualified: editQualified,
        cashCollected: Math.round(cashDollars * 100),
        revenueGenerated: Math.round(revenueDollars * 100),
        ...(editReason.trim() && { reasonForOutcome: editReason.trim() }),
      };
      if (editCallDate) body.callDate = editCallDate;
      if (editOfferId) body.offerId = editOfferId;
      if (editProspectName !== undefined) body.prospectName = editProspectName.trim() || null;
      if (editCallType) body.callType = editCallType;
      if (editCommissionRatePct !== '') {
        const pct = parseFloat(editCommissionRatePct);
        if (!isNaN(pct) && pct >= 0 && pct <= 100) body.commissionRatePct = pct;
      }
      const res = await fetch(`/api/calls/${callId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update outcome');
      }
      toastSuccess('Outcome saved. Figures will update.');
      await refetchCall();
      setEditingOutcome(false);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to save outcome');
    } finally {
      setSavingOutcome(false);
    }
  };

  const VALID_RESULTS = ['no_show', 'closed', 'lost', 'deposit', 'follow_up', 'unqualified'] as const;

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

      {/* Completed State - Show 7-Section Analysis */}
      {call.status === 'completed' && analysis && (
        <div className="space-y-6">

          {/* ══════ SECTION 1: CALL OVERVIEW ══════ */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif">1. Call Overview</CardTitle>
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

              {/* Transcript */}
              {call.transcript && (
                <div>
                  <p className="text-sm font-medium mb-2">Transcript</p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {call.transcript}
                  </div>
                </div>
              )}

              {/* Call metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {call.callDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">Call Date</p>
                    <p className="text-sm font-medium">{new Date(call.callDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Offer</p>
                  <p className="text-sm font-medium">{call.offerName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prospect</p>
                  <p className="text-sm font-medium">{call.prospectName || analysis.prospectName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Result</p>
                  {(() => {
                    const result = call.result || analysis.outcome?.result || '—';
                    const colors: Record<string, string> = {
                      closed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                      lost: 'bg-red-500/20 text-red-400 border-red-500/30',
                      follow_up: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                      deposit: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      unqualified: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                      no_show: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                    };
                    const label = result === 'follow_up' ? 'Follow-up' : result === 'no_show' ? 'No Show' : (result.charAt(0).toUpperCase() + result.slice(1));
                    return <Badge className={colors[result] || 'bg-gray-500/20 text-gray-400'}>{label}</Badge>;
                  })()}
                </div>
              </div>

              {/* Prospect Difficulty */}
              {(analysis.prospectDifficulty || analysis.prospectDifficultyTier) && (
                <div className="flex items-center gap-4 p-3 rounded-lg border border-white/10 bg-white/5">
                  <div>
                    <p className="text-xs text-muted-foreground">Prospect Difficulty</p>
                    <p className="text-lg font-bold">{analysis.prospectDifficulty ?? '—'} <span className="text-sm font-normal text-muted-foreground">/ 50</span></p>
                  </div>
                  {analysis.prospectDifficultyTier && (
                    <Badge className={{
                      easy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                      realistic: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                      hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                      expert: 'bg-red-500/20 text-red-400 border-red-500/30',
                      elite: 'bg-red-500/20 text-red-400 border-red-500/30',
                    }[analysis.prospectDifficultyTier] || 'bg-gray-500/20 text-gray-400'}>
                      {(analysis.prospectDifficultyTier === 'elite' ? 'Expert' : analysis.prospectDifficultyTier.charAt(0).toUpperCase() + analysis.prospectDifficultyTier.slice(1))}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ SECTION 2: OUTCOME DIAGNOSTIC ══════ */}
          {analysis.outcomeDiagnostic && (
            <Card className="border border-amber-500/20 bg-linear-to-br from-amber-500/5 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">2. Outcome Diagnostic</CardTitle>
                <CardDescription>Why this call ended the way it did</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{analysis.outcomeDiagnostic}</p>
              </CardContent>
            </Card>
          )}

          {/* ══════ SECTION 3: SCORE BREAKDOWN ══════ */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif">3. Score Breakdown</CardTitle>
              <CardDescription>10 categories from the Sales Call Scoring Framework. Click to expand.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall score — always calculated from the 10 category scores */}
              {(() => {
                const CATEGORY_ORDER = ['authority', 'structure', 'communication', 'discovery', 'gap', 'value', 'trust', 'adaptation', 'objection_handling', 'closing'];
                const rawScores = analysis.categoryScores && typeof analysis.categoryScores === 'object'
                  ? analysis.categoryScores
                  : (analysis.skillScores && typeof analysis.skillScores === 'object' && !Array.isArray(analysis.skillScores) ? analysis.skillScores : {});
                const calculatedOverall = CATEGORY_ORDER.reduce((sum, catId) => {
                  const s = typeof rawScores[catId] === 'number' ? rawScores[catId] : (typeof rawScores[catId] === 'object' && rawScores[catId]?.score != null ? rawScores[catId].score : 0);
                  return sum + s;
                }, 0);
                return (
                  <div className="text-center py-4">
                    <div className="text-6xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                      {calculatedOverall}
                    </div>
                    <p className="text-muted-foreground mt-1">out of 100</p>
                  </div>
                );
              })()}

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

          {/* ══════ SECTION 4: MOMENT-BY-MOMENT COACHING ══════ */}
          {Array.isArray(analysis.momentCoaching) && analysis.momentCoaching.length > 0 && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">4. Moment-by-Moment Coaching</CardTitle>
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

          {/* ══════ SECTION 5: OBJECTION ANALYSIS ══════ */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif">5. Objection Analysis</CardTitle>
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
                          <p className="font-medium italic">"{obj.objection}"</p>
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

          {/* ══════ SECTION 6: PRIORITY FIXES ══════ */}
          {Array.isArray(analysis.priorityFixes) && analysis.priorityFixes.length > 0 && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">6. Priority Fixes</CardTitle>
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

        </div>
      )}

      {/* ══════ SECTION 7: FIGURES OUTCOME ══════ */}
      {call.status === 'completed' && (
        <>
          {(
            call.result == null &&
            call.cashCollected == null &&
            call.revenueGenerated == null
          ) && (
              <Alert className="border-primary/30 bg-primary/5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Add this call to your figures:</strong> Set the deal outcome below (result, cash collected, revenue) so it shows in Performance → Figures. The AI may have filled these; if not, click Edit outcome and enter the amounts.
                </AlertDescription>
              </Alert>
            )}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <CardTitle className="font-serif">Sales figures outcome</CardTitle>
                </div>
                {!editingOutcome && (
                  <Button type="button" variant="outline" size="sm" onClick={openOutcomeEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit outcome
                  </Button>
                )}
              </div>
              <CardDescription>
                Used for Figures (cash collected, revenue). Set result and amounts so this call is included in Performance → Figures.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {editingOutcome ? (
                <form onSubmit={handleSaveOutcome} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outcome-call-date">Call Date</Label>
                      <Input
                        id="outcome-call-date"
                        type="date"
                        value={editCallDate}
                        onChange={(e) => setEditCallDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outcome-call-type">Call Type</Label>
                      <Select
                        value={editCallType || undefined}
                        onValueChange={(value) => setEditCallType(value)}
                      >
                        <SelectTrigger id="outcome-call-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="closing_call">Closing Call</SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outcome-offer">Offer</Label>
                      <Select
                        value={editOfferId || undefined}
                        onValueChange={(value) => setEditOfferId(value)}
                      >
                        <SelectTrigger id="outcome-offer">
                          <SelectValue placeholder="Select offer" />
                        </SelectTrigger>
                        <SelectContent>
                          {offers.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outcome-prospect">Prospect Name</Label>
                      <Input
                        id="outcome-prospect"
                        type="text"
                        placeholder="Prospect's name"
                        value={editProspectName}
                        onChange={(e) => setEditProspectName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outcome-result">Result</Label>
                      <Select
                        value={editResult || undefined}
                        onValueChange={(value) => {
                          setEditResult(value);
                          setEditQualified(value === 'unqualified' ? false : true);
                        }}
                      >
                        <SelectTrigger id="outcome-result">
                          <SelectValue placeholder="Select result" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALID_RESULTS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r === 'follow_up' ? 'Follow-up' : r.replace('_', ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(editResult === 'closed' || editResult === 'deposit') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="outcome-cash">Cash Collected (£)</Label>
                        <Input
                          id="outcome-cash"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={editCash}
                          onChange={(e) => setEditCash(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outcome-revenue">Revenue Generated (£)</Label>
                        <Input
                          id="outcome-revenue"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={editRevenue}
                          onChange={(e) => setEditRevenue(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="outcome-commission">Commission rate (%)</Label>
                        <Input
                          id="outcome-commission"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          placeholder="e.g. 10"
                          value={editCommissionRatePct}
                          onChange={(e) => setEditCommissionRatePct(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="outcome-reason">Why did the prospect buy or not buy? What objections were raised?</Label>
                    <Textarea
                      id="outcome-reason"
                      placeholder="e.g. Prospect agreed to £3,600 program; 3-month payment plan."
                      rows={2}
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={savingOutcome}>
                      {savingOutcome ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save outcome'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingOutcome(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Call date:</span>{' '}
                    {call.callDate ? new Date(call.callDate).toLocaleDateString() : '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Call type:</span>{' '}
                    {call.callType === 'follow_up' ? 'Follow-up' : call.callType ? call.callType.replace('_', ' ') : '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Offer:</span>{' '}
                    {call.offerName || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prospect:</span>{' '}
                    {call.prospectName || '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Result:</span>{' '}
                    {call.result ? call.result.replace('_', ' ') : '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cash collected:</span>{' '}
                    {call.cashCollected != null ? `£${(call.cashCollected / 100).toLocaleString()}` : '—'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Revenue generated:</span>{' '}
                    {call.revenueGenerated != null ? `£${(call.revenueGenerated / 100).toLocaleString()}` : '—'}
                  </div>
                  {call.commissionRatePct != null && (
                    <div>
                      <span className="text-muted-foreground">Commission rate:</span> {call.commissionRatePct}%
                    </div>
                  )}
                  {call.reasonForOutcome && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Reason:</span> {call.reasonForOutcome}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Failed State */}
      {call.status === 'failed' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {(() => {
              try {
                const meta = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata;
                if (meta?.failureReason) return meta.failureReason;
              } catch {
                // ignore invalid metadata
              }
              return 'Call processing failed. Please try uploading again.';
            })()}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
