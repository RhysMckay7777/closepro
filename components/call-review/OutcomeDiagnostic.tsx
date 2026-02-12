'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface OutcomeDiagnosticProps {
  paragraph1?: string | null;
  paragraph2?: string | null;
  outcome?: string | null;
  overallScore?: number | null;
  sectionNumber?: number;
}

function getParagraph2Title(outcome?: string | null, overallScore?: number | null): string {
  if (outcome === 'closed' && (overallScore ?? 0) >= 70) return 'Optimization Opportunities';
  if (outcome === 'deposit' || outcome === 'payment_plan') return 'Path to Full Close';
  if (outcome === 'lost') return 'What Needed to Happen';
  return 'Additional Context';
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
            <p className="text-xs font-semibold text-muted-foreground mb-1">Why This Result Occurred</p>
            <p className="text-base leading-relaxed">{paragraph1}</p>
          </div>
        )}
        {paragraph2 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{getParagraph2Title(outcome, overallScore)}</p>
            <p className="text-base leading-relaxed text-muted-foreground">{paragraph2}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
