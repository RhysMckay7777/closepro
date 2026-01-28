'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toastError } from '@/lib/toast';

const offerSchema = z.object({
  // Top Section
  name: z.string().min(1, 'Offer name is required'),
  offerCategory: z.string().min(1, 'Offer category is required'),
  deliveryModel: z.string().min(1, 'Delivery model is required'),
  coreOfferPrice: z.string().min(1, 'Core offer price is required'),
  
  // Section 1 - ICP
  whoItsFor: z.string().min(1, 'Who it\'s for is required'),
  customerStage: z.string().optional(),
  
  // Section 2 - Core Problems
  coreProblems: z.string().min(1, 'Core problems are required'),
  
  // Section 3 - Desired Outcome
  desiredOutcome: z.string().min(1, 'Desired outcome is required'),
  tangibleOutcomes: z.string().optional(),
  emotionalOutcomes: z.string().optional(),
  
  // Section 4 - Deliverables
  deliverables: z.string().optional(),
  
  // Section 5 - Cost Profile
  paymentOptions: z.string().optional(),
  timePerWeek: z.string().optional(),
  estimatedTimeToResults: z.string().optional(),
  effortRequired: z.string().optional(),
  
  // Section 6 - Proof & Risk Reversal
  caseStudyStrength: z.string().optional(),
  guaranteesRefundTerms: z.string().optional(),
  
  // Section 7 - Funnel Context
  primaryFunnelSource: z.string().optional(),
  funnelContextAdditional: z.string().optional(),
  
  // Legacy fields for backward compatibility
  coreOutcome: z.string().optional(),
  mechanismHighLevel: z.string().optional(),
  priceRange: z.string().optional(),
});

type OfferFormData = z.infer<typeof offerSchema>;

