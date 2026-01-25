'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Shield, Package, Truck } from 'lucide-react';
import Link from 'next/link';

interface Rep {
  id: string;
  name: string;
  email: string;
  profilePhoto: string | null;
  role: string;
  averageOverallScore: number;
  averageValueScore: number;
  averageTrustScore: number;
  averageFitScore: number;
  averageLogisticsScore: number;
  trend: 'improving' | 'declining' | 'neutral';
  status: 'green' | 'amber' | 'red';
  totalCalls: number;
  totalRoleplays: number;
  totalAnalyses: number;
}

export default function TeamPerformancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<Rep[]>([]);
  const [period, setPeriod] = useState('30');
  const [sortBy, setSortBy] = useState<'score' | 'calls' | 'name'>('score');

  useEffect(() => {
    fetchReps();
  }, [period]);

  const fetchReps = async () => {
    try {
      const response = await fetch(`/api/manager/reps?days=${period}`);
      if (!response.ok) throw new Error('Failed to fetch reps');
      const data = await response.json();
      setReps(data.reps || []);
    } catch (error) {
      console.error('Error fetching reps:', error);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      green: 'default',
      amber: 'secondary',
      red: 'destructive',
    };
    const colors: Record<string, string> = {
      green: 'bg-green-500',
      amber: 'bg-yellow-500',
      red: 'bg-red-500',
    };
    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        <div className={`w-2 h-2 rounded-full ${colors[status]} mr-2`}></div>
        {status}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Compute sorted reps based on current sortBy
  const sortedReps = [...reps].sort((a, b) => {
    if (sortBy === 'score') {
      return b.averageOverallScore - a.averageOverallScore;
    } else if (sortBy === 'calls') {
      return (b.totalCalls + b.totalRoleplays) - (a.totalCalls + a.totalRoleplays);
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading team performance...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <Link href="/dashboard/manager">
            <Button variant="ghost" size="sm" className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold">Team Performance</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Compare rep performance and identify coaching opportunities
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort by Score</SelectItem>
              <SelectItem value="calls">Sort by Activity</SelectItem>
              <SelectItem value="name">Sort by Name</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Leaderboard */}
      {sortedReps.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No team performance data available</p>
        </Card>
      ) : (
        <div className="gap-3 flex flex-col">
          {sortedReps.map((rep, index) => (
            <Link key={rep.id} href={`/dashboard/manager/reps/${rep.id}`}>
              <Card className="p-4 sm:p-6 hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer group overflow-hidden">
                {/* Mobile Layout */}
                <div className="flex flex-col sm:hidden gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-muted-foreground/60 w-8 text-center">
                      #{index + 1}
                    </div>
                    <Avatar className="h-12 w-12 border-2 border-background group-hover:border-primary/20 transition-colors">
                      <AvatarImage src={rep.profilePhoto || undefined} />
                      <AvatarFallback>{getInitials(rep.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors truncate">
                        {rep.name}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{rep.email}</p>
                    </div>
                    {getStatusBadge(rep.status)}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Overall</p>
                      <p className={`text-3xl font-bold ${getScoreColor(rep.averageOverallScore)}`}>
                        {rep.averageOverallScore}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Activity</p>
                      <p className="text-xl font-bold">{rep.totalCalls + rep.totalRoleplays}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {rep.totalCalls} calls, {rep.totalRoleplays} roleplays
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-3 border-t">
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Target className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                      <p className={`text-sm font-bold ${getScoreColor(rep.averageValueScore)}`}>
                        {rep.averageValueScore}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Shield className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                      <p className={`text-sm font-bold ${getScoreColor(rep.averageTrustScore)}`}>
                        {rep.averageTrustScore}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Package className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                      <p className={`text-sm font-bold ${getScoreColor(rep.averageFitScore)}`}>
                        {rep.averageFitScore}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/30">
                      <Truck className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                      <p className={`text-sm font-bold ${getScoreColor(rep.averageLogisticsScore)}`}>
                        {rep.averageLogisticsScore}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-3 sm:gap-4 lg:gap-6 flex-wrap lg:flex-nowrap">
                  {/* Rank & Avatar */}
                  <div className="flex items-center gap-3 lg:gap-4 min-w-[100px] lg:min-w-[120px]">
                    <div className="text-2xl lg:text-3xl font-bold text-muted-foreground/60 w-8 lg:w-10 text-center">
                      #{index + 1}
                    </div>
                    <Avatar className="h-12 w-12 lg:h-14 lg:w-14 border-2 border-background group-hover:border-primary/20 transition-colors">
                      <AvatarImage src={rep.profilePhoto || undefined} />
                      <AvatarFallback className="text-base lg:text-lg">{getInitials(rep.name)}</AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Name & Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg lg:text-xl mb-1 group-hover:text-primary transition-colors truncate">
                      {rep.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{rep.email}</p>
                    <div className="flex items-center gap-2 lg:gap-3 mt-2 flex-wrap">
                      {getStatusBadge(rep.status)}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {rep.trend === 'improving' && (
                          <>
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-500">Improving</span>
                          </>
                        )}
                        {rep.trend === 'declining' && (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="text-red-500">Declining</span>
                          </>
                        )}
                        {rep.trend === 'neutral' && (
                          <>
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <span>Stable</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Overall Score */}
                  <div className="text-center min-w-[80px] lg:min-w-[100px] px-2 lg:px-4">
                    <p className="text-xs text-muted-foreground mb-1">Overall</p>
                    <p className={`text-3xl lg:text-4xl font-bold ${getScoreColor(rep.averageOverallScore)}`}>
                      {rep.averageOverallScore}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {rep.totalAnalyses} {rep.totalAnalyses === 1 ? 'analysis' : 'analyses'}
                    </p>
                  </div>

                  {/* Pillar Scores - Compact Grid */}
                  <div className="hidden lg:grid grid-cols-4 gap-2 lg:gap-3 min-w-[240px] lg:min-w-[280px]">
                    <div className="text-center p-2 lg:p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Target className="h-3 w-3 lg:h-4 lg:w-4 mx-auto mb-1 lg:mb-1.5 text-muted-foreground" />
                      <p className={`text-base lg:text-lg font-bold ${getScoreColor(rep.averageValueScore)}`}>
                        {rep.averageValueScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Value</p>
                    </div>
                    <div className="text-center p-2 lg:p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Shield className="h-3 w-3 lg:h-4 lg:w-4 mx-auto mb-1 lg:mb-1.5 text-muted-foreground" />
                      <p className={`text-base lg:text-lg font-bold ${getScoreColor(rep.averageTrustScore)}`}>
                        {rep.averageTrustScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Trust</p>
                    </div>
                    <div className="text-center p-2 lg:p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Package className="h-3 w-3 lg:h-4 lg:w-4 mx-auto mb-1 lg:mb-1.5 text-muted-foreground" />
                      <p className={`text-base lg:text-lg font-bold ${getScoreColor(rep.averageFitScore)}`}>
                        {rep.averageFitScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Fit</p>
                    </div>
                    <div className="text-center p-2 lg:p-3 rounded-lg bg-muted/30 border border-border/50">
                      <Truck className="h-3 w-3 lg:h-4 lg:w-4 mx-auto mb-1 lg:mb-1.5 text-muted-foreground" />
                      <p className={`text-base lg:text-lg font-bold ${getScoreColor(rep.averageLogisticsScore)}`}>
                        {rep.averageLogisticsScore}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Logistics</p>
                    </div>
                  </div>

                  {/* Activity */}
                  <div className="hidden sm:block text-center min-w-[100px] lg:min-w-[120px] px-2 lg:px-4 border-l border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Activity</p>
                    <div className="space-y-1">
                      <div>
                        <p className="text-xl lg:text-2xl font-bold">{rep.totalCalls + rep.totalRoleplays}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="flex items-center justify-center gap-1 lg:gap-2 text-[10px] lg:text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>{rep.totalCalls} calls</span>
                        <span>•</span>
                        <span>{rep.totalRoleplays} roleplays</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
