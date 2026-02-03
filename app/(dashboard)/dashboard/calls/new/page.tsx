'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/toast';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

export default function NewCallPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('transcript');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Manual log form state
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    offerType: '',
    callType: 'closing_call' as 'closing_call' | 'follow_up',
    result: '',
    qualified: false,
    prospectName: '',
    cashCollected: '',
    revenueGenerated: '',
    commissionRatePct: '',
    depositTaken: false,
    reasonForOutcome: '',
  });

  // No-show form state
  const [noShowForm, setNoShowForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    offerType: '',
    prospectName: '',
    wasConfirmed: false,
    bookingSource: '',
    notes: '',
  });

  // Follow-up: list of recent calls for dropdown
  const [followUpCalls, setFollowUpCalls] = useState<Array<{ id: string; prospectName: string; offerName: string; createdAt: string }>>([]);
  const [followUpForm, setFollowUpForm] = useState({
    originalCallId: '',
    followUpDate: new Date().toISOString().split('T')[0],
    outcome: '',
    reasonForOutcome: '',
    cashCollected: '',
    revenueGenerated: '',
    commissionRatePct: '',
    depositTaken: false,
  });

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [addToFigures, setAddToFigures] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Paste transcript form state
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [addToFiguresTranscript, setAddToFiguresTranscript] = useState(true);
  const [transcriptSubmitting, setTranscriptSubmitting] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    if (activeTab === 'follow-up') {
      fetch('/api/calls?forFollowUp=true')
        .then((r) => r.ok ? r.json() : { calls: [] })
        .then((data) => setFollowUpCalls(data.calls || []))
        .catch(() => setFollowUpCalls([]));
    }
  }, [activeTab]);

  const fetchOffers = async () => {
    try {
      const response = await fetch('/api/offers');
      if (response.ok) {
        const data = await response.json();
        setOffers(data.offers || []);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.offerId || !manualForm.result || !manualForm.reasonForOutcome) {
      toastError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/calls/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...manualForm,
          prospectName: manualForm.prospectName.trim() || undefined,
          cashCollected: manualForm.cashCollected ? parseInt(manualForm.cashCollected) * 100 : null,
          revenueGenerated: manualForm.revenueGenerated ? parseInt(manualForm.revenueGenerated) * 100 : null,
          commissionRatePct: manualForm.commissionRatePct ? parseFloat(manualForm.commissionRatePct) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to log call');
      }

      toastSuccess('Call logged successfully');
      router.push('/dashboard/calls');
    } catch (error: any) {
      console.error('Error logging call:', error);
      toastError(error.message || 'Failed to log call');
    } finally {
      setLoading(false);
    }
  };

  const handleNoShowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noShowForm.offerId) {
      toastError('Please select an offer');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/calls/no-show', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noShowForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to log no-show');
      }

      toastSuccess('No-show logged successfully');
      router.push('/dashboard/calls');
    } catch (error: any) {
      console.error('Error logging no-show:', error);
      toastError(error.message || 'Failed to log no-show');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpForm.originalCallId || !followUpForm.outcome || !followUpForm.reasonForOutcome) {
      toastError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/calls/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...followUpForm,
          cashCollected: followUpForm.cashCollected ? parseInt(followUpForm.cashCollected) * 100 : null,
          revenueGenerated: followUpForm.revenueGenerated ? parseInt(followUpForm.revenueGenerated) * 100 : null,
          commissionRatePct: followUpForm.commissionRatePct ? parseFloat(followUpForm.commissionRatePct) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to log follow-up');
      }

      toastSuccess('Follow-up logged successfully');
      router.push('/dashboard/calls');
    } catch (error: any) {
      console.error('Error logging follow-up:', error);
      toastError(error.message || 'Failed to log follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toastError('Please select an audio file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('metadata', JSON.stringify({ addToFigures }));
      const response = await fetch('/api/calls/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const data = await response.json();
      toastSuccess('Call uploaded. Analysis in progress...');
      if (data.callId) {
        router.push(`/dashboard/calls/${data.callId}`);
      } else {
        router.push('/dashboard/calls');
      }
    } catch (err: unknown) {
      console.error('Upload error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to upload call');
    } finally {
      setUploading(false);
    }
  };

  const handleTranscriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasText = transcriptText.trim().length > 0;
    const hasFile = transcriptFile != null && transcriptFile.size > 0;
    if (!hasText && !hasFile) {
      toastError('Please paste transcript text or upload a .txt, .pdf, or .docx file');
      return;
    }
    setTranscriptSubmitting(true);
    try {
      let response: Response;
      if (hasFile) {
        const formData = new FormData();
        formData.append('file', transcriptFile);
        formData.append('metadata', JSON.stringify({ addToFigures: addToFiguresTranscript }));
        response = await fetch('/api/calls/transcript', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/calls/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptText.trim(),
            addToFigures: addToFiguresTranscript,
          }),
        });
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create call from transcript');
      }
      const data = await response.json();
      toastSuccess('Transcript saved. Analysis in progress...');
      if (data.callId) {
        router.push(`/dashboard/calls/${data.callId}`);
      } else {
        router.push('/dashboard/calls');
      }
    } catch (err: unknown) {
      console.error('Transcript submit error:', err);
      toastError(err instanceof Error ? err.message : 'Failed to create call from transcript');
    } finally {
      setTranscriptSubmitting(false);
    }
  };

  const getOfferTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      b2c_health: 'B2C Health',
      b2c_relationships: 'B2C Relationships',
      b2c_wealth: 'B2C Wealth',
      mixed_wealth: 'Mixed Wealth',
      b2b_services: 'B2B Services',
    };
    return labels[type] || type;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/calls">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Calls
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Add New Call</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Paste/upload a transcript, upload audio, or log manually. Transcript and upload both get AI analysis. Or use the Upload & Analyze tab for audio files.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
          <TabsTrigger value="transcript">Paste / upload transcript</TabsTrigger>
          <TabsTrigger value="manual">Manual Log</TabsTrigger>
          <TabsTrigger value="no-show">No-Show</TabsTrigger>
          <TabsTrigger value="follow-up">Follow-Up</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload & Analyze Call</CardTitle>
              <CardDescription>
                Upload an audio file for transcription and AI analysis (MP3, WAV, M4A, WebM, max 100MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="upload-file">Audio file *</Label>
                  <Input
                    id="upload-file"
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/webm,.mp3,.wav,.m4a,.webm"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="upload-add-to-figures"
                    checked={addToFigures}
                    onCheckedChange={(checked) => setAddToFigures(checked === true)}
                  />
                  <Label htmlFor="upload-add-to-figures" className="font-normal cursor-pointer">
                    Add to sales figures (include outcome in Performance → Figures)
                  </Label>
                </div>
                <div className="flex gap-3">
                  <Link href="/dashboard/calls" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={uploading || !uploadFile} className="flex-1">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Analyze
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Paste or upload transcript</CardTitle>
              <CardDescription>
                Paste text below or upload a .txt, .pdf, or Word (.docx) file. No audio needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTranscriptSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="transcript-file">Upload transcript file</Label>
                  <Input
                    id="transcript-file"
                    type="file"
                    accept=".txt,.pdf,.doc,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setTranscriptFile(e.target.files?.[0] ?? null)}
                  />
                  {transcriptFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {transcriptFile.name} ({(transcriptFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or paste below</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transcript-text">Paste transcript text</Label>
                  <Textarea
                    id="transcript-text"
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="Paste your call transcript here. You can use lines like [Speaker A] or Speaker 1: to separate speakers."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transcript-add-to-figures"
                    checked={addToFiguresTranscript}
                    onCheckedChange={(checked) => setAddToFiguresTranscript(checked === true)}
                  />
                  <Label htmlFor="transcript-add-to-figures" className="font-normal cursor-pointer">
                    Add to sales figures (include outcome in Performance → Figures)
                  </Label>
                </div>
                <div className="flex gap-3">
                  <Link href="/dashboard/calls" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={transcriptSubmitting || (!transcriptText.trim() && !transcriptFile)}
                    className="flex-1"
                  >
                    {transcriptSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Analyze transcript
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Manual Call Log</CardTitle>
              <CardDescription>
                Log a call manually when you don&apos;t have a recording. This updates figures.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offers.length === 0 && (
                <p className="text-sm text-muted-foreground mb-4">
                  Create an offer first to log calls.
                </p>
              )}
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-date">Date *</Label>
                    <Input
                      id="manual-date"
                      type="date"
                      value={manualForm.date}
                      onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-offer">Offer Name *</Label>
                    <Select
                      value={manualForm.offerId}
                      onValueChange={(value) => {
                        const offer = offers.find((o) => o.id === value);
                        setManualForm({
                          ...manualForm,
                          offerId: value,
                          offerType: offer?.offerCategory || '',
                        });
                      }}
                      required
                    >
                      <SelectTrigger>
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
                  <Label htmlFor="manual-prospect">Prospect name (optional)</Label>
                  <Input
                    id="manual-prospect"
                    value={manualForm.prospectName}
                    onChange={(e) => setManualForm({ ...manualForm, prospectName: e.target.value })}
                    placeholder="e.g. James, Busy Dad"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-call-type">Call Type *</Label>
                    <Select
                      value={manualForm.callType}
                      onValueChange={(value) => setManualForm({ ...manualForm, callType: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closing_call">Closing Call</SelectItem>
                        <SelectItem value="follow_up">Follow-Up</SelectItem>
                        <SelectItem value="no_show">No-Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-result">Result *</Label>
                    <Select
                      value={manualForm.result}
                      onValueChange={(value) => {
                        const qualified = value === 'closed' || value === 'lost' ? true : value === 'unqualified' ? false : manualForm.qualified;
                        setManualForm({ ...manualForm, result: value, qualified });
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="unqualified">Unqualified</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Closed or Lost = qualified; Unqualified = not qualified.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-qualified">Qualified</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="manual-qualified"
                      checked={manualForm.qualified}
                      onCheckedChange={(checked) => setManualForm({ ...manualForm, qualified: checked === true })}
                    />
                    <span className="text-sm text-muted-foreground">
                      {manualForm.result === 'closed' || manualForm.result === 'lost'
                        ? 'Yes (set from result)'
                        : manualForm.result === 'unqualified'
                          ? 'No (set from result)'
                          : 'Qualified lead'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-reason">Reason for outcome *</Label>
                  <Textarea
                    id="manual-reason"
                    value={manualForm.reasonForOutcome}
                    onChange={(e) => setManualForm({ ...manualForm, reasonForOutcome: e.target.value })}
                    placeholder="Why did this call end this way? What objections came up? How did we handle them?"
                    rows={3}
                    required
                  />
                </div>

                {manualForm.result === 'closed' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-cash">Cash Collected (£)</Label>
                      <Input
                        id="manual-cash"
                        type="number"
                        value={manualForm.cashCollected}
                        onChange={(e) => setManualForm({ ...manualForm, cashCollected: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-revenue">Revenue Generated (£)</Label>
                      <Input
                        id="manual-revenue"
                        type="number"
                        value={manualForm.revenueGenerated}
                        onChange={(e) => setManualForm({ ...manualForm, revenueGenerated: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 pt-8">
                        <Checkbox
                          id="manual-deposit"
                          checked={manualForm.depositTaken}
                          onCheckedChange={(checked) => setManualForm({ ...manualForm, depositTaken: checked === true })}
                        />
                        <Label htmlFor="manual-deposit">Deposit Taken</Label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link href="/dashboard/calls" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      'Log Call'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-show">
          <Card>
            <CardHeader>
              <CardTitle>Log No-Show / Cancellation</CardTitle>
              <CardDescription>
                Record when a prospect doesn&apos;t show up for a scheduled call
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNoShowSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="no-show-date">Date *</Label>
                    <Input
                      id="no-show-date"
                      type="date"
                      value={noShowForm.date}
                      onChange={(e) => setNoShowForm({ ...noShowForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="no-show-offer">Offer Name *</Label>
                    <Select
                      value={noShowForm.offerId}
                      onValueChange={(value) => {
                        const offer = offers.find((o) => o.id === value);
                        setNoShowForm({
                          ...noShowForm,
                          offerId: value,
                          offerType: offer?.offerCategory || '',
                        });
                      }}
                      required
                    >
                      <SelectTrigger>
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
                  <Label htmlFor="no-show-prospect">Prospect name (optional)</Label>
                  <Input
                    id="no-show-prospect"
                    value={noShowForm.prospectName}
                    onChange={(e) => setNoShowForm({ ...noShowForm, prospectName: e.target.value })}
                    placeholder="e.g. John Smith"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="no-show-confirmed"
                      checked={noShowForm.wasConfirmed}
                      onCheckedChange={(checked) => setNoShowForm({ ...noShowForm, wasConfirmed: checked === true })}
                    />
                    <Label htmlFor="no-show-confirmed">Was the call confirmed?</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no-show-source">Booking Source (Optional)</Label>
                  <Input
                    id="no-show-source"
                    value={noShowForm.bookingSource}
                    onChange={(e) => setNoShowForm({ ...noShowForm, bookingSource: e.target.value })}
                    placeholder="e.g., Calendly, email, phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no-show-notes">Notes (Optional)</Label>
                  <Textarea
                    id="no-show-notes"
                    value={noShowForm.notes}
                    onChange={(e) => setNoShowForm({ ...noShowForm, notes: e.target.value })}
                    placeholder="Any additional notes about the no-show"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <Link href="/dashboard/calls" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      'Log No-Show'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="follow-up">
          <Card>
            <CardHeader>
              <CardTitle>Log Follow-Up</CardTitle>
              <CardDescription>
                Record a follow-up call that happened after an original call
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFollowUpSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="follow-up-original">Original call (Prospect – Offer) *</Label>
                  <Select
                    value={followUpForm.originalCallId}
                    onValueChange={(value) => setFollowUpForm({ ...followUpForm, originalCallId: value })}
                    required
                  >
                    <SelectTrigger id="follow-up-original">
                      <SelectValue placeholder="Select original call" />
                    </SelectTrigger>
                    <SelectContent>
                      {followUpCalls.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.prospectName ? `${c.prospectName} – ${c.offerName}` : c.offerName || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="follow-up-date">Follow-Up Date *</Label>
                    <Input
                      id="follow-up-date"
                      type="date"
                      value={followUpForm.followUpDate}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, followUpDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="follow-up-outcome">Outcome *</Label>
                    <Select
                      value={followUpForm.outcome}
                      onValueChange={(value) => setFollowUpForm({ ...followUpForm, outcome: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale_made">Sale Made</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="did_not_attend">Did Not Attend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="follow-up-reason">Reason for outcome *</Label>
                  <Textarea
                    id="follow-up-reason"
                    value={followUpForm.reasonForOutcome}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, reasonForOutcome: e.target.value })}
                    placeholder="Why did this call end this way? What objections came up? How did we handle them?"
                    rows={3}
                    required
                  />
                </div>

                {followUpForm.outcome === 'sale_made' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="follow-up-cash">Cash Collected (£)</Label>
                      <Input
                        id="follow-up-cash"
                        type="number"
                        value={followUpForm.cashCollected}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, cashCollected: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="follow-up-revenue">Revenue Generated (£)</Label>
                      <Input
                        id="follow-up-revenue"
                        type="number"
                        value={followUpForm.revenueGenerated}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, revenueGenerated: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="follow-up-commission">Commission rate (%)</Label>
                      <Input
                        id="follow-up-commission"
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={followUpForm.commissionRatePct}
                        onChange={(e) => setFollowUpForm({ ...followUpForm, commissionRatePct: e.target.value })}
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 pt-8">
                        <Checkbox
                          id="follow-up-deposit"
                          checked={followUpForm.depositTaken}
                          onCheckedChange={(checked) => setFollowUpForm({ ...followUpForm, depositTaken: checked === true })}
                        />
                        <Label htmlFor="follow-up-deposit">Deposit Taken</Label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Link href="/dashboard/calls" className="flex-1">
                    <Button type="button" variant="outline" className="w-full">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      'Log Follow-Up'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
