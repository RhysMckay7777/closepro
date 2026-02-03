'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Phone, CheckCircle2, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SalesListItem {
  callId: string;
  date: string;
  offerName: string;
  prospectName: string;
  cashCollected: number;
  revenueGenerated: number;
  commissionPct: number;
  commissionAmount: number;
}

interface FiguresData {
  month: string;
  callsBooked: number;
  callsShowed: number;
  callsQualified: number;
  salesMade: number;
  closeRate: number;
  showRate: number;
  qualifiedRate: number;
  cashCollected: number;
  revenueGenerated: number;
  cashCollectedPct: number;
  commissionRatePct?: number | null;
  totalCommission?: number;
  salesList?: SalesListItem[];
  schemaHint?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDefaultMonthYear(): { month: string; year: number } {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, '0'),
    year: now.getFullYear(),
  };
}

function toMonthParam(month: string, year: number): string {
  return `${year}-${month}`;
}

export default function FiguresPage() {
  const defaultRange = getDefaultMonthYear();
  const [month, setMonth] = useState(defaultRange.month);
  const [year, setYear] = useState(defaultRange.year);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [figures, setFigures] = useState<FiguresData | null>(null);

  const fetchFigures = useCallback(async () => {
    const monthParam = toMonthParam(month, year);
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/performance/figures?month=${monthParam}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch figures');
      }
      const data = await response.json();
      setFigures(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load figures');
      setFigures(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchFigures();
  }, [fetchFigures]);

  const years = [year - 2, year - 1, year, year + 1, year + 2].filter((y) => y >= 2020 && y <= 2030);

  if (loading && !figures) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading figures...</p>
        </div>
      </div>
    );
  }

  if (error && !figures) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-destructive font-medium mb-2">{error}</p>
              <Button onClick={fetchFigures} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/dashboard/performance">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Performance
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Figures</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Month-by-month sales reality: booked, showed, qualified, closed, revenue
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchFigures} disabled={loading} className="shrink-0">
            {loading && figures ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, i) => (
                <SelectItem key={label} value={String(i + 1).padStart(2, '0')}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {figures?.schemaHint && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {figures.schemaHint} Figures will stay at zero until migrations are run.
          </AlertDescription>
        </Alert>
      )}

      {loading && figures && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {figures && (
        <>
          {/* Row 1 – Volume: Calls Booked, Showed, Qualified, Sales Made */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-semibold">Total Calls Booked</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.callsBooked}</p>
                <p className="text-xs text-muted-foreground mt-1">For selected month</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Total Calls Showed</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.callsShowed}</p>
                <p className="text-xs text-muted-foreground mt-1">For selected month</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-sm font-semibold">Total Calls Qualified</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.callsQualified}</p>
                <p className="text-xs text-muted-foreground mt-1">For selected month</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Sales Made</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.salesMade}</p>
                <p className="text-xs text-muted-foreground mt-1">For selected month</p>
              </CardContent>
            </Card>
          </div>

          {/* Row 2 – Rates: Close Rate, Show Rate, Qualified Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Close Rate</CardTitle>
                <p className="text-xs text-muted-foreground">Sales Made ÷ Calls Showed</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.closeRate}%</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Show Rate</CardTitle>
                <p className="text-xs text-muted-foreground">Calls Showed ÷ Calls Booked</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.showRate}%</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Qualified Rate</CardTitle>
                <p className="text-xs text-muted-foreground">Calls Qualified ÷ Calls Showed</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.qualifiedRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Row 3 – Revenue: Cash Collected, Revenue Generated, Cash Collected % */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Cash Collected</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${(figures.cashCollected / 100).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Amount actually collected (cents stored)</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Revenue Generated</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${(figures.revenueGenerated / 100).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total value of deals (incl. payment plans)</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Cash Collected %</CardTitle>
                <p className="text-xs text-muted-foreground">Cash Collected ÷ Revenue Generated</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.cashCollectedPct}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Commission: rate and total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Commission rate</CardTitle>
                <p className="text-xs text-muted-foreground">Your default commission % (set in profile if available)</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{figures.commissionRatePct != null ? `${figures.commissionRatePct}%` : '—'}</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Total commission (month)</CardTitle>
                <p className="text-xs text-muted-foreground">Sum of commission on sales (revenue × commission % per deal)</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${((figures.totalCommission ?? 0) / 100).toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales list: cash, revenue, offer, date, commission % per deal, commission amount */}
          {figures.salesList && figures.salesList.length > 0 && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Sales this month (for commission)</CardTitle>
                <p className="text-xs text-muted-foreground">Cash received, revenue generated, offer, date of sale, commission % per deal, commission amount</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Offer</th>
                        <th className="py-2 pr-4">Prospect</th>
                        <th className="py-2 pr-4 text-right">Cash</th>
                        <th className="py-2 pr-4 text-right">Revenue</th>
                        <th className="py-2 pr-4 text-right">Commission %</th>
                        <th className="py-2 text-right">Commission $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {figures.salesList.map((row) => (
                        <tr key={row.callId} className="border-b border-border/50">
                          <td className="py-2 pr-4">{row.date}</td>
                          <td className="py-2 pr-4">{row.offerName}</td>
                          <td className="py-2 pr-4">{row.prospectName || '—'}</td>
                          <td className="py-2 pr-4 text-right">${(row.cashCollected / 100).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right">${(row.revenueGenerated / 100).toLocaleString()}</td>
                          <td className="py-2 pr-4 text-right">{row.commissionPct}%</td>
                          <td className="py-2 text-right">${(row.commissionAmount / 100).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* How cash/revenue get into figures */}
          <Alert className="border-primary/30 bg-primary/5">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Cash collected &amp; revenue:</strong> These come from each call&apos;s outcome. Open a completed call → <strong>Edit outcome</strong> → set Result, Cash collected ($), and Revenue generated ($). The AI may fill these from the transcript; if not, add them there so this page updates.
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Figures include analysed transcripts (when &quot;Add to sales figures&quot; is on) and manual call entries. Follow-up closes increase sales count but not call count.
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
