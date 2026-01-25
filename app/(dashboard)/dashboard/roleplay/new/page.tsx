'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText } from 'lucide-react';
import Link from 'next/link';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

interface ProspectAvatar {
  id: string;
  name: string;
  difficultyTier: string;
}

interface SalesCall {
  id: string;
  fileName: string;
  transcript: string;
}

export default function NewRoleplayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'transcript_replay'>('manual');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [avatars, setAvatars] = useState<ProspectAvatar[]>([]);
  const [calls, setCalls] = useState<SalesCall[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [selectedCallId, setSelectedCallId] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('intermediate');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');

  useEffect(() => {
    fetchOffers();
    fetchAvatars();
    if (mode === 'transcript_replay') {
      fetchCalls();
    }
  }, [mode]);

  const fetchOffers = async () => {
    try {
      const response = await fetch('/api/offers');
      if (!response.ok) throw new Error('Failed to fetch offers');
      const data = await response.json();
      
      if (data.offers && data.offers.length > 0) {
        setOffers(data.offers);
        setSelectedOfferId(data.offers[0].id);
      } else {
        setOffers([
          { id: 'default', name: 'Default Practice Offer', offerCategory: 'b2c_wealth' },
        ]);
        setSelectedOfferId('default');
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      setOffers([
        { id: 'default', name: 'Default Practice Offer', offerCategory: 'b2c_wealth' },
      ]);
      setSelectedOfferId('default');
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

  const fetchCalls = async () => {
    try {
      const response = await fetch('/api/calls');
      if (response.ok) {
        const data = await response.json();
        // Filter calls with transcripts
        const callsWithTranscripts = (data.calls || []).filter(
          (call: SalesCall) => call.transcript
        );
        setCalls(callsWithTranscripts);
      }
    } catch (error) {
      console.error('Error fetching calls:', error);
    }
  };

  const handleStart = async () => {
    if (!selectedOfferId) {
      alert('Please select an offer');
      return;
    }

    if (mode === 'transcript_replay' && !selectedCallId) {
      alert('Please select a call to replay');
      return;
    }

    setLoading(true);
    try {
      let sessionData: any = {
        offerId: selectedOfferId === 'default' ? 'default' : selectedOfferId,
        selectedDifficulty: difficulty,
        inputMode,
        mode,
      };

      if (selectedAvatarId) {
        sessionData.prospectAvatarId = selectedAvatarId;
      }

      if (mode === 'transcript_replay' && selectedCallId) {
        sessionData.sourceCallId = selectedCallId;
        
        // Extract prospect from transcript first
        try {
          const extractResponse = await fetch('/api/roleplay/extract-prospect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callId: selectedCallId }),
          });

          if (extractResponse.ok) {
            const extractData = await extractResponse.json();
            sessionData.prospectAvatarId = extractData.avatar.id;
          }
        } catch (error) {
          console.error('Error extracting prospect:', error);
          // Continue anyway - will use difficulty selection
        }
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

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Start New Roleplay</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Configure your roleplay session
        </p>
      </div>

      <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Mode Selection */}
        <div className="space-y-2">
          <Label>Roleplay Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'manual' | 'transcript_replay')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual Roleplay</SelectItem>
              <SelectItem value="transcript_replay">Replay from Transcript</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {mode === 'manual' 
              ? 'Practice with a custom prospect'
              : 'Replay a real call to practice handling the same prospect'}
          </p>
        </div>

        {/* Transcript Selection (for replay mode) */}
        {mode === 'transcript_replay' && (
          <div className="space-y-2">
            <Label>Select Call to Replay</Label>
            <Select value={selectedCallId} onValueChange={setSelectedCallId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a call" />
              </SelectTrigger>
              <SelectContent>
                {calls.length === 0 ? (
                  <SelectItem value="" disabled>No calls with transcripts available</SelectItem>
                ) : (
                  calls.map((call) => (
                    <SelectItem key={call.id} value={call.id}>
                      {call.fileName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              The AI will extract the prospect profile from this call
            </p>
          </div>
        )}

        {/* Offer Selection */}
        <div className="space-y-2">
          <Label>Offer</Label>
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
            The offer you'll be selling in this roleplay
          </p>
          {offers.length === 0 || (offers.length === 1 && offers[0].id === 'default') ? (
            <p className="text-sm text-orange-500 mt-1">
              <Link href="/dashboard/offers/new" className="underline">
                Create an offer
              </Link> to use in roleplays
            </p>
          ) : null}
        </div>

        {/* Prospect Avatar Selection (optional, for manual mode) */}
        {mode === 'manual' && avatars.length > 0 && (
          <div className="space-y-2">
            <Label>Prospect Avatar (Optional)</Label>
            <Select value={selectedAvatarId} onValueChange={setSelectedAvatarId}>
              <SelectTrigger>
                <SelectValue placeholder="Use default or select avatar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default (based on difficulty)</SelectItem>
                {avatars.map((avatar) => (
                  <SelectItem key={avatar.id} value={avatar.id}>
                    {avatar.name} ({avatar.difficultyTier})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Use a saved prospect profile, or let AI generate one based on difficulty
            </p>
          </div>
        )}

        {/* Difficulty Selection (for manual mode or if no avatar selected) */}
        {mode === 'manual' && (
          <div className="space-y-2">
            <Label>Difficulty Level</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy - Open and cooperative</SelectItem>
                <SelectItem value="intermediate">Intermediate - Realistic challenge</SelectItem>
                <SelectItem value="hard">Hard - Guarded and skeptical</SelectItem>
                <SelectItem value="expert">Expert - Elite level difficulty</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How difficult the prospect should be (if not using a saved avatar)
            </p>
          </div>
        )}

        {/* Input Mode */}
        <div className="space-y-2">
          <Label>Input Mode</Label>
          <Select value={inputMode} onValueChange={(v) => setInputMode(v as 'text' | 'voice')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text Chat</SelectItem>
              <SelectItem value="voice">Voice Chat</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            How you'll communicate during the roleplay
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading}
            className="flex-1 w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              'Start Roleplay'
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
