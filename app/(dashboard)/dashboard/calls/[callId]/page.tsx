'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, FileAudio, Clock } from 'lucide-react';
import Link from 'next/link';

export default function CallDetailPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params?.callId as string;
  const [call, setCall] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callId) return;

    const fetchCall = async () => {
      try {
        const response = await fetch(`/api/calls/${callId}/status`);
        if (!response.ok) {
          throw new Error('Failed to fetch call');
        }

        const data = await response.json();
        setCall(data.call);
        setAnalysis(data.analysis);

        // If still processing, poll for updates
        if (data.status !== 'completed' && data.status !== 'failed') {
          const interval = setInterval(async () => {
            const statusResponse = await fetch(`/api/calls/${callId}/status`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              setCall(statusData.call);
              setAnalysis(statusData.analysis);

              if (statusData.status === 'completed' || statusData.status === 'failed') {
                clearInterval(interval);
              }
            }
          }, 5000); // Poll every 5 seconds

          return () => clearInterval(interval);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load call');
      } finally {
        setLoading(false);
      }
    };

    fetchCall();
  }, [callId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Completed</Badge>;
      case 'processing':
      case 'transcribing':
      case 'analyzing':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading call...</p>
        </div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || 'Call not found'}</AlertDescription>
        </Alert>
        <Link href="/dashboard/calls">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Calls
          </Button>
        </Link>
      </div>
    );
  }

  const isProcessing = call.status === 'processing' || call.status === 'transcribing' || call.status === 'analyzing';

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/calls">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Calls
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight">
              Call Analysis
            </h1>
            {getStatusBadge(call.status)}
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            {call.fileName}
          </p>
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 backdrop-blur-xl shadow-xl">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div>
                <p className="font-medium text-lg">Processing call...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {call.status === 'transcribing' && 'Transcribing audio...'}
                  {call.status === 'analyzing' && 'Analyzing call with AI...'}
                  {call.status === 'processing' && 'Processing your call...'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  This may take a few minutes. The page will update automatically when complete.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completed State - Show Analysis */}
      {call.status === 'completed' && analysis && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <CardTitle className="font-serif">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-6xl font-bold bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                  {analysis.overallScore}
                </div>
                <p className="text-muted-foreground mt-2">out of 100</p>
              </div>
            </CardContent>
          </Card>

          {/* 4 Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['value', 'trust', 'fit', 'logistics'].map((pillar) => {
              const pillarData = analysis[`${pillar}Details`] 
                ? JSON.parse(analysis[`${pillar}Details`])
                : { score: 0 };
              const score = analysis[`${pillar}Score`] || pillarData.score || 0;

              return (
                <Card key={pillar} className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-serif capitalize">{pillar}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{score}</div>
                    <p className="text-xs text-muted-foreground mt-1">out of 100</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Coaching Recommendations */}
          {analysis.coachingRecommendations && (
            <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
              <CardHeader>
                <CardTitle className="font-serif">Coaching Recommendations</CardTitle>
                <CardDescription>
                  AI-generated insights to improve your sales performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {JSON.parse(analysis.coachingRecommendations).map((rec: any, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        rec.priority === 'high' 
                          ? 'border-destructive/30 bg-destructive/5' 
                          : rec.priority === 'medium'
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                              {rec.priority}
                            </Badge>
                            <span className="text-sm font-medium">{rec.category}</span>
                          </div>
                          <p className="font-semibold mb-1">{rec.issue}</p>
                          <p className="text-sm text-muted-foreground mb-2">{rec.explanation}</p>
                          <p className="text-sm font-medium text-primary">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Failed State */}
      {call.status === 'failed' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Call processing failed. Please try uploading again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
