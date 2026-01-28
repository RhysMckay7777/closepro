'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, TrendingUp, TrendingDown, Minus, Phone, Bot, Loader2, ArrowRight, Upload, Play, BarChart3, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/user-context';

interface PerformanceData {
  totalAnalyses: number;
  totalCalls: number;
  totalRoleplays: number;
  averageOverall: number;
  averageValue: number;
  averageTrust: number;
  averageFit: number;
  averageLogistics: number;
  trend: 'improving' | 'declining' | 'neutral';
  recentAnalyses: Array<{
    id: string;
    type: 'call' | 'roleplay';
    overallScore: number;
    createdAt: string;
  }>;
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const { user } = useUser();
  const router = useRouter();
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/signin');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      fetchPerformance();
    }
  }, [session?.user?.id]);

  const fetchPerformance = async () => {
    try {
      const response = await fetch('/api/performance?days=30');
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
      {/* Greeting Card */}
      <div data-tour="dashboard-greeting">
        <div className="space-y-1">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-primary/90">
            Welcome Back, <span className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold text-foreground inline-block">
              {userName}
            </span>
          </div>
        </div>
        {/* <div className="text-sm text-muted-foreground mt-4">
          Last login: Today
        </div> */}
      </div>

      <div className="relative">
        <div className="absolute inset-0 bg-linear-to-r from-primary/20 to-transparent blur-3xl -z-10" />
        <h1 className="text-2xl sm:text-3xl font-serif font-semibold tracking-tight">Overview</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Here's an overview of your sales performance.
        </p>
      </div>

      {/* Subscription Status Banner */}
      <Card className="border border-white/10 bg-linear-to-br from-primary/10 to-primary/5 backdrop-blur-xl shadow-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-base sm:text-lg">Starter Plan</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  <span className="block sm:inline">15 of 50 calls used this month</span>
                  <span className="hidden sm:inline"> • </span>
                  <span className="block sm:inline">3 of 5 seats used</span>
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
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {performance?.totalCalls || 0}
            </div>
            <p className="text-xs text-muted-foreground">Analyzed calls</p>
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
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Total Sessions</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {performance?.totalAnalyses || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {performance?.totalCalls || 0} calls, {performance?.totalRoleplays || 0} roleplays
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 italic">
              Combined total of analyzed calls and practice sessions
            </p>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl shadow-black/5 hover:shadow-primary/10 transition-all hover:scale-[1.02]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-serif font-semibold text-muted-foreground">Practice Sessions</CardTitle>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-semibold bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {performance?.totalRoleplays || 0}
            </div>
            <p className="text-xs text-muted-foreground">AI roleplay sessions</p>
            <p className="text-xs text-muted-foreground/70 mt-1 italic">
              Interactive practice sessions with AI prospects
            </p>
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
                {performance.recentAnalyses.slice(0, 3).map((analysis) => (
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
                          <p className="text-sm font-medium">
                            {analysis.type === 'call' ? 'Sales Call' : 'AI Roleplay'}
                          </p>
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
                ))}
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
                    <p className="font-medium">Upload Call</p>
                    <p className="text-xs text-muted-foreground">Analyze a sales call</p>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/roleplay/new">
                <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <Play className="h-5 w-5 text-purple-500" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">Start Roleplay</p>
                    <p className="text-xs text-muted-foreground">Practice with AI prospect</p>
                  </div>
                </Button>
              </Link>
              <Link href="/dashboard/performance">
                <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <div className="flex-1 text-left">
                    <p className="font-medium">View Performance</p>
                    <p className="text-xs text-muted-foreground">See your trends & insights</p>
                  </div>
                </Button>
              </Link>
              {performance && performance.weaknesses.length > 0 && (
                <Link href="/dashboard/roleplay/new">
                  <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3 border-primary/20 bg-primary/5">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    <div className="flex-1 text-left">
                      <p className="font-medium">Improve {performance.weaknesses[0].category}</p>
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
