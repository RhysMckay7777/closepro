'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileAudio, Clock, DollarSign, Pencil } from 'lucide-react';
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

  const openOutcomeEdit = () => {
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

      {/* Completed State - Show Analysis */}
      {call.status === 'completed' && analysis && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-6xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                  {analysis.overallScore}
                </div>
                <p className="text-muted-foreground mt-2">out of 100</p>
              </div>
            </CardContent>
          </Card>

          {/* 10 Sales Categories (Sales Call Scoring Framework) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {(analysis.categoryScores && typeof analysis.categoryScores === 'object'
              ? Object.entries(analysis.categoryScores)
              : (analysis.skillScores && typeof analysis.skillScores === 'object' && !Array.isArray(analysis.skillScores)
                ? Object.entries(analysis.skillScores)
                : SALES_CATEGORIES.map((c) => [c.id, null])
              )
            )
              .filter(([, score]) => typeof score === 'number')
              .map(([id, score]) => (
                <Card key={String(id)} className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-serif">{getCategoryLabel(String(id))}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Number(score)}</div>
                    <p className="text-xs text-muted-foreground mt-1">out of 10</p>
                  </CardContent>
                </Card>
              ))}
          </div>
          <p className="text-xs text-muted-foreground">Sales categories defined in Knowledge Doc: Sales Call Scoring Framework.</p>

          {/* Objections (pillar classification) */}
          {analysis.objections && Array.isArray(analysis.objections) && analysis.objections.length > 0 && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">Objections</CardTitle>
                <CardDescription>Classified by pillar (Value, Trust, Fit, Logistics)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.objections.map((obj: { objection?: string; pillar?: string; handling?: string }, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/5">
                      <p className="font-medium">{obj.objection ?? '—'}</p>
                      {obj.pillar && <Badge variant="secondary" className="mt-1 capitalize">{obj.pillar}</Badge>}
                      {obj.handling && <p className="text-sm text-muted-foreground mt-2">{obj.handling}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coaching Recommendations */}
          {analysis.coachingRecommendations && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">Coaching Recommendations</CardTitle>
                <CardDescription>
                  AI-generated insights to improve your sales performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {JSON.parse(analysis.coachingRecommendations).map((rec: any, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        rec.priority === 'high' 
                          ? 'border-destructive/30 bg-destructive/5' 
                          : rec.priority === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                              {rec.priority}
                            </Badge>
                            <span className="text-sm font-medium">{rec.category}</span>
                          </div>
                          <p className="font-semibold mb-1">{rec.issue}</p>
                          <p className="text-sm text-muted-foreground mb-2">{rec.explanation}</p>
                          <p className="text-sm font-medium text-primary">{rec.action}</p>
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

      {/* Sales figures outcome – completed calls only */}
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
                  <p className="text-xs text-muted-foreground">Qualified if result ≠ Unqualified. Only &quot;Unqualified&quot; marks the call as not qualified.</p>
                </div>
                {(editResult === 'closed' || editResult === 'deposit') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="outcome-cash">Cash collected ($)</Label>
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
                    <Label htmlFor="outcome-revenue">Revenue generated ($)</Label>
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
                {call.callDate && (
                  <div>
                    <span className="text-muted-foreground">Call date:</span>{' '}
                    {new Date(call.callDate).toLocaleDateString()}
                  </div>
                )}
                {call.prospectName && (
                  <div>
                    <span className="text-muted-foreground">Prospect:</span> {call.prospectName}
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Result:</span>{' '}
                  {call.result ? call.result.replace('_', ' ') : '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Qualified:</span>{' '}
                  {call.qualified === true ? 'Yes' : call.qualified === false ? 'No' : '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Cash collected:</span>{' '}
                  {call.cashCollected != null ? `$${(call.cashCollected / 100).toLocaleString()}` : '—'}
                </div>
                <div>
                  <span className="text-muted-foreground">Revenue generated:</span>{' '}
                  {call.revenueGenerated != null ? `$${(call.revenueGenerated / 100).toLocaleString()}` : '—'}
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
