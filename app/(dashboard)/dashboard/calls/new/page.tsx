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
import { Loader2, ArrowLeft, Upload, FileText, Calendar, Briefcase, User, Phone } from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/toast';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

export default function NewCallPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Manual log form state
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    offerType: '',
    result: '',
    prospectName: '',
    cashCollected: '',
    revenueGenerated: '',
    commissionRatePct: '',
    depositTaken: false,
    reasonForOutcome: '',
    paymentType: 'paid_in_full' as 'paid_in_full' | 'payment_plan',
    numberOfInstalments: '',
    monthlyAmount: '',
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
    paymentType: 'paid_in_full' as 'paid_in_full' | 'payment_plan',
    numberOfInstalments: '',
    monthlyAmount: '',
    nextFollowUpDate: '',
  });

  // Upload & Analyse (merged: transcript text, transcript file, or audio file)
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [addToFigures, setAddToFigures] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [transcriptSubmitting, setTranscriptSubmitting] = useState(false);

  const isAudioFile = (file: File) => {
    const t = file.type?.toLowerCase() || '';
    const n = file.name?.toLowerCase() || '';
    return /^audio\//.test(t) || /\.(mp3|wav|m4a|webm)$/.test(n);
  };
  const isTranscriptFile = (file: File) => {
    const n = file.name?.toLowerCase() || '';
    const t = file.type?.toLowerCase() || '';
    return /\.(txt|pdf|docx?)$/.test(n) || /^text\//.test(t) || t.includes('pdf') || t.includes('wordprocessingml');
  };

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
          callType: 'closing_call',
          prospectName: manualForm.prospectName.trim() || undefined,
          cashCollected: manualForm.cashCollected ? parseInt(manualForm.cashCollected) * 100 : null,
          revenueGenerated: manualForm.revenueGenerated ? parseInt(manualForm.revenueGenerated) * 100 : null,
          commissionRatePct: manualForm.commissionRatePct ? parseFloat(manualForm.commissionRatePct) : undefined,
          paymentType: manualForm.paymentType,
          numberOfInstalments: manualForm.numberOfInstalments ? parseInt(manualForm.numberOfInstalments) : undefined,
          monthlyAmount: manualForm.monthlyAmount ? parseInt(manualForm.monthlyAmount) * 100 : undefined,
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
          paymentType: followUpForm.paymentType,
          numberOfInstalments: followUpForm.numberOfInstalments ? parseInt(followUpForm.numberOfInstalments) : undefined,
          monthlyAmount: followUpForm.monthlyAmount ? parseInt(followUpForm.monthlyAmount) * 100 : undefined,
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

  const handleUploadAndAnalyseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = uploadFile;
    const hasText = transcriptText.trim().length > 0;
    const isAudio = file != null && isAudioFile(file);
    const isTranscript = file != null && isTranscriptFile(file);

    if (file != null && file.size === 0) {
      toastError('Selected file is empty. Please choose a different file or paste transcript text.');
      return;
    }
    if (file != null && !isAudio && !isTranscript) {
      toastError('Unsupported file type. Use audio (MP3, WAV, M4A, WebM) or transcript (.txt, .pdf, .docx), or paste text below.');
      return;
    }

    if (isAudio) {
      setUploading(true);
      try {
        // Dynamic import — only loaded when needed (client-side)
        const { upload } = await import('@vercel/blob/client');

        // STEP A: Upload file directly to Vercel Blob from browser
        // This bypasses the 4.5 MB serverless function body limit
        const blob = await upload(file!.name, file!, {
          access: 'public',
          handleUploadUrl: '/api/calls/upload-blob',
        });

        // STEP B: Send blob URL + metadata to the API for transcription & analysis
        const response = await fetch('/api/calls/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: blob.url,
            fileName: file!.name,
            fileSize: file!.size,
            addToFigures,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }
        toastSuccess('Call uploaded. Analysis in progress...');
        if (data.callId) {
          router.push(`/dashboard/calls/${data.callId}?openOutcome=1`);
        } else {
          router.push('/dashboard/calls');
        }
      } catch (err: unknown) {
        console.error('Upload error:', err);
        toastError(err instanceof Error ? err.message : 'Failed to upload call');
      } finally {
        setUploading(false);
      }
      return;
    }

    if (isTranscript || hasText) {
      setTranscriptSubmitting(true);
      try {
        let response: Response;
        if (isTranscript && file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('metadata', JSON.stringify({ addToFigures }));
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
              addToFigures,
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
          router.push(`/dashboard/calls/${data.callId}?openOutcome=1`);
        } else {
          router.push('/dashboard/calls');
        }
      } catch (err: unknown) {
        console.error('Transcript submit error:', err);
        toastError(err instanceof Error ? err.message : 'Failed to create call from transcript');
      } finally {
        setTranscriptSubmitting(false);
      }
      return;
    }

    toastError('Upload an audio or transcript file, or paste transcript text');
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
          Upload an audio or transcript file, paste transcript text, or log manually. Upload & Analyse runs AI analysis on audio or transcript.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">Upload & Analyse</TabsTrigger>
          <TabsTrigger value="manual">Manual Log</TabsTrigger>
          <TabsTrigger value="no-show">No-Show</TabsTrigger>
          <TabsTrigger value="follow-up">Follow-Up</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Call: Upload & Analyse</CardTitle>
              <CardDescription>
                Upload an audio file (MP3, WAV, M4A, WebM) or a transcript file (.txt, .pdf, .docx), or paste transcript text below. AI analysis runs on upload.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadAndAnalyseSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="upload-file">File (audio or transcript)</Label>
                  <Input
                    id="upload-file"
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/webm,.mp3,.wav,.m4a,.webm,.txt,.pdf,.doc,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  {uploadFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or paste transcript below</span>
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
                  <Button
                    type="submit"
                    disabled={uploading || transcriptSubmitting || (!uploadFile && !transcriptText.trim())}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : transcriptSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analysing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload & Analyse
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
              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Call details
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Date, offer, prospect, and whether this was a closing or follow-up call.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manual-date" className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        Date *
                      </Label>
                      <Input
                        id="manual-date"
                        type="date"
                        value={manualForm.date}
                        onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                        required
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-offer" className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5" />
                        Offer name *
                      </Label>
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
                    <Label htmlFor="manual-prospect" className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-3.5 w-3.5" />
                      Prospect name (optional)
                    </Label>
                    <Input
                      id="manual-prospect"
                      value={manualForm.prospectName}
                      onChange={(e) => setManualForm({ ...manualForm, prospectName: e.target.value })}
                      placeholder="e.g. James, Busy Dad"
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manual-result">Result *</Label>
                    <Select
                      value={manualForm.result}
                      onValueChange={(value) => setManualForm({ ...manualForm, result: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select result" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="follow_up">Follow-up</SelectItem>
                        <SelectItem value="unqualified">Unqualified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground self-end pb-2">
                    Qualified if result ≠ Unqualified. Only &quot;Unqualified&quot; marks the call as not qualified.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-reason">Why did the prospect buy or not buy? What objections were raised? *</Label>
                  <Textarea
                    id="manual-reason"
                    value={manualForm.reasonForOutcome}
                    onChange={(e) => setManualForm({ ...manualForm, reasonForOutcome: e.target.value })}
                    placeholder="e.g. Prospect agreed to program; payment plan. Objections: timing, partner approval."
                    rows={3}
                    required
                  />
                </div>

                {manualForm.result === 'closed' && (
                  <div className="space-y-4">
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
                        <Label htmlFor="manual-payment-type">Payment Type</Label>
                        <Select
                          value={manualForm.paymentType}
                          onValueChange={(value: 'paid_in_full' | 'payment_plan') => setManualForm({ ...manualForm, paymentType: value })}
                        >
                          <SelectTrigger id="manual-payment-type">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                            <SelectItem value="payment_plan">Payment Plan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {manualForm.paymentType === 'payment_plan' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="manual-instalments">Number of Instalments</Label>
                          <Input
                            id="manual-instalments"
                            type="number"
                            min="2"
                            value={manualForm.numberOfInstalments}
                            onChange={(e) => setManualForm({ ...manualForm, numberOfInstalments: e.target.value })}
                            placeholder="e.g. 6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="manual-monthly">Monthly Amount (£)</Label>
                          <Input
                            id="manual-monthly"
                            type="number"
                            value={manualForm.monthlyAmount}
                            onChange={(e) => setManualForm({ ...manualForm, monthlyAmount: e.target.value })}
                            placeholder="e.g. 500"
                          />
                        </div>
                      </div>
                    )}
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
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                        <SelectItem value="no_show">No-Show</SelectItem>
                        <SelectItem value="further_follow_up">Further Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="follow-up-reason">Why did the prospect buy or not buy? What objections were raised? *</Label>
                  <Textarea
                    id="follow-up-reason"
                    value={followUpForm.reasonForOutcome}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, reasonForOutcome: e.target.value })}
                    placeholder="e.g. Prospect closed; payment plan. Objections: timing."
                    rows={3}
                    required
                  />
                </div>

                {followUpForm.outcome === 'further_follow_up' && (
                  <div className="space-y-2">
                    <Label htmlFor="next-follow-up-date">Next Follow-Up Date</Label>
                    <Input
                      id="next-follow-up-date"
                      type="date"
                      value={followUpForm.nextFollowUpDate}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, nextFollowUpDate: e.target.value })}
                    />
                  </div>
                )}

                {followUpForm.outcome === 'closed' && (
                  <div className="space-y-4">
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
                        <Label htmlFor="follow-up-payment-type">Payment Type</Label>
                        <Select
                          value={followUpForm.paymentType}
                          onValueChange={(value: 'paid_in_full' | 'payment_plan') => setFollowUpForm({ ...followUpForm, paymentType: value })}
                        >
                          <SelectTrigger id="follow-up-payment-type">
                            <SelectValue placeholder="Select payment type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                            <SelectItem value="payment_plan">Payment Plan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {followUpForm.paymentType === 'payment_plan' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="follow-up-instalments">Number of Instalments</Label>
                          <Input
                            id="follow-up-instalments"
                            type="number"
                            min="2"
                            value={followUpForm.numberOfInstalments}
                            onChange={(e) => setFollowUpForm({ ...followUpForm, numberOfInstalments: e.target.value })}
                            placeholder="e.g. 6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="follow-up-monthly">Monthly Amount (£)</Label>
                          <Input
                            id="follow-up-monthly"
                            type="number"
                            value={followUpForm.monthlyAmount}
                            onChange={(e) => setFollowUpForm({ ...followUpForm, monthlyAmount: e.target.value })}
                            placeholder="e.g. 500"
                          />
                        </div>
                      </div>
                    )}
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