export default function NewOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<OfferFormData>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      name: '',
      offerCategory: '',
      deliveryModel: '',
      coreOfferPrice: '',
      whoItsFor: '',
      customerStage: '',
      coreProblems: '',
      desiredOutcome: '',
      tangibleOutcomes: '',
      emotionalOutcomes: '',
      deliverables: '',
      paymentOptions: '',
      timePerWeek: '',
      estimatedTimeToResults: '',
      effortRequired: 'medium',
      caseStudyStrength: '',
      guaranteesRefundTerms: '',
      primaryFunnelSource: '',
      funnelContextAdditional: '',
      coreOutcome: '',
      mechanismHighLevel: '',
      priceRange: '',
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    const problems = data.primaryProblemsSolved.filter((p) => p.trim());
    if (problems.length < 3) {
      form.setError('primaryProblemsSolved', { message: 'Please provide at least 3 problems this offer solves' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          primaryProblemsSolved: problems,
          commonSkepticismTriggers: data.commonObjections?.filter((o) => o.trim()) || [],
          downsellOptions: data.downsellOptions?.filter((o) => o.trim()) || [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create offer');
      }

      router.push('/dashboard/offers');
    } catch (error: unknown) {
      console.error('Error creating offer:', error);
      toastError('Failed to create offer: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  });


  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/offers">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offers
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Create New Offer</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Define your offer for AI roleplay training
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {Object.keys(form.formState.errors).length > 0 && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-medium text-destructive">
                Please fix {Object.keys(form.formState.errors).length} error{Object.keys(form.formState.errors).length !== 1 ? 's' : ''} below
              </p>
            </div>
          )}
          {/* Top Section - Offer Overview */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Offer Overview</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Offer Name *</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="e.g., High-Ticket Closing Mastery"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offerCategory">Offer Type *</Label>
                <Select
                  value={form.watch('offerCategory')}
                  onValueChange={(value) => form.setValue('offerCategory', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c_health">B2C Health</SelectItem>
                    <SelectItem value="b2c_relationships">B2C Relationships</SelectItem>
                    <SelectItem value="b2c_wealth">B2C Wealth</SelectItem>
                    <SelectItem value="mixed_wealth">Mixed Wealth</SelectItem>
                    <SelectItem value="b2b_services">B2B Services</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.offerCategory && (
                  <p className="text-sm text-destructive">{form.formState.errors.offerCategory.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryModel">Delivery Model *</Label>
                <Select
                  value={form.watch('deliveryModel')}
                  onValueChange={(value) => form.setValue('deliveryModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dfy">Done-For-You</SelectItem>
                    <SelectItem value="dwy">Done-With-You</SelectItem>
                    <SelectItem value="diy">Do-It-Yourself</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.deliveryModel && (
                  <p className="text-sm text-destructive">{form.formState.errors.deliveryModel.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="coreOfferPrice">Core Offer Price *</Label>
                <Input
                  id="coreOfferPrice"
                  {...form.register('coreOfferPrice')}
                  placeholder="e.g., £5,000"
                />
                {form.formState.errors.coreOfferPrice && (
                  <p className="text-sm text-destructive">{form.formState.errors.coreOfferPrice.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 1 - Ideal Customer Profile (ICP) */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 1 - Ideal Customer Profile (ICP)</h2>
            
            <div className="space-y-2">
              <Label htmlFor="whoItsFor">Who Is This Offer For? *</Label>
              <Textarea
                id="whoItsFor"
                {...form.register('whoItsFor')}
                placeholder="Description of the ideal customer's position and life/business context"
                rows={3}
              />
              {form.formState.errors.whoItsFor && (
                <p className="text-sm text-destructive">{form.formState.errors.whoItsFor.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerStage">Customer Stage</Label>
              <Select
                value={form.watch('customerStage') || ''}
                onValueChange={(value) => form.setValue('customerStage', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aspiring">Aspiring (new / just starting)</SelectItem>
                  <SelectItem value="current">Current (already doing it, stuck)</SelectItem>
                  <SelectItem value="mixed">Mixed (customers can be a mix of the above)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2 - Core Problems */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 2 - Core Problems</h2>
            <p className="text-sm text-muted-foreground">
              Define the felt problems the prospect already experiences. Problems should be written from the prospect&apos;s perspective.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="coreProblems">Core Problems This Offer Solves *</Label>
              <Textarea
                id="coreProblems"
                {...form.register('coreProblems')}
                placeholder="What problems does this prospect have that the offer is designed to solve? Write from the prospect's perspective."
                rows={5}
              />
              {form.formState.errors.coreProblems && (
                <p className="text-sm text-destructive">{form.formState.errors.coreProblems.message}</p>
              )}
            </div>
          </div>

          {/* Section 3 - Desired Outcome & Transformation */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 3 - Desired Outcome & Transformation</h2>
            
            <div className="space-y-2">
              <Label htmlFor="desiredOutcome">Core Outcome & Timeline *</Label>
              <Textarea
                id="desiredOutcome"
                {...form.register('desiredOutcome')}
                placeholder="What result does the prospect achieve and in what timeframe?"
                rows={2}
              />
              {form.formState.errors.desiredOutcome && (
                <p className="text-sm text-destructive">{form.formState.errors.desiredOutcome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tangibleOutcomes">Tangible Outcomes</Label>
              <Textarea
                id="tangibleOutcomes"
                {...form.register('tangibleOutcomes')}
                placeholder="Measurable or concrete results (e.g., weight loss, revenue increase, specific metrics)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="emotionalOutcomes">Emotional Outcomes</Label>
              <Textarea
                id="emotionalOutcomes"
                {...form.register('emotionalOutcomes')}
                placeholder="Confidence, relief, certainty, identity shift, etc."
                rows={2}
              />
            </div>
          </div>

          {/* Section 4 - Offer Deliverables */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 4 - Offer Deliverables</h2>
            
            <div className="space-y-2">
              <Label htmlFor="deliverables">Deliverables</Label>
              <Textarea
                id="deliverables"
                {...form.register('deliverables')}
                placeholder="What does the customer actually receive? (e.g., calls, coaching, software access, audits, templates, support)"
                rows={3}
              />
            </div>
          </div>

          {/* Section 5 - Cost Profile */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 5 - Cost Profile</h2>
            
            <div className="space-y-2">
              <Label htmlFor="paymentOptions">Payment Options</Label>
              <Textarea
                id="paymentOptions"
                {...form.register('paymentOptions')}
                placeholder="One-pay, payment plans, deposits (descriptive only)"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timePerWeek">Time Per Week Required</Label>
                <Input
                  id="timePerWeek"
                  {...form.register('timePerWeek')}
                  placeholder="e.g., 5-10 hours or number/range"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedTimeToResults">Estimated Time to Results</Label>
                <Input
                  id="estimatedTimeToResults"
                  {...form.register('estimatedTimeToResults')}
                  placeholder="e.g., 12-16 weeks"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effortRequired">Effort Level</Label>
              <Select
                value={form.watch('effortRequired') || 'medium'}
                onValueChange={(value) => form.setValue('effortRequired', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 6 - Proof & Risk Reversal */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 6 - Proof & Risk Reversal</h2>
            
            <div className="space-y-2">
              <Label htmlFor="caseStudyStrength">Case Study / Proof Strength</Label>
              <Select
                value={form.watch('caseStudyStrength') || ''}
                onValueChange={(value) => form.setValue('caseStudyStrength', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select proof strength" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="weak">Weak</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="strong">Strong</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="guaranteesRefundTerms">Guarantees / Refund Terms</Label>
              <Textarea
                id="guaranteesRefundTerms"
                {...form.register('guaranteesRefundTerms')}
                placeholder="Describe any guarantees or refund terms"
                rows={2}
              />
            </div>
          </div>

          {/* Section 7 - Funnel Context */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 7 - Funnel Context</h2>
            
            <div className="space-y-2">
              <Label htmlFor="primaryFunnelSource">Primary Funnel Source</Label>
              <Select
                value={form.watch('primaryFunnelSource') || ''}
                onValueChange={(value) => form.setValue('primaryFunnelSource', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select funnel source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold_outbound">Cold outbound</SelectItem>
                  <SelectItem value="cold_ads">Cold ads</SelectItem>
                  <SelectItem value="warm_inbound">Warm inbound</SelectItem>
                  <SelectItem value="content_driven_inbound">Content-driven inbound</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="existing_customer">Existing customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="funnelContextAdditional">Additional Context</Label>
              <Textarea
                id="funnelContextAdditional"
                {...form.register('funnelContextAdditional')}
                placeholder="Any nuance needed for AI interpretation"
                rows={2}
              />
            </div>
          </div>


          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Link href="/dashboard/offers" className="flex-1">
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
                'Create Offer'
              )}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
