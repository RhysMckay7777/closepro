'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Phone, Bot, ArrowLeft, Loader2, AlertCircle, Download, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const RANGE_OPTIONS = [
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
  recentAnalyses: Array<{
    id: string;
    type: 'call' | 'roleplay';
    overallScore: number;
    createdAt: string;
    difficultyTier?: string | null;
  }>;
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
  elite: 'Elite',
};

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [range, setRange] = useState<string>('this_month');
  // Month-specific selection
  const defaultMonthYear = getDefaultMonthYear();
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthYear.month);
  const [selectedYear, setSelectedYear] = useState(defaultMonthYear.year);
  const [selectionMode, setSelectionMode] = useState<'range' | 'month'>('range');
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [dataSource, setDataSource] = useState<'all' | 'calls' | 'roleplays'>('all');
  const [box4Tab, setBox4Tab] = useState<'offerType' | 'offer' | 'difficulty'>('offerType');

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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }
      const data = await response.json();
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
      setError(error instanceof Error ? error.message : 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSummary = () => {
    if (!performance) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const period = performance.period;
    const content = `
      <!DOCTYPE html>
      <html>
        <head><title>Performance Summary - ${period}</title></head>
        <body style="font-family: system-ui; padding: 24px; max-width: 640px;">
          <h1>Performance Summary</h1>
          <p><strong>Period:</strong> ${period}</p>
          <p><strong>Sessions:</strong> ${performance.totalAnalyses} (${performance.totalCalls} calls, ${performance.totalRoleplays} roleplays)</p>
          <p><strong>Average Score:</strong> ${performance.averageOverall}</p>
          ${performance.weeklySummary ? `<h2>This Week</h2><p>${performance.weeklySummary.overview}</p><p>${performance.weeklySummary.skillTrends}</p><ul>${(performance.weeklySummary.actionPlan || []).map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
          ${performance.monthlySummary ? `<h2>This Month</h2><p>${performance.monthlySummary.overview}</p><p>${performance.monthlySummary.skillTrends}</p><ul>${(performance.monthlySummary.actionPlan || []).map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
          ${performance.aiInsight ? `<h2>Insight</h2><p>${performance.aiInsight}</p>` : ''}
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
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

  // Calculate chart heights for separate charts
  const callData = performance.callWeeklyData ?? performance.weeklyData;
  const roleplayData = performance.roleplayWeeklyData ?? performance.weeklyData;
  const callMaxScore = Math.max(...callData.map(d => d.score), 100);
  const roleplayMaxScore = Math.max(...roleplayData.map(d => d.score), 100);
  const chartHeight = 180;

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

      {/* ═══ SALES CALLS SECTION ═══ */}
      {(dataSource === 'all' || dataSource === 'calls') && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Overall Performance – Sales Calls</CardTitle>
            <CardDescription>Based on {performance.period}. Data: analysed sales calls only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(performance.salesCallsSummary?.averageOverall ?? performance.averageOverall)}`}>
                  {performance.salesCallsSummary?.averageOverall ?? performance.averageOverall}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total Calls Analysed: {performance.salesCallsSummary?.totalCalls ?? performance.totalCalls}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Best Category</p>
                <p className="text-2xl font-bold truncate" title={performance.salesCallsSummary?.bestCategory ?? performance.strengths[0]?.category}>
                  {performance.salesCallsSummary?.bestCategory ?? performance.strengths[0]?.category ?? '—'}
                </p>
                {(performance.salesCallsSummary?.bestCategoryScore ?? performance.strengths[0]?.averageScore) != null && (
                  <p className={`text-lg font-semibold mt-1 ${getScoreColor((performance.salesCallsSummary?.bestCategoryScore ?? performance.strengths[0]?.averageScore) as number)}`}>
                    {performance.salesCallsSummary?.bestCategoryScore ?? performance.strengths[0]?.averageScore}
                  </p>
                )}
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Biggest Improvement Opportunity</p>
                <p className="text-2xl font-bold truncate" title={performance.salesCallsSummary?.improvementOpportunity ?? performance.weaknesses[0]?.category}>
                  {performance.salesCallsSummary?.improvementOpportunity ?? performance.weaknesses[0]?.category ?? '—'}
                </p>
                {(performance.salesCallsSummary?.improvementOpportunityScore ?? performance.weaknesses[0]?.averageScore) != null && (
                  <p className={`text-lg font-semibold mt-1 ${getScoreColor((performance.salesCallsSummary?.improvementOpportunityScore ?? performance.weaknesses[0]?.averageScore) as number)}`}>
                    {performance.salesCallsSummary?.improvementOpportunityScore ?? performance.weaknesses[0]?.averageScore}
                  </p>
                )}
              </div>
            </div>

            {/* Sales Calls Trend Chart */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Sales Calls – Weekly Trend</h4>
              <div className="relative" style={{ height: `${chartHeight + 60}px` }}>
                <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                  <span>{callMaxScore}</span>
                  <span>{Math.round(callMaxScore * 0.75)}</span>
                  <span>{Math.round(callMaxScore * 0.5)}</span>
                  <span>{Math.round(callMaxScore * 0.25)}</span>
                  <span>0</span>
                </div>
                <div className="ml-12 relative" style={{ height: `${chartHeight}px` }}>
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-t border-border/30" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-end justify-between gap-2 px-2">
                    {callData.map((data, index) => {
                      const height = callMaxScore > 0 ? (data.score / callMaxScore) * 100 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="relative w-full flex items-end justify-center" style={{ height: `${chartHeight}px` }}>
                            <div
                              className={`w-full rounded-t transition-all hover:opacity-80 ${data.score >= 80 ? 'bg-green-500' :
                                data.score >= 60 ? 'bg-blue-500' :
                                  data.score >= 40 ? 'bg-orange-500' :
                                    data.score > 0 ? 'bg-red-500' : 'bg-muted/20'
                                }`}
                              style={{ height: `${height}%`, minHeight: data.score > 0 ? '4px' : '0px' }}
                              title={`Week ${data.week}: ${data.score} (${data.count} calls)`}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            <div className="font-medium">{data.score || '–'}</div>
                            <div className="text-[10px]">{data.week}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ROLEPLAYS SECTION ═══ */}
      {(dataSource === 'all' || dataSource === 'roleplays') && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" /> Overall Performance – Roleplays</CardTitle>
            <CardDescription>Based on {performance.period}. Data: roleplay sessions only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Average Roleplay Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(performance.roleplaysSummary?.averageRoleplayScore ?? performance.averageRoleplayScore ?? 0)}`}>
                  {performance.roleplaysSummary?.averageRoleplayScore ?? performance.averageRoleplayScore ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Total Roleplays: {performance.roleplaysSummary?.totalRoleplays ?? performance.totalRoleplays}</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Best Category</p>
                <p className="text-2xl font-bold truncate">{performance.roleplaysSummary?.bestCategory ?? '—'}</p>
                {performance.roleplaysSummary?.bestCategoryScore != null && (
                  <p className={`text-lg font-semibold mt-1 ${getScoreColor(performance.roleplaysSummary.bestCategoryScore)}`}>
                    {performance.roleplaysSummary.bestCategoryScore}
                  </p>
                )}
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground mb-2">Biggest Improvement Opportunity</p>
                <p className="text-2xl font-bold truncate">{performance.roleplaysSummary?.improvementOpportunity ?? '—'}</p>
                {performance.roleplaysSummary?.improvementOpportunityScore != null && (
                  <p className={`text-lg font-semibold mt-1 ${getScoreColor(performance.roleplaysSummary.improvementOpportunityScore)}`}>
                    {performance.roleplaysSummary.improvementOpportunityScore}
                  </p>
                )}
              </div>
            </div>

            {/* Roleplays Trend Chart */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Roleplays – Weekly Trend</h4>
              <div className="relative" style={{ height: `${chartHeight + 60}px` }}>
                <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
                  <span>{roleplayMaxScore}</span>
                  <span>{Math.round(roleplayMaxScore * 0.75)}</span>
                  <span>{Math.round(roleplayMaxScore * 0.5)}</span>
                  <span>{Math.round(roleplayMaxScore * 0.25)}</span>
                  <span>0</span>
                </div>
                <div className="ml-12 relative" style={{ height: `${chartHeight}px` }}>
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="border-t border-border/30" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-end justify-between gap-2 px-2">
                    {roleplayData.map((data, index) => {
                      const height = roleplayMaxScore > 0 ? (data.score / roleplayMaxScore) * 100 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="relative w-full flex items-end justify-center" style={{ height: `${chartHeight}px` }}>
                            <div
                              className={`w-full rounded-t transition-all hover:opacity-80 ${data.score >= 80 ? 'bg-green-500' :
                                data.score >= 60 ? 'bg-blue-500' :
                                  data.score >= 40 ? 'bg-orange-500' :
                                    data.score > 0 ? 'bg-red-500' : 'bg-muted/20'
                                }`}
                              style={{ height: `${height}%`, minHeight: data.score > 0 ? '4px' : '0px' }}
                              title={`Week ${data.week}: ${data.score} (${data.count} roleplays)`}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground text-center">
                            <div className="font-medium">{data.score || '–'}</div>
                            <div className="text-[10px]">{data.week}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Skill Breakdown (10 categories from API) */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle>Sales Skills Breakdown</CardTitle>
          <CardDescription>Average score and trend per category (from analyses). Sales categories defined in Knowledge Doc: Sales Call Scoring Framework.</CardDescription>
        </CardHeader>
        <CardContent>
          {performance.skillCategories.length > 0 ? (
            <div className="space-y-1">
              {performance.skillCategories.map((skill, idx) => {
                const isExpanded = expandedCategories.has(idx);
                const toggleExpand = () => {
                  setExpandedCategories(prev => {
                    const next = new Set(prev);
                    if (next.has(idx)) next.delete(idx); else next.add(idx);
                    return next;
                  });
                };
                return (
                  <div key={idx} className="rounded-lg bg-white/5 border border-white/10 overflow-hidden">
                    <button
                      onClick={toggleExpand}
                      className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <p className="font-medium">{skill.category}</p>
                      <div className="flex items-center gap-3">
                        {typeof skill.trend === 'number' && skill.trend !== 0 && (
                          <span className={`text-xs flex items-center gap-0.5 ${skill.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {skill.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {skill.trend > 0 ? '+' : ''}{skill.trend}
                          </span>
                        )}
                        <div className="w-32 bg-muted h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${skill.averageScore >= 80 ? 'bg-green-500' :
                              skill.averageScore >= 60 ? 'bg-blue-500' :
                                skill.averageScore >= 40 ? 'bg-orange-500' :
                                  'bg-red-500'
                              }`}
                            style={{ width: `${skill.averageScore}%` }}
                          />
                        </div>
                        <span className={`text-lg font-bold w-12 text-right ${getScoreColor(skill.averageScore)}`}>
                          {skill.averageScore}
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/10">
                        {/* Trend sparkline */}
                        {skill.trendData && skill.trendData.some(v => v > 0) && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Trend Over Time</p>
                            <svg viewBox={`0 0 ${(skill.trendData.length - 1) * 20} 30`} className="w-full h-8" preserveAspectRatio="none">
                              <polyline
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-blue-500"
                                points={skill.trendData.map((v, i) => `${i * 20},${30 - (v / 10) * 30}`).join(' ')}
                              />
                            </svg>
                          </div>
                        )}
                        {skill.strengths && skill.strengths.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-green-500 mb-1">Strengths</p>
                            <ul className="text-sm text-muted-foreground space-y-0.5">
                              {skill.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                            </ul>
                          </div>
                        )}
                        {skill.weaknesses && skill.weaknesses.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-red-500 mb-1">Weaknesses</p>
                            <ul className="text-sm text-muted-foreground space-y-0.5">
                              {skill.weaknesses.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          </div>
                        )}
                        {skill.actionPoints && skill.actionPoints.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-blue-500 mb-1">Action Points to Improve</p>
                            <ul className="text-sm text-muted-foreground space-y-0.5">
                              {skill.actionPoints.map((a, i) => <li key={i}>→ {a}</li>)}
                            </ul>
                          </div>
                        )}
                        {(!skill.strengths || skill.strengths.length === 0) && (!skill.weaknesses || skill.weaknesses.length === 0) && (!skill.actionPoints || skill.actionPoints.length === 0) && (
                          <p className="text-sm text-muted-foreground italic">Not enough data yet for a detailed breakdown.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No scored sessions yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Complete a call analysis or roleplay to see your skills breakdown.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Box 4: Average Scores By (Tabs) */}
      {((performance.byOfferType && Object.keys(performance.byOfferType).length > 0) ||
        (performance.byDifficulty && Object.keys(performance.byDifficulty).length > 0) ||
        (performance.byOffer && performance.byOffer.length > 0)) && (
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle>Average Scores By</CardTitle>
              <CardDescription>Performance breakdown by offer type, specific offer, and prospect difficulty</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Tab buttons */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden mb-4">
                {[
                  { key: 'offerType' as const, label: 'By Offer Type' },
                  { key: 'offer' as const, label: 'By Specific Offer' },
                  { key: 'difficulty' as const, label: 'By Prospect Difficulty' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${box4Tab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/20 hover:bg-muted/40 text-muted-foreground'
                      }`}
                    onClick={() => setBox4Tab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {box4Tab === 'offerType' && (
                performance.byOfferType && Object.keys(performance.byOfferType).length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 font-medium text-muted-foreground">Offer Type</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Avg Score</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(performance.byOfferType).map(([k, v]) => (
                        <tr key={k} className="border-b border-border/20">
                          <td className="py-2">{OFFER_TYPE_LABELS[k] ?? k}</td>
                          <td className={`py-2 text-right font-medium ${getScoreColor(v.averageScore)}`}>{v.averageScore}</td>
                          <td className="py-2 text-right text-muted-foreground">{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No offer type data available</p>
                )
              )}

              {box4Tab === 'offer' && (
                performance.byOffer && performance.byOffer.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 font-medium text-muted-foreground">Offer</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Avg Score</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.byOffer.slice(0, 10).map((o) => (
                        <tr key={o.offerId} className="border-b border-border/20">
                          <td className="py-2 truncate max-w-[200px]" title={o.offerName}>{o.offerName}</td>
                          <td className={`py-2 text-right font-medium ${getScoreColor(o.averageScore)}`}>{o.averageScore}</td>
                          <td className="py-2 text-right text-muted-foreground">{o.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No specific offer data available</p>
                )
              )}

              {box4Tab === 'difficulty' && (
                performance.byDifficulty && Object.keys(performance.byDifficulty).length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-2 font-medium text-muted-foreground">Difficulty</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Avg Score</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(performance.byDifficulty).map(([k, v]) => (
                        <tr key={k} className="border-b border-border/20">
                          <td className="py-2">{DIFFICULTY_LABELS[k] ?? k}</td>
                          <td className={`py-2 text-right font-medium ${getScoreColor(v.averageScore)}`}>{v.averageScore}</td>
                          <td className="py-2 text-right text-muted-foreground">{v.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No difficulty data available</p>
                )
              )}
            </CardContent>
          </Card>
        )}

      {/* Objection Handling Insights */}
      {performance.objectionInsights && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Objection Handling Insights
            </CardTitle>
            <CardDescription>Common objections and how you handle them</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Top objections */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Most Common Objections</h4>
              <div className="space-y-2">
                {performance.objectionInsights.topObjections.map((obj, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">&ldquo;{obj.text}&rdquo;</span>
                        <Badge variant="outline" className="text-xs">{obj.pillar}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {obj.handlingQuality != null && (
                          <span className={`text-xs font-medium ${getScoreColor(obj.handlingQuality * 10)}`}>Quality: {obj.handlingQuality}/10</span>
                        )}
                        <span className="text-sm font-medium">{obj.count}×</span>
                      </div>
                    </div>
                    {obj.rootCause && (
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Root Cause:</span> {obj.rootCause}</p>
                    )}
                    {obj.preventionOpportunity && (
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Prevention:</span> {obj.preventionOpportunity}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pillar breakdown */}
            {performance.objectionInsights.pillarBreakdown.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Handling Score by Pillar</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {performance.objectionInsights.pillarBreakdown.map((p) => (
                    <div key={p.pillar} className={`text-center p-3 rounded-lg border ${p.pillar === performance.objectionInsights?.weakestArea?.pillar ? 'border-red-500/40 bg-red-500/10' : 'border-white/10 bg-white/5'}`}>
                      <p className="text-xs text-muted-foreground mb-1">{p.pillar}</p>
                      <p className={`text-lg font-bold ${getScoreColor(p.averageHandling * 10)}`}>{p.averageHandling}</p>
                      <p className="text-[10px] text-muted-foreground">{p.count} handled</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Guidance */}
            {performance.objectionInsights.guidance && (
              <p className="text-sm text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                💡 {performance.objectionInsights.guidance}
              </p>
            )}

            {/* Prioritised Improvement Actions */}
            {performance.objectionInsights.improvementActions && performance.objectionInsights.improvementActions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Prioritised Improvement Actions</h4>
                <div className="space-y-2">
                  {performance.objectionInsights.improvementActions.map((action, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-1">
                      <p className="text-sm font-medium">{action.problem}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Do differently:</span> {action.whatToDoDifferently}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium">When:</span> {action.whenToApply}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium">Why:</span> {action.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Insight */}
      {performance.aiInsight && (
        <Card className="border border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{performance.aiInsight}</p>
          </CardContent>
        </Card>
      )}


      {/* Weekly & Monthly Summary + PDF export */}
      {(performance.weeklySummary || performance.monthlySummary) && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Summaries</CardTitle>
              <CardDescription>This week and this month overview</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadSummary} className="shrink-0">
              <Download className="h-4 w-4 mr-2" />
              Download summary (PDF)
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {performance.weeklySummary && (
              <div>
                <h3 className="text-sm font-semibold mb-1">This week</h3>
                <p className="text-sm text-muted-foreground">{performance.weeklySummary.overview}</p>
                {performance.weeklySummary.skillTrends && (
                  <p className="text-sm text-muted-foreground mt-1">{performance.weeklySummary.skillTrends}</p>
                )}
                {performance.weeklySummary.actionPlan?.length ? (
                  <ul className="list-disc list-inside text-sm mt-2 space-y-0.5">
                    {performance.weeklySummary.actionPlan.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            {performance.monthlySummary && (
              <div>
                <h3 className="text-sm font-semibold mb-1">This month</h3>
                <p className="text-sm text-muted-foreground">{performance.monthlySummary.overview}</p>
                {performance.monthlySummary.skillTrends && (
                  <p className="text-sm text-muted-foreground mt-1">{performance.monthlySummary.skillTrends}</p>
                )}
                {performance.monthlySummary.actionPlan?.length ? (
                  <ul className="list-disc list-inside text-sm mt-2 space-y-0.5">
                    {performance.monthlySummary.actionPlan.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
