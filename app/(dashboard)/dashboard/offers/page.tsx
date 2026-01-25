'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import Link from 'next/link';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
  priceRange: string;
  deliveryModel: string;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const response = await fetch('/api/offers');
      if (!response.ok) throw new Error('Failed to fetch offers');
      const data = await response.json();
      setOffers(data.offers || []);
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!confirm('Are you sure you want to delete this offer?')) return;

    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete offer');

      setOffers(offers.filter(o => o.id !== offerId));
    } catch (error) {
      console.error('Error deleting offer:', error);
      alert('Failed to delete offer');
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      b2c_health: 'B2C Health',
      b2c_wealth: 'B2C Wealth',
      b2c_relationships: 'B2C Relationships',
      b2b_services: 'B2B Services',
      mixed_wealth: 'Mixed Wealth',
    };
    return labels[category] || category;
  };

  const getDeliveryLabel = (model: string) => {
    const labels: Record<string, string> = {
      dfy: 'Done-For-You',
      dwy: 'Done-With-You',
      diy: 'Do-It-Yourself',
      hybrid: 'Hybrid',
    };
    return labels[model] || model;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading offers...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Offers</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your sales offers for roleplays
          </p>
        </div>
        <Link href="/dashboard/offers/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Offer
          </Button>
        </Link>
      </div>

      {/* Offers List */}
      {offers.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No offers yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first offer to start using it in roleplays
          </p>
          <Link href="/dashboard/offers/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Offer
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((offer) => (
            <Card key={offer.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{offer.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline">{getCategoryLabel(offer.offerCategory)}</Badge>
                    <Badge variant="secondary">{getDeliveryLabel(offer.deliveryModel)}</Badge>
                    {offer.isTemplate && (
                      <Badge variant="default">Template</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Price: {offer.priceRange}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Link href={`/dashboard/offers/${offer.id}/edit`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(offer.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
