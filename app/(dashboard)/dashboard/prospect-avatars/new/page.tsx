'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormPageSkeleton } from '@/components/dashboard/skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
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

  const [formData, setFormData] = useState({
    name: '',
    problems: [''],
    positionDescription: '',
    // 5 sliders (1-10 each)
    positionProblemAlignment: 5, // 1-10
    painAmbitionIntensity: 5, // 1-10 (combines pain and ambition)
    perceivedNeedForHelpAuthority: 5, // 1-10 (combines perceived need and authority)
    funnelContext: 5, // 1-10
    abilityToProceed: 5, // 1-10 (execution resistance)
  });

  // Calculate total difficulty score (0-50)
  const calculateDifficultyScore = () => {
    return (
      formData.positionProblemAlignment +
      formData.painAmbitionIntensity +
      formData.perceivedNeedForHelpAuthority +
      formData.funnelContext +
      formData.abilityToProceed
    );
  };

  // Get difficulty tier label
  const getDifficultyTier = (score: number): string => {
    if (score >= 43) return 'Easy';
    if (score >= 37) return 'Realistic';
    if (score >= 31) return 'Hard';
    return 'Elite';
  };

  const difficultyScore = calculateDifficultyScore();
  const difficultyTier = getDifficultyTier(difficultyScore);

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
      // Use slider values directly
      const positionProblemAlignment = formData.positionProblemAlignment;
      const painAmbitionIntensity = formData.painAmbitionIntensity;
      const perceivedNeedForHelp = formData.perceivedNeedForHelpAuthority;
      const funnelContext = formData.funnelContext;
      const executionResistance = formData.abilityToProceed;

      // Map perceivedNeedForHelpAuthority to authorityLevel for API compatibility
      // Low (1-3) = advisor, Medium (4-7) = peer, High (8-10) = advisee
      let authorityLevel: 'advisee' | 'peer' | 'advisor';
      if (perceivedNeedForHelp <= 3) {
        authorityLevel = 'advisor';
      } else if (perceivedNeedForHelp <= 7) {
        authorityLevel = 'peer';
      } else {
        authorityLevel = 'advisee';
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
          authorityLevel,
          funnelContext,
          executionResistance,
          positionDescription: formData.positionDescription,
          problems: problems,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to create avatar');
      }

      router.push(`/dashboard/offers/${offerId}`);
    } catch (error: unknown) {
      console.error('Error creating avatar:', error);
      toastError(error instanceof Error ? error.message : 'Failed to create avatar');
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
              <Label htmlFor="positionDescription">Profile overview</Label>
              <Textarea
                id="positionDescription"
                value={formData.positionDescription}
                onChange={(e) => setFormData({ ...formData, positionDescription: e.target.value })}
                placeholder="Describe the prospect's current position as it relates to your offer, and the current problems that they are facing (the more detailed the better, because this is how the AI will play your prospect)"
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Include demographics, constraints, and relevant context. The more detailed, the better the AI will play this prospect.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Prospect Difficulty Profile</h2>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  Difficulty Score: {difficultyScore} / 50
                </div>
                <Badge variant={
                  difficultyTier === 'Easy' ? 'default' :
                    difficultyTier === 'Realistic' ? 'secondary' :
                      difficultyTier === 'Hard' ? 'outline' : 'destructive'
                }>
                  {difficultyTier}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Adjust the sliders below to set difficulty scores (1–10 per dimension) for the 50-point difficulty model
            </p>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="positionProblemAlignment">Position + Problem Alignment</Label>
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
                <div className="px-2">
                  <Slider
                    value={[formData.positionProblemAlignment]}
                    onValueChange={(value) => setFormData({ ...formData, positionProblemAlignment: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 (Low)</span>
                    <span className="font-medium">{formData.positionProblemAlignment}</span>
                    <span>10 (High)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Problems (Offer-Relevant)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  What problems does this prospect have that the offer is designed to solve? (You can also include these in the description above)
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

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="painAmbitionIntensity">Pain / Ambition Intensity</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Combined measure of how much pain the prospect feels from their problems and how strong their desire is to reach their desired result. Use the higher of pain or ambition.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="px-2">
                  <Slider
                    value={[formData.painAmbitionIntensity]}
                    onValueChange={(value) => setFormData({ ...formData, painAmbitionIntensity: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 (Low)</span>
                    <span className="font-medium">{formData.painAmbitionIntensity}</span>
                    <span>10 (High)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="perceivedNeedForHelpAuthority">Perceived Need for Help / Authority Stance</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Combines how aware the prospect is that they need external help with their authority stance relative to the seller. Low (1-3) = advisor (high authority), Medium (4-7) = peer, High (8-10) = advisee (low authority, easy).
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="px-2">
                  <Slider
                    value={[formData.perceivedNeedForHelpAuthority]}
                    onValueChange={(value) => setFormData({ ...formData, perceivedNeedForHelpAuthority: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 (Advisor)</span>
                    <span className="font-medium">{formData.perceivedNeedForHelpAuthority}</span>
                    <span>10 (Advisee)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
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
                <div className="px-2">
                  <Slider
                    value={[formData.funnelContext]}
                    onValueChange={(value) => setFormData({ ...formData, funnelContext: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 (Cold)</span>
                    <span className="font-medium">{formData.funnelContext}</span>
                    <span>10 (Warm)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="abilityToProceed">Ability to Proceed</Label>
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
                <div className="px-2">
                  <Slider
                    value={[formData.abilityToProceed]}
                    onValueChange={(value) => setFormData({ ...formData, abilityToProceed: value[0] })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1 (Extreme Resistance)</span>
                    <span className="font-medium">{formData.abilityToProceed}</span>
                    <span>10 (Fully Able)</span>
                  </div>
                </div>
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
