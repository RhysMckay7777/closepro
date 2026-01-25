'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewProspectAvatarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    positionProblemAlignment: 5,
    painAmbitionIntensity: 5,
    perceivedNeedForHelp: 5,
    authorityLevel: 'peer' as 'advisee' | 'peer' | 'advisor',
    funnelContext: 5,
    positionDescription: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Please provide a name for this prospect avatar');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/prospect-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create avatar');
      }

      router.push('/dashboard/prospect-avatars');
    } catch (error: any) {
      console.error('Error creating avatar:', error);
      alert('Failed to create avatar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/prospect-avatars">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Avatars
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Create Prospect Avatar</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Define a prospect profile for roleplay training
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Avatar Name *</Label>
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
                placeholder="Describe the prospect's current situation"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Difficulty Profile (40-Point Model)</h2>
            <p className="text-sm text-muted-foreground">
              Adjust these values to set the prospect's difficulty level
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-xs text-muted-foreground">
                  How well prospect's position aligns with offer
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Strength of motivation to change
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="perceivedNeedForHelp">
                  Perceived Need for Help: {formData.perceivedNeedForHelp}/10
                </Label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.perceivedNeedForHelp}
                  onChange={(e) => setFormData({ ...formData, perceivedNeedForHelp: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  How much they believe they need help
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
                <p className="text-xs text-muted-foreground">
                  0-3: Cold, 4-6: Warm, 7-8: Educated, 9-10: Referral
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="authorityLevel">Authority Level</Label>
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
                  <SelectItem value="advisee">Advisee (Open, deferential)</SelectItem>
                  <SelectItem value="peer">Peer (Reserved, evaluative)</SelectItem>
                  <SelectItem value="advisor">Advisor (Challenges, teaches)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Link href="/dashboard/prospect-avatars" className="flex-1">
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
                'Create Avatar'
              )}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
