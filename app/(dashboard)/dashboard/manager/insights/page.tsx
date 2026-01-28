'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Lightbulb, AlertCircle, Target } from 'lucide-react';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

export default function ManagerInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [teamPerformance, setTeamPerformance] = useState<any>(null);
  const [reps, setReps] = useState<any[]>([]);
  const [categories, setCategories] = useState<any>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      const [perfRes, repsRes, catRes] = await Promise.all([
        fetch('/api/manager/team-performance?days=30'),
        fetch('/api/manager/reps?days=30'),
        fetch('/api/manager/categories?days=30'),
      ]);

      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setTeamPerformance(perfData);
      }

      if (repsRes.ok) {
        const repsData = await repsRes.json();
        setReps(repsData.reps || []);
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = () => {
    const insights: Array<{ type: 'warning' | 'success' | 'info'; title: string; message: string; action?: string }> = [];

    if (!teamPerformance || !reps || !categories) return insights;

    // Team trend insight
    if (teamPerformance.trend === 'declining') {
      insights.push({
        type: 'warning',
        title: 'Team Performance Declining',
        message: `Team average score has decreased over the last 30 days. Consider targeted coaching sessions.`,
        action: 'Review team performance',
      });
    } else if (teamPerformance.trend === 'improving') {
      insights.push({
        type: 'success',
        title: 'Team Performance Improving',
        message: `Great work! Team scores are trending upward. Keep the momentum going.`,
      });
    }

    // Weak categories insight
    if (categories?.weakCategories?.length > 0) {
      const weakCatNames = categories.weakCategories.map((c: any) => c.category).join(', ');
      insights.push({
        type: 'warning',
        title: 'Team-Wide Skill Gaps',
        message: `Multiple reps are struggling with: ${weakCatNames}. Consider a team-wide training workshop.`,
        action: 'View category analysis',
      });
    }

    // Low performers insight
    const lowPerformers = reps.filter((r: any) => r.averageOverallScore < 60);
    if (lowPerformers.length > 0) {
      insights.push({
        type: 'warning',
        title: `${lowPerformers.length} Rep${lowPerformers.length > 1 ? 's' : ''} Need Support`,
        message: `${lowPerformers.map((r: any) => r.name).join(', ')} ${lowPerformers.length > 1 ? 'are' : 'is'} scoring below 60. Schedule one-on-one coaching.`,
        action: 'View team performance',
      });
    }

    // High performers insight
    const highPerformers = reps.filter((r: any) => r.averageOverallScore >= 80);
    if (highPerformers.length > 0) {
      insights.push({
        type: 'success',
        title: `${highPerformers.length} Top Performer${highPerformers.length > 1 ? 's' : ''}`,
        message: `${highPerformers.map((r: any) => r.name).join(', ')} ${highPerformers.length > 1 ? 'are' : 'is'} excelling. Consider using ${highPerformers.length > 1 ? 'them' : 'them'} as mentors.`,
      });
    }

    // Activity insight
    const lowActivity = reps.filter((r: any) => (r.totalCalls + r.totalRoleplays) < 5);
    if (lowActivity.length > 0) {
      insights.push({
        type: 'info',
        title: 'Low Activity Reps',
        message: `${lowActivity.map((r: any) => r.name).join(', ')} ${lowActivity.length > 1 ? 'have' : 'has'} completed fewer than 5 calls/roleplays. Encourage more practice.`,
      });
    }

    return insights;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">Loading insights...</div>
      </div>
    );
  }

  const insights = generateInsights();

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/manager">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Coaching Insights</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          AI-generated recommendations for team development
        </p>
      </div>

      {/* Insights List */}
      {insights.length === 0 ? (
        <Card className="p-12">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Lightbulb className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No insights available yet</EmptyTitle>
              <EmptyDescription>Insights will appear here as your team completes calls and roleplays.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {insights.map((insight, idx) => (
            <Card
              key={idx}
              className={`p-4 sm:p-6 ${
                insight.type === 'warning'
                  ? 'border-orange-500/50 bg-orange-500/10'
                  : insight.type === 'success'
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-blue-500/50 bg-blue-500/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {insight.type === 'warning' ? (
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                ) : insight.type === 'success' ? (
                  <Target className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{insight.title}</h3>
                    <Badge
                      variant={
                        insight.type === 'warning'
                          ? 'destructive'
                          : insight.type === 'success'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {insight.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{insight.message}</p>
                  {insight.action && (
                    <Link href={insight.action === 'View team performance' ? '/dashboard/manager/team' : '/dashboard/manager/categories'}>
                      <Button variant="outline" size="sm">
                        {insight.action}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
