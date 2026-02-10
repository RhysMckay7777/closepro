'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package } from 'lucide-react';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { EmptyOffersIllustration } from '@/components/illustrations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
  priceRange: string;
  coreOfferPrice?: string;
  deliveryModel: string;
  isTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  prospectCount?: number;
}

export default function OffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
  }, []);

  // Refresh offers when page becomes visible (e.g., after navigation)
  useEffect(() => {
    const handleFocus = () => {
      fetchOffers();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
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
        <div className="flex items-start gap-4">
          <div className="hidden sm:block shrink-0 w-14 h-14 text-muted-foreground/70">
            <EmptyOffersIllustration className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Offers</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage your sales offers for roleplays
            </p>
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => {
            console.log('New Offer button clicked');
            router.push('/dashboard/offers/new');
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Offer
        </Button>
      </div>

      {/* Offers List */}
      {offers.length === 0 ? (
        <Card className="p-8 sm:p-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="illustration" className="size-32">
                <EmptyOffersIllustration className="size-full max-w-[8rem] max-h-[8rem]" />
              </EmptyMedia>
              <EmptyTitle>No offers yet</EmptyTitle>
              <EmptyDescription>Create your first offer to start using it in roleplays</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                onClick={() => {
                  console.log('Create Offer button clicked');
                  router.push('/dashboard/offers/new');
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Offer
              </Button>
            </EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Offer Name</TableHead>
                  <TableHead>Offer Type</TableHead>
                  <TableHead>Delivery Model</TableHead>
                  <TableHead>Core Offer Price</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow
                    key={offer.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => router.push(`/dashboard/offers/${offer.id}`)}
                  >
                    <TableCell className="font-medium">{offer.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(offer.offerCategory)}</Badge>
                    </TableCell>
                    <TableCell>{getDeliveryLabel(offer.deliveryModel)}</TableCell>
                    <TableCell>
                      {(offer.coreOfferPrice || offer.priceRange) ? `£${Number(offer.coreOfferPrice || offer.priceRange).toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/dashboard/offers/${offer.id}`} onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          View Offer
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
