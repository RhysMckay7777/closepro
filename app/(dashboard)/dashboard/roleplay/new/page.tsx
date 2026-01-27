'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

interface OfferTemplate {
  id: string;
  key: string;
  name: string;
  offerCategory: string;
  whoItsFor: string;
  coreOutcome: string;
  mechanismHighLevel: string;
  deliveryModel: string;
  priceRange: string;
  primaryProblemsSolved: string[];
  isTemplate: boolean;
}

interface ProspectAvatar {
  id: string;
  name: string;
  difficultyTier: string;
  sourceType: 'manual' | 'transcript_derived';
}

type OfferSelectionMode = 'template' | 'custom' | null;
type ProspectSelectionMode = 'difficulty' | 'manual' | 'transcript' | null;

export default function NewRoleplayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [templates, setTemplates] = useState<OfferTemplate[]>([]);
  const [avatars, setAvatars] = useState<ProspectAvatar[]>([]);
  
  // Step 2: Offer Selection
  const [offerSelectionMode, setOfferSelectionMode] = useState<OfferSelectionMode>('template');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('');
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  
  // Step 3: Prospect Selection
  const [prospectSelectionMode, setProspectSelectionMode] = useState<ProspectSelectionMode>('difficulty');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('realistic');
  
  // Transcript replay
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchOffers();
    fetchAvatars();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/offers?templates=true');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

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

  const fetchAvatars = async () => {
    try {
      const response = await fetch('/api/prospect-avatars');
      if (response.ok) {
        const data = await response.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error('Error fetching avatars:', error);
    }
  };

  const handleTemplateSelect = async (templateKey: string) => {
    setSelectedTemplateKey(templateKey);
    setOfferSelectionMode('template');
    
    // Create offer from template
    try {
      const template = templates.find(t => t.key === templateKey);
      if (!template) return;

      setLoading(true);
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          offerCategory: template.offerCategory,
          whoItsFor: template.whoItsFor,
          coreOutcome: template.coreOutcome,
          mechanismHighLevel: template.mechanismHighLevel,
          deliveryModel: template.deliveryModel,
          priceRange: template.priceRange,
          primaryProblemsSolved: template.primaryProblemsSolved,
          emotionalDrivers: template.emotionalDrivers,
          logicalDrivers: template.logicalDrivers,
          commonSkepticismTriggers: template.commonSkepticismTriggers,
          effortRequired: template.effortRequired,
          timeToResult: template.timeToResult,
          riskReversal: template.riskReversal,
          bestFitNotes: template.bestFitNotes,
          isTemplate: false, // User's copy, not the template itself
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedOfferId(data.offer.id);
        await fetchOffers(); // Refresh offers list
      } else {
        const errorData = await response.json();
        alert('Failed to create offer: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error creating offer from template:', error);
      alert('Failed to create offer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptUpload = async () => {
    if (!transcriptText.trim() && !transcriptFile) {
      alert('Please provide a transcript or upload a file');
      return;
    }

    if (!selectedOfferId) {
      alert('Please select an offer first');
      return;
    }

    setUploadingTranscript(true);
    try {
      // Extract prospect from transcript or audio
      const formData = new FormData();
      
      if (transcriptFile) {
        // Upload audio file
        formData.append('audio', transcriptFile);
      } else if (transcriptText.trim()) {
        // Send transcript text
        formData.append('transcript', transcriptText);
      }

      const extractResponse = await fetch('/api/roleplay/extract-prospect', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract prospect');
      }

      const extractData = await extractResponse.json();
      const avatarId = extractData.avatar.id;

      // Start roleplay with extracted avatar
      const sessionResponse = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: selectedOfferId,
          prospectAvatarId: avatarId,
          inputMode: 'voice',
          mode: 'transcript_replay',
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();
      router.push(`/dashboard/roleplay/${sessionData.session.id}`);
    } catch (error: any) {
      console.error('Error processing transcript:', error);
      alert('Failed to process transcript: ' + error.message);
    } finally {
      setUploadingTranscript(false);
    }
  };

  const handleStart = async () => {
    if (!selectedOfferId) {
      alert('Please select an offer');
      return;
    }

    // If transcript replay, handle separately
    if (prospectSelectionMode === 'transcript') {
      await handleTranscriptUpload();
      return;
    }

    setLoading(true);
    try {
      let sessionData: any = {
        offerId: selectedOfferId,
        selectedDifficulty: difficulty,
        inputMode: 'voice', // Fixed to voice only
        mode: prospectSelectionMode === 'transcript' ? 'transcript_replay' : 'manual',
      };

      if (selectedAvatarId) {
        sessionData.prospectAvatarId = selectedAvatarId;
      }

      const response = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      router.push(`/dashboard/roleplay/${data.session.id}`);
    } catch (error: any) {
      console.error('Error starting roleplay:', error);
      alert('Failed to start roleplay: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceedToProspect = selectedOfferId && offerSelectionMode !== null;
  const canStart = canProceedToProspect && (prospectSelectionMode !== null || selectedAvatarId) && prospectSelectionMode !== 'transcript';

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Start New Roleplay</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Step 1: Select Offer → Step 2: Select Prospect → Step 3: Start Roleplay
        </p>
      </div>

      {/* Step 2: Offer Selection (REQUIRED) */}
      <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 2 — Offer Selection (REQUIRED)</h2>
          <p className="text-sm text-muted-foreground">
            You must select an offer before any role play can run. Prospect difficulty is relative to the offer.
          </p>
        </div>

        <Tabs value={offerSelectionMode} onValueChange={(v) => setOfferSelectionMode(v as OfferSelectionMode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="template">Option A: Use a Generic Template</TabsTrigger>
            <TabsTrigger value="custom">Option B: Create Your Own Offer</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={`p-4 cursor-pointer transition-all hover:border-primary ${
                    selectedTemplateKey === template.key ? 'border-primary border-2' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template.key)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    <Badge variant="outline">Template</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{template.whoItsFor}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.primaryProblemsSolved.length} problems • {template.deliveryModel} • {template.priceRange}
                  </p>
                </Card>
              ))}
            </div>
            {selectedTemplateKey && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm">
                  <strong>Selected:</strong> {templates.find(t => t.key === selectedTemplateKey)?.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can edit this template after creating it, or proceed to prospect selection.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select Your Offer</Label>
              <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
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
              <p className="text-sm text-muted-foreground">
                Choose from your existing offers
              </p>
              {offers.length === 0 && (
                <p className="text-sm text-orange-500 mt-1">
                  <Link href="/dashboard/offers/new" className="underline">
                    Create an offer
                  </Link> to use in roleplays
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Step 3: Prospect Selection */}
      {canProceedToProspect && (
        <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6 mb-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Step 3 — Prospect Selection</h2>
            <p className="text-sm text-muted-foreground">
              Choose how the prospect is generated for this roleplay
            </p>
          </div>

          <Tabs value={prospectSelectionMode} onValueChange={(v) => setProspectSelectionMode(v as ProspectSelectionMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="difficulty">Option A: Difficulty Preset</TabsTrigger>
              <TabsTrigger value="manual">Option B: Manual Builder</TabsTrigger>
              <TabsTrigger value="transcript">Option C: Transcript Replay</TabsTrigger>
            </TabsList>

            <TabsContent value="difficulty" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy (35-40 points)</SelectItem>
                    <SelectItem value="realistic">Realistic (30-35 points)</SelectItem>
                    <SelectItem value="hard">Hard (25-30 points)</SelectItem>
                    <SelectItem value="elite">Elite (20-25 points)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  AI will randomly generate a prospect whose total difficulty score falls within the selected band
                </p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Saved Prospect Avatar</Label>
                <Select value={selectedAvatarId} onValueChange={setSelectedAvatarId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a prospect avatar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Create New Prospect</SelectItem>
                    {Array.isArray(avatars) && avatars.length > 0 ? (
                      avatars.map((avatar) => (
                        <SelectItem key={avatar.id} value={avatar.id}>
                          {avatar.name} ({avatar.difficultyTier || 'unknown'})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No saved avatars yet
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Select from your saved prospect avatars, or create a new one
                </p>
                <div className="flex gap-2">
                  <Link href="/dashboard/prospect-avatars/new">
                    <Button variant="outline" size="sm" type="button">
                      Create New Prospect Avatar
                    </Button>
                  </Link>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Transcript or Audio</Label>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept=".txt,.md,.mp3,.wav,.m4a"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type.startsWith('audio/')) {
                            setTranscriptFile(file);
                          } else {
                            file.text().then(setTranscriptText);
                          }
                        }
                      }}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Or Paste Transcript Text</Label>
                  <Textarea
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder="Paste your sales call transcript here..."
                    rows={6}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  AI will analyze the prospect-side language and recreate the prospect for roleplay
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={loading || uploadingTranscript}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleStart}
          disabled={!canStart || loading || uploadingTranscript}
          className="flex-1 w-full sm:w-auto"
        >
          {loading || uploadingTranscript ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {uploadingTranscript ? 'Processing...' : 'Starting...'}
            </>
          ) : (
            'Start Roleplay'
          )}
        </Button>
      </div>
    </div>
  );
}
