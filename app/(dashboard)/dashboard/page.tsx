'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, TrendingUp, TrendingDown, Minus, Phone, Bot, Loader2, ArrowRight, Upload, Play, BarChart3, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/user-context';
import { DashboardHeroIllustration } from '@/components/illustrations';

const DASHBOARD_RANGE_OPTIONS = [
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'last_year', label: 'Last Year' },
] as const;

interface PerformanceData {
  period: string;
  totalAnalyses: number;
  totalCalls: number;
  totalRoleplays: number;
  averageOverall: number;
  averageRoleplayScore: number;
  trend: 'improving' | 'declining' | 'neutral';
  recentAnalyses: Array<{
    id: string;
    type: 'call' | 'roleplay';
    overallScore: number;
    createdAt: string;
    difficultyTier?: string | null;
  }>;
  strengths?: Array<{ category: string; averageScore: number }>;
  weaknesses?: Array<{ category: string; averageScore: number }>;
}

interface BillingData {
  subscription: { planTier: string; callsPerMonth: number; roleplaySessionsPerMonth: number } | null;
  usage: { callsUsed: number; roleplaySessionsUsed: number; month: string };
  organization?: { name: string; currentSeats: number; maxSeats: number };
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter Plan',
  pro: 'Pro Plan',
  enterprise: 'Enterprise',
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const { user } = useUser();
  const router = useRouter();
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('this_month');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/signin');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      fetchPerformance();
    }
  }, [session?.user?.id, range]);

  useEffect(() => {
    if (session?.user) {
      fetch('/api/billing')
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data && setBilling(data))
        .catch(() => {});
    }
  }, [session?.user?.id]);

  const fetchPerformance = async () => {
    try {
      const response = await fetch(`/api/performance?range=${range}`);
      if (response.ok) {
        const data = await response.json();
        setPerformance(data);
      }
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userName = user?.name?.split(' ')[0] || session.user?.name?.split(' ')[0] || 'User';
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-8">
      {/* Greeting + Hero illustration */}
      <div data-tour="dashboard-greeting" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-primary/90">
            Welcome Back, <span className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-foreground inline-block">
              {userName}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Here&apos;s an overview of your sales performance.
          </p>
        </div>
        <div className="shrink-0 w-40 sm:w-48 text-muted-foreground/80">
          <DashboardHeroIllustration className="w-full h-auto" />
        </div>
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute inset-0 bg-linear-to-r from-primary/20 to-transparent blur-3xl -z-10" />
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight">Overview</h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            {DASHBOARD_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Plan & Usage */}
      <Card className="border border-white/10 bg-linear-to-br from-primary/10 to-primary/5 backdrop-blur-xl shadow-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-base sm:text-lg">
                  {billing?.subscription ? PLAN_NAMES[billing.subscription.planTier] ?? billing.subscription.planTier : 'Starter Plan'}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="block sm:inline">
                    Usage this month: {billing?.usage?.callsUsed ?? 0} of {billing?.subscription?.callsPerMonth ?? 50} calls
                    {typeof billing?.subscription?.roleplaySessionsPerMonth === 'number' && billing.subscription.roleplaySessionsPerMonth >= 0
                      ? ` • ${billing?.usage?.roleplaySessionsUsed ?? 0} of ${billing.subscription.roleplaySessionsPerMonth} roleplays`
                      : ''}
                  </span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">
                    Sessions remaining this month: {Math.max(0, (billing?.subscription?.callsPerMonth ?? 50) - (billing?.usage?.callsUsed ?? 0))} calls
                    {billing?.organization ? ` • ${billing.organization.currentSeats ?? 0} of ${billing.organization.maxSeats ?? 5} seats` : ''}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <Link href="/dashboard/billing" className="flex-1 sm:flex-initial">
                <Button variant="outline" className="shadow-sm w-full sm:w-auto text-sm">
                  View Details
                </Button>
              </Link>
              <Link href="/pricing" className="flex-1 sm:flex-initial">
                <Button className="shadow-sm w-full sm:w-auto text-sm">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Upgrade
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Calls Analysed</CardTitle>
            <Phone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {performance?.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">Based on {performance?.period ?? range}</p>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Avg. Score</CardTitle>
            <div className="flex items-center gap-1">
              {performance?.trend === 'improving' && <TrendingUp className="h-4 w-4 text-green-500" />}
              {performance?.trend === 'declining' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {performance?.trend === 'neutral' && <Minus className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-semibold ${getScoreColor(performance?.averageOverall || 0)}`}>
              {performance?.averageOverall || 0}
            </div>
            <p className={`text-xs ${performance?.trend === 'improving' ? 'text-green-500' :
                performance?.trend === 'declining' ? 'text-red-500' :
                  'text-muted-foreground'
              }`}>
              {performance?.trend === 'improving' && 'Improving'}
              {performance?.trend === 'declining' && 'Declining'}
              {performance?.trend === 'neutral' && 'Stable'}
            </p>
            <p className="text-xs text-muted-foreground">Based on {performance?.period ?? range}</p>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Total Roleplay Sessions</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {performance?.totalRoleplays || 0}
            </div>
            <p className="text-xs text-muted-foreground">Roleplay sessions in period. Based on {performance?.period ?? range}</p>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Average Roleplay Score</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-semibold ${getScoreColor(performance?.averageRoleplayScore ?? 0)}`}>
              {performance?.averageRoleplayScore ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Roleplay only. Based on {performance?.period ?? range}</p>
          </CardContent>
        </Card>
      </div>


      {/* Recent Activity & Quick Actions - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Activity */}
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-serif font-semibold flex items-center gap-2">
                  Recent Activity
                  {performance && performance.recentAnalyses.length > 0 && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </CardTitle>
                <CardDescription>
                  Your latest calls and practice sessions
                </CardDescription>
              </div>
              <Link href="/dashboard/performance">
                <Button variant="ghost" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!performance || performance.recentAnalyses.length === 0 ? (
              <div className="text-sm text-muted-foreground p-8 text-center bg-white/5 rounded-lg border border-dashed border-white/10">
                No recent activity to display.
              </div>
            ) : (
              <div className="flex flex-col space-y-3">
                {performance.recentAnalyses.slice(0, 3).map((analysis) => {
                  const dateStr = new Date(analysis.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const actionLabel = analysis.type === 'call'
                    ? `Live Call Reviewed – ${dateStr}`
                    : `Roleplay Completed${analysis.difficultyTier ? ` (${analysis.difficultyTier})` : ''} – ${dateStr}`;
                  return (
                    <Link
                      key={analysis.id}
                      href={analysis.type === 'call'
                        ? `/dashboard/calls/${analysis.id}`
                        : `/dashboard/roleplay/${analysis.id}/results`}
                    >
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          {analysis.type === 'call' ? (
                            <Phone className="h-4 w-4 text-blue-500" />
                          ) : (
                            <Bot className="h-4 w-4 text-purple-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{actionLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(analysis.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${getScoreColor(analysis.overallScore)}`}>
                          {analysis.overallScore}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle className="text-lg font-serif font-semibold flex items-center gap-2">
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-3">
              <Link href="/dashboard/calls">
                <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Upload className="h-5 w-5 text-primary" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">Upload & Review Call</p>
                    <p className="text-xs text-muted-foreground">Analyze a sales call</p>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/roleplay/new">
                <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Play className="h-5 w-5 text-purple-500" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">Start AI Roleplay</p>
                    <p className="text-xs text-muted-foreground">Practice with AI prospect</p>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/performance">
                <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">View Performance Insights</p>
                    <p className="text-xs text-muted-foreground">See your trends & insights</p>
                  </div>
                </Button>
              </Link>
              {performance && (performance.weaknesses?.length ?? 0) > 0 && (
                <Link href="/dashboard/roleplay/new">
                  <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 border-primary/20 bg-primary/5">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Improve {performance.weaknesses?.[0]?.category}</p>
                      <p className="text-xs text-muted-foreground">Focus on your weakest area</p>
                    </div>
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
