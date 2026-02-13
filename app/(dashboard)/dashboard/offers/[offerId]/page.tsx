'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Plus, ArrowLeft, Edit, Play, Phone } from 'lucide-react';
import Link from 'next/link';
import { resolveProspectAvatarUrl, getProspectInitials, getProspectPlaceholderColor } from '@/lib/prospect-avatar';
import { toastError } from '@/lib/toast';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { EmptyProspectsIllustration } from '@/components/illustrations';
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
  positionDescription?: string;
  avatarUrl?: string | null;
}

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const offerId = params.offerId as string;

  const [offer, setOffer] = useState<Offer | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingCountRef = useRef(0);

  // Stop any active polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollingCountRef.current = 0;
  }, []);

  // Poll for avatar updates after generate/regenerate
  const startAvatarPolling = useCallback(() => {
    stopPolling();
    pollingCountRef.current = 0;

    pollingRef.current = setInterval(async () => {
      pollingCountRef.current++;
      // Stop after 12 polls (60 seconds at 5s intervals)
      if (pollingCountRef.current > 12) {
        stopPolling();
        return;
      }

      try {
        const response = await fetch(`/api/offers/${offerId}/prospects`);
        if (!response.ok) return;
        const data = await response.json();
        const freshProspects: Prospect[] = data.prospects || [];
        setProspects(freshProspects);

        // Stop polling if all prospects have real (non-cartoon) avatar URLs
        const allHaveAvatars = freshProspects.length > 0 &&
          freshProspects.every(p => {
            const url = resolveProspectAvatarUrl(p.id, p.name, p.avatarUrl);
            return url !== null;
          });

        if (allHaveAvatars) {
          stopPolling();
        }
      } catch (err) {
        // Silently continue polling
      }
    }, 5000);
  }, [offerId, stopPolling]);

  useEffect(() => {
    fetchOffer();
    fetchProspects();
    return () => stopPolling();
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

  // Generate avatar images sequentially via individual API calls
  const triggerAvatarGeneration = async (prospectsList: Prospect[]) => {
    for (let i = 0; i < prospectsList.length; i++) {
      const prospect = prospectsList[i];
      if (prospect.avatarUrl) continue; // Skip if already has image
      try {
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between calls
        }
        console.log(`[Avatar Gen] Generating image ${i + 1}/${prospectsList.length} for ${prospect.name}`);
        const res = await fetch(`/api/prospect-avatars/${prospect.id}/generate-avatar`, {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.avatarUrl) {
            setProspects(prev => prev.map(p =>
              p.id === prospect.id ? { ...p, avatarUrl: data.avatarUrl } : p
            ));
          }
        } else {
          console.error(`[Avatar Gen] Failed for ${prospect.name}:`, res.status);
        }
      } catch (err) {
        console.error(`[Avatar Gen] Error for ${prospect.name}:`, err);
      }
    }
  };

  const generateProspects = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/offers/${offerId}/prospects/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate prospects');
      }

      const data = await response.json();
      const newProspects: Prospect[] = data.prospects || [];
      setProspects(newProspects);
      // Start polling for avatar images AND trigger frontend-based generation as fallback
      startAvatarPolling();
      triggerAvatarGeneration(newProspects);
    } catch (error: any) {
      console.error('Error generating prospects:', error);
      toastError(error.message || 'Failed to generate prospects');
    } finally {
      setGenerating(false);
    }
  };

  const regenerateProspects = async () => {
    if (!window.confirm('This will replace all current prospects with 4 new AI-generated prospects. Continue?')) {
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch(
        `/api/offers/${offerId}/prospects/generate?regenerate=true`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regenerate: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to regenerate prospects');
      }

      const data = await response.json();
      const newProspects: Prospect[] = data.prospects || [];
      setProspects(newProspects);
      // Start polling for avatar images AND trigger frontend-based generation as fallback
      startAvatarPolling();
      triggerAvatarGeneration(newProspects);
    } catch (error: any) {
      console.error('Error regenerating prospects:', error);
      toastError(error.message || 'Failed to regenerate prospects');
    } finally {
      setGenerating(false);
    }
  };

  const getDifficultyColor = (tier: string) => {
    const colors: Record<string, string> = {
      easy: 'bg-green-500/20 text-green-600 border-green-500/50',
      realistic: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
      hard: 'bg-orange-500/20 text-orange-600 border-orange-500/50',
      expert: 'bg-red-500/20 text-red-600 border-red-500/50',
      elite: 'bg-red-500/20 text-red-600 border-red-500/50', // backward compat
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

  const getModeLabel = (tier: string) => {
    const labels: Record<string, string> = {
      easy: 'Easy',
      realistic: 'Realistic',
      hard: 'Hard',
      expert: 'Expert',
      elite: 'Expert', // backward compat
      near_impossible: 'Near Impossible',
    };
    return labels[tier] ?? `${tier.charAt(0).toUpperCase()}${tier.slice(1)}`;
  };

  const getCardAccentClasses = (tier: string) => {
    const classes: Record<string, string> = {
      easy: 'bg-emerald-500/20',
      realistic: 'bg-sky-500/20',
      hard: 'bg-orange-500/20',
      expert: 'bg-red-500/20',
      elite: 'bg-red-500/20', // backward compat
      near_impossible: 'bg-red-500/20',
    };
    return classes[tier] ?? 'bg-muted';
  };

  const getCardAccentBullet = (tier: string) => {
    const classes: Record<string, string> = {
      easy: 'bg-emerald-500',
      realistic: 'bg-sky-500',
      hard: 'bg-orange-500',
      expert: 'bg-red-500',
      elite: 'bg-red-500', // backward compat
      near_impossible: 'bg-red-500',
    };
    return classes[tier] ?? 'bg-muted-foreground';
  };



  const getShortTitle = (p: Prospect) => {
    if (!p.positionDescription) return getModeLabel(p.difficultyTier);
    const firstSentence = p.positionDescription.split(/[.!?]/)[0]?.trim() ?? '';
    const match = firstSentence.match(/(?:^|\s)(?:the\s+)?([A-Za-z]+\s+[A-Za-z]+)(?:\s|,|$)/i);
    if (match) return match[1];
    return firstSentence.slice(0, 40) + (firstSentence.length > 40 ? '…' : '');
  };

  const handleStartDiscovery = async (prospectId: string) => {
    setSelectedProspect(null);
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
      if (!response.ok) throw new Error('Failed to create session');
      const data = await response.json();
      router.push(`/dashboard/roleplay/${data.session.id}`);
    } catch (error: unknown) {
      console.error('Error starting roleplay:', error);
      toastError(error instanceof Error ? error.message : 'Failed to start roleplay');
    }
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
            <p className="font-medium">£{Number(offer.priceRange).toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Prospects Section */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold">Prospects</h2>
          <div className="flex items-center gap-2">
            {prospects.length > 0 && (
              <Button
                variant="outline"
                onClick={regenerateProspects}
                disabled={generating}
              >
                {generating ? 'Regenerating…' : 'Regenerate prospects (with bios)'}
              </Button>
            )}
            <Link href={`/dashboard/offers/${offerId}/prospects/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Prospect
              </Button>
            </Link>
          </div>
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
                <EmptyMedia variant="illustration" className="size-32">
                  <EmptyProspectsIllustration className="size-full max-w-[8rem] max-h-[8rem]" />
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
          <>
            <Dialog open={!!selectedProspect} onOpenChange={(open) => !open && setSelectedProspect(null)}>
              <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
                {selectedProspect && (
                  <div className="flex flex-col sm:flex-row min-h-[420px]">
                    <div className="relative w-full sm:w-1/3 min-h-[240px] sm:min-h-0 flex items-center justify-center bg-linear-to-br from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/20 p-8">
                      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} aria-hidden />
                      <Avatar className="size-40 sm:size-48 shrink-0 ring-4 ring-white/80 dark:ring-background/80 shadow-lg">
                        {resolveProspectAvatarUrl(selectedProspect.id, selectedProspect.name, selectedProspect.avatarUrl) ? (
                          <AvatarImage src={resolveProspectAvatarUrl(selectedProspect.id, selectedProspect.name, selectedProspect.avatarUrl)!} alt={selectedProspect.name} className="object-cover" />
                        ) : null}
                        <AvatarFallback className={`text-3xl font-bold text-white bg-gradient-to-br ${getProspectPlaceholderColor(selectedProspect.name)}`}>{getProspectInitials(selectedProspect.name)}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex-1 flex flex-col p-6 sm:p-8 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <DialogTitle className="text-2xl font-bold mb-1">{selectedProspect.name}</DialogTitle>
                          <DialogDescription className="text-sm text-muted-foreground">
                            Start A Roleplay With {getShortTitle(selectedProspect)}
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
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Selling {offer.name}</h4>
                          {offer.priceRange && (
                            <p className="text-xs text-muted-foreground mb-2">Price point: £{Number(offer.priceRange).toLocaleString()}</p>
                          )}
                          <p className="text-sm text-foreground leading-relaxed rounded-md bg-muted/50 p-3 max-h-24 overflow-y-auto">
                            {offer.coreOutcome ?? offer.mechanismHighLevel ?? offer.offerCategory ?? 'No offer description.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedProspect(null)} className="-ml-2">
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back
                        </Button>
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/prospect-avatars/${selectedProspect.id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          </Link>
                          <Button onClick={() => handleStartDiscovery(selectedProspect.id)}>
                            <Phone className="h-4 w-4 mr-2" />
                            Start Roleplay
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {prospects.map((prospect) => (
                <Card
                  key={prospect.id}
                  className="overflow-hidden hover:shadow-lg transition-all cursor-pointer flex flex-col"
                  onClick={() => setSelectedProspect(prospect)}
                >
                  <div className={`relative aspect-square min-h-[200px] ${getCardAccentClasses(prospect.difficultyTier)} flex items-center justify-center p-4`}>
                    {resolveProspectAvatarUrl(prospect.id, prospect.name, prospect.avatarUrl) ? (
                      <img
                        src={resolveProspectAvatarUrl(prospect.id, prospect.name, prospect.avatarUrl)!}
                        alt={prospect.name}
                        className="size-full object-cover rounded-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`size-28 rounded-full bg-gradient-to-br ${getProspectPlaceholderColor(prospect.name)} flex items-center justify-center shadow-lg ${resolveProspectAvatarUrl(prospect.id, prospect.name, prospect.avatarUrl) ? 'hidden' : ''}`}>
                      <span className="text-3xl font-bold text-white">{getProspectInitials(prospect.name)}</span>
                    </div>

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
              <Card
                className="overflow-hidden border-2 border-dashed hover:border-primary cursor-pointer flex flex-col min-h-[280px]"
                onClick={() => router.push(`/dashboard/offers/${offerId}/prospects/new`)}
              >
                <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center bg-muted/50 p-6">
                  <Plus className="h-14 w-14 text-muted-foreground mb-3" />
                  <h3 className="font-semibold text-lg mb-1">Create New Prospect</h3>
                  <p className="text-sm text-muted-foreground text-center">Manual or from transcript</p>
                </div>
                <div className="p-4 border-t">
                  <p className="text-xs text-muted-foreground">Add your own</p>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
