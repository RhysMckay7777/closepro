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
import { calculateDifficultyIndex } from '@/lib/ai/roleplay/prospect-avatar';

export default function NewProspectAvatarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Helper to map High/Medium/Low to 1-10
  const mapLevelToScore = (level: 'high' | 'medium' | 'low'): number => {
    switch (level) {
      case 'high': return 8;
      case 'medium': return 5;
      case 'low': return 2;
      default: return 5;
    }
  };

  const [formData, setFormData] = useState({
    name: '',
    positionAlignment: 'medium' as 'high' | 'medium' | 'low',
    problems: [''],
    painLevel: 'medium' as 'high' | 'medium' | 'low',
    ambitionLevel: 'medium' as 'high' | 'medium' | 'low',
    perceivedNeedForHelp: 'medium' as 'high' | 'medium' | 'low',
    authorityLevel: 'peer' as 'advisee' | 'peer' | 'advisor',
    funnelContext: 'warm_inbound',
    positionDescription: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Please provide a name for this prospect avatar');
      return;
    }

    const problems = formData.problems.filter(p => p.trim());
    if (problems.length === 0) {
      alert('Please provide at least one problem');
      return;
    }

    setLoading(true);
    try {
      // Map levels to scores
      const positionProblemAlignment = mapLevelToScore(formData.positionAlignment);
      
      // Pain/Ambition: use the higher of the two
      const painScore = mapLevelToScore(formData.painLevel);
      const ambitionScore = mapLevelToScore(formData.ambitionLevel);
      const painAmbitionIntensity = Math.max(painScore, ambitionScore);
      
      // Perceived need for help - map based on authority level
      const baseNeedScore = mapLevelToScore(formData.perceivedNeedForHelp);
      let perceivedNeedForHelp = baseNeedScore;
      
      // Adjust based on authority level (API will handle final calculation)
      if (formData.authorityLevel === 'advisor') {
        perceivedNeedForHelp = Math.max(1, Math.min(3, baseNeedScore));
      } else if (formData.authorityLevel === 'peer') {
        perceivedNeedForHelp = Math.max(4, Math.min(7, baseNeedScore));
      } else {
        // advisee
        perceivedNeedForHelp = Math.max(8, Math.min(10, baseNeedScore));
      }

      // Map funnel context to score
      const funnelContextMap: Record<string, number> = {
        'cold_outbound_direct': 1,
        'cold_outbound_discovery': 2,
        'cold_ads': 3,
        'warm_inbound': 5,
        'content_educated': 7,
        'referral': 9,
        'tripwire': 6,
        'existing_customer': 10,
      };
      const funnelContext = funnelContextMap[formData.funnelContext] || 5;

      const response = await fetch('/api/prospect-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          positionProblemAlignment,
          painAmbitionIntensity,
          perceivedNeedForHelp,
          authorityLevel: formData.authorityLevel,
          funnelContext,
          positionDescription: formData.positionDescription,
          problems: problems,
        }),
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
              <Label htmlFor="name">Prospect Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Skeptical Business Owner"
                required
              />
              <p className="text-xs text-muted-foreground">Free text for realism and replay reference</p>
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
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Prospect Difficulty Profile</h2>
            <p className="text-sm text-muted-foreground">
              These inputs are converted into numeric scores (1–10 per dimension) for the 40-point difficulty model
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="positionAlignment">Position Alignment (Relative to the Offer)</Label>
                <Select
                  value={formData.positionAlignment}
                  onValueChange={(value: 'high' | 'medium' | 'low') => 
                    setFormData({ ...formData, positionAlignment: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High - Perfect ICP match</SelectItem>
                    <SelectItem value="medium">Medium - Partial fit</SelectItem>
                    <SelectItem value="low">Low - Weak fit</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How close is this prospect to the ideal customer for this offer?
                </p>
              </div>

              <div className="space-y-2">
                <Label>Problems (Offer-Relevant)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  What problems does this prospect have that the offer is designed to solve?
                </p>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="painLevel">Pain Level</Label>
                  <Select
                    value={formData.painLevel}
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setFormData({ ...formData, painLevel: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How much pain does the prospect feel from these problems?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ambitionLevel">Ambition Level</Label>
                  <Select
                    value={formData.ambitionLevel}
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setFormData({ ...formData, ambitionLevel: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How strong is the prospect's desire to reach their desired result?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perceivedNeedForHelp">Perceived Need for Help</Label>
                  <Select
                    value={formData.perceivedNeedForHelp}
                    onValueChange={(value: 'high' | 'medium' | 'low') => 
                      setFormData({ ...formData, perceivedNeedForHelp: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How aware is the prospect that they need external help?
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authorityLevel">Authority Level (Relative to Seller)</Label>
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
                <Label htmlFor="funnelContext">Funnel Context</Label>
                <Select
                  value={formData.funnelContext}
                  onValueChange={(value) => setFormData({ ...formData, funnelContext: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold_outbound_direct">Cold outbound → straight to call</SelectItem>
                    <SelectItem value="cold_outbound_discovery">Cold outbound → discovery → call</SelectItem>
                    <SelectItem value="cold_ads">Cold ads</SelectItem>
                    <SelectItem value="warm_inbound">Warm inbound</SelectItem>
                    <SelectItem value="content_educated">Content-educated inbound</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="tripwire">Tripwire → call</SelectItem>
                    <SelectItem value="existing_customer">Upsell / existing customer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How did this prospect come onto the call?
                </p>
              </div>
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
