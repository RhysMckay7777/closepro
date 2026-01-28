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
    name: '',
    offerCategory: '',
    whoItsFor: '',
    coreOutcome: '',
    mechanismHighLevel: '',
    deliveryModel: '',
    priceRange: '',
    primaryProblemsSolved: [] as string[],
    effortRequired: 'medium',
    riskReversal: 'none',
  });

  useEffect(() => {
    fetchOffer();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}`);
      if (!response.ok) throw new Error('Failed to fetch offer');
      const data = await response.json();
      const offer = data.offer;
      
      setFormData({
        name: offer.name || '',
        offerCategory: offer.offerCategory || '',
        whoItsFor: offer.whoItsFor || '',
        coreOutcome: offer.coreOutcome || '',
        mechanismHighLevel: offer.mechanismHighLevel || '',
        deliveryModel: offer.deliveryModel || '',
        priceRange: offer.priceRange || '',
        primaryProblemsSolved: offer.primaryProblemsSolved 
          ? JSON.parse(offer.primaryProblemsSolved) 
          : [],
        effortRequired: offer.effortRequired || 'medium',
        riskReversal: offer.riskReversal || 'none',
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
    
    if (!formData.name || !formData.offerCategory || !formData.whoItsFor || 
        !formData.coreOutcome || !formData.mechanismHighLevel || 
        !formData.deliveryModel || !formData.priceRange) {
      toastError('Please fill in all required fields');
      return;
    }

    const problems = formData.primaryProblemsSolved.filter(p => p.trim());
    if (problems.length < 3) {
      toastError('Please provide at least 3 problems this offer solves');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          primaryProblemsSolved: problems,
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

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading offer...</div>
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
          {/* Same form fields as new page */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            
            <div className="space-y-2">
              <Label htmlFor="name">Offer Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    <SelectValue />
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
                    <SelectValue />
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

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Target & Outcome</h2>
            
            <div className="space-y-2">
              <Label htmlFor="whoItsFor">Who It's For (ICP) *</Label>
              <Textarea
                id="whoItsFor"
                value={formData.whoItsFor}
                onChange={(e) => setFormData({ ...formData, whoItsFor: e.target.value })}
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
                rows={2}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Pricing & Effort</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceRange">Price Range *</Label>
                <Input
                  id="priceRange"
                  value={formData.priceRange}
                  onChange={(e) => setFormData({ ...formData, priceRange: e.target.value })}
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
