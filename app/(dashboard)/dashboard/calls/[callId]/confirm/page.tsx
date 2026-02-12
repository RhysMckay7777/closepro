'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Calendar, Briefcase, User, FileText, Info } from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/toast';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

export default function ConfirmCallDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params?.callId as string;

  const [call, setCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasExtractedFields, setHasExtractedFields] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    result: '',
    prospectName: '',
    cashCollected: '',
    revenueGenerated: '',
    commissionRatePct: '',
    reasonForOutcome: '',
    callType: 'closing_call',
    paymentType: 'paid_in_full' as 'paid_in_full' | 'payment_plan',
    numberOfInstalments: '',
    monthlyAmount: '',
    addToSalesFigures: true,
  });

  useEffect(() => {
    if (!callId) return;
    // Fetch offers first so we can do offer matching with extracted details
    fetchOffersAndCall();
  }, [callId]);

  const fetchOffersAndCall = async () => {
    // Fetch offers first
    let loadedOffers: Offer[] = [];
    try {
      const response = await fetch('/api/offers');
      if (response.ok) {
        const data = await response.json();
        loadedOffers = data.offers || [];
        setOffers(loadedOffers);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }

    // Now fetch call (needs offers for extraction matching)
    try {
      const response = await fetch(`/api/calls/${callId}/status`);
      if (!response.ok) {
        router.replace('/dashboard/calls');
        return;
      }
      const data = await response.json();

      // Allow loading for any status — edit mode for already-confirmed calls
      const isAlreadyConfirmed = data.status !== 'pending_confirmation';
      setIsEditMode(isAlreadyConfirmed);

      setCall(data.call);

      // Parse extracted details (AI auto-populated from transcript)
      let extracted: Record<string, any> = {};
      if (data.call?.extractedDetails) {
        try {
          extracted = JSON.parse(data.call.extractedDetails);
        } catch { /* ignore bad JSON */ }
      }

      // Offer matching: try to match AI-extracted offer name to a real offer ID
      let matchedOfferId = '';
      if (extracted.offerName && loadedOffers.length > 0) {
        matchedOfferId = matchOfferByName(extracted.offerName, loadedOffers);
      }

      // Pre-fill form from existing call data, then extracted details as fallback
      if (data.call) {
        const c = data.call;
        const usedExtracted = !isAlreadyConfirmed && Object.values(extracted).some((v) => v !== null && v !== undefined);
        if (usedExtracted) setHasExtractedFields(true);

        setForm((prev) => ({
          ...prev,
          prospectName: c.prospectName || extracted.prospectName || '',
          date: c.callDate
            ? new Date(c.callDate).toISOString().split('T')[0]
            : extracted.callDate
              ? extracted.callDate.split('T')[0]
              : new Date().toISOString().split('T')[0],
          offerId: c.offerId || matchedOfferId || '',
          result: c.result || extracted.result || '',
          callType: c.callType || extracted.callType || 'closing_call',
          reasonForOutcome: c.reasonForOutcome || extracted.reasonForResult || '',
          cashCollected: c.cashCollected
            ? (c.cashCollected / 100).toString()
            : extracted.cashCollected != null ? extracted.cashCollected.toString() : '',
          revenueGenerated: c.revenueGenerated
            ? (c.revenueGenerated / 100).toString()
            : extracted.revenueGenerated != null ? extracted.revenueGenerated.toString() : '',
          commissionRatePct: c.commissionRatePct?.toString() || '',
          paymentType: c.paymentType === 'payment_plan' ? 'payment_plan'
            : extracted.paymentType === 'payment_plan' ? 'payment_plan' : 'paid_in_full',
          numberOfInstalments: c.numberOfInstalments
            ? c.numberOfInstalments.toString()
            : extracted.numberOfInstalments != null ? extracted.numberOfInstalments.toString() : '',
          monthlyAmount: c.monthlyAmount
            ? c.monthlyAmount.toString()
            : extracted.monthlyAmount != null ? extracted.monthlyAmount.toString() : '',
          addToSalesFigures: c.addToSalesFigures !== false,
        }));
      }
    } catch (err) {
      console.error('Error fetching call:', err);
      router.replace('/dashboard/calls');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Match an AI-extracted offer name to a real offer ID.
   * Priority: exact match > case-insensitive > partial match.
   */
  function matchOfferByName(aiName: string, offerList: Offer[]): string {
    const lower = aiName.toLowerCase().trim();
    // Exact match
    const exact = offerList.find((o) => o.name === aiName);
    if (exact) return exact.id;
    // Case-insensitive
    const ci = offerList.find((o) => o.name.toLowerCase() === lower);
    if (ci) return ci.id;
    // Partial: AI name includes offer name or vice versa
    const partial = offerList.find(
      (o) => lower.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(lower)
    );
    if (partial) return partial.id;
    return '';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!form.offerId) {
      toastError('Please select an offer');
      return;
    }
    if (!form.prospectName.trim()) {
      toastError('Please enter the prospect name');
      return;
    }
    if (!form.result) {
      toastError('Please select a call result');
      return;
    }
    if (['lost', 'deposit', 'follow_up_result', 'unqualified'].includes(form.result) && !form.reasonForOutcome.trim()) {
      toastError('Please provide a reason for the outcome');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        offerId: form.offerId,
        prospectName: form.prospectName.trim(),
        result: form.result,
        callDate: form.date,
        callType: form.callType,
      };

      if (form.reasonForOutcome.trim()) {
        payload.reasonForOutcome = form.reasonForOutcome.trim();
      }

      // Add to sales figures toggle
      if (form.callType === 'closing_call' || form.callType === 'follow_up') {
        payload.addToSalesFigures = form.addToSalesFigures;
      }

      if (form.result === 'closed' || form.result === 'deposit') {
        if (form.cashCollected) {
          payload.cashCollected = Math.round(parseFloat(form.cashCollected) * 100);
        }
        if (form.revenueGenerated) {
          payload.revenueGenerated = Math.round(parseFloat(form.revenueGenerated) * 100);
        }
        if (form.commissionRatePct) {
          payload.commissionRatePct = parseFloat(form.commissionRatePct);
        }
        // Payment plan fields only for closed result
        if (form.result === 'closed') {
          payload.paymentType = form.paymentType;
          if (form.paymentType === 'payment_plan') {
            if (form.numberOfInstalments) {
              payload.numberOfInstalments = parseInt(form.numberOfInstalments);
            }
            if (form.monthlyAmount) {
              payload.monthlyAmount = parseFloat(form.monthlyAmount);
            }
          }
        }
      }

      const response = await fetch(`/api/calls/${callId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        toastError(data.error || 'Failed to confirm call');
        setSubmitting(false);
        return;
      }

      if (data.status === 'failed') {
        toastError(data.message || 'Analysis failed');
        router.push(`/dashboard/calls/${callId}`);
        return;
      }

      toastSuccess(isEditMode ? 'Details updated successfully' : 'Call logged and analysis complete');
      router.push(`/dashboard/calls/${callId}`);
    } catch (err) {
      console.error('Error confirming call:', err);
      toastError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading call details...</p>
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Call not found.</p>
        <Link href="/dashboard/calls">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calls
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <Link href={isEditMode ? `/dashboard/calls/${callId}` : '/dashboard/calls'}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isEditMode ? 'Back to Call' : 'Back to Calls'}
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight">
          {isEditMode ? 'Edit Call Details' : 'Confirm Call Details'}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          {isEditMode
            ? 'Update the call details below.'
            : 'Review and confirm the details before AI analysis runs.'}
        </p>
      </div>

      {/* Transcript Preview */}
      {call.transcript && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base font-serif">Transcript Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {call.transcript.length > 2000
                ? call.transcript.slice(0, 2000) + '...'
                : call.transcript}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Auto-Populate Banner */}
      {hasExtractedFields && !isEditMode && (
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription>
            Fields have been auto-populated from the transcript. Please review and edit before logging.
          </AlertDescription>
        </Alert>
      )}

      {/* Confirm Form */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle className="font-serif">Call Details</CardTitle>
          <CardDescription>
            {hasExtractedFields && !isEditMode
              ? 'These fields have been pre-filled by AI from the transcript. Please review and correct them.'
              : 'Fill in the call details below.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Call details section */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Call Information
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm-date" className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Call Date *
                  </Label>
                  <Input
                    id="confirm-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-offer" className="flex items-center gap-2 text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    Offer Name *
                  </Label>
                  <Select
                    value={form.offerId}
                    onValueChange={(value) => setForm({ ...form, offerId: value })}
                    required
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select an offer" />
                    </SelectTrigger>
                    <SelectContent>
                      {offers.map((offer) => (
                        <SelectItem key={offer.id} value={offer.id}>
                          {offer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-prospect" className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  Prospect Name *
                </Label>
                <Input
                  id="confirm-prospect"
                  value={form.prospectName}
                  onChange={(e) => setForm({ ...form, prospectName: e.target.value })}
                  placeholder="e.g. James, Busy Dad"
                  className="bg-background"
                  required
                />
              </div>
            </div>

            {/* Call Type */}
            <div className="space-y-2">
              <Label htmlFor="confirm-call-type">Call Type</Label>
              <Select
                value={form.callType}
                onValueChange={(value) => setForm({ ...form, callType: value })}
              >
                <SelectTrigger id="confirm-call-type">
                  <SelectValue placeholder="Select call type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closing_call">Closing Call</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="roleplay">Roleplay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Result */}
            <div className="space-y-2">
              <Label htmlFor="confirm-result">Call Result *</Label>
              <Select
                value={form.result}
                onValueChange={(value) => setForm({ ...form, result: value, reasonForOutcome: '' })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="follow_up_result">Follow-up</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields based on result */}

            {/* CLOSED: Financial fields + Payment Type */}
            {form.result === 'closed' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirm-cash">Cash Collected (&pound;)</Label>
                    <Input
                      id="confirm-cash"
                      type="number"
                      value={form.cashCollected}
                      onChange={(e) => setForm({ ...form, cashCollected: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-revenue">Revenue Generated (&pound;)</Label>
                    <Input
                      id="confirm-revenue"
                      type="number"
                      value={form.revenueGenerated}
                      onChange={(e) => setForm({ ...form, revenueGenerated: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-commission">Commission Rate (%)</Label>
                    <Input
                      id="confirm-commission"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.commissionRatePct}
                      onChange={(e) => setForm({ ...form, commissionRatePct: e.target.value })}
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-payment-type">Payment Type</Label>
                    <Select
                      value={form.paymentType}
                      onValueChange={(value: 'paid_in_full' | 'payment_plan') =>
                        setForm({ ...form, paymentType: value })
                      }
                    >
                      <SelectTrigger id="confirm-payment-type">
                        <SelectValue placeholder="Select payment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                        <SelectItem value="payment_plan">Payment Plan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Instalment fields for payment plan */}
                {form.paymentType === 'payment_plan' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="confirm-instalments">Number of Instalments</Label>
                      <Input
                        id="confirm-instalments"
                        type="number"
                        min="2"
                        value={form.numberOfInstalments}
                        onChange={(e) =>
                          setForm({ ...form, numberOfInstalments: e.target.value })
                        }
                        placeholder="e.g. 6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-monthly">Monthly Amount (&pound;)</Label>
                      <Input
                        id="confirm-monthly"
                        type="number"
                        value={form.monthlyAmount}
                        onChange={(e) =>
                          setForm({ ...form, monthlyAmount: e.target.value })
                        }
                        placeholder="e.g. 500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DEPOSIT: Financial fields + reason textarea */}
            {form.result === 'deposit' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="confirm-cash">Cash Collected (&pound;)</Label>
                    <Input
                      id="confirm-cash"
                      type="number"
                      value={form.cashCollected}
                      onChange={(e) => setForm({ ...form, cashCollected: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-revenue">Revenue Generated (&pound;)</Label>
                    <Input
                      id="confirm-revenue"
                      type="number"
                      value={form.revenueGenerated}
                      onChange={(e) => setForm({ ...form, revenueGenerated: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-commission">Commission Rate (%)</Label>
                    <Input
                      id="confirm-commission"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={form.commissionRatePct}
                      onChange={(e) => setForm({ ...form, commissionRatePct: e.target.value })}
                      placeholder="e.g. 10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-reason">Deposit Details *</Label>
                  <Textarea
                    id="confirm-reason"
                    value={form.reasonForOutcome}
                    onChange={(e) => setForm({ ...form, reasonForOutcome: e.target.value })}
                    placeholder="Enter deposit amount and reason deposit was taken and sale wasn't made."
                    rows={3}
                    required
                  />
                </div>
              </div>
            )}

            {/* LOST: Reason textarea only */}
            {form.result === 'lost' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-reason">Reason *</Label>
                <Textarea
                  id="confirm-reason"
                  value={form.reasonForOutcome}
                  onChange={(e) => setForm({ ...form, reasonForOutcome: e.target.value })}
                  placeholder="Why did this deal not close? What objections were raised?"
                  rows={3}
                  required
                />
              </div>
            )}

            {/* FOLLOW-UP: Reason textarea only */}
            {form.result === 'follow_up_result' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-reason">Reason *</Label>
                <Textarea
                  id="confirm-reason"
                  value={form.reasonForOutcome}
                  onChange={(e) => setForm({ ...form, reasonForOutcome: e.target.value })}
                  placeholder="Why was this a follow-up and not a sale?"
                  rows={3}
                  required
                />
              </div>
            )}

            {/* UNQUALIFIED: Reason textarea only */}
            {form.result === 'unqualified' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-reason">Reason *</Label>
                <Textarea
                  id="confirm-reason"
                  value={form.reasonForOutcome}
                  onChange={(e) => setForm({ ...form, reasonForOutcome: e.target.value })}
                  placeholder="Why was this call unqualified?"
                  rows={3}
                  required
                />
              </div>
            )}

            {/* Add to Sales Figures toggle (only for closing/follow_up call types, not roleplay) */}
            {(form.callType === 'closing_call' || form.callType === 'follow_up') && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="confirm-sales-figures" className="text-sm font-medium">Add to Sales Figures</Label>
                  <p className="text-xs text-muted-foreground">
                    When off, this call will be logged and analyzed but won&apos;t count toward performance figures or commission.
                  </p>
                </div>
                <button
                  id="confirm-sales-figures"
                  type="button"
                  role="switch"
                  aria-checked={form.addToSalesFigures}
                  onClick={() => setForm({ ...form, addToSalesFigures: !form.addToSalesFigures })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${form.addToSalesFigures ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${form.addToSalesFigures ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Link href="/dashboard/calls" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Analysing...'}
                  </>
                ) : (
                  isEditMode ? 'Update Details' : 'Log Call & Analyse'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
