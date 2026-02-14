'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PhaseTimelineBar } from './PhaseTimelineBar';

export interface PhaseAnalysisTabsProps {
  phaseScores: { overall?: number; intro?: number; discovery?: number; pitch?: number; close?: number; objections?: number };
  phaseAnalysis: any;
  overallScore: number;
  callId?: string;
  sessionId?: string;
  sectionNumber?: number;
  defaultTab?: string;
}

const TABS = [
  { id: 'overall', label: 'Overall' },
  { id: 'intro', label: 'Intro' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'close', label: 'Close' },
  { id: 'objections', label: 'Objections' },
] as const;

const phaseLabels: Record<string, string> = { intro: 'Introduction', discovery: 'Discovery', pitch: 'Pitch', close: 'Close' };
const replayLabels: Record<string, string> = { intro: 'Replay This Intro in AI Roleplay', discovery: 'Replay This Discovery Section', pitch: 'Replay This Pitch', close: 'Replay This Close' };

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function buildReplayUrl(phase: string, callId?: string, sessionId?: string, objectionIndex?: number) {
  const params = new URLSearchParams();
  params.set('phase', phase);
  if (objectionIndex != null) params.set('objectionIndex', String(objectionIndex));
  if (callId) params.set('callId', callId);
  if (sessionId) params.set('sessionId', sessionId);
  return `/dashboard/roleplay?${params.toString()}`;
}

