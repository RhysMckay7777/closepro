'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface OutcomeDiagnosticProps {
  paragraph1?: string | null;
  paragraph2?: string | null;
  outcome?: string | null;
  overallScore?: number | null;
  sectionNumber?: number;
}

function getParagraph2Title(outcome?: string | null, overallScore?: number | null): { title: string; color: string } {
  if (outcome === 'closed' && (overallScore ?? 0) >= 70) return { title: 'Optimization Opportunities', color: 'text-blue-400' };
  if (outcome === 'deposit' || outcome === 'payment_plan') return { title: 'Path to Full Close', color: 'text-emerald-400' };
  if (outcome === 'lost') return { title: 'What Needed to Happen', color: 'text-red-400' };
  return { title: 'Additional Context', color: 'text-blue-400' };
}

export function OutcomeDiagnostic({ paragraph1, paragraph2, outcome, overallScore, sectionNumber = 3 }: OutcomeDiagnosticProps) {
  if (!paragraph1 && !paragraph2) return null;

  return (
    <Card className="border border-amber-500/20 bg-linear-to-br from-amber-500/5 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle className="font-serif">{sectionNumber}. Outcome Diagnostic</CardTitle>
        <CardDescription>Why this call ended the way it did</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {paragraph1 && (
          <div>
            <p className="text-sm font-semibold text-amber-400 mb-1">Why This Result Occurred</p>
            <p className="text-base leading-relaxed">{paragraph1}</p>
          </div>
        )}
        {paragraph2 && (
          <div>
            <p className={`text-sm font-semibold ${getParagraph2Title(outcome, overallScore).color} mb-1`}>{getParagraph2Title(outcome, overallScore).title}</p>
            <p className="text-base leading-relaxed text-muted-foreground">{paragraph2}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
