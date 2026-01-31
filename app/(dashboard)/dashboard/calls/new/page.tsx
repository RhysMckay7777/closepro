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
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Manual log form state
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    offerType: '',
    callType: 'closing_call',
    result: '',
    qualified: false,
    cashCollected: '',
    revenueGenerated: '',
    depositTaken: false,
    reasonForOutcome: '',
    objections: '',
  });

  // No-show form state
  const [noShowForm, setNoShowForm] = useState({
    date: new Date().toISOString().split('T')[0],
    offerId: '',
    offerType: '',
    wasConfirmed: false,
    bookingSource: '',
    notes: '',
  });

  // Follow-up form state
  const [followUpForm, setFollowUpForm] = useState({
    originalCallId: '',
    followUpDate: new Date().toISOString().split('T')[0],
    outcome: '',
    cashCollected: '',
    revenueGenerated: '',
    depositTaken: false,
  });

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [addToFigures, setAddToFigures] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, []);

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
          cashCollected: manualForm.cashCollected ? parseInt(manualForm.cashCollected) * 100 : null,
          revenueGenerated: manualForm.revenueGenerated ? parseInt(manualForm.revenueGenerated) * 100 : null,
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
    if (!followUpForm.originalCallId || !followUpForm.outcome) {
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
          Choose how you want to add this call to your history
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
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

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Manual Call Log</CardTitle>
              <CardDescription>
                Log a call manually when you don&apos;t have a recording. This updates figures but does not add to call history.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                      onValueChange={(value) => setManualForm({ ...manualForm, result: value })}
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-reason">Reason for Outcome *</Label>
                  <Textarea
                    id="manual-reason"
                    value={manualForm.reasonForOutcome}
                    onChange={(e) => setManualForm({ ...manualForm, reasonForOutcome: e.target.value })}
                    placeholder="Why did this call end this way?"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="manual-qualified"
                      checked={manualForm.qualified}
                      onCheckedChange={(checked) => setManualForm({ ...manualForm, qualified: checked === true })}
                    />
                    <Label htmlFor="manual-qualified">Qualified</Label>
                  </div>
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

                <div className="space-y-2">
                  <Label htmlFor="manual-objections">What objections came up? (Optional)</Label>
                  <Textarea
                    id="manual-objections"
                    value={manualForm.objections}
                    onChange={(e) => setManualForm({ ...manualForm, objections: e.target.value })}
                    placeholder="List any objections that came up during the call"
                    rows={2}
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
                  <Label htmlFor="follow-up-original">Original Call Date *</Label>
                  <Input
                    id="follow-up-original"
                    type="text"
                    value={followUpForm.originalCallId}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, originalCallId: e.target.value })}
                    placeholder="Enter original call ID or select from list"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be enhanced to show a dropdown of recent calls
                  </p>
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

                {followUpForm.outcome === 'sale_made' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
