'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, Download, FileDown } from 'lucide-react';
import Link from 'next/link';

const RANGE_OPTIONS = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
] as const;

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

interface PerformanceData {
  range?: string;
  period: string;
  totalAnalyses: number;
  totalCalls: number;
  totalRoleplays: number;
  averageOverall: number;
  averageRoleplayScore?: number;
  trend: 'improving' | 'declining' | 'neutral';
  salesCallsSummary?: { totalCalls: number; averageOverall: number; bestCategory: string | null; bestCategoryScore: number | null; improvementOpportunity: string | null; improvementOpportunityScore: number | null; trend: string };
  roleplaysSummary?: { totalRoleplays: number; averageRoleplayScore: number; bestCategory: string | null; bestCategoryScore: number | null; improvementOpportunity: string | null; improvementOpportunityScore: number | null; trend: string };
  weeklyData: Array<{ week: string; score: number; count: number }>;
  callWeeklyData?: Array<{ week: string; score: number; count: number }>;
  roleplayWeeklyData?: Array<{ week: string; score: number; count: number }>;
  skillCategories: Array<{ category: string; averageScore: number; trend?: number; strengths?: string[]; weaknesses?: string[]; actionPoints?: string[]; trendData?: number[] }>;
  strengths: Array<{ category: string; averageScore: number }>;
  weaknesses: Array<{ category: string; averageScore: number }>;
  byOfferType?: Record<string, { averageScore: number; count: number }>;
  byDifficulty?: Record<string, { averageScore: number; count: number }>;
  byOffer?: Array<{ offerId: string; offerName: string; averageScore: number; count: number }>;
  objectionInsights?: {
    topObjections: Array<{ text: string; count: number; pillar: string; rootCause?: string; preventionOpportunity?: string; handlingQuality?: number }>;
    pillarBreakdown: Array<{ pillar: string; averageHandling: number; count: number }>;
    weakestArea: { pillar: string; averageHandling: number } | null;
    guidance: string;
    improvementActions?: Array<{ problem: string; whatToDoDifferently: string; whenToApply: string; whyItMatters: string }>;
  } | null;
  aiInsight?: string;
  weeklySummary?: { overview: string; skillTrends: string; actionPlan: string[] };
  monthlySummary?: { overview: string; skillTrends: string; actionPlan: string[] };
  principleSummaries?: Array<{
    id: string;
    name: string;
    description: string;
    score: number;
    trend: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
  }>;
  priorityActionSteps?: Array<{
    action: string;
    reason: string;
    frequency: number;
    sources: string[];
  }>;
  recentAnalyses: Array<{
    id: string;
    type: 'call' | 'roleplay';
    overallScore: number;
    createdAt: string;
    difficultyTier?: string | null;
  }>;
  v2?: {
    snapshot: {
      overallScore: number;
      closeRate: number | null;
      avgDifficulty: number | null;
      avgDifficultyTier: string | null;
      objectionConversionRate: number | null;
      totalSessions: number;
    };
    phases: Record<string, {
      phase: string;
      averageScore: number;
      sessionCount: number;
      summary: string;
      strengthPatterns: Array<{ text: string; frequency: number }>;
      weaknessPatterns: Array<{ text: string; frequency: number; whyItMatters?: string; whatToChange?: string }>;
      scoreGuidance: string;
      scoreImprovementSummary?: string;
      handlingImprovements?: string;
      preEmptionImprovements?: string;
      structuralMetrics?: Record<string, number | string>;
    }>;
    objectionsGrouped: Record<string, Array<{ text: string; frequency: number; howHandled?: string; whySurfaced?: string; higherLeverageAlt?: string }>>;
    priorityActionPlan: Array<{ title: string; observedCount: number; impact: string; whatToChange: string; microDrill?: string }>;
  };
}

