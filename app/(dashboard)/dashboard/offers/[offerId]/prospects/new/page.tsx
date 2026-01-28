'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Upload } from 'lucide-react';
import Link from 'next/link';
import { toastError, toastSuccess } from '@/lib/toast';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function NewProspectPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;
  const [loading, setLoading] = useState(false);
  const [uploadingTranscript, setUploadingTranscript] = useState(false);
  const [offer, setOffer] = useState<any>(null);

  // Slider-based form data (0-10 for each dimension)
  const [formData, setFormData] = useState({
    name: '',
    positionProblemAlignment: 5,
    painAmbitionIntensity: 5,
    perceivedNeedForHelp: 5,
    authorityLevel: 'peer' as 'advisee' | 'peer' | 'advisor',
    funnelContext: 5,
    executionResistance: 5,
    positionDescription: '',
    problems: [''],
  });

  // Transcript upload
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);

  useEffect(() => {
    fetchOffer();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}`);
      if (response.ok) {
        const data = await response.json();
        setOffer(data.offer);
      }
    } catch (error) {
      console.error('Error fetching offer:', error);
    }
  };

  // Calculate difficulty in real-time
  const calculateDifficulty = () => {
    let authorityScore = formData.perceivedNeedForHelp;
    if (formData.authorityLevel === 'advisor') {
      authorityScore = Math.max(0, authorityScore - 3);
    } else if (formData.authorityLevel === 'peer') {
      authorityScore = Math.max(0, authorityScore - 1);
    }

    const { index, tier } = calculateDifficultyIndex(
      formData.positionProblemAlignment,
      formData.painAmbitionIntensity,
      formData.perceivedNeedForHelp,
      formData.authorityLevel,
      formData.funnelContext,
      formData.executionResistance
    );

    return { index, tier };
  };

  const difficulty = calculateDifficulty();

  const getDifficultyColor = (tier: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/20 text-green-600 border-green-500/50',
      realistic: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
      hard: 'bg-orange-500/20 text-orange-600 border-orange-500/50',
      elite: 'bg-red-500/20 text-red-600 border-red-500/50',
      near_impossible: 'bg-purple-500/20 text-purple-600 border-purple-500/50',
    };
    return colors[tier] || 'bg-gray-500/20 text-gray-600 border-gray-500/50';
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toastError('Please provide a name for this prospect');
      return;
    }

    const problems = formData.problems.filter(p => p.trim());
    if (problems.length === 0) {
      toastError('Please provide at least one problem');
      return;
    }

    setLoading(true);
    try {
      let authorityScore = formData.perceivedNeedForHelp;
      if (formData.authorityLevel === 'advisor') {
        authorityScore = Math.max(0, authorityScore - 3);
      } else if (formData.authorityLevel === 'peer') {
        authorityScore = Math.max(0, authorityScore - 1);
      }

      const { index: difficultyIndex, tier: difficultyTier } = calculateDifficultyIndex(
        formData.positionProblemAlignment,
        formData.painAmbitionIntensity,
        formData.perceivedNeedForHelp,
        formData.authorityLevel,
        formData.funnelContext,
        formData.executionResistance
      );

      const response = await fetch('/api/prospect-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offerId,
          name: formData.name,
          positionProblemAlignment: formData.positionProblemAlignment,
          painAmbitionIntensity: formData.painAmbitionIntensity,
          perceivedNeedForHelp: formData.perceivedNeedForHelp,
          authorityLevel: formData.authorityLevel,
          funnelContext: formData.funnelContext,
          executionResistance: formData.executionResistance,
          positionDescription: formData.positionDescription,
          problems: problems,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create prospect');
      }

      router.push(`/dashboard/offers/${offerId}`);
    } catch (error: any) {
      console.error('Error creating prospect:', error);
      toastError('Failed to create prospect: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptUpload = async () => {
    if (!transcriptText.trim() && !transcriptFile) {
      toastError('Please provide a transcript or upload a file');
      return;
    }

    setUploadingTranscript(true);
    try {
      const formData = new FormData();
      
      if (transcriptFile) {
        formData.append('audio', transcriptFile);
      } else if (transcriptText.trim()) {
        formData.append('transcript', transcriptText);
      }

      formData.append('offerId', offerId);

      const extractResponse = await fetch('/api/roleplay/extract-prospect', {
        method: 'POST',
        body: formData,
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract prospect');
      }

      const extractData = await extractResponse.json();
      
      // Auto-populate form with extracted data
      if (extractData.avatar) {
        setFormData({
          name: extractData.avatar.name || '',
          positionProblemAlignment: extractData.avatar.positionProblemAlignment || 5,
          painAmbitionIntensity: extractData.avatar.painAmbitionIntensity || 5,
          perceivedNeedForHelp: extractData.avatar.perceivedNeedForHelp || 5,
          authorityLevel: extractData.avatar.authorityLevel || 'peer',
          funnelContext: extractData.avatar.funnelContext || 5,
          executionResistance: extractData.avatar.executionResistance || 5,
          positionDescription: extractData.avatar.positionDescription || '',
          problems: extractData.avatar.problems ? JSON.parse(extractData.avatar.problems) : [''],
        });
        
        // Switch to manual tab to show extracted data
        toastSuccess('Prospect extracted! Review and adjust the values below, then click "Create Prospect".');
      } else {
        router.push(`/dashboard/offers/${offerId}`);
      }
    } catch (error: any) {
      console.error('Error processing transcript:', error);
      toastError('Failed to process transcript: ' + error.message);
    } finally {
      setUploadingTranscript(false);
    }
  };

  const mapFunnelContextToScore = (context: string): number => {
    const map: Record<string, number> = {
      'cold_outbound_direct': 1,
      'cold_outbound_discovery': 2,
      'cold_ads': 3,
      'warm_inbound': 5,
      'content_educated': 7,
      'referral': 9,
      'tripwire': 6,
      'existing_customer': 10,
    };
    return map[context] || 5;
  };

  const mapScoreToFunnelContext = (score: number): string => {
    if (score <= 1) return 'cold_outbound_direct';
    if (score <= 2) return 'cold_outbound_discovery';
    if (score <= 3) return 'cold_ads';
    if (score <= 5) return 'warm_inbound';
    if (score <= 6) return 'tripwire';
    if (score <= 7) return 'content_educated';
    if (score <= 9) return 'referral';
    return 'existing_customer';
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Link href={`/dashboard/offers/${offerId}`}>
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offer
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Create New Prospect</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          {offer?.name && `For offer: ${offer.name}`}
        </p>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Builder</TabsTrigger>
          <TabsTrigger value="transcript">Upload Transcript</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <form onSubmit={handleManualSubmit}>
            <Card className="p-4 sm:p-6 space-y-6">
              {/* Live Difficulty Display */}
              <div className="p-4 bg-muted rounded-lg border-2 border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Difficulty Score</h3>
                  <Badge className={getDifficultyColor(difficulty.tier)}>
                    {difficulty.tier.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-3xl font-bold">{difficulty.index}/50</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Adjust sliders below to change difficulty. Score updates in real-time.
                </p>
              </div>

              {/* Basic Information */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Basic Information</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="name">Prospect Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Skeptical Business Owner"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="positionDescription">Position Description</Label>
                  <Textarea
                    id="positionDescription"
                    value={formData.positionDescription}
                    onChange={(e) => setFormData({ ...formData, positionDescription: e.target.value })}
                    placeholder="Describe the prospect's current situation relative to the offer"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Problems (Offer-Relevant)</Label>
                  {formData.problems.map((problem, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={problem}
                        onChange={(e) => {
                          const updated = [...formData.problems];
                          updated[index] = e.target.value;
                          setFormData({ ...formData, problems: updated });
                        }}
                        placeholder="e.g., Lack of time to exercise"
                      />
                      {formData.problems.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const updated = formData.problems.filter((_, i) => i !== index);
                            setFormData({ ...formData, problems: updated });
                          }}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, problems: [...formData.problems, ''] })}
                  >
                    Add Another Problem
                  </Button>
                </div>
              </div>

              {/* Difficulty Sliders */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Difficulty Dimensions</h2>
                <p className="text-sm text-muted-foreground">
                  Adjust each slider to set the prospect's difficulty profile. The total score updates automatically.
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Position & Problem Alignment</Label>
                      <span className="text-sm font-medium">{formData.positionProblemAlignment}/10</span>
                    </div>
                    <Slider
                      value={[formData.positionProblemAlignment]}
                      onValueChange={(value) => setFormData({ ...formData, positionProblemAlignment: value[0] })}
                      min={0}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      How well does the prospect's position align with the offer's ICP?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Pain / Ambition Intensity</Label>
                      <span className="text-sm font-medium">{formData.painAmbitionIntensity}/10</span>
                    </div>
                    <Slider
                      value={[formData.painAmbitionIntensity]}
                      onValueChange={(value) => setFormData({ ...formData, painAmbitionIntensity: value[0] })}
                      min={0}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Strength of pain or ambition driving the prospect
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Perceived Need for Help</Label>
                      <span className="text-sm font-medium">{formData.perceivedNeedForHelp}/10</span>
                    </div>
                    <Slider
                      value={[formData.perceivedNeedForHelp]}
                      onValueChange={(value) => setFormData({ ...formData, perceivedNeedForHelp: value[0] })}
                      min={0}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      How aware is the prospect that they need external help?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Authority Level</Label>
                    <Select
                      value={formData.authorityLevel}
                      onValueChange={(value: 'advisee' | 'peer' | 'advisor') => 
                        setFormData({ ...formData, authorityLevel: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advisee">Advisee (Low authority – easy)</SelectItem>
                        <SelectItem value="peer">Peer (Medium authority)</SelectItem>
                        <SelectItem value="advisor">Advisor (High authority – difficult)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      How does the prospect see themselves relative to the closer?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Funnel Context</Label>
                      <span className="text-sm font-medium">{formData.funnelContext}/10</span>
                    </div>
                    <Slider
                      value={[formData.funnelContext]}
                      onValueChange={(value) => setFormData({ ...formData, funnelContext: value[0] })}
                      min={0}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      How warm/cold is the prospect? (0-3 cold, 4-6 warm, 7-8 educated, 9-10 referral)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Execution Resistance</Label>
                      <span className="text-sm font-medium">{formData.executionResistance}/10</span>
                    </div>
                    <Slider
                      value={[formData.executionResistance]}
                      onValueChange={(value) => setFormData({ ...formData, executionResistance: value[0] })}
                      min={1}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ability to proceed: money, time, effort capacity, decision authority
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formData.executionResistance >= 8 
                        ? 'Fully Able - Has money, time, authority'
                        : formData.executionResistance >= 5
                        ? 'Partial Ability - Needs reprioritization'
                        : 'Extreme Resistance - Severe constraints'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Link href={`/dashboard/offers/${offerId}`} className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={loading} className="flex-1 w-full sm:w-auto">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Prospect'
                  )}
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="transcript">
          <Card className="p-4 sm:p-6 space-y-4">
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
                  rows={8}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                AI will analyze the prospect-side language and extract prospect details. You can review and adjust before saving.
              </p>
              <Button
                onClick={handleTranscriptUpload}
                disabled={uploadingTranscript || (!transcriptText.trim() && !transcriptFile)}
                className="w-full"
              >
                {uploadingTranscript ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting Prospect...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Extract Prospect from Transcript
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
