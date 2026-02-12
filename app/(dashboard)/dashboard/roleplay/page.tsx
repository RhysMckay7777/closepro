'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Clock, TrendingUp, MessageSquare, Heart, Users, DollarSign, PieChart, Briefcase, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';
import { EmptyRoleplayIllustration } from '@/components/illustrations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RoleplaySession {
  id: string;
  mode: string;
  status: string;
  inputMode: string;
  selectedDifficulty: string | null;
  actualDifficultyTier: string | null;
  overallScore: number | null;
  offerName: string;
  prospectName?: string;
  offerType?: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

const PHASE_LABELS: Record<string, string> = {
  intro: 'Introduction',
  discovery: 'Discovery',
  pitch: 'Pitch',
  close: 'Close',
  objection: 'Objection Handling',
  skill: 'Skill Training',
};

function RoleplayPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Replay detection
  const replayPhase = searchParams?.get('phase');
  const replaySkill = searchParams?.get('skill');
  const replayCallId = searchParams?.get('callId');
  const replaySessionId = searchParams?.get('sessionId');
  const replayObjectionIndex = searchParams?.get('objectionIndex');
  const isReplay = !!(replayPhase || replaySkill);

  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [replayStatus, setReplayStatus] = useState<string | null>(isReplay ? 'Setting up phase practice...' : null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const replayTriggeredRef = useRef(false);

  // Safe JSON parse helper
  const safeParse = (val: unknown, fallback: unknown = {}) => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return fallback; }
    }
    return fallback;
  };

  // Replay dispatcher effect
  const handleReplay = useCallback(async () => {
    if (!isReplay || replayTriggeredRef.current) return;
    replayTriggeredRef.current = true;

    try {
      setReplayStatus('Fetching original analysis...');

      let offerId: string | null = null;
      let phaseAnalysis: any = null;
      let actionPoints: any[] = [];

      if (replayCallId) {
        // Fetch from call status API
        const res = await fetch(`/api/calls/${replayCallId}/status`);
        if (!res.ok) throw new Error('Failed to fetch original call');
        const data = await res.json();
        offerId = data.call?.offerId || null;
        const analysis = data.analysis;
        if (analysis) {
          phaseAnalysis = safeParse(analysis.phaseAnalysis, null);
          actionPoints = safeParse(analysis.actionPoints, []) as any[];
        }
      } else if (replaySessionId) {
        // Fetch from roleplay session API
        const res = await fetch(`/api/roleplay/${replaySessionId}`);
        if (!res.ok) throw new Error('Failed to fetch original session');
        const data = await res.json();
        offerId = data.session?.offerId || null;
        const analysis = data.analysis;
        if (analysis) {
          phaseAnalysis = safeParse(analysis.phaseAnalysis, null);
          actionPoints = safeParse(analysis.actionPoints, []) as any[];
        }
      }

      if (!offerId) {
        setReplayError('Could not determine the offer for this replay. Please start a new roleplay manually.');
        setReplayStatus(null);
        return;
      }

      // Build replay context
      let replayContext: any = {};
      const effectivePhase = replayPhase || (replaySkill ? 'skill' : null);

      if (effectivePhase === 'objection' && phaseAnalysis?.objections?.blocks) {
        const idx = replayObjectionIndex ? parseInt(replayObjectionIndex) : 0;
        const block = phaseAnalysis.objections.blocks[idx];
        replayContext = {
          phase: 'objection',
          objectionIndex: idx,
          originalObjection: block || null,
          originalFeedback: phaseAnalysis?.objections || null,
        };
      } else if (effectivePhase === 'skill' && replaySkill) {
        const matchingPoint = actionPoints.find(
          (ap: any) => ap.thePattern === replaySkill || ap.thePattern?.toLowerCase() === replaySkill?.toLowerCase()
        ) || actionPoints[0] || null;
        replayContext = {
          phase: 'skill',
          skill: replaySkill,
          originalActionPoint: matchingPoint,
        };
      } else if (effectivePhase && phaseAnalysis?.[effectivePhase]) {
        replayContext = {
          phase: effectivePhase,
          originalFeedback: phaseAnalysis[effectivePhase],
        };
      } else {
        replayContext = { phase: effectivePhase };
      }

      setReplayStatus('Creating practice session...');

      // Create the session
      const createRes = await fetch('/api/roleplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId,
          selectedDifficulty: 'realistic',
          inputMode: 'voice',
          mode: 'manual',
          replayPhase: effectivePhase,
          replaySourceCallId: replayCallId || null,
          replaySourceSessionId: replaySessionId || null,
          replayContext: JSON.stringify(replayContext),
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create practice session');
      }

      const createData = await createRes.json();
      router.push(`/dashboard/roleplay/${createData.session.id}`);
    } catch (err: any) {
      console.error('Replay setup error:', err);
      setReplayError(err.message || 'Failed to set up practice session');
      setReplayStatus(null);
    }
  }, [isReplay, replayPhase, replaySkill, replayCallId, replaySessionId, replayObjectionIndex, router]);

  useEffect(() => {
    if (isReplay) {
      handleReplay();
    } else {
      fetchSessions();
    }
  }, [isReplay, handleReplay]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/roleplay');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  // If this is a replay, show the replay loading/error UI
  if (isReplay) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-lg">
        <Card className="p-8 sm:p-12 text-center space-y-6">
          {replayError ? (
            <>
              <p className="text-destructive font-medium">{replayError}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/dashboard/roleplay/new">
                  <Button>Start New Roleplay</Button>
                </Link>
                <Link href="/dashboard/roleplay">
                  <Button variant="outline">Back to Roleplays</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">
                  {PHASE_LABELS[replayPhase || 'skill'] || 'Phase'} Practice
                </h2>
                <p className="text-sm text-muted-foreground">{replayStatus}</p>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // Normal session listing
  const getOfferTypeLabel = (type?: string) => {
    if (!type) return '—';
    const labels: Record<string, string> = {
      b2c_health: 'B2C Health',
      b2c_relationships: 'B2C Relationships',
      b2c_wealth: 'B2C Wealth',
      mixed_wealth: 'Mixed Wealth',
      b2b_services: 'B2B Services',
    };
    return labels[type] || type;
  };

  const getOfferTypeDescription = (type?: string) => {
    if (!type) return null;
    const descriptions: Record<string, string> = {
      b2c_health: 'Health and wellness solutions',
      b2c_relationships: 'Relationship and personal development',
      b2c_wealth: 'Financial and wealth building',
      mixed_wealth: 'Mixed wealth solutions',
      b2b_services: 'Business services and solutions',
    };
    return descriptions[type] || null;
  };

  const getOfferTypeIcon = (type?: string) => {
    if (!type) return null;
    const iconMap: Record<string, React.ReactNode> = {
      b2c_health: <Heart className="h-4 w-4 text-red-500" />,
      b2c_relationships: <Users className="h-4 w-4 text-pink-500" />,
      b2c_wealth: <DollarSign className="h-4 w-4 text-green-500" />,
      mixed_wealth: <PieChart className="h-4 w-4 text-blue-500" />,
      b2b_services: <Briefcase className="h-4 w-4 text-purple-500" />,
    };
    return iconMap[type] || null;
  };

  const getDifficultyBadgeVariant = (tier: string | null) => {
    if (!tier) return 'outline';
    switch (tier) {
      case 'easy':
        return 'default';
      case 'realistic':
        return 'secondary';
      case 'hard':
        return 'outline';
      case 'expert':
      case 'elite':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="hidden sm:block shrink-0 w-14 h-14 text-muted-foreground/70">
            <EmptyRoleplayIllustration className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">AI Roleplay</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Practice sales calls with AI prospects
            </p>
          </div>
        </div>
        <Link href="/dashboard/roleplay/new" className="w-full sm:w-auto">
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <Plus className="h-5 w-5" />
            Start New Roleplay
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold">{sessions.length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.status === 'in_progress').length}
              </p>
            </div>
            <Play className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.status === 'completed').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Score</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.overallScore !== null).length > 0
                  ? Math.round(
                    sessions
                      .filter(s => s.overallScore !== null)
                      .reduce((sum, s) => sum + (s.overallScore || 0), 0) /
                    sessions.filter(s => s.overallScore !== null).length
                  )
                  : 'N/A'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 sm:p-12">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="illustration" className="size-32">
                    <EmptyRoleplayIllustration className="size-full max-w-[8rem] max-h-[8rem]" />
                  </EmptyMedia>
                  <EmptyTitle>No roleplay sessions yet</EmptyTitle>
                  <EmptyDescription>Start your first AI roleplay to practice and get scored.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Link href="/dashboard/roleplay/new">
                    <Button>Start Your First Roleplay</Button>
                  </Link>
                </EmptyContent>
              </Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Offer Name</TableHead>
                  <TableHead>Prospect Name</TableHead>
                  <TableHead>Offer Type</TableHead>
                  <TableHead>Prospect Difficulty</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow
                    key={session.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => {
                      if (session.status === 'completed' && session.overallScore !== null) {
                        router.push(`/dashboard/roleplay/${session.id}/results`);
                      } else {
                        router.push(`/dashboard/roleplay/${session.id}`);
                      }
                    }}
                  >
                    <TableCell>
                      {new Date(session.startedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{session.offerName}</div>
                      {session.offerType && getOfferTypeDescription(session.offerType) && (
                        <p className="text-xs text-muted-foreground mt-0.5">{getOfferTypeDescription(session.offerType)}</p>
                      )}
                    </TableCell>
                    <TableCell>{session.prospectName ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getOfferTypeIcon(session.offerType)}
                        <Badge variant="outline">{getOfferTypeLabel(session.offerType)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.actualDifficultyTier ? (
                        <Badge variant={getDifficultyBadgeVariant(session.actualDifficultyTier)}>
                          {session.actualDifficultyTier === 'elite' ? 'Expert' : session.actualDifficultyTier.charAt(0).toUpperCase() + session.actualDifficultyTier.slice(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {session.overallScore !== null && session.overallScore !== undefined ? (
                        <span className="font-medium">{session.overallScore}/100</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function RoleplayPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <RoleplayPageContent />
    </Suspense>
  );
}
