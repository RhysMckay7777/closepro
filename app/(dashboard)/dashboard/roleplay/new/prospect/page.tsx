'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { toastError } from '@/lib/toast';
import { Suspense } from 'react';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
}

interface ProspectAvatar {
  id: string;
  name: string;
  difficultyTier: string;
  positionDescription?: string;
  sourceType: 'manual' | 'transcript_derived' | 'auto_generated';
}

function ProspectSelectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offerId = searchParams?.get('offerId');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [prospects, setProspects] = useState<ProspectAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (offerId) {
      fetchOffer();
      fetchProspects();
    } else {
      router.push('/dashboard/roleplay/new');
    }
  }, [offerId, router]);

  const fetchOffer = async () => {
    if (!offerId) return;
    try {
      const response = await fetch(`/api/offers/${offerId}`);
      if (response.ok) {
        const data = await response.json();
        setOffer(data.offer);
      }
    } catch (error) {
      console.error('Error fetching offer:', error);
    }
  };

  const fetchProspects = async () => {
    if (!offerId) return;
    try {
      const response = await fetch(`/api/prospect-avatars?offerId=${offerId}`);
      if (response.ok) {
        const data = await response.json();
        setProspects(data.avatars || []);
      }
    } catch (error) {
      console.error('Error fetching prospects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProspects = async () => {
    if (!offerId) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/prospects/generate`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchProspects();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate prospects');
      }
    } catch (error: any) {
      console.error('Error generating prospects:', error);
      toastError(error.message || 'Failed to generate prospects');
    } finally {
      setGenerating(false);
    }
  };

  const handleProspectSelect = async (prospectId: string) => {
    if (!offerId) return;
    try {
      const response = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          prospectAvatarId: prospectId,
          inputMode: 'voice',
          mode: 'manual',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      router.push(`/dashboard/roleplay/${data.session.id}`);
    } catch (error: any) {
      console.error('Error starting roleplay:', error);
      toastError(error.message || 'Failed to start roleplay');
    }
  };

  const handleDifficultySelect = async (difficulty: string) => {
    if (!offerId) return;
    try {
      const response = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          selectedDifficulty: difficulty,
          inputMode: 'voice',
          mode: 'manual',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      router.push(`/dashboard/roleplay/${data.session.id}`);
    } catch (error: any) {
      console.error('Error starting roleplay:', error);
      toastError(error.message || 'Failed to start roleplay');
    }
  };

  const getDifficultyBadgeVariant = (tier: string) => {
    switch (tier) {
      case 'easy':
        return 'default';
      case 'realistic':
        return 'secondary';
      case 'hard':
        return 'outline';
      case 'elite':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading prospects...</p>
        </div>
      </div>
    );
  }

  // Auto-generate 4 prospects if none exist and offer is new
  useEffect(() => {
    if (prospects.length === 0 && offerId && !loading) {
      handleGenerateProspects();
    }
  }, [prospects.length, offerId, loading]);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/roleplay">Roleplay</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard/roleplay/new">New session</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Prospect Selection</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 sm:mb-6">
        <Link href="/dashboard/roleplay/new">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Offer Selection
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Prospect Selection</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Choose a prospect for {offer?.name || 'this offer'}
        </p>
      </div>

      {/* Difficulty Presets */}
      <Card className="p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Quick Start - Difficulty Presets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['easy', 'realistic', 'hard', 'elite'].map((difficulty) => (
            <Button
              key={difficulty}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleDifficultySelect(difficulty)}
            >
              <span className="font-semibold capitalize">{difficulty}</span>
              <span className="text-xs text-muted-foreground">
                {difficulty === 'easy' && '43-50 points'}
                {difficulty === 'realistic' && '37-43 points'}
                {difficulty === 'hard' && '31-37 points'}
                {difficulty === 'elite' && '25-31 points'}
              </span>
            </Button>
          ))}
        </div>
      </Card>

      {/* Saved Prospects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Saved Prospects</h2>
          {prospects.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateProspects}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Default Prospects
                </>
              )}
            </Button>
          )}
        </div>

        {prospects.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <User className="size-6" />
                </EmptyMedia>
                <EmptyTitle>No prospects yet</EmptyTitle>
                <EmptyDescription>
                  Generate default prospects or create a custom one
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex gap-2">
                  <Button onClick={handleGenerateProspects} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Generate Default Prospects
                      </>
                    )}
                  </Button>
                  {offerId && (
                    <Link href={`/dashboard/offers/${offerId}/prospects/new`}>
                      <Button variant="outline">
                        Create Custom Prospect
                      </Button>
                    </Link>
                  )}
                </div>
              </EmptyContent>
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Create New Prospect Card */}
            {offerId && (
              <Card
                className="p-6 border-2 border-dashed hover:border-primary cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px]"
                onClick={() => router.push(`/dashboard/offers/${offerId}/prospects/new`)}
              >
                <Plus className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Create New Prospect</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Build a custom prospect for this offer
                </p>
              </Card>
            )}

            {/* Existing Prospects */}
            {prospects.map((prospect) => (
              <Card
                key={prospect.id}
                className="p-6 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => handleProspectSelect(prospect.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{prospect.name}</h3>
                    <Badge variant={getDifficultyBadgeVariant(prospect.difficultyTier)} className="mb-2">
                      {prospect.difficultyTier.charAt(0).toUpperCase() + prospect.difficultyTier.slice(1)}
                    </Badge>
                    {prospect.positionDescription && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                        {prospect.positionDescription}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={(e) => {
                  e.stopPropagation();
                  handleProspectSelect(prospect.id);
                }}>
                  Select Prospect
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProspectSelectionPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ProspectSelectionContent />
    </Suspense>
  );
}
