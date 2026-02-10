'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Phone, CheckCircle2, TrendingUp, PoundSterling, AlertCircle, FileDown, Trash2 } from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
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
  isInstalment?: boolean;
  instalmentNumber?: number;
  totalInstalments?: number;
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
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const commissionTableRef = useRef<HTMLDivElement>(null);

  const exportCSV = useCallback(() => {
    if (!figures?.salesList?.length) return;
    setExportingCsv(true);
    try {
      const headers = ['Date', 'Offer', 'Prospect Name', 'Cash Collected', 'Revenue Generated', 'Commission %', 'Commission Earned'];
      const rows = figures.salesList.map((row) => [
        row.date,
        `"${(row.offerName || '').replace(/"/g, '""')}"`,
        `"${(row.prospectName || '').replace(/"/g, '""')}"`,
        (row.cashCollected / 100).toFixed(2),
        (row.revenueGenerated / 100).toFixed(2),
        `${row.commissionPct}%`,
        (row.commissionAmount / 100).toFixed(2),
      ]);
      const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const monthLabel = MONTHS[Number(month) - 1];
      a.href = url;
      a.download = `Commission_${monthLabel}_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error', err);
    } finally {
      setExportingCsv(false);
    }
  }, [figures, month, year]);

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

  const handleDeleteCall = async (callId: string) => {
    if (!confirm('Delete this call and all its data? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/calls/${callId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toastSuccess('Call deleted');
      fetchFigures(); // Refresh figures to reflect deletion
    } catch {
      toastError('Failed to delete call');
    }
  };

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
                  <PoundSterling className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Cash Collected</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">£{(figures.cashCollected / 100).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Total cash received this month</p>
              </CardContent>
            </Card>
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <PoundSterling className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm font-semibold">Revenue Generated</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">£{(figures.revenueGenerated / 100).toLocaleString()}</p>
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

          {/* Visual divider before Commission */}
          <div className="pt-8 pb-4" aria-hidden>
            <hr className="border-t-2 border-border" />
          </div>

          {/* Commission section: Total Commission (This Month) */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <PoundSterling className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-semibold">Total Commission</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">{MONTHS[Number(month) - 1]} {year}</p>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">£{((figures.totalCommission ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>

          {/* Commission table: Date, Offer, Prospect Name, Cash Collected, Revenue, Commission %, Commission Amount – exportable as PDF */}
          {figures.salesList && figures.salesList.length > 0 && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl" id="commission-table" ref={commissionTableRef}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-semibold">Commission Schedule</CardTitle>
                  <p className="text-xs text-muted-foreground">Per-deal breakdown for {MONTHS[Number(month) - 1]} {year}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingCsv}
                    onClick={exportCSV}
                  >
                    {exportingCsv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exportingPdf}
                    onClick={async () => {
                      if (!commissionTableRef.current) return;
                      setExportingPdf(true);
                      try {
                        const html2canvas = (await import('html2canvas')).default;
                        const { jsPDF } = await import('jspdf');
                        const canvas = await html2canvas(commissionTableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                        const imgData = canvas.toDataURL('image/png');
                        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
                        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                        const monthLabel = MONTHS[Number(month) - 1];
                        pdf.save(`Commission_${monthLabel}_${year}.pdf`);
                      } catch (err) {
                        console.error('PDF export error', err);
                      } finally {
                        setExportingPdf(false);
                      }
                    }}
                  >
                    {exportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 pr-4">Offer</th>
                        <th className="py-2 pr-4">Prospect Name</th>
                        <th className="py-2 pr-4 text-right">Cash Collected</th>
                        <th className="py-2 pr-4 text-right">Revenue Generated</th>
                        <th className="py-2 pr-4 text-right">Commission %</th>
                        <th className="py-2 pr-4 text-right">Commission Earned</th>
                        <th className="py-2 w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {figures.salesList.map((row, idx) => (
                        <tr key={`${row.callId}-${idx}`} className="border-b border-border/50">
                          <td className="py-2 pr-4">
                            {row.date}
                            {row.isInstalment && row.instalmentNumber && row.totalInstalments && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (instalment {row.instalmentNumber} of {row.totalInstalments})
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">{row.offerName}</td>
                          <td className="py-2 pr-4">{row.prospectName || 'Unknown'}</td>
                          <td className="py-2 pr-4 text-right">£{(row.cashCollected / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 pr-4 text-right">£{(row.revenueGenerated / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2 pr-4 text-right">{row.commissionPct}%</td>
                          <td className="py-2 pr-4 text-right">£{(row.commissionAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteCall(row.callId)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
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
              <strong>Cash collected &amp; revenue:</strong> These come from each call&apos;s outcome. Open a completed call → <strong>Edit outcome</strong> → set Result, Cash collected (£), and Revenue generated (£). The AI may fill these from the transcript; if not, add them there so this page updates.
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
