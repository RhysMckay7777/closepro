'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2, ArrowLeft, Play, Phone } from 'lucide-react';
import Link from 'next/link';
import { resolveProspectAvatarUrl } from '@/lib/prospect-avatar';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { EmptyProspectsIllustration } from '@/components/illustrations';
import { toastError } from '@/lib/toast';
import { Suspense } from 'react';

interface Offer {
  id: string;
  name: string;
  offerCategory: string;
  priceRange?: string;
  coreOutcome?: string;
  mechanismHighLevel?: string;
  coreOfferPrice?: string;
}

interface ProspectAvatar {
  id: string;
  name: string;
  difficultyTier: string;
  positionDescription?: string;
  avatarUrl?: string | null;
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
  const [loadingStatus, setLoadingStatus] = useState('Loading prospects...');
  const [selectedProspect, setSelectedProspect] = useState<ProspectAvatar | null>(null);
  const hasTriedGenerateRef = useRef(false);
  const avatarPollRef = useRef<NodeJS.Timeout | null>(null);

  // Define fetchOffer and fetchProspects BEFORE useEffect that uses them
  const fetchOffer = useCallback(async () => {
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
  }, [offerId]);

  const fetchProspects = useCallback(async () => {
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
  }, [offerId]);

  // Start avatar polling: periodically re-fetch prospects to pick up async-generated images
  const startAvatarPoll = useCallback(() => {
    if (avatarPollRef.current) return;
    let attempts = 0;
    avatarPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 10) { // Stop after ~30 seconds
        if (avatarPollRef.current) clearInterval(avatarPollRef.current);
        avatarPollRef.current = null;
        return;
      }
      try {
        const res = await fetch(`/api/prospect-avatars?offerId=${offerId}`);
        if (res.ok) {
          const data = await res.json();
          const avatars: ProspectAvatar[] = data.avatars || [];
          setProspects(avatars);
          // Stop polling once all prospects have avatar URLs
          if (avatars.length > 0 && avatars.every(a => a.avatarUrl)) {
            if (avatarPollRef.current) clearInterval(avatarPollRef.current);
            avatarPollRef.current = null;
          }
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
  }, [offerId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (avatarPollRef.current) clearInterval(avatarPollRef.current);
    };
  }, []);

