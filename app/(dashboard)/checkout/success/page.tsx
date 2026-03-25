'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Give a moment to show the success animation
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border backdrop-blur-xl shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            {isLoading ? (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in duration-300">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-serif">
            {isLoading ? 'Processing...' : 'Welcome to ProCloser!'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {!isLoading && (
            <>
              <p className="text-muted-foreground">
                Your subscription is now active. You&apos;re all set to start
                coaching your sales team with AI-powered insights.
              </p>
              <div className="space-y-3">
                <Link href="/dashboard" className="block">
                  <Button className="w-full" size="lg">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard/billing" className="block">
                  <Button variant="ghost" className="w-full" size="sm">
                    View Billing Details
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