export function PhaseAnalysisTabs({ phaseScores, phaseAnalysis, overallScore, callId, sessionId, sectionNumber = 4, defaultTab }: PhaseAnalysisTabsProps) {
  const [activePhase, setActivePhase] = useState<string>(defaultTab || 'overall');

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle className="font-serif">{sectionNumber}. Phase Analysis</CardTitle>
        <CardDescription>Performance across each phase of the call</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActivePhase(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activePhase === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Phase Timeline Bar */}
        <PhaseTimelineBar
          phaseTimings={phaseAnalysis?.phaseTimings}
          totalDuration={phaseAnalysis?.totalDuration}
          activePhase={activePhase as any}
        />

        {/* OVERALL TAB */}
        {activePhase === 'overall' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-6xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                {phaseScores?.overall ?? overallScore ?? 0}
              </div>
              <p className="text-muted-foreground mt-1">out of 100</p>
            </div>
            {/* PARAGRAPH 1: Call Outcome & Why */}
            {phaseAnalysis?.overall?.callOutcomeAndWhy && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Call Outcome & Why This Happened
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {phaseAnalysis.overall.callOutcomeAndWhy}
                </p>
              </div>
            )}

            {/* PARAGRAPH 2: What Limited This Call */}
            {phaseAnalysis?.overall?.whatLimited && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {phaseAnalysis.overall.isStrongCall
                    ? 'Optimization Opportunities'
                    : 'What Limited This Call'}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {phaseAnalysis.overall.whatLimited}
                </p>
              </div>
            )}

            {/* PARAGRAPH 3: Primary Improvement Focus */}
            {phaseAnalysis?.overall?.primaryImprovementFocus && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Primary Improvement Focus
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {phaseAnalysis.overall.primaryImprovementFocus}
                </p>
              </div>
            )}

            {/* FALLBACK for old analyses that only have summary */}
            {!phaseAnalysis?.overall?.callOutcomeAndWhy && phaseAnalysis?.overall?.summary && (
              <p className="text-sm leading-relaxed">{phaseAnalysis.overall.summary}</p>
            )}
            {!phaseAnalysis?.overall?.callOutcomeAndWhy && phaseAnalysis?.overall?.biggestImprovementTheme && (
              <div className={`p-4 rounded-lg border-l-4 ${
                phaseAnalysis.overall.isStrongCall
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-amber-500 bg-amber-500/5'
              }`}>
                <p className={`text-xs font-semibold mb-1 ${
                  phaseAnalysis.overall.isStrongCall ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {phaseAnalysis.overall.isStrongCall ? 'Optimization Focus' : 'Priority Improvement Area'}
                </p>
                <p className="text-sm">{phaseAnalysis.overall.biggestImprovementTheme}</p>
              </div>
            )}
          </div>
        )}

        {/* INTRO / DISCOVERY / PITCH / CLOSE TABS */}
        {(['intro', 'discovery', 'pitch', 'close'] as const).map(phase => {
          if (activePhase !== phase) return null;
          const detail = phaseAnalysis?.[phase];
          const score = typeof phaseScores?.[phase] === 'number' ? phaseScores[phase] : null;
          const sc = score != null ? scoreColor(score) : 'text-muted-foreground';

          return (
            <div key={phase} className="space-y-4">
              {score != null && (
                <Badge className={`text-base px-3 py-1 ${sc} bg-white/5 border-white/10`}>
                  {phaseLabels[phase]}: {score}/100
                </Badge>
              )}
              {detail?.summary && <p className="text-sm leading-relaxed">{detail.summary}</p>}
              {/* What Worked — green accent */}
              {Array.isArray(detail?.whatWorked) && detail.whatWorked.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> What Worked
                  </h4>
                  <ul className="space-y-1.5">
                    {detail.whatWorked.slice(0, 3).map((item: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What Limited Impact — structured feedback with Problem/Correction cards */}
              {Array.isArray(detail?.whatLimitedImpact) && detail.whatLimitedImpact.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> What Limited Impact
                  </h4>
                  {detail.whatLimitedImpact.map((item: any, i: number) => (
                    <div key={i} className="rounded-lg border border-white/10 overflow-hidden">
                      {/* Problem section — red/warning accent */}
                      <div className="border-l-4 border-l-red-500 bg-red-500/5 p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Problem</p>
                          {item.timestamp && (
                            <span className="text-xs font-mono text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded">
                              {item.timestamp}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                      </div>
                      {/* Correction section — green/positive accent */}
                      {item.whatShouldHaveDone && (
                        <div className="border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4 space-y-2">
                          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Correction</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{item.whatShouldHaveDone}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* FALLBACK: Old string-format whatLimitedImpact for pre-Prompt3 analyses */}
              {typeof detail?.whatLimitedImpact === 'string' && detail.whatLimitedImpact && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-amber-400">What Limited Impact</h4>
                  <p className="text-sm text-muted-foreground">{detail.whatLimitedImpact}</p>
                </div>
              )}

              {/* FALLBACK: Old timestampedFeedback for pre-Prompt3 analyses */}
              {!Array.isArray(detail?.whatLimitedImpact) && Array.isArray(detail?.timestampedFeedback) && detail.timestampedFeedback.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">Timestamped Feedback</p>
                  {detail.timestampedFeedback.map((fb: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-mono font-bold">
                        {fb.timestamp || '—'}
                      </span>
                      {fb.whatHappened && (
                        <div>
                          <p className="text-xs font-semibold text-red-400 mb-0.5">What happened</p>
                          <p className="text-sm">{fb.whatHappened}</p>
                        </div>
                      )}
                      {fb.whatShouldHaveHappened && (
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 mb-0.5">What should have happened</p>
                          <p className="text-sm">{fb.whatShouldHaveHappened}</p>
                        </div>
                      )}
                      {fb.whyItMatters && (
                        <div>
                          <p className="text-xs font-semibold text-blue-400 mb-0.5">Why it matters</p>
                          <p className="text-sm">{fb.whyItMatters}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* Replay button */}
              <Link href={buildReplayUrl(phase, callId, sessionId)}>
                <Button variant="outline" size="sm" className="mt-2">
                  <Play className="h-4 w-4 mr-2" />
                  {replayLabels[phase]}
                </Button>
              </Link>
            </div>
          );
        })}

        {/* OBJECTIONS TAB */}
        {activePhase === 'objections' && (
          <div className="space-y-4">
            {(() => {
              const score = phaseScores?.objections;
              const sc = score != null ? scoreColor(score) : 'text-muted-foreground';
              return score != null ? (
                <Badge className={`text-base px-3 py-1 ${sc} bg-white/5 border-white/10`}>
                  Objections: {score}/100
                </Badge>
              ) : null;
            })()}
            {(() => {
              const objBlocks = phaseAnalysis?.objections?.blocks;
              if (!Array.isArray(objBlocks) || objBlocks.length === 0) {
                return <p className="text-sm text-muted-foreground">No objections detected in this call.</p>;
              }
              const typeColors: Record<string, string> = {
                value: 'border-l-purple-500', trust: 'border-l-blue-500', fit: 'border-l-orange-500',
                logistics: 'border-l-gray-500', price: 'border-l-amber-500', timing: 'border-l-blue-500',
                authority: 'border-l-purple-500', need: 'border-l-emerald-500', spouse: 'border-l-pink-500',
              };
              const typeBadgeColors: Record<string, string> = {
                value: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                trust: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                fit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                logistics: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                price: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                timing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                authority: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                need: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                spouse: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
              };
              return objBlocks.map((block: any, i: number) => (
                <div key={i} className={`p-4 rounded-lg border border-white/10 border-l-4 ${typeColors[block.type?.toLowerCase()] || 'border-l-gray-500'} bg-white/5 space-y-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {block.type && (
                        <Badge className={typeBadgeColors[block.type.toLowerCase()] || 'bg-gray-500/20 text-gray-400'}>
                          {block.type.charAt(0).toUpperCase() + block.type.slice(1)}
                        </Badge>
                      )}
                      {block.timestamp && (
                        <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-mono font-bold">{block.timestamp}</span>
                      )}
                    </div>
                  </div>
                  {block.quote && (
                    <p className="font-medium italic text-sm">&ldquo;{block.quote}&rdquo;</p>
                  )}
                  {block.whySurfaced && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-0.5">Why It Surfaced</p>
                      <p className="text-sm">{block.whySurfaced}</p>
                    </div>
                  )}
                  {block.howHandled && (
                    <div>
                      <p className="text-xs font-semibold text-blue-400 mb-0.5">How It Was Handled</p>
                      <p className="text-sm">{block.howHandled}</p>
                    </div>
                  )}
                  {block.higherLeverageAlternative && (
                    <div className="p-3 rounded border border-emerald-500/20 bg-emerald-500/5">
                      <p className="text-xs font-semibold text-emerald-400 mb-0.5">Higher-Leverage Alternative</p>
                      <p className="text-sm">{block.higherLeverageAlternative}</p>
                    </div>
                  )}
                  <Link href={buildReplayUrl('objection', callId, sessionId, i)}>
                    <Button variant="outline" size="sm" className="mt-1">
                      <Play className="h-4 w-4 mr-2" />
                      Re-run This Objection
                    </Button>
                  </Link>
                </div>
              ));
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