  // On load: fetch offer + existing prospects first, only generate if zero exist
  useEffect(() => {
    if (!offerId) {
      router.push('/dashboard/roleplay/new');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadingStatus('Loading prospects...');
    (async () => {
      await fetchOffer();
      if (cancelled) return;
      // First, fetch existing prospects
      try {
        const res = await fetch(`/api/prospect-avatars?offerId=${offerId}`);
        if (res.ok) {
          const data = await res.json();
          const existing: ProspectAvatar[] = data.avatars || [];
          if (existing.length > 0) {
            // Prospects already exist — show them immediately
            setProspects(existing);
            setLoading(false);
            // Start polling if any are missing avatar images
            if (existing.some(a => !a.avatarUrl)) {
              startAvatarPoll();
            }
            return;
          }
        }
      } catch (e) {
        console.error('Error fetching existing prospects:', e);
      }
      if (cancelled) return;
      // No prospects exist — generate for the first time
      setLoadingStatus('Creating prospect profiles...');
      try {
        const res = await fetch(
          `/api/offers/${offerId}/prospects/generate`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
        );
        if (cancelled) return;
        if (res.ok) {
          setLoadingStatus('Prospects created! Loading...');
          await fetchProspects();
          // Start polling for avatar images (generated async in background)
          startAvatarPoll();
        } else {
          const err = await res.json().catch(() => ({}));
          toastError(err.error || 'Failed to generate prospects');
          await fetchProspects();
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Generate on first load failed:', e);
          toastError('Failed to generate prospects');
          await fetchProspects();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId, router, fetchOffer, fetchProspects, startAvatarPoll]);

  const handleGenerateProspects = useCallback(async () => {
    if (!offerId || hasTriedGenerateRef.current) return;
    hasTriedGenerateRef.current = true;
    setGenerating(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/prospects/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
      hasTriedGenerateRef.current = false; // Reset on error so user can retry
    } finally {
      setGenerating(false);
    }
  }, [offerId, fetchProspects]);

  const handleRegenerateProspects = useCallback(async () => {
    if (!offerId) return;
    setGenerating(true);
    setLoadingStatus('Regenerating prospect profiles...');
    try {
      const response = await fetch(
        `/api/offers/${offerId}/prospects/generate?regenerate=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regenerate: true }),
        }
      );
      if (response.ok) {
        setLoadingStatus('Prospects regenerated! Loading...');
        await fetchProspects();
        // Start polling for new avatar images
        startAvatarPoll();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate prospects');
      }
    } catch (error: any) {
      console.error('Error regenerating prospects:', error);
      toastError(error.message || 'Failed to regenerate prospects');
    } finally {
      setGenerating(false);
    }
  }, [offerId, fetchProspects, startAvatarPoll]);

  const handleProspectSelect = async (prospectId: string) => {
    if (!offerId) return;
    setSelectedProspect(null); // Close dialog
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
    } catch (error: unknown) {
      console.error('Error starting roleplay:', error);
      toastError(error instanceof Error ? error.message : 'Failed to start roleplay');
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

  const getModeLabel = (tier: string) => {
    const labels: Record<string, string> = {
      easy: 'Easy Mode',
      realistic: 'Intermediate Mode',
      hard: 'Hard Mode',
      elite: 'Expert Mode',
    };
    return labels[tier] ?? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Mode`;
  };

  const getCardAccentClasses = (tier: string) => {
    const classes: Record<string, string> = {
      easy: 'bg-emerald-500/20',
      realistic: 'bg-sky-500/20',
      hard: 'bg-orange-500/20',
      elite: 'bg-red-500/20',
    };
    return classes[tier] ?? 'bg-muted';
  };

  const getCardAccentBullet = (tier: string) => {
    const classes: Record<string, string> = {
      easy: 'bg-emerald-500',
      realistic: 'bg-sky-500',
      hard: 'bg-orange-500',
      elite: 'bg-red-500',
    };
    return classes[tier] ?? 'bg-muted-foreground';
  };

  // getCallTypeTag removed per Rhys's spec — no type label on cards

  const getShortTitle = (p: ProspectAvatar) => {
    if (!p.positionDescription) return getModeLabel(p.difficultyTier);
    const firstSentence = p.positionDescription.split(/[.!?]/)[0]?.trim() ?? '';
    const match = firstSentence.match(/(?:^|\s)(?:the\s+)?([A-Za-z]+\s+[A-Za-z]+)(?:\s|,|$)/i);
    if (match) return match[1];
    return firstSentence.slice(0, 40) + (firstSentence.length > 40 ? '…' : '');
  };

  // Fallback: if regenerate on load failed and we have no prospects, try one-time generate
  useEffect(() => {
    if (prospects.length === 0 && offerId && !loading && !hasTriedGenerateRef.current) {
      handleGenerateProspects();
    }
  }, [prospects.length, offerId, loading, handleGenerateProspects]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground font-medium">{loadingStatus}</p>
          <p className="text-xs text-muted-foreground mt-2">This may take a few seconds on first load</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Prospect detail dialog - two-column RepArena-style */}
      <Dialog open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
        <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
          {selectedProspect && (
            <div className="flex flex-col sm:flex-row min-h-[420px]">
              {/* Left: gradient + circular headshot */}
              <div className="relative w-full sm:w-1/3 min-h-[240px] sm:min-h-0 flex items-center justify-center bg-linear-to-br from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/20 p-8">
                <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} aria-hidden />
                <Avatar className="size-40 sm:size-48 shrink-0 ring-4 ring-white/80 dark:ring-background/80 shadow-lg">
                  <AvatarImage src={resolveProspectAvatarUrl(selectedProspect.id, selectedProspect.name, selectedProspect.avatarUrl)} alt={selectedProspect.name} className="object-cover" />
                  <AvatarFallback className="text-2xl bg-muted">{selectedProspect.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              {/* Right: name, context, selling offer, CTA */}
              <div className="flex-1 flex flex-col p-6 sm:p-8 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <DialogTitle className="text-2xl font-bold mb-1">{selectedProspect.name}</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                      Start A Discovery Call With {getShortTitle(selectedProspect)}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`size-2 rounded-full ${getCardAccentBullet(selectedProspect.difficultyTier)}`} aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground">{getModeLabel(selectedProspect.difficultyTier)}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Prospect Context</h4>
                    {selectedProspect.positionDescription ? (
                      <p className="text-sm text-foreground leading-relaxed rounded-md bg-muted/50 p-3 max-h-32 overflow-y-auto">
                        {selectedProspect.positionDescription}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic p-3 rounded-md bg-muted/50">No bio added yet.</p>
                    )}
                  </div>
                  {offer && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Selling {offer.name}</h4>
                      {(offer.priceRange ?? offer.coreOfferPrice) && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Price point: {offer.coreOfferPrice ?? offer.priceRange}
                        </p>
                      )}
                      <p className="text-sm text-foreground leading-relaxed rounded-md bg-muted/50 p-3 max-h-24 overflow-y-auto">
                        {offer.coreOutcome ?? offer.mechanismHighLevel ?? offer.offerCategory ?? 'No offer description.'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProspect(null)} className="-ml-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => handleProspectSelect(selectedProspect.id)}>
                    <Phone className="h-4 w-4 mr-2" />
                    Start Discovery
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/dashboard/roleplay/new">
            <Button variant="ghost" size="sm" className="mb-2 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Offer Selection
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Choose A Prospect And Start An AI Roleplay</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {offer?.name ? `For ${offer.name}` : 'Select a prospect to begin'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {offerId && (
            <Link href={`/dashboard/offers/${offerId}/prospects/new`}>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </Link>
          )}
          <Link href="/dashboard/roleplay">
            <Button size="sm">
              <Phone className="h-4 w-4 mr-2" />
              View Call History
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Start - Difficulty Presets (compact) */}
      <div className="mb-6">
        <p className="text-sm text-muted-foreground mb-2">Quick start by difficulty:</p>
        <div className="flex flex-wrap gap-2">
          {['easy', 'realistic', 'hard', 'elite'].map((difficulty) => (
            <Button
              key={difficulty}
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => handleDifficultySelect(difficulty)}
            >
              {getModeLabel(difficulty)}
            </Button>
          ))}
        </div>
      </div>

      {/* Saved Prospects */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Prospects</h2>
          {prospects.length === 0 ? (
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
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateProspects}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                'Regenerate prospects (with bios)'
              )}
            </Button>
          )}
        </div>

        {prospects.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="illustration" className="size-32">
                  <EmptyProspectsIllustration className="size-full max-w-[8rem] max-h-[8rem]" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* Create New Prospect Card */}
            {offerId && (
              <Card
                className="overflow-hidden border-2 border-dashed hover:border-primary cursor-pointer transition-all flex flex-col min-h-[280px]"
                onClick={() => router.push(`/dashboard/offers/${offerId}/prospects/new`)}
              >
                <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center bg-muted/50 p-6">
                  <Plus className="h-14 w-14 text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-lg mb-1">Create New Prospect</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Build a custom prospect
                  </p>
                </div>
                <div className="p-4 border-t">
                  <p className="text-xs text-muted-foreground">Add your own</p>
                </div>
              </Card>
            )}

            {/* Existing Prospects - image-first cards */}
            {prospects.map((prospect) => (
              <Card
                key={prospect.id}
                className="overflow-hidden hover:shadow-lg transition-all cursor-pointer flex flex-col"
                onClick={() => setSelectedProspect(prospect)}
              >
                <div className={`relative aspect-square min-h-[200px] ${getCardAccentClasses(prospect.difficultyTier)} flex items-center justify-center p-4`}>
                  <img
                    src={resolveProspectAvatarUrl(prospect.id, prospect.name, prospect.avatarUrl)}
                    alt={prospect.name}
                    className="size-full object-cover rounded-lg"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg mb-0.5">{prospect.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                    {prospect.positionDescription ? getShortTitle(prospect) : getModeLabel(prospect.difficultyTier)}
                  </p>
                  <div className="mt-auto flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${getCardAccentBullet(prospect.difficultyTier)}`} aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground">{getModeLabel(prospect.difficultyTier)}</span>
                  </div>
                </div>
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
