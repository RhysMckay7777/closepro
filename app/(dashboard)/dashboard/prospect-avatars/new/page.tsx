'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormPageSkeleton } from '@/components/dashboard/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { toastError } from '@/lib/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function NewProspectAvatarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams?.get('offerId');
  const [loading, setLoading] = useState(false);

  // Redirect if accessed directly - prospects must be created within offers
  useEffect(() => {
    if (!offerId) {
      router.push('/dashboard/offers');
    }
  }, [offerId, router]);
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
    executionResistance: 'medium' as 'fully_able' | 'partial' | 'extreme' | 'auto',
    positionDescription: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toastError('Please provide a name for this prospect avatar');
      return;
    }

    const problems = formData.problems.filter(p => p.trim());
    if (problems.length === 0) {
      toastError('Please provide at least one problem');
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

      // Map execution resistance
      let executionResistance: number;
      if (formData.executionResistance === 'auto') {
        // Default to medium (5) - could be enhanced with offer-based calculation
        executionResistance = 5;
      } else {
        const executionResistanceMap: Record<string, number> = {
          'fully_able': 9, // 8-10 range, use 9 as midpoint
          'partial': 6, // 5-7 range, use 6 as midpoint
          'extreme': 2, // 1-4 range, use 2 as midpoint
        };
        executionResistance = executionResistanceMap[formData.executionResistance] || 5;
      }

      if (!offerId) {
        toastError('Offer ID is required. Please create prospects from within an offer.');
        router.push('/dashboard/offers');
        return;
      }

      const response = await fetch('/api/prospect-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offerId,
          name: formData.name,
          positionProblemAlignment,
          painAmbitionIntensity,
          perceivedNeedForHelp,
          authorityLevel: formData.authorityLevel,
          funnelContext,
          executionResistance,
          positionDescription: formData.positionDescription,
          problems: problems,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create avatar');
      }

      router.push(`/dashboard/offers/${offerId}`);
    } catch (error: unknown) {
      console.error('Error creating avatar:', error);
      toastError('Failed to create avatar: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        {offerId && (
          <Link href={`/dashboard/offers/${offerId}`}>
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Offer
            </Button>
          </Link>
        )}
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
                <div className="flex items-center gap-2">
                  <Label htmlFor="positionAlignment">Position Alignment (Relative to the Offer)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        How closely does this prospect match your ideal customer profile (ICP) for this offer?
                        High alignment means they perfectly fit your target market, while low alignment indicates
                        they may be outside your typical customer base.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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
                    How strong is the prospect&apos;s desire to reach their desired result?
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
                <div className="flex items-center gap-2">
                  <Label htmlFor="funnelContext">Funnel Context</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        The entry point or journey stage where this prospect entered your sales funnel.
                        This affects their awareness level, trust, and readiness to buy. Examples range
                        from cold outbound (low awareness) to referrals or existing customers (high trust).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
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

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="executionResistance">Execution Resistance (Ability to Proceed)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        The prospect&apos;s practical ability to take action, independent of their emotional
                        interest. This measures logistical constraints like budget availability, time
                        capacity, decision-making authority, and ability to implement. This is about
                        capability, not desire.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.executionResistance}
                  onValueChange={(value: 'fully_able' | 'partial' | 'extreme' | 'auto') =>
                    setFormData({ ...formData, executionResistance: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-calculate (default)</SelectItem>
                    <SelectItem value="fully_able">Fully Able (8-10) - Has money, time, authority</SelectItem>
                    <SelectItem value="partial">Partial Ability (5-7) - Needs reprioritization</SelectItem>
                    <SelectItem value="extreme">Extreme Resistance (1-4) - Severe constraints</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Measures whether the prospect has practical ability to act (money, time, effort capacity, decision authority).
                  This is logistical, not emotional.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            {offerId ? (
              <Link href={`/dashboard/offers/${offerId}`} className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard/offers" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            )}
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

export default function NewProspectAvatarPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NewProspectAvatarContent />
    </Suspense>
  );
}
