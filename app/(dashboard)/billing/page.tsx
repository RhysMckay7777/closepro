'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Calendar,
  Users,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';

interface SubscriptionData {
  subscription: {
    id: string;
    planTier: string;
    status: string;
    seats: number;
    callsPerMonth: number;
    roleplaySessionsPerMonth: number;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    callsUsed: number;
    roleplaySessionsUsed: number;
    month: string;
  };
  organization: {
    name: string;
    maxSeats: number;
    currentSeats: number;
  };
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const response = await fetch('/api/dashboard/billing');
      if (!response.ok) throw new Error('Failed to fetch billing data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load billing information');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'Failed to load billing data'}</AlertDescription>
      </Alert>
    );
  }

  const { subscription, usage, organization } = data;

  const callsPercentage = subscription
    ? subscription.callsPerMonth === -1
      ? 0
      : (usage.callsUsed / subscription.callsPerMonth) * 100
    : 0;

  const roleplayPercentage = subscription
    ? subscription.roleplaySessionsPerMonth === -1
      ? 0
      : subscription.roleplaySessionsPerMonth === 0
        ? 0
        : (usage.roleplaySessionsUsed / subscription.roleplaySessionsPerMonth) * 100
    : 0;

  const seatsPercentage = subscription
    ? (organization.currentSeats / subscription.seats) * 100
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your subscription and usage</p>
        </div>
        {subscription && (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/pricing">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Change Plan
            </Link>
          </Button>
        )}
      </div>

      {/* Status Alerts */}
      {!subscription && (
        <Alert className="border-primary/50 bg-primary/10">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            No active subscription.{' '}
            <Link href="/pricing" className="underline font-medium hover:text-primary transition-colors">
              View plans
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {subscription?.cancelAtPeriodEnd && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Subscription cancels on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card - Compact */}
      {subscription && (
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-xl sm:text-2xl font-serif font-semibold capitalize">
                      {subscription.planTier}
                    </CardTitle>
                    <Badge
                      variant={
                        subscription.status === 'active'
                          ? 'default'
                          : subscription.status === 'trialing'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className="text-xs"
                    >
                      {subscription.status === 'active' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {subscription.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open('https://whop.com/portal', '_blank')}
                className="text-xs"
              >
                Manage via Whop
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Usage Stats - Compact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm font-serif font-semibold">Calls</span>
                </div>
                <span className="text-xs font-medium">
                  {subscription?.callsPerMonth === -1
                    ? '∞'
                    : `${Math.round(callsPercentage)}%`}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {usage.callsUsed} / {subscription?.callsPerMonth === -1 ? '∞' : subscription?.callsPerMonth || 0}
                  </span>
                </div>
                <Progress value={callsPercentage} className="h-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-serif font-semibold">Roleplay</span>
                </div>
                <span className="text-xs font-medium">
                  {subscription?.roleplaySessionsPerMonth === -1
                    ? '∞'
                    : subscription?.roleplaySessionsPerMonth === 0
                      ? 'N/A'
                      : `${Math.round(roleplayPercentage)}%`}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {usage.roleplaySessionsUsed} / {subscription?.roleplaySessionsPerMonth === -1 ? '∞' : subscription?.roleplaySessionsPerMonth || 0}
                  </span>
                </div>
                <Progress value={roleplayPercentage} className="h-1.5" />
              </div>
              {subscription?.roleplaySessionsPerMonth === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Upgrade for AI Roleplay</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardContent className="pt-4 pb-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-serif font-semibold">Seats</span>
                </div>
                <span className="text-xs font-medium">{Math.round(seatsPercentage)}%</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {organization.currentSeats} / {subscription?.seats || 0}
                  </span>
                </div>
                <Progress value={seatsPercentage} className="h-1.5" />
              </div>
              <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" asChild>
                <Link href="/dashboard/team">Manage Team</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Compact */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-between h-9 text-sm" asChild>
            <Link href="/pricing">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" />
                Upgrade Plan
              </span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between h-9 text-sm"
            onClick={() => window.open('https://whop.com/portal', '_blank')}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Method
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between h-9 text-sm"
            onClick={() => window.open('https://whop.com/portal', '_blank')}
          >
            <span className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Billing History
            </span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
