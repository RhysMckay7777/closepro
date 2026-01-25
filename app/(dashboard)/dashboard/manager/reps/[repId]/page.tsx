'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Shield, Package, Truck, Phone, Bot } from 'lucide-react';
import Link from 'next/link';

interface RepDetail {
  rep: {
    id: string;
    name: string;
    email: string;
    profilePhoto: string | null;
  };
  performance: {
    averageOverallScore: number;
    averageValueScore: number;
    averageTrustScore: number;
    averageFitScore: number;
    averageLogisticsScore: number;
    trend: 'improving' | 'declining' | 'neutral';
    totalCalls: number;
    totalRoleplays: number;
    totalAnalyses: number;
  };
  strengths: Array<{ category: string; averageScore: number }>;
  weaknesses: Array<{ category: string; averageScore: number }>;
  recentCalls: Array<any>;
  recentRoleplays: Array<any>;
}

export default function RepDetailPage() {
  const params = useParams();
  const router = useRouter();
  const repId = params.repId as string;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RepDetail | null>(null);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchRepDetail();
  }, [repId, period]);

  const fetchRepDetail = async () => {
    try {
      const response = await fetch(`/api/manager/reps/${repId}?days=${period}`);
      if (!response.ok) throw new Error('Failed to fetch rep details');
      const data = await response.json();
      setData(data);
    } catch (error) {
      console.error('Error fetching rep details:', error);
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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading rep details...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Rep not found</p>
          <Link href="/dashboard/manager/team">
            <Button variant="outline" className="mt-4">Back to Team</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <Link href="/dashboard/manager/team" className="shrink-0">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Team
            </Button>
          </Link>
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 border-2 border-primary/20 shrink-0">
            <AvatarImage src={data.rep.profilePhoto || undefined} />
            <AvatarFallback className="text-lg sm:text-xl">{getInitials(data.rep.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 truncate">{data.rep.name}</h1>
            <p className="text-sm sm:text-base text-muted-foreground truncate">{data.rep.email}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
              <Badge variant={data.performance.averageOverallScore >= 80 ? 'default' : data.performance.averageOverallScore >= 60 ? 'secondary' : 'destructive'}>
                {data.performance.averageOverallScore >= 80 ? 'Top Performer' : data.performance.averageOverallScore >= 60 ? 'Good' : 'Needs Support'}
              </Badge>
              {data.performance.trend === 'improving' && (
                <Badge variant="outline" className="text-green-500 border-green-500/50">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Improving
                </Badge>
              )}
              {data.performance.trend === 'declining' && (
                <Badge variant="outline" className="text-red-500 border-red-500/50">
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Declining
                </Badge>
              )}
            </div>
          </div>
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

      {/* Performance Overview - Enhanced */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Overall Score - Large & Prominent */}
        <Card className={`p-6 sm:p-8 border-2 ${getScoreBg(data.performance.averageOverallScore)} lg:col-span-1`}>
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">Overall Performance</p>
            <p className={`text-6xl font-bold mb-2 ${getScoreColor(data.performance.averageOverallScore)}`}>
              {data.performance.averageOverallScore}
            </p>
            <div className="flex items-center justify-center gap-2 mb-4">
              {data.performance.trend === 'improving' && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Trending Up</span>
                </>
              )}
              {data.performance.trend === 'declining' && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500">Trending Down</span>
                </>
              )}
              {data.performance.trend === 'neutral' && (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Stable</span>
                </>
              )}
            </div>
            <div className="pt-4 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Based on {data.performance.totalAnalyses} {data.performance.totalAnalyses === 1 ? 'analysis' : 'analyses'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.performance.totalCalls} calls • {data.performance.totalRoleplays} roleplays
              </p>
            </div>
          </div>
        </Card>

        {/* Pillar Scores - Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(data.performance.averageValueScore)}`}>
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Value</p>
                <p className="text-xs text-muted-foreground">Communication</p>
              </div>
            </div>
            <p className={`text-3xl sm:text-4xl font-bold ${getScoreColor(data.performance.averageValueScore)}`}>
              {data.performance.averageValueScore}
            </p>
          </Card>

          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(data.performance.averageTrustScore)}`}>
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Trust</p>
                <p className="text-xs text-muted-foreground">Building</p>
              </div>
            </div>
            <p className={`text-3xl sm:text-4xl font-bold ${getScoreColor(data.performance.averageTrustScore)}`}>
              {data.performance.averageTrustScore}
            </p>
          </Card>

          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(data.performance.averageFitScore)}`}>
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Fit</p>
                <p className="text-xs text-muted-foreground">Confirmation</p>
              </div>
            </div>
            <p className={`text-3xl sm:text-4xl font-bold ${getScoreColor(data.performance.averageFitScore)}`}>
              {data.performance.averageFitScore}
            </p>
          </Card>

          <Card className={`p-4 sm:p-6 border-2 ${getScoreBg(data.performance.averageLogisticsScore)}`}>
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Logistics</p>
                <p className="text-xs text-muted-foreground">Handling</p>
              </div>
            </div>
            <p className={`text-3xl sm:text-4xl font-bold ${getScoreColor(data.performance.averageLogisticsScore)}`}>
              {data.performance.averageLogisticsScore}
            </p>
          </Card>
        </div>
      </div>

      {/* Strengths & Weaknesses - Enhanced */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="p-6 border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-green-600">Top Strengths</h2>
          </div>
          {data.strengths.length > 0 ? (
            <div className="space-y-4">
              {data.strengths.map((strength, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-green-500/20">
                  <div className="flex-1">
                    <p className="font-medium">{strength.category}</p>
                    <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-green-500 h-full rounded-full transition-all"
                        style={{ width: `${strength.averageScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500 ml-4 text-lg px-3 py-1">
                    {strength.averageScore}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No strength data available</p>
          )}
        </Card>

        <Card className="p-6 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-lg bg-red-500/20">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-red-600">Areas for Improvement</h2>
          </div>
          {data.weaknesses.length > 0 ? (
            <div className="space-y-4">
              {data.weaknesses.map((weakness, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-red-500/20">
                  <div className="flex-1">
                    <p className="font-medium">{weakness.category}</p>
                    <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="bg-red-500 h-full rounded-full transition-all"
                        style={{ width: `${weakness.averageScore}%` }}
                      ></div>
                    </div>
                  </div>
                  <Badge variant="destructive" className="ml-4 text-lg px-3 py-1">
                    {weakness.averageScore}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No weakness data available</p>
          )}
        </Card>
      </div>

      {/* Recent Activity - Enhanced */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold">Recent Activity</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-2">
              <Phone className="h-3 w-3" />
              {data.recentCalls.length} Calls
            </Badge>
            <Badge variant="outline" className="gap-2">
              <Bot className="h-3 w-3" />
              {data.recentRoleplays.length} Roleplays
            </Badge>
          </div>
        </div>
        <div className="space-y-2 sm:space-y-3">
          {[...data.recentCalls, ...data.recentRoleplays]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 15)
            .map((item: any) => (
              <Link 
                key={item.id} 
                href={item.type === 'call' ? `/dashboard/calls/${item.callId}` : `/dashboard/roleplay/${item.sessionId}/results`}
              >
                <Card className="p-4 sm:p-5 hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className={`p-2 sm:p-3 rounded-lg shrink-0 ${
                        item.type === 'call' 
                          ? 'bg-blue-500/10 border border-blue-500/20' 
                          : 'bg-purple-500/10 border border-purple-500/20'
                      }`}>
                        {item.type === 'call' ? (
                          <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                        ) : (
                          <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold group-hover:text-primary transition-colors truncate">
                            {item.type === 'call' ? item.fileName : 'AI Roleplay Session'}
                          </p>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.type === 'call' ? 'Call' : 'Roleplay'}
                          </Badge>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-6">
                      {/* Pillar Scores - hidden on mobile */}
                      <div className="hidden md:flex items-center gap-4">
                        <div className="text-center">
                          <Target className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs font-medium">{item.valueScore || 'N/A'}</p>
                        </div>
                        <div className="text-center">
                          <Shield className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs font-medium">{item.trustScore || 'N/A'}</p>
                        </div>
                        <div className="text-center">
                          <Package className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs font-medium">{item.fitScore || 'N/A'}</p>
                        </div>
                        <div className="text-center">
                          <Truck className="h-3 w-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-xs font-medium">{item.logisticsScore || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Overall Score */}
                      <div className="text-center min-w-[60px] sm:min-w-[80px]">
                        <p className={`text-xl sm:text-2xl font-bold ${getScoreColor(item.overallScore || 0)}`}>
                          {item.overallScore || 'N/A'}
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Overall</p>
                      </div>

                      <Button variant="outline" size="sm" className="w-full sm:w-auto group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        View Details
                      </Button>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
        </div>
        {[...data.recentCalls, ...data.recentRoleplays].length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No recent activity for this period</p>
          </Card>
        )}
      </div>
    </div>
  );
}
