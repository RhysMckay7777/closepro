'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toastError } from '@/lib/toast';

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Top Section – Offer Overview
    name: '',
    offerCategory: '',
    deliveryModel: '',
    coreOfferPrice: '',
    // Section 1 – ICP
    whoItsFor: '',
    customerStage: '',
    // Section 2 – Core Problems
    coreProblems: '',
    // Section 3 – Desired Outcome & Transformation
    desiredOutcome: '',
    tangibleOutcomes: '',
    emotionalOutcomes: '',
    // Section 4 – Deliverables
    deliverables: '',
    // Section 5 – Cost Profile
    paymentOptions: '',
    timePerWeek: '',
    estimatedTimeToResults: '',
    effortRequired: 'medium',
    // Section 6 – Proof & Risk Reversal
    caseStudyStrength: '',
    guaranteesRefundTerms: '',
    // Section 7 – Funnel Context
    primaryFunnelSource: '',
    funnelContextAdditional: '',
    // Legacy (kept for backward compat)
    coreOutcome: '',
    mechanismHighLevel: '',
    priceRange: '',
  });

  useEffect(() => {
    fetchOffer();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}`);
      if (!response.ok) throw new Error('Failed to fetch offer');
      const data = await response.json();
      const o = data.offer;

      // Parse legacy primaryProblemsSolved into coreProblems if needed
      let coreProblems = o.coreProblems || '';
      if (!coreProblems && o.primaryProblemsSolved) {
        try {
          const arr = typeof o.primaryProblemsSolved === 'string'
            ? JSON.parse(o.primaryProblemsSolved)
            : o.primaryProblemsSolved;
          if (Array.isArray(arr)) coreProblems = arr.join('. ');
        } catch { /* ignore */ }
      }

      setFormData({
        name: o.name || '',
        offerCategory: o.offerCategory || '',
        deliveryModel: o.deliveryModel || '',
        coreOfferPrice: o.coreOfferPrice || o.priceRange || '',
        whoItsFor: o.whoItsFor || '',
        customerStage: o.customerStage || '',
        coreProblems,
        desiredOutcome: o.desiredOutcome || o.coreOutcome || '',
        tangibleOutcomes: o.tangibleOutcomes || '',
        emotionalOutcomes: o.emotionalOutcomes || '',
        deliverables: o.deliverables || o.mechanismHighLevel || '',
        paymentOptions: o.paymentOptions || '',
        timePerWeek: o.timePerWeek || '',
        estimatedTimeToResults: o.estimatedTimeToResults || '',
        effortRequired: o.effortRequired || 'medium',
        caseStudyStrength: o.caseStudyStrength || '',
        guaranteesRefundTerms: o.guaranteesRefundTerms || '',
        primaryFunnelSource: o.primaryFunnelSource || '',
        funnelContextAdditional: o.funnelContextAdditional || '',
        coreOutcome: o.coreOutcome || '',
        mechanismHighLevel: o.mechanismHighLevel || '',
        priceRange: o.priceRange || '',
      });
    } catch (error) {
      console.error('Error fetching offer:', error);
      toastError('Failed to load offer');
      router.push('/dashboard/offers');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.offerCategory || !formData.deliveryModel || !formData.coreOfferPrice) {
      toastError('Please fill in all required fields in Offer Overview');
      return;
    }
    if (!formData.whoItsFor) {
      toastError('Please describe who the offer is for');
      return;
    }
    if (!formData.coreProblems?.trim()) {
      toastError('Please provide core problems this offer solves');
      return;
    }
    if (!formData.desiredOutcome) {
      toastError('Please provide the desired outcome');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Legacy compat
          coreOutcome: formData.desiredOutcome || formData.coreOutcome,
          mechanismHighLevel: formData.deliverables || formData.mechanismHighLevel,
          priceRange: formData.coreOfferPrice || formData.priceRange,
          primaryProblemsSolved: formData.coreProblems ? [formData.coreProblems] : [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update offer');
      }

      router.push('/dashboard/offers');
    } catch (error: any) {
      console.error('Error updating offer:', error);
      toastError('Failed to update offer: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading offer...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/offers">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offers
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Edit Offer</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Update your offer details
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Top Section – Offer Overview */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Offer Overview</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Offer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., High-Ticket Closing Mastery"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offerCategory">Offer Type *</Label>
                <Select
                  value={formData.offerCategory}
                  onValueChange={(v) => setFormData({ ...formData, offerCategory: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2c_health">B2C Health</SelectItem>
                    <SelectItem value="b2c_relationships">B2C Relationships</SelectItem>
                    <SelectItem value="b2c_wealth">B2C Wealth</SelectItem>
                    <SelectItem value="mixed_wealth">Mixed Wealth</SelectItem>
                    <SelectItem value="b2b_services">B2B Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryModel">Delivery Model *</Label>
                <Select
                  value={formData.deliveryModel}
                  onValueChange={(v) => setFormData({ ...formData, deliveryModel: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dfy">Done-For-You</SelectItem>
                    <SelectItem value="dwy">Done-With-You</SelectItem>
                    <SelectItem value="diy">Do-It-Yourself</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coreOfferPrice">Core Offer Price *</Label>
                <Input
                  id="coreOfferPrice"
                  value={formData.coreOfferPrice}
                  onChange={(e) => setFormData({ ...formData, coreOfferPrice: e.target.value })}
                  placeholder="e.g., £5,000"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 1 – ICP */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 1 - Ideal Customer Profile (ICP)</h2>

            <div className="space-y-2">
              <Label htmlFor="whoItsFor">Who Is This Offer For? *</Label>
              <Textarea
                id="whoItsFor"
                value={formData.whoItsFor}
                onChange={(e) => setFormData({ ...formData, whoItsFor: e.target.value })}
                placeholder="Description of the ideal customer's position and life/business context"
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerStage">Customer Stage</Label>
              <Select
                value={formData.customerStage || ''}
                onValueChange={(v) => setFormData({ ...formData, customerStage: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aspiring">Aspiring (new / just starting)</SelectItem>
                  <SelectItem value="current">Current (already doing it, stuck)</SelectItem>
                  <SelectItem value="mixed">Mixed (customers can be a mix of the above)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 2 – Core Problems */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 2 - Core Problems</h2>
            <p className="text-sm text-muted-foreground">
              Define the felt problems the prospect already experiences. Write from the prospect&apos;s perspective.
            </p>

            <div className="space-y-2">
              <Label htmlFor="coreProblems">Core Problems This Offer Solves *</Label>
              <Textarea
                id="coreProblems"
                value={formData.coreProblems}
                onChange={(e) => setFormData({ ...formData, coreProblems: e.target.value })}
                placeholder="What problems does this prospect have that the offer is designed to solve?"
                rows={5}
              />
            </div>
          </div>

          {/* Section 3 – Goals */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 3 - Goals</h2>

            <div className="space-y-2">
              <Label htmlFor="desiredOutcome">Goals *</Label>
              <Textarea
                id="desiredOutcome"
                value={formData.desiredOutcome}
                onChange={(e) => setFormData({ ...formData, desiredOutcome: e.target.value })}
                placeholder="What position do they want to be in? What result does the prospect achieve?"
                rows={4}
              />
            </div>
          </div>

          {/* Section 4 – Offer Deliverables */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 4 - Offer Deliverables</h2>

            <div className="space-y-2">
              <Label htmlFor="deliverables">Deliverables</Label>
              <Textarea
                id="deliverables"
                value={formData.deliverables}
                onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
                placeholder="What does the customer actually receive? (e.g., calls, coaching, software access, audits, templates, support)"
                rows={3}
              />
            </div>
          </div>

          {/* Section 5 – Cost Profile */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 5 - Cost Profile</h2>

            <div className="space-y-2">
              <Label htmlFor="paymentOptions">Payment Options</Label>
              <Textarea
                id="paymentOptions"
                value={formData.paymentOptions}
                onChange={(e) => setFormData({ ...formData, paymentOptions: e.target.value })}
                placeholder="One-pay, payment plans, deposits (descriptive only)"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timePerWeek">Time Per Week Required</Label>
                <Input
                  id="timePerWeek"
                  value={formData.timePerWeek}
                  onChange={(e) => setFormData({ ...formData, timePerWeek: e.target.value })}
                  placeholder="e.g., 5-10 hours"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedTimeToResults">Estimated Time to Results</Label>
                <Input
                  id="estimatedTimeToResults"
                  value={formData.estimatedTimeToResults}
                  onChange={(e) => setFormData({ ...formData, estimatedTimeToResults: e.target.value })}
                  placeholder="e.g., 12-16 weeks"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effortRequired">Effort Level</Label>
              <Select
                value={formData.effortRequired || 'medium'}
                onValueChange={(v) => setFormData({ ...formData, effortRequired: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 6 – Proof & Risk Reversal */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 6 - Proof &amp; Risk Reversal</h2>

            <div className="space-y-2">
              <Label htmlFor="caseStudyStrength">Case Study / Proof Strength</Label>
              <Select
                value={formData.caseStudyStrength || ''}
                onValueChange={(v) => setFormData({ ...formData, caseStudyStrength: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select proof strength" /></SelectTrigger>
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
                value={formData.guaranteesRefundTerms}
                onChange={(e) => setFormData({ ...formData, guaranteesRefundTerms: e.target.value })}
                placeholder="Describe any guarantees or refund terms"
                rows={2}
              />
            </div>
          </div>

          {/* Section 7 – Funnel Context */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Section 7 - Funnel Context</h2>

            <div className="space-y-2">
              <Label htmlFor="primaryFunnelSource">Primary Funnel Source</Label>
              <Select
                value={formData.primaryFunnelSource || ''}
                onValueChange={(v) => setFormData({ ...formData, primaryFunnelSource: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select funnel source" /></SelectTrigger>
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
                value={formData.funnelContextAdditional}
                onChange={(e) => setFormData({ ...formData, funnelContextAdditional: e.target.value })}
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
