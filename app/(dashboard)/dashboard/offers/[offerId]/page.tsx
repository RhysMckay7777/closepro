'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Edit, Play, User } from 'lucide-react';
import Link from 'next/link';
import { toastError } from '@/lib/toast';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
  whoItsFor: string;
  coreOutcome: string;
  mechanismHighLevel: string;
  deliveryModel: string;
  priceRange: string;
}

interface Prospect {
  id: string;
  name: string;
  difficultyTier: string;
  difficultyIndex: number;
  sourceType: string;
  authorityLevel: string;
}

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.offerId as string;
  
  const [offer, setOffer] = useState<Offer | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchOffer();
    fetchProspects();
  }, [offerId]);

  const fetchOffer = async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}`);
      if (!response.ok) throw new Error('Failed to fetch offer');
      const data = await response.json();
      setOffer(data.offer);
    } catch (error) {
      console.error('Error fetching offer:', error);
      toastError('Failed to load offer');
      router.push('/dashboard/offers');
    }
  };

  const fetchProspects = async () => {
    try {
      const response = await fetch(`/api/offers/${offerId}/prospects`);
      if (!response.ok) throw new Error('Failed to fetch prospects');
      const data = await response.json();
      setProspects(data.prospects || []);
      
      // Auto-generate if no prospects exist
      if (data.prospects.length === 0) {
        await generateProspects();
      }
    } catch (error) {
      console.error('Error fetching prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateProspects = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/prospects/generate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate prospects');
      }
      
      const data = await response.json();
      setProspects(data.prospects || []);
    } catch (error: any) {
      console.error('Error generating prospects:', error);
      toastError(error.message || 'Failed to generate prospects');
    } finally {
      setGenerating(false);
    }
  };

  const getDifficultyColor = (tier: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/20 text-green-600 border-green-500/50',
      realistic: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
      hard: 'bg-orange-500/20 text-orange-600 border-orange-500/50',
      elite: 'bg-red-500/20 text-red-600 border-red-500/50',
      near_impossible: 'bg-purple-500/20 text-purple-600 border-purple-500/50',
    };
    return colors[tier] || 'bg-gray-500/20 text-gray-600 border-gray-500/50';
  };

  const getAuthorityLabel = (level: string) => {
    const labels: Record<string, string> = {
      advisee: 'Advisee',
      peer: 'Peer',
      advisor: 'Advisor',
    };
    return labels[level] || level;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading offer details...</div>
        </div>
      </div>
    );
  }

  if (!offer) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/offers">Offers</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{offer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/offers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{offer.name}</h1>
            <p className="text-sm text-muted-foreground">{offer.offerCategory}</p>
          </div>
        </div>
        <Link href={`/dashboard/offers/${offerId}/edit`}>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Offer
          </Button>
        </Link>
      </div>

      {/* Offer Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Offer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Who It's For</p>
            <p className="font-medium">{offer.whoItsFor}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Core Outcome</p>
            <p className="font-medium">{offer.coreOutcome}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">How It Works</p>
            <p className="font-medium">{offer.mechanismHighLevel}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Price Range</p>
            <p className="font-medium">{offer.priceRange}</p>
          </div>
        </div>
      </Card>

      {/* Prospects Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Prospects</h2>
          <Link href={`/dashboard/offers/${offerId}/prospects/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Prospect
            </Button>
          </Link>
        </div>

        {generating ? (
          <Card className="p-6">
            <div className="text-center text-muted-foreground">
              Generating prospects...
            </div>
          </Card>
        ) : prospects.length === 0 ? (
          <Card className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <User className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No prospects yet</EmptyTitle>
                <EmptyDescription>Create prospect profiles for this offer to use in roleplays.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href={`/dashboard/offers/${offerId}/prospects/new`}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Prospect
                  </Button>
                </Link>
              </EmptyContent>
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {prospects.map((prospect) => (
              <Card key={prospect.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold">{prospect.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {prospect.sourceType === 'auto_generated' ? 'Auto-generated' : 
                         prospect.sourceType === 'transcript_derived' ? 'From transcript' : 
                         'Manual'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <Badge className={getDifficultyColor(prospect.difficultyTier)}>
                    {prospect.difficultyTier.toUpperCase()} ({prospect.difficultyIndex}/50)
                  </Badge>
                  <div>
                    <p className="text-xs text-muted-foreground">Authority</p>
                    <p className="text-sm font-medium">{getAuthorityLabel(prospect.authorityLevel)}</p>
                  </div>
                </div>

                <Link href={`/dashboard/roleplay/new?offerId=${offerId}&prospectId=${prospect.id}`}>
                  <Button className="w-full" size="sm">
                    <Play className="h-3 w-3 mr-2" />
                    Start Roleplay
                  </Button>
                </Link>
              </Card>
            ))}
            
            {/* Create New Prospect Card */}
            <Card className="p-4 border-dashed hover:border-primary transition-colors cursor-pointer">
              <Link href={`/dashboard/offers/${offerId}/prospects/new`} className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="font-medium">Create New Prospect</p>
                <p className="text-sm text-muted-foreground mt-1">Manual or from transcript</p>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