const OFFER_TYPE_LABELS: Record<string, string> = {
  b2c_health: 'B2C Health',
  b2c_relationships: 'B2C Relationships',
  b2c_wealth: 'B2C Wealth',
  mixed_wealth: 'Mixed Wealth',
  b2b_services: 'B2B Services',
  unknown: 'Unknown',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  realistic: 'Realistic',
  hard: 'Hard',
  expert: 'Expert',
  elite: 'Expert',
};

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [range, setRange] = useState<string>('all_time');
  // Month-specific selection
  const defaultMonthYear = getDefaultMonthYear();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthYear.month);
  const [selectedYear, setSelectedYear] = useState(defaultMonthYear.year);
  const [selectionMode, setSelectionMode] = useState<'range' | 'month'>('range');
  const [dataSource, setDataSource] = useState<'all' | 'calls' | 'roleplays'>('all');
  const [phaseTab, setPhaseTab] = useState<string>('overall');

  const years = [selectedYear - 2, selectedYear - 1, selectedYear, selectedYear + 1].filter((y) => y >= 2020 && y <= 2030);

  useEffect(() => {
    fetchPerformance();
  }, [range, selectedMonth, selectedYear, selectionMode, dataSource]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = `/api/performance`;
      const params: string[] = [];
      if (selectionMode === 'month') {
        params.push(`month=${selectedYear}-${selectedMonth}`);
      } else {
        params.push(`range=${range}`);
      }
      if (dataSource !== 'all') {
        params.push(`source=${dataSource}`);
      }
      url += `?${params.join('&')}`;
      console.log('[Performance] Fetching:', url, { selectionMode, range, selectedMonth, selectedYear, dataSource });
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }
      const data = await response.json();
      console.log('[Performance] Response period:', data.period, 'totalAnalyses:', data.totalAnalyses);
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
      setError(error instanceof Error ? error.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSummary = async () => {
    if (!performance) return;
    try {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 40;
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      const addText = (text: string, fontSize: number, opts?: { bold?: boolean }) => {
        pdf.setFontSize(fontSize);
        if (opts?.bold) pdf.setFont('helvetica', 'bold');
        else pdf.setFont('helvetica', 'normal');
        const lines = pdf.splitTextToSize(text, maxWidth);
        if (y + lines.length * fontSize * 1.2 > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(lines, margin, y);
        y += lines.length * fontSize * 1.2 + 4;
      };

      addText('Performance Summary', 20, { bold: true });
      addText(`Period: ${performance.period}`, 11);
      addText(`Sessions: ${performance.totalAnalyses} (${performance.totalCalls} calls, ${performance.totalRoleplays} roleplays)`, 11);
      addText(`Average Score: ${performance.averageOverall}`, 11);
      y += 10;

      if (performance.weeklySummary) {
        addText('This Week', 14, { bold: true });
        addText(performance.weeklySummary.overview, 10);
        if (performance.weeklySummary.skillTrends) addText(performance.weeklySummary.skillTrends, 10);
        if (performance.weeklySummary.actionPlan?.length) {
          performance.weeklySummary.actionPlan.forEach((a) => addText(`• ${a}`, 10));
        }
        y += 8;
      }

      if (performance.monthlySummary) {
        addText('This Month', 14, { bold: true });
        addText(performance.monthlySummary.overview, 10);
        if (performance.monthlySummary.skillTrends) addText(performance.monthlySummary.skillTrends, 10);
        if (performance.monthlySummary.actionPlan?.length) {
          performance.monthlySummary.actionPlan.forEach((a) => addText(`• ${a}`, 10));
        }
        y += 8;
      }

      if (performance.aiInsight) {
        addText('AI Insight', 14, { bold: true });
        addText(performance.aiInsight, 10);
      }

      const safePeriod = performance.period.replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`Performance_Summary_${safePeriod}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  };

  const handleDownloadCSV = () => {
    if (!performance) return;
    try {
      const rows: string[][] = [];
      rows.push(['Performance Summary']);
      rows.push(['Period', performance.period]);
      rows.push(['Total Sessions', String(performance.totalAnalyses)]);
      rows.push(['Total Calls', String(performance.totalCalls)]);
      rows.push(['Total Roleplays', String(performance.totalRoleplays)]);
      rows.push(['Average Overall Score', String(performance.averageOverall)]);
      rows.push([]);

      if (performance.skillCategories.length > 0) {
        rows.push(['Sales Skills Breakdown']);
        rows.push(['Category', 'Average Score', 'Trend']);
        performance.skillCategories.forEach((s) => {
          rows.push([s.category, String(s.averageScore), s.trend != null ? String(s.trend) : '']);
        });
        rows.push([]);
      }

      if (performance.byOffer && performance.byOffer.length > 0) {
        rows.push(['Scores By Offer']);
        rows.push(['Offer', 'Average Score', 'Sessions']);
        performance.byOffer.forEach((o) => {
          rows.push([`"${o.offerName.replace(/"/g, '""')}"`, String(o.averageScore), String(o.count)]);
        });
        rows.push([]);
      }

      if (performance.byDifficulty && Object.keys(performance.byDifficulty).length > 0) {
        rows.push(['Scores By Difficulty']);
        rows.push(['Difficulty', 'Average Score', 'Sessions']);
        Object.entries(performance.byDifficulty).forEach(([k, v]) => {
          rows.push([k, String(v.averageScore), String(v.count)]);
        });
      }

      const csv = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safePeriod = performance.period.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `Performance_${safePeriod}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <p className="text-destructive font-medium mb-2">{error}</p>
              <Button onClick={fetchPerformance} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No performance data available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Upload calls or complete roleplays to see your performance data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your sales performance over time
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Mode toggle buttons */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium ${selectionMode === 'range' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              onClick={() => setSelectionMode('range')}
            >
              Range
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium ${selectionMode === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              onClick={() => setSelectionMode('month')}
            >
              Month
            </button>
          </div>
          {/* Range selector */}
          {selectionMode === 'range' && (
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Month/Year selector */}
          {selectionMode === 'month' && (
            <div className="flex gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx} value={String(idx + 1).padStart(2, '0')}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v, 10))}>
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
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
          )}
        </div>
      </div>

      {/* Data source toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Data source:</span>
        <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
          {(['all', 'calls', 'roleplays'] as const).map((src) => (
            <button
              key={src}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${dataSource === src
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                }`}
              onClick={() => setDataSource(src)}
            >
              {src === 'all' ? 'All' : src === 'calls' ? 'Sales Calls' : 'Roleplays'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ V2 PERFORMANCE LAYOUT ═══ */}
      {performance.v2 ? (
        <>
          {/* Section 1: 4-Box Snapshot Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Overall Score */}
            <Card className="border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 backdrop-blur-xl">
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall Score</p>
                <p className={`text-4xl font-black ${getScoreColor(performance.v2.snapshot.overallScore)}`}>
                  {performance.v2.snapshot.overallScore || '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{performance.v2.snapshot.totalSessions} session{performance.v2.snapshot.totalSessions !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
            {/* Close Rate */}
            <Card className="border border-white/10 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur-xl">
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Close Rate</p>
                <p className={`text-4xl font-black ${performance.v2.snapshot.closeRate !== null ? getScoreColor(performance.v2.snapshot.closeRate) : 'text-muted-foreground'}`}>
                  {performance.v2.snapshot.closeRate !== null ? `${performance.v2.snapshot.closeRate}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">closed / qualified</p>
              </CardContent>
            </Card>
            {/* Avg Difficulty */}
            <Card className="border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur-xl">
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Avg Difficulty</p>
                <p className="text-4xl font-black text-amber-400">
                  {performance.v2.snapshot.avgDifficulty ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {performance.v2.snapshot.avgDifficultyTier ? performance.v2.snapshot.avgDifficultyTier.charAt(0).toUpperCase() + performance.v2.snapshot.avgDifficultyTier.slice(1) : 'No data'}
                </p>
              </CardContent>
            </Card>
            {/* Objection Conversion */}
            <Card className="border border-white/10 bg-gradient-to-br from-rose-500/10 to-pink-500/5 backdrop-blur-xl">
              <CardContent className="pt-5 pb-4 text-center">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Objection Conversion</p>
                <p className={`text-4xl font-black ${performance.v2.snapshot.objectionConversionRate !== null ? getScoreColor(performance.v2.snapshot.objectionConversionRate) : 'text-muted-foreground'}`}>
                  {performance.v2.snapshot.objectionConversionRate !== null ? `${performance.v2.snapshot.objectionConversionRate}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">objections → close</p>
              </CardContent>
            </Card>
          </div>

          {/* Section 2: Phase Analysis Tabs */}
          <Card className="border border-white/10 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle>Phase Analysis</CardTitle>
              <CardDescription>Deep-dive into each call phase across your sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Phase tab buttons */}
              <div className="flex flex-wrap rounded-lg border border-white/10 overflow-hidden mb-6">
                {['overall', 'intro', 'discovery', 'pitch', 'close', 'objections'].map((tab) => (
                  <button
                    key={tab}
                    className={`flex-1 min-w-[80px] px-3 py-2.5 text-xs font-medium transition-colors ${phaseTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    onClick={() => setPhaseTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {performance.v2!.phases[tab] && (
                      <span className="ml-1.5 opacity-70">{performance.v2!.phases[tab].averageScore || '—'}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Active phase content */}
              {(() => {
                const phase = performance.v2!.phases[phaseTab];
                if (!phase) return <p className="text-muted-foreground text-sm text-center py-6">No data for this phase yet.</p>;

                // For objections tab, show grouped objections instead
                if (phaseTab === 'objections') {
                  const groups = performance.v2!.objectionsGrouped;
                  const hasAny = Object.values(groups).some(arr => arr.length > 0);
                  return (
                    <div className="space-y-6">
                      {/* Score + guidance row */}
                      <div className="flex items-center gap-6">
                        <div className="flex-shrink-0">
                          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${phase.averageScore >= 80 ? 'border-green-500 text-green-500' :
                            phase.averageScore >= 60 ? 'border-blue-500 text-blue-500' :
                              phase.averageScore >= 40 ? 'border-orange-500 text-orange-500' :
                                'border-red-500 text-red-500'
                            }`}>
                            <span className="text-2xl font-black">{phase.averageScore || '—'}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">{phase.scoreGuidance}</p>
                          {phase.summary && <p className="text-sm mt-2">{phase.summary}</p>}
                        </div>
                      </div>

                      {/* Handling & Pre-emption Improvements */}
                      {phase.handlingImprovements && (
                        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                          <p className="text-xs font-bold text-amber-400 mb-1">Handling Improvements</p>
                          <p className="text-sm">{phase.handlingImprovements}</p>
                        </div>
                      )}
                      {phase.preEmptionImprovements && (
                        <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                          <p className="text-xs font-bold text-blue-400 mb-1">Pre-emption Opportunities</p>
                          <p className="text-sm">{phase.preEmptionImprovements}</p>
                        </div>
                      )}

                      {/* Grouped objections by category */}
                      {hasAny ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(['value', 'trust', 'fit', 'logistics'] as const).map(cat => {
                            const items = groups[cat] || [];
                            if (items.length === 0) return null;
                            const catColors: Record<string, string> = {
                              value: 'border-purple-500/30 bg-purple-500/5',
                              trust: 'border-amber-500/30 bg-amber-500/5',
                              fit: 'border-blue-500/30 bg-blue-500/5',
                              logistics: 'border-emerald-500/30 bg-emerald-500/5',
                            };
                            return (
                              <div key={cat} className={`rounded-lg border p-4 ${catColors[cat]}`}>
                                <h4 className="text-sm font-bold capitalize mb-3">{cat} Objections ({items.length})</h4>
                                <div className="space-y-3">
                                  {items.slice(0, 3).map((obj, i) => (
                                    <div key={i} className="space-y-1">
                                      <p className="text-sm font-medium">"{obj.text}"</p>
                                      {obj.frequency > 1 && <Badge variant="outline" className="text-xs">×{obj.frequency}</Badge>}
                                      {obj.whySurfaced && <p className="text-xs text-muted-foreground"><span className="font-semibold">Root cause:</span> {obj.whySurfaced}</p>}
                                      {obj.higherLeverageAlt && <p className="text-xs text-green-400"><span className="font-semibold">Better approach:</span> {obj.higherLeverageAlt}</p>}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No objections recorded in this period.</p>
                      )}
                    </div>
                  );
                }

                // Standard phase tab (Overall / Intro / Discovery / Pitch / Close)
                return (
                  <div className="space-y-6">
                    {/* Score ring + guidance */}
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center ${phase.averageScore >= 80 ? 'border-green-500 text-green-500' :
                          phase.averageScore >= 60 ? 'border-blue-500 text-blue-500' :
                            phase.averageScore >= 40 ? 'border-orange-500 text-orange-500' :
                              'border-red-500 text-red-500'
                          }`}>
                          <span className="text-2xl font-black">{phase.averageScore || '—'}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{phase.scoreGuidance}</p>
                        {phase.sessionCount > 0 && <p className="text-xs text-muted-foreground mt-1">Based on {phase.sessionCount} session{phase.sessionCount !== 1 ? 's' : ''}</p>}
                      </div>
                    </div>

                    {/* Summary */}
                    {phase.summary && (
                      <div className="rounded-lg bg-muted/20 p-4 border border-white/5">
                        <p className="text-sm">{phase.summary}</p>
                      </div>
                    )}

                    {/* Score Improvement Summary (Overall tab only) */}
                    {phaseTab === 'overall' && phase.scoreImprovementSummary && (
                      <div className="rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 p-4">
                        <p className="text-xs font-bold text-primary mb-1">Score Improvement Summary</p>
                        <p className="text-sm">{phase.scoreImprovementSummary}</p>
                      </div>
                    )}

                    {/* Structural Metrics (Intro / Discovery / Pitch / Close) */}
                    {phase.structuralMetrics && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(phase.structuralMetrics)
                          .filter(([k]) => k !== 'callsAnalysed')
                          .map(([key, value]) => {
                            // Convert camelCase to readable label
                            const label = key.replace(/Rate$/, '').replace(/([A-Z])/g, ' $1').trim();
                            return (
                              <div key={key} className="rounded-lg bg-muted/30 border border-white/5 p-3 text-center">
                                <p className="text-2xl font-black">{String(value)}%</p>
                                <p className="text-xs text-muted-foreground capitalize">{label}</p>
                              </div>
                            );
                          })}
                        <div className="rounded-lg bg-muted/10 border border-white/5 p-3 text-center">
                          <p className="text-2xl font-black text-muted-foreground">{phase.structuralMetrics.callsAnalysed}</p>
                          <p className="text-xs text-muted-foreground">Calls Analysed</p>
                        </div>
                      </div>
                    )
                    }

                    {/* Strength patterns */}
                    {phase.strengthPatterns.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-green-400 mb-2">Strength Patterns</h4>
                        <div className="space-y-2">
                          {phase.strengthPatterns.map((p, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-green-500 mt-0.5 shrink-0">+</span>
                              <span className="flex-1">{p.text}</span>
                              {p.frequency > 1 && <Badge variant="outline" className="text-xs border-green-500/30 text-green-400 bg-green-500/10 shrink-0">×{p.frequency}</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weakness patterns */}
                    {phase.weaknessPatterns.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-red-400 mb-2">Repeating Weaknesses</h4>
                        <div className="space-y-3">
                          {phase.weaknessPatterns.map((w, i) => (
                            <div key={i} className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 space-y-1">
                              <div className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5 shrink-0">−</span>
                                <span className="text-sm font-medium flex-1">{w.text}</span>
                                {w.frequency > 1 && <Badge variant="outline" className="text-xs border-red-500/30 text-red-400 bg-red-500/10 shrink-0">×{w.frequency}</Badge>}
                              </div>
                              {w.whyItMatters && <p className="text-xs text-muted-foreground pl-5"><span className="font-semibold">Why:</span> {w.whyItMatters}</p>}
                              {w.whatToChange && <p className="text-xs text-blue-400 pl-5"><span className="font-semibold">Change:</span> {w.whatToChange}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {phase.strengthPatterns.length === 0 && phase.weaknessPatterns.length === 0 && !phase.summary && (
                      <p className="text-sm text-muted-foreground text-center py-6">Complete more sessions to see patterns for {phaseTab}.</p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Section 3: Priority Action Plan */}
          <Card className="border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle>Priority Action Plan</CardTitle>
              <CardDescription>Your top behavioral changes ranked by impact — max 3 at a time</CardDescription>
            </CardHeader>
            <CardContent>
              {performance.v2.priorityActionPlan.length > 0 ? (
                <div className="space-y-4">
                  {performance.v2.priorityActionPlan.map((action, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-sm font-black text-amber-400">{idx + 1}</span>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <p className="text-sm font-bold">{action.title}</p>
                        {action.impact && <p className="text-sm text-muted-foreground">{action.impact}</p>}
                        {action.whatToChange && <p className="text-sm text-blue-400">→ {action.whatToChange}</p>}
                        {action.microDrill && (
                          <div className="rounded bg-primary/5 border border-primary/10 p-2 mt-1">
                            <p className="text-xs text-primary"><span className="font-bold">Drill:</span> {action.microDrill}</p>
                          </div>
                        )}
                        {action.observedCount > 1 && (
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 bg-amber-500/10">
                            Flagged in {action.observedCount} session{action.observedCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Complete more sessions to generate your action plan.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        /* Fallback: Legacy layout for users without v2 data */
        <Card className="border border-white/10 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-lg font-bold">Overall Score: {performance.averageOverall || '—'}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {performance.totalAnalyses} session{performance.totalAnalyses !== 1 ? 's' : ''} analysed ({performance.totalCalls} calls, {performance.totalRoleplays} roleplays)
              </p>
              <p className="text-xs text-muted-foreground mt-4">Phase-based analysis is available for sessions analysed with the latest engine.</p>
            </div>
          </CardContent>
        </Card>
      )
      }

      {/* Export buttons */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
          <FileDown className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadSummary}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    </div >
  );
}
