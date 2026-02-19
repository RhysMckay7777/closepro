'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import Link from 'next/link';

export interface ActionPoint {
  label?: string;
  thePattern?: string;
  whyItsCostingYou?: string;
  whatToDoInstead?: string;
  microDrill?: string;
}

export interface ActionPointCardsProps {
  actionPoints: ActionPoint[];
  callId?: string;
  sessionId?: string;
  sectionNumber?: number;
}

function buildTrainUrl(pattern: string, callId?: string, sessionId?: string) {
  const params = new URLSearchParams();
  params.set('skill', pattern);
  if (callId) params.set('callId', callId);
  if (sessionId) params.set('sessionId', sessionId);
  return `/dashboard/roleplay?${params.toString()}`;
}

export function ActionPointCards({ actionPoints, callId, sessionId, sectionNumber = 5 }: ActionPointCardsProps) {
  if (!Array.isArray(actionPoints) || actionPoints.length === 0) return null;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle className="font-serif text-xl">{sectionNumber}. Action Steps</CardTitle>
        <CardDescription>The highest-impact changes to make on your next call</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {actionPoints.slice(0, 3).map((ap, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-lg border border-white/10 bg-white/5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{idx + 1}</span>
              </div>
              <div className="flex-1 space-y-3">
                {ap.label && (
                  <h4 className="text-base font-semibold text-foreground mb-2">{ap.label}</h4>
                )}
                {idx === 2 && !ap.label && (
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Suggested Optimization</p>
                )}
                {ap.thePattern && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-0.5">The Pattern</p>
                    <p className="text-sm font-medium">{ap.thePattern}</p>
                  </div>
                )}
                {ap.whyItsCostingYou && (
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-0.5">Why It&apos;s Costing You</p>
                    <p className="text-sm">{ap.whyItsCostingYou}</p>
                  </div>
                )}
                {ap.whatToDoInstead && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-400 mb-0.5">What To Do Instead</p>
                    <p className="text-sm">{ap.whatToDoInstead}</p>
                  </div>
                )}
                {ap.microDrill && (
                  <div className="p-3 rounded border border-primary/20 bg-primary/5">
                    <p className="text-xs font-semibold text-primary mb-0.5">Micro-Drill</p>
                    <p className="text-sm">{ap.microDrill}</p>
                  </div>
                )}
                {ap.thePattern && (
                  <Link href={buildTrainUrl(ap.thePattern, callId, sessionId)}>
                    <Button variant="outline" size="sm">
                      <Play className="h-4 w-4 mr-2" />
                      Train This Skill
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
