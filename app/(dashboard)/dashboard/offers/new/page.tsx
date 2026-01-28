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
  name: z.string().min(1, 'Offer name is required'),
  offerCategory: z.string().min(1, 'Offer category is required'),
  whoItsFor: z.string().min(1, 'Who it\'s for is required'),
  coreOutcome: z.string().min(1, 'Core outcome is required'),
  mechanismHighLevel: z.string().min(1, 'How it works is required'),
  deliveryModel: z.string().min(1, 'Delivery model is required'),
  priceRange: z.string().min(1, 'Price range is required'),
  primaryProblemsSolved: z.array(z.string()).refine(
    (arr) => arr.filter((p) => p.trim()).length >= 3,
    'Please provide at least 3 problems this offer solves'
  ),
  effortRequired: z.string().optional(),
  riskReversal: z.string().optional(),
  customerStage: z.string().optional(),
  proofLevel: z.string().optional(),
  timeToResult: z.string().optional(),
  timePerWeek: z.string().optional(),
  commonObjections: z.array(z.string()).optional(),
  funnelContext: z.string().optional(),
  paymentOptions: z.object({ payInFull: z.boolean(), paymentPlans: z.array(z.any()) }).optional(),
  downsellOptions: z.array(z.string()).optional(),
  riskReversalDetails: z.string().optional(),
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
      whoItsFor: '',
      coreOutcome: '',
      mechanismHighLevel: '',
      deliveryModel: '',
      priceRange: '',
      primaryProblemsSolved: ['', '', ''],
      effortRequired: 'medium',
      riskReversal: 'none',
      customerStage: '',
      proofLevel: '',
      timeToResult: '',
      timePerWeek: '',
      commonObjections: [''],
      funnelContext: '',
      paymentOptions: { payInFull: true, paymentPlans: [] },
      downsellOptions: [''],
      riskReversalDetails: '',
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

  const addProblemField = () => {
    const current = form.getValues('primaryProblemsSolved');
    form.setValue('primaryProblemsSolved', [...current, '']);
  };

  const updateProblem = (index: number, value: string) => {
    const current = form.getValues('primaryProblemsSolved');
    const updated = [...current];
    updated[index] = value;
    form.setValue('primaryProblemsSolved', updated);
  };

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
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offerCategory">Offer Category *</Label>
                <Select
                  value={form.watch('offerCategory')}
                  onValueChange={(value) => form.setValue('offerCategory', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c_health">B2C Health</SelectItem>
                    <SelectItem value="b2c_wealth">B2C Wealth</SelectItem>
                    <SelectItem value="b2c_relationships">B2C Relationships</SelectItem>
                    <SelectItem value="b2b_services">B2B Services</SelectItem>
                    <SelectItem value="mixed_wealth">Mixed Wealth</SelectItem>
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
            </div>
          </div>

          {/* Target & Outcome */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Target & Outcome</h2>
            
            <div className="space-y-2">
              <Label htmlFor="whoItsFor">Who It's For (ICP) *</Label>
              <Textarea
                id="whoItsFor"
                {...form.register('whoItsFor')}
                placeholder="e.g., Men 35+ with families who want to lose 20lbs in 12 weeks"
                rows={2}
              />
              {form.formState.errors.whoItsFor && (
                <p className="text-sm text-destructive">{form.formState.errors.whoItsFor.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coreOutcome">Core Outcome / Transformation *</Label>
              <Textarea
                id="coreOutcome"
                {...form.register('coreOutcome')}
                placeholder="e.g., Complete body transformation with sustainable habits"
                rows={2}
              />
              {form.formState.errors.coreOutcome && (
                <p className="text-sm text-destructive">{form.formState.errors.coreOutcome.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mechanismHighLevel">How It Works *</Label>
              <Textarea
                id="mechanismHighLevel"
                {...form.register('mechanismHighLevel')}
                placeholder="e.g., Personalized coaching, meal plans, and accountability system"
                rows={2}
              />
              {form.formState.errors.mechanismHighLevel && (
                <p className="text-sm text-destructive">{form.formState.errors.mechanismHighLevel.message}</p>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Pricing & Effort</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceRange">Price Range *</Label>
                <Input
                  id="priceRange"
                  {...form.register('priceRange')}
                  placeholder="e.g., 5000-25000"
                />
                {form.formState.errors.priceRange && (
                  <p className="text-sm text-destructive">{form.formState.errors.priceRange.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="effortRequired">Effort Required</Label>
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

            <div className="space-y-2">
              <Label htmlFor="riskReversal">Risk Reversal</Label>
              <Select
                value={form.watch('riskReversal') || 'none'}
                onValueChange={(value) => form.setValue('riskReversal', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="refund">Refund Policy</SelectItem>
                  <SelectItem value="guarantee">Guarantee</SelectItem>
                  <SelectItem value="conditional">Conditional Guarantee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Problems Solved */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Problems Solved *</h2>
            <p className="text-sm text-muted-foreground">
              List at least 3 primary problems this offer solves
            </p>
            
            {form.watch('primaryProblemsSolved').map((problem, index) => (
              <div key={index} className="space-y-2">
                <Label>Problem {index + 1}</Label>
                <Input
                  value={problem}
                  onChange={(e) => updateProblem(index, e.target.value)}
                  placeholder="e.g., Lack of time to exercise"
                />
              </div>
            ))}
            {form.formState.errors.primaryProblemsSolved && (
              <p className="text-sm text-destructive">{form.formState.errors.primaryProblemsSolved.message}</p>
            )}
            
            <Button
              type="button"
              variant="outline"
              onClick={addProblemField}
            >
              Add Another Problem
            </Button>
          </div>

          {/* Customer Stage & Proof */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Customer Stage & Proof</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <SelectItem value="aspiring">Aspiring (starting from zero)</SelectItem>
                    <SelectItem value="current">Current (already doing it, stuck)</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proofLevel">Proof Level</Label>
                <Select
                  value={form.watch('proofLevel') || ''}
                  onValueChange={(value) => form.setValue('proofLevel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select proof level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strong">Strong (many case studies/testimonials)</SelectItem>
                    <SelectItem value="moderate">Moderate (some proof available)</SelectItem>
                    <SelectItem value="light">Light (limited proof)</SelectItem>
                    <SelectItem value="new">New / Minimal (just starting)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Cost Profile */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Cost Profile</h2>
            <p className="text-sm text-muted-foreground">
              What does it take for a customer to get results?
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timePerWeek">Time Per Week Required</Label>
                <Input
                  id="timePerWeek"
                  {...form.register('timePerWeek')}
                  placeholder="e.g., 5-10 hours"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeToResult">Estimated Time to Reach Results</Label>
                <Input
                  id="timeToResult"
                  {...form.register('timeToResult')}
                  placeholder="e.g., 12-16 weeks"
                />
              </div>
            </div>
          </div>

          {/* Common Objections */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Common Objections</h2>
            <p className="text-sm text-muted-foreground">
              What objections do you most commonly hear?
            </p>
            
            {(form.watch('commonObjections') || ['']).map((objection, index) => (
              <div key={index} className="space-y-2">
                <Label>Objection {index + 1}</Label>
                <Input
                  value={objection}
                  onChange={(e) => {
                    const current = form.getValues('commonObjections') || [''];
                    const updated = [...current];
                    updated[index] = e.target.value;
                    form.setValue('commonObjections', updated);
                  }}
                  placeholder="e.g., Too expensive"
                />
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const current = form.getValues('commonObjections') || [''];
                form.setValue('commonObjections', [...current, '']);
              }}
            >
              Add Another Objection
            </Button>
          </div>

          {/* Down Sell Options */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Down Sell Options</h2>
            <p className="text-sm text-muted-foreground">
              Alternative offers or payment plans available if prospect can't commit to main offer
            </p>
            
            {(form.watch('downsellOptions') || ['']).map((option, index) => (
              <div key={index} className="space-y-2">
                <Label>Down Sell Option {index + 1}</Label>
                <Input
                  value={option}
                  onChange={(e) => {
                    const current = form.getValues('downsellOptions') || [''];
                    const updated = [...current];
                    updated[index] = e.target.value;
                    form.setValue('downsellOptions', updated);
                  }}
                  placeholder="e.g., Payment plan: 3 installments of $3,333"
                />
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const current = form.getValues('downsellOptions') || [''];
                form.setValue('downsellOptions', [...current, '']);
              }}
            >
              Add Another Down Sell Option
            </Button>
          </div>

          {/* Funnel Context */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Funnel Context</h2>
            <p className="text-sm text-muted-foreground">
              Where do most of your calls come from?
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="funnelContext">Funnel Source</Label>
              <Select
                value={form.watch('funnelContext') || ''}
                onValueChange={(value) => form.setValue('funnelContext', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select funnel context" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold_outbound_direct">Cold outbound → straight to call</SelectItem>
                  <SelectItem value="cold_outbound_discovery">Cold outbound → discovery → call</SelectItem>
                  <SelectItem value="cold_ads">Cold ads</SelectItem>
                  <SelectItem value="warm_inbound">Warm inbound</SelectItem>
                  <SelectItem value="content_educated">Content-educated inbound</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="tripwire">Tripwire → call</SelectItem>
                  <SelectItem value="existing_customer">Existing customer / upsell</SelectItem>
                </SelectContent>
              </Select>
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
