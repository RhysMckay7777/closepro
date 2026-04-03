'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowRight, Sparkles, ArrowLeft, Tag, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PLANS, ActivePlanTier } from '@/lib/plans';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import Link from 'next/link';

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const router = useRouter();
  const { data: session } = useSession();

  const handleSelectPlan = async (tier: ActivePlanTier) => {
    setIsLoading(tier);
    try {
      // Use guest checkout for unauthenticated users, regular checkout for authenticated
      const endpoint = session?.user ? '/api/checkout' : '/api/checkout/guest';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          ...(couponCode.trim() && { couponCode: couponCode.trim() }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Invalid coupon code') {
          setCouponError('Invalid coupon code');
        }
        setIsLoading(null);
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('No checkout URL returned');
        setIsLoading(null);
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      setIsLoading(null);
      setCouponError(null);
    }
  };

  const planEntries: { key: ActivePlanTier; plan: typeof PLANS.rep }[] = [
    { key: 'rep', plan: PLANS.rep },
    { key: 'manager', plan: PLANS.manager },
    { key: 'enterprise', plan: PLANS.enterprise },
  ];

  return (
    <div className="space-y-8 mt-20">
      <Link href={session?.user ? '/dashboard' : '/'} className="absolute top-4 left-4">
        <Button variant="ghost" size="sm" className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {session?.user ? 'Go to Dashboard' : 'Back to Home'}
        </Button>
      </Link>

      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-4">
        <Badge className="backdrop-blur-sm bg-primary/10 text-primary border-primary/20">
          Pricing Plans
        </Badge>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight px-4">
          Choose the right plan for you
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
          AI-powered sales coaching and analytics for individual closers and teams
        </p>
      </div>

      {/* Coupon Code — always visible, prominent */}
      <div className="max-w-md mx-auto px-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Have a coupon code?
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponError(null);
              }}
              className="uppercase"
            />
          </div>
          {couponError && (
            <p className="text-sm text-destructive">{couponError}</p>
          )}
          {couponCode.trim() && !couponError && (
            <p className="text-sm text-primary">Coupon will be applied at checkout</p>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto px-4">
        {planEntries.map(({ key, plan }) => {
          const isManager = key === 'manager';
          const isEnterprise = key === 'enterprise';

          return (
            <Card
              key={key}
              className={`relative border backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02] ${isManager
                  ? 'border-primary bg-linear-to-br from-primary/10 to-primary/5 shadow-primary/20'
                  : 'border-white/10 bg-linear-to-br from-card/80 to-card/40'
                }`}
            >
              {isManager && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-linear-to-r from-primary to-primary/80 text-primary-foreground border-0 shadow-lg shadow-primary/50 gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-8 pt-6">
                <CardTitle className="text-2xl font-serif">{plan.name}</CardTitle>
                <div className="mt-4 flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold tracking-tight">
                    £{plan.price}
                  </span>
                  <span className="text-muted-foreground">
                    {isEnterprise ? '/one-time' : '/month'}
                  </span>
                </div>
                {isManager && (
                  <p className="text-sm text-primary mt-2 font-medium">
                    +£{plan.additionalSeatPrice}/month per additional seat
                  </p>
                )}
                <CardDescription className="mt-2">
                  {key === 'rep' && 'For individual closers'}
                  {key === 'manager' && 'For team leads managing reps'}
                  {key === 'enterprise' && '3 months at Rep Level + Free Sales Training'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Key Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <span>
                      <strong>{plan.includedSeats === 999 ? 'Unlimited' : plan.includedSeats}</strong>{' '}
                      {plan.includedSeats === 1 ? 'seat' : 'seats'} included
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span>
                      <strong>
                        {plan.callsPerMonth === -1 ? 'Unlimited' : plan.callsPerMonth}
                      </strong>{' '}
                      calls/month
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span>
                      <strong>
                        {plan.roleplaySessionsPerMonth === -1
                          ? 'Unlimited'
                          : plan.roleplaySessionsPerMonth}
                      </strong>{' '}
                      roleplay sessions/month
                    </span>
                  </div>
                </div>

                {isEnterprise && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-primary font-medium">
                    Includes Free Multi Hour Sales Training Program
                  </div>
                )}

                <div className="h-px bg-border" />

                {/* Feature List */}
                <div className="space-y-3">
                  <FeatureItem
                    included={plan.features.aiAnalysis}
                    text="AI Call Analysis"
                  />
                  <FeatureItem
                    included={plan.features.managerDashboard}
                    text="Manager Dashboard"
                  />
                  <FeatureItem
                    included={plan.features.aiRoleplay}
                    text="AI Roleplay Engine"
                  />
                  <FeatureItem
                    included={plan.features.prioritySupport}
                    text="Priority Support"
                  />
                  <FeatureItem
                    included={plan.features.customIntegrations}
                    text="Custom Integrations"
                  />
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  size="lg"
                  variant={isManager ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(key)}
                  disabled={isLoading !== null}
                >
                  {isLoading === key ? (
                    'Loading...'
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="text-center text-sm text-muted-foreground max-w-2xl mx-auto pt-8">
        <p>
          All plans include a 14-day free trial. No credit card required.
          Cancel anytime.
        </p>
      </div>
    </div>
  );
}

function FeatureItem({ included, text }: { included: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {included ? (
        <Check className="h-4 w-4 text-primary shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className={included ? '' : 'text-muted-foreground'}>{text}</span>
    </div>
  );
}
