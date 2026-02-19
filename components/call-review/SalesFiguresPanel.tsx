'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Pencil, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export interface SalesFiguresPanelProps {
  call: {
    callDate?: string | null;
    callType?: string | null;
    offerName?: string | null;
    prospectName?: string | null;
    result?: string | null;
    cashCollected?: number | null;
    revenueGenerated?: number | null;
    commissionRatePct?: number | null;
    reasonForOutcome?: string | null;
    paymentType?: string | null;
    numberOfInstalments?: number | null;
    monthlyAmount?: number | null;
    addToSalesFigures?: boolean | null;
  };
  callId: string;
}

export function SalesFiguresPanel({ call, callId }: SalesFiguresPanelProps) {
  const showPrompt = call.result == null && call.cashCollected == null && call.revenueGenerated == null;

  return (
    <>
      {showPrompt && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Add this call to your figures:</strong> Set the deal outcome below (result, cash collected, revenue) so it shows in Performance &rarr; Figures. The AI may have filled these; if not, click Edit outcome and enter the amounts.
          </AlertDescription>
        </Alert>
      )}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <CardTitle className="font-serif text-xl">Sales figures outcome</CardTitle>
            </div>
            <Link href={`/dashboard/calls/${callId}/confirm`}>
              <Button type="button" variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Edit details
              </Button>
            </Link>
          </div>
          <CardDescription>
            Used for Figures (cash collected, revenue). Set result and amounts so this call is included in Performance &rarr; Figures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Call date:</span>{' '}
              {call.callDate ? new Date(call.callDate).toLocaleDateString() : '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Call type:</span>{' '}
              {call.callType === 'follow_up' ? 'Follow-up' : call.callType ? call.callType.replace('_', ' ') : '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Offer:</span>{' '}
              {call.offerName || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Prospect:</span>{' '}
              {call.prospectName || '—'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Result:</span>{' '}
              {call.result ? (
                <Badge variant="outline" className={
                  call.result === 'closed' ? 'border-green-500/50 text-green-600' :
                  call.result === 'deposit' ? 'border-orange-500/50 text-orange-600' :
                  call.result === 'payment_plan' ? 'border-orange-500/50 text-orange-600' :
                  call.result === 'lost' ? 'border-red-500/50 text-red-600' :
                  call.result === 'follow_up_result' ? 'border-amber-500/50 text-amber-600' :
                  call.result === 'follow_up' ? 'border-amber-500/50 text-amber-600' :
                  call.result === 'unqualified' ? 'border-red-500/50 text-red-600' :
                  ''
                }>
                  {call.result === 'follow_up_result' ? 'Follow-up' :
                   call.result === 'payment_plan' ? 'Payment Plan' :
                   call.result.charAt(0).toUpperCase() + call.result.slice(1).replace(/_/g, ' ')}
                </Badge>
              ) : '—'}
            </div>
            {call.addToSalesFigures === false && (
              <div className="sm:col-span-2">
                <Badge variant="secondary" className="text-xs">Not counted in figures</Badge>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Cash collected:</span>{' '}
              {call.cashCollected != null ? `£${(call.cashCollected / 100).toLocaleString()}` : '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Revenue generated:</span>{' '}
              {call.revenueGenerated != null ? `£${(call.revenueGenerated / 100).toLocaleString()}` : '—'}
            </div>
            {call.commissionRatePct != null && (
              <div>
                <span className="text-muted-foreground">Commission rate:</span> {call.commissionRatePct}%
              </div>
            )}
            {call.reasonForOutcome && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">
                  {call.result === 'deposit' ? 'Deposit reason:' :
                   call.result === 'lost' ? 'Loss reason:' :
                   call.result === 'follow_up_result' ? 'Follow-up reason:' :
                   call.result === 'unqualified' ? 'Qualification notes:' :
                   'Reason:'}
                </span>{' '}
                {call.reasonForOutcome}
              </div>
            )}
            {call.paymentType === 'payment_plan' && call.numberOfInstalments && (
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Payment plan:</span>{' '}
                {call.numberOfInstalments} instalments of £{call.monthlyAmount?.toLocaleString() ?? '—'}/mo
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
