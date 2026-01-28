'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Clock, TrendingUp, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty';

interface RoleplaySession {
  id: string;
  mode: string;
  status: string;
  inputMode: string;
  selectedDifficulty: string | null;
  actualDifficultyTier: string | null;
  overallScore: number | null;
  offerName: string;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export default function RoleplayPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<RoleplaySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/roleplay');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-500">In Progress</Badge>;
      case 'abandoned':
        return <Badge variant="secondary">Abandoned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-500';
      case 'realistic':
        return 'text-blue-500';
      case 'hard':
        return 'text-orange-500';
      case 'elite':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">AI Roleplay</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Practice sales calls with AI prospects
          </p>
        </div>
        <Link href="/dashboard/roleplay/new" className="w-full sm:w-auto">
          <Button size="lg" className="gap-2 w-full sm:w-auto">
            <Plus className="h-5 w-5" />
            Start New Roleplay
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold">{sessions.length}</p>
            </div>
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.status === 'in_progress').length}
              </p>
            </div>
            <Play className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.status === 'completed').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Score</p>
              <p className="text-2xl font-bold">
                {sessions.filter(s => s.overallScore !== null).length > 0
                  ? Math.round(
                      sessions
                        .filter(s => s.overallScore !== null)
                        .reduce((sum, s) => sum + (s.overallScore || 0), 0) /
                        sessions.filter(s => s.overallScore !== null).length
                    )
                  : 'N/A'}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Sessions List */}
      <Card className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare className="size-6" />
              </EmptyMedia>
              <EmptyTitle>No roleplay sessions yet</EmptyTitle>
              <EmptyDescription>Start your first AI roleplay to practice and get scored.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link href="/dashboard/roleplay/new">
                <Button>Start Your First Roleplay</Button>
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => {
                  if (session.status === 'completed' && session.overallScore !== null) {
                    router.push(`/dashboard/roleplay/${session.id}/results`);
                  } else {
                    router.push(`/dashboard/roleplay/${session.id}`);
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{session.offerName}</h3>
                    {getStatusBadge(session.status)}
                    {session.actualDifficultyTier && (
                      <span className={`text-sm font-medium ${getDifficultyColor(session.actualDifficultyTier)}`}>
                        {session.actualDifficultyTier.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{formatDate(session.startedAt)}</span>
                    {session.overallScore !== null && (
                      <span className="font-medium text-foreground">
                        Score: {session.overallScore}/100
                      </span>
                    )}
                    <span className="capitalize">{session.inputMode}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  {session.status === 'in_progress' 
                    ? 'Continue' 
                    : session.overallScore !== null 
                    ? 'View Results' 
                    : 'View'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
