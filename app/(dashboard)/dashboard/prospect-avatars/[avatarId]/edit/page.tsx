'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toastError } from '@/lib/toast';

export default function EditProspectAvatarPage() {
  const router = useRouter();
  const params = useParams();
  const avatarId = params.avatarId as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Authority Level / Perceived Need = one score 1–10 (1–3 Advisor, 4–7 Peer, 8–10 Advisee)
  const authorityFromScore = (score: number): 'advisee' | 'peer' | 'advisor' =>
    score <= 3 ? 'advisor' : score <= 7 ? 'peer' : 'advisee';

  const [offerId, setOfferId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    positionProblemAlignment: 5,
    painAmbitionIntensity: 5,
    authorityPerceivedScore: 5,
    funnelContext: 5,
    positionDescription: '',
    voiceStyle: '',
  });

  useEffect(() => {
    fetchAvatar();
  }, [avatarId]);

  const fetchAvatar = async () => {
    try {
      const response = await fetch(`/api/prospect-avatars/${avatarId}`);
      if (!response.ok) throw new Error('Failed to fetch avatar');
      const data = await response.json();
      const avatar = data.avatar;
      if (avatar.offerId) setOfferId(avatar.offerId);

      const p = avatar.perceivedNeedForHelp;
      const a = avatar.authorityLevel;
      const score = typeof p === 'number' ? p : a === 'advisor' ? 2 : a === 'peer' ? 5 : 9;
      setFormData({
        name: avatar.name || '',
        positionProblemAlignment: avatar.positionProblemAlignment || 5,
        painAmbitionIntensity: avatar.painAmbitionIntensity || 5,
        authorityPerceivedScore: score,
        funnelContext: avatar.funnelContext || 5,
        positionDescription: avatar.positionDescription || '',
        voiceStyle: avatar.voiceStyle || '',
      });
    } catch (error) {
      console.error('Error fetching avatar:', error);
      toastError('Failed to load avatar');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toastError('Please provide a name for this prospect avatar');
      return;
    }

    setSaving(true);
    try {
      const perceivedNeedForHelp = formData.authorityPerceivedScore;
      const authorityLevel = authorityFromScore(perceivedNeedForHelp);
      const response = await fetch(`/api/prospect-avatars/${avatarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          positionProblemAlignment: formData.positionProblemAlignment,
          painAmbitionIntensity: formData.painAmbitionIntensity,
          perceivedNeedForHelp,
          authorityLevel,
          funnelContext: formData.funnelContext,
          positionDescription: formData.positionDescription,
          voiceStyle: formData.voiceStyle.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update avatar');
      }

      if (offerId) {
        router.push(`/dashboard/offers/${offerId}`);
      } else {
        router.back();
      }
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      toastError('Failed to update avatar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading avatar...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => offerId ? router.push(`/dashboard/offers/${offerId}`) : router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold">Edit Prospect Avatar</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Update prospect profile details
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Same form structure as new page */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Avatar Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="positionDescription">Profile overview</Label>
              <Textarea
                id="positionDescription"
                value={formData.positionDescription}
                onChange={(e) => setFormData({ ...formData, positionDescription: e.target.value })}
                placeholder="e.g. Busy dad, sceptical about coaching"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceStyle">Voice style (optional)</Label>
              <Input
                id="voiceStyle"
                value={formData.voiceStyle}
                onChange={(e) => setFormData({ ...formData, voiceStyle: e.target.value })}
                placeholder="e.g. Professional, Friendly, or ElevenLabs voice ID"
              />
              <p className="text-xs text-muted-foreground">
                Enter an ElevenLabs voice ID (e.g., 21m00Tcm4TlvDq8ikWAM) or a style like &apos;Professional&apos;, &apos;Friendly&apos;, &apos;Authoritative&apos;. Leave empty to auto-select based on character.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Difficulty Profile (40-Point Model)</h2>
            <p className="text-sm text-muted-foreground">
              Adjust these values to set the prospect's difficulty level
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="positionProblemAlignment">
                  Position & Problem Alignment: {formData.positionProblemAlignment}/10
                </Label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.positionProblemAlignment}
                  onChange={(e) => setFormData({ ...formData, positionProblemAlignment: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="painAmbitionIntensity">
                  Pain / Ambition Intensity: {formData.painAmbitionIntensity}/10
                </Label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.painAmbitionIntensity}
                  onChange={(e) => setFormData({ ...formData, painAmbitionIntensity: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="authorityPerceivedScore">
                  Authority Level / Perceived Need for Help: {formData.authorityPerceivedScore}/10
                </Label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.authorityPerceivedScore}
                  onChange={(e) => setFormData({ ...formData, authorityPerceivedScore: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  1–3 Advisor, 4–7 Peer, 8–10 Advisee
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="funnelContext">
                  Funnel Context / Warmth: {formData.funnelContext}/10
                </Label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.funnelContext}
                  onChange={(e) => setFormData({ ...formData, funnelContext: parseInt(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button type="button" variant="outline" className="w-full flex-1" onClick={() => offerId ? router.push(`/dashboard/offers/${offerId}`) : router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
