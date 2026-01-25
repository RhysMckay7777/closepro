'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Target, Shield, Package, Truck, TrendingUp, TrendingDown, Minus, Phone, Bot, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PerformanceData {
  period: string;
  totalAnalyses: number;
  totalCalls: number;
  totalRoleplays: number;
  averageOverall: number;
  averageValue: number;
  averageTrust: number;
  averageFit: number;
  averageLogistics: number;
  trend: 'improving' | 'declining' | 'neutral';
  weeklyData: Array<{ week: string; score: number; count: number }>;
  skillCategories: Array<{ category: string; averageScore: number }>;
  strengths: Array<{ category: string; averageScore: number }>;
  weaknesses: Array<{ category: string; averageScore: number }>;
  recentAnalyses: Array<{
    id: string;
    type: 'call' | 'roleplay';
    overallScore: number;
    createdAt: string;
  }>;
}

export default function PerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchPerformance();
  }, [period]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/performance?days=${period}`);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/20 border-green-500/50';
    if (score >= 60) return 'bg-blue-500/20 border-blue-500/50';
    if (score >= 40) return 'bg-orange-500/20 border-orange-500/50';
    return 'bg-red-500/20 border-red-500/50';
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

  // Calculate chart height
  const maxScore = Math.max(...performance.weeklyData.map(d => d.score), 100);
  const chartHeight = 200;

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
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overall Performance */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle>Overall Performance</CardTitle>
          <CardDescription>Your average scores over the last {performance.period}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Overall Score</p>
              <p className={`text-4xl font-bold ${getScoreColor(performance.averageOverall)}`}>
                {performance.averageOverall}
              </p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {performance.trend === 'improving' && (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">Improving</span>
                  </>
                )}
                {performance.trend === 'declining' && (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-500">Declining</span>
                  </>
                )}
                {performance.trend === 'neutral' && (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Stable</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Total Sessions</p>
              <p className="text-4xl font-bold">{performance.totalAnalyses}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {performance.totalCalls} calls, {performance.totalRoleplays} roleplays
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Best Category</p>
              {performance.strengths.length > 0 ? (
                <>
                  <p className="text-2xl font-bold truncate" title={performance.strengths[0].category}>
                    {performance.strengths[0].category}
                  </p>
                  <p className={`text-lg font-semibold ${getScoreColor(performance.strengths[0].averageScore)}`}>
                    {performance.strengths[0].averageScore}
                  </p>
                </>
              ) : performance.totalAnalyses > 0 ? (
                <>
                  <p className="text-2xl font-bold">Value</p>
                  <p className={`text-lg font-semibold ${getScoreColor(performance.averageValue)}`}>
                    {performance.averageValue}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No data yet</p>
              )}
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">Focus Area</p>
              {performance.weaknesses.length > 0 ? (
                <>
                  <p className="text-2xl font-bold truncate" title={performance.weaknesses[0].category}>
                    {performance.weaknesses[0].category}
                  </p>
                  <p className={`text-lg font-semibold ${getScoreColor(performance.weaknesses[0].averageScore)}`}>
                    {performance.weaknesses[0].averageScore}
                  </p>
                </>
              ) : performance.totalAnalyses > 0 ? (
                <>
                  <p className="text-2xl font-bold">Logistics</p>
                  <p className={`text-lg font-semibold ${getScoreColor(performance.averageLogistics)}`}>
                    {performance.averageLogistics}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No data yet</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Trend Chart */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle>Performance Trend</CardTitle>
          <CardDescription>Weekly average scores over the last 7 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative" style={{ height: `${chartHeight + 60}px` }}>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-12 flex flex-col justify-between text-xs text-muted-foreground pr-2">
              <span>{maxScore}</span>
              <span>{Math.round(maxScore * 0.75)}</span>
              <span>{Math.round(maxScore * 0.5)}</span>
              <span>{Math.round(maxScore * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="ml-12 relative" style={{ height: `${chartHeight}px` }}>
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-t border-border/30" />
                ))}
              </div>

              {/* Bars */}
              <div className="absolute inset-0 flex items-end justify-between gap-2 px-2">
                {performance.weeklyData.map((data, index) => {
                  const height = (data.score / maxScore) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
                      <div className="relative w-full flex items-end justify-center" style={{ height: `${chartHeight}px` }}>
                        <div
                          className={`w-full rounded-t transition-all hover:opacity-80 ${
                            data.score >= 80 ? 'bg-green-500' :
                            data.score >= 60 ? 'bg-blue-500' :
                            data.score >= 40 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ height: `${height}%` }}
                          title={`Week ${data.week}: ${data.score} (${data.count} sessions)`}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        <div className="font-medium">{data.score}</div>
                        <div className="text-[10px]">{data.week}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pillar Scores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`border-2 ${getScoreBg(performance.averageValue)}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-semibold">Value</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getScoreColor(performance.averageValue)}`}>
              {performance.averageValue}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Communication score</p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${getScoreBg(performance.averageTrust)}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-semibold">Trust</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getScoreColor(performance.averageTrust)}`}>
              {performance.averageTrust}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Building score</p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${getScoreBg(performance.averageFit)}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-semibold">Fit</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getScoreColor(performance.averageFit)}`}>
              {performance.averageFit}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Confirmation score</p>
          </CardContent>
        </Card>

        <Card className={`border-2 ${getScoreBg(performance.averageLogistics)}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm font-semibold">Logistics</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${getScoreColor(performance.averageLogistics)}`}>
              {performance.averageLogistics}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Handling score</p>
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-green-500">Top Strengths</CardTitle>
            <CardDescription>Your strongest skill categories</CardDescription>
          </CardHeader>
          <CardContent>
            {performance.strengths.length > 0 ? (
              <div className="space-y-3">
                {performance.strengths.map((strength, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="font-medium">{strength.category}</p>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {strength.averageScore}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : performance.totalAnalyses > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="font-medium">Value</p>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    {performance.averageValue}
                  </Badge>
                </div>
                {performance.averageTrust > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="font-medium">Trust</p>
                    <Badge variant="default" className="text-lg px-3 py-1">
                      {performance.averageTrust}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Complete calls or roleplays to see your strengths</p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-red-500">Focus Areas</CardTitle>
            <CardDescription>Categories that need improvement</CardDescription>
          </CardHeader>
          <CardContent>
            {performance.weaknesses.length > 0 ? (
              <div className="space-y-3">
                {performance.weaknesses.map((weakness, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="font-medium">{weakness.category}</p>
                    <Badge variant="destructive" className="text-lg px-3 py-1">
                      {weakness.averageScore}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : performance.totalAnalyses > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="font-medium">Logistics</p>
                  <Badge variant="destructive" className="text-lg px-3 py-1">
                    {performance.averageLogistics}
                  </Badge>
                </div>
                {performance.averageFit < performance.averageValue && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="font-medium">Fit</p>
                    <Badge variant="destructive" className="text-lg px-3 py-1">
                      {performance.averageFit}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Complete calls or roleplays to identify focus areas</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skill Categories */}
      {performance.skillCategories.length > 0 && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle>All Skill Categories</CardTitle>
            <CardDescription>Average scores across all skill categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {performance.skillCategories.map((skill, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="font-medium">{skill.category}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-muted h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          skill.averageScore >= 80 ? 'bg-green-500' :
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
