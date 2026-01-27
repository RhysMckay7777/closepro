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

export default function NewOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.offerCategory || !formData.whoItsFor || 
        !formData.coreOutcome || !formData.mechanismHighLevel || 
        !formData.deliveryModel || !formData.priceRange) {
      alert('Please fill in all required fields');
      return;
    }

    const problems = formData.primaryProblemsSolved.filter(p => p.trim());
    if (problems.length < 3) {
      alert('Please provide at least 3 problems this offer solves');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          primaryProblemsSolved: problems,
          commonSkepticismTriggers: formData.commonObjections.filter(o => o.trim()),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create offer');
      }

      router.push('/dashboard/offers');
    } catch (error: any) {
      console.error('Error creating offer:', error);
      alert('Failed to create offer: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const addProblemField = () => {
    setFormData({
      ...formData,
      primaryProblemsSolved: [...formData.primaryProblemsSolved, ''],
    });
  };

  const updateProblem = (index: number, value: string) => {
    const updated = [...formData.primaryProblemsSolved];
    updated[index] = value;
    setFormData({ ...formData, primaryProblemsSolved: updated });
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
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offerCategory">Offer Category *</Label>
                <Select
                  value={formData.offerCategory}
                  onValueChange={(value) => setFormData({ ...formData, offerCategory: value })}
                  required
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryModel">Delivery Model *</Label>
                <Select
                  value={formData.deliveryModel}
                  onValueChange={(value) => setFormData({ ...formData, deliveryModel: value })}
                  required
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
                value={formData.whoItsFor}
                onChange={(e) => setFormData({ ...formData, whoItsFor: e.target.value })}
                placeholder="e.g., Men 35+ with families who want to lose 20lbs in 12 weeks"
                rows={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coreOutcome">Core Outcome / Transformation *</Label>
              <Textarea
                id="coreOutcome"
                value={formData.coreOutcome}
                onChange={(e) => setFormData({ ...formData, coreOutcome: e.target.value })}
                placeholder="e.g., Complete body transformation with sustainable habits"
                rows={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mechanismHighLevel">How It Works *</Label>
              <Textarea
                id="mechanismHighLevel"
                value={formData.mechanismHighLevel}
                onChange={(e) => setFormData({ ...formData, mechanismHighLevel: e.target.value })}
                placeholder="e.g., Personalized coaching, meal plans, and accountability system"
                rows={2}
                required
              />
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
                  value={formData.priceRange}
                  onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
                  placeholder="e.g., 5000-25000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="effortRequired">Effort Required</Label>
                <Select
                  value={formData.effortRequired}
                  onValueChange={(value) => setFormData({ ...formData, effortRequired: value })}
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
                value={formData.riskReversal}
                onValueChange={(value) => setFormData({ ...formData, riskReversal: value })}
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
            
            {formData.primaryProblemsSolved.map((problem, index) => (
              <div key={index} className="space-y-2">
                <Label>Problem {index + 1}</Label>
                <Input
                  value={problem}
                  onChange={(e) => updateProblem(index, e.target.value)}
                  placeholder="e.g., Lack of time to exercise"
                />
              </div>
            ))}
            
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
                  value={formData.customerStage}
                  onValueChange={(value) => setFormData({ ...formData, customerStage: value })}
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
                  value={formData.proofLevel}
                  onValueChange={(value) => setFormData({ ...formData, proofLevel: value })}
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
                  value={formData.timePerWeek}
                  onChange={(e) => setFormData({ ...formData, timePerWeek: e.target.value })}
                  placeholder="e.g., 5-10 hours"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeToResult">Estimated Time to Reach Results</Label>
                <Input
                  id="timeToResult"
                  value={formData.timeToResult}
                  onChange={(e) => setFormData({ ...formData, timeToResult: e.target.value })}
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
            
            {formData.commonObjections.map((objection, index) => (
              <div key={index} className="space-y-2">
                <Label>Objection {index + 1}</Label>
                <Input
                  value={objection}
                  onChange={(e) => {
                    const updated = [...formData.commonObjections];
                    updated[index] = e.target.value;
                    setFormData({ ...formData, commonObjections: updated });
                  }}
                  placeholder="e.g., Too expensive"
                />
              </div>
            ))}
            
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormData({ ...formData, commonObjections: [...formData.commonObjections, ''] })}
            >
              Add Another Objection
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
                value={formData.funnelContext}
                onValueChange={(value) => setFormData({ ...formData, funnelContext: value })}
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
