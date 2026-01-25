'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Users, Phone, Bot, Target, Shield, Package, Truck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface TeamPerformance {
  totalReps: number;
  totalCalls: number;
  totalRoleplays: number;
  averageOverallScore: number;
  averageValueScore: number;
  averageTrustScore: number;
  averageFitScore: number;
  averageLogisticsScore: number;
  trend: 'improving' | 'declining' | 'neutral';
  period: string;
}

export default function ManagerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<TeamPerformance | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchPerformance();
  }, [period]);

  const fetchPerformance = async () => {
    try {
      const response = await fetch(`/api/manager/team-performance?days=${period}`);
      if (!response.ok) throw new Error('Failed to fetch performance');
      const data = await response.json();
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
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
        <div className="text-center py-12">Loading dashboard...</div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No performance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Team performance overview and insights
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[180px]">
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

      {/* Team Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Team Size</p>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{performance.totalReps}</p>
          <p className="text-xs text-muted-foreground mt-1">Active reps</p>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Calls</p>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{performance.totalCalls}</p>
          <p className="text-xs text-muted-foreground mt-1">Analyzed calls</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Roleplays</p>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{performance.totalRoleplays}</p>
          <p className="text-xs text-muted-foreground mt-1">Completed sessions</p>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Avg Score</p>
            {performance.trend === 'improving' ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : performance.trend === 'declining' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
          </div>
          <p className={`text-3xl font-bold ${getScoreColor(performance.averageOverallScore)}`}>
            {performance.averageOverallScore}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {performance.trend === 'improving' && 'Trending up'}
            {performance.trend === 'declining' && 'Trending down'}
            {performance.trend === 'neutral' && 'Stable'}
          </p>
        </Card>
      </div>

      {/* Pillar Performance */}
      <div>
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Pillar Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={`p-6 border-2 ${getScoreBg(performance.averageValueScore)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <h3 className="font-semibold">Value</h3>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(performance.averageValueScore)}`}>
                {performance.averageValueScore}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Average value communication score
            </p>
          </Card>

          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(performance.averageTrustScore)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <h3 className="font-semibold">Trust</h3>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(performance.averageTrustScore)}`}>
                {performance.averageTrustScore}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Average trust building score
            </p>
          </Card>

          <Card className={`p-6 border-2 ${getScoreBg(performance.averageFitScore)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <h3 className="font-semibold">Fit</h3>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(performance.averageFitScore)}`}>
                {performance.averageFitScore}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Average fit confirmation score
            </p>
          </Card>

          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(performance.averageLogisticsScore)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                <h3 className="font-semibold">Logistics</h3>
              </div>
              <span className={`text-2xl font-bold ${getScoreColor(performance.averageLogisticsScore)}`}>
                {performance.averageLogisticsScore}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Average logistics handling score
            </p>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/dashboard/manager/team">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Team Performance</h3>
                <p className="text-sm text-muted-foreground">
                  View leaderboard and compare reps
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/manager/categories">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Category Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Identify team-wide weaknesses
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/manager/insights">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Coaching Insights</h3>
                <p className="text-sm text-muted-foreground">
                  AI-generated recommendations
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
