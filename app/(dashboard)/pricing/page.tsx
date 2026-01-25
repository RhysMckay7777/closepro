'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react';
import { PLANS, PlanTier } from '@/lib/plans';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSelectPlan = async (tier: PlanTier) => {
    setIsLoading(tier);

    try {
      // Redirect to checkout API route which will handle Whop redirect
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: tier }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        console.error('No checkout URL returned');
        setIsLoading(null);
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-8 mt-20">
      <Link href="/dashboard" className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go to Dashboard
          </Button>
        </Link>
      {/* Header */}
      <div className="text-center space-y-3 sm:space-y-4">
        <Badge className="backdrop-blur-sm bg-primary/10 text-primary border-primary/20">
          Pricing Plans
        </Badge>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight px-4">
          Choose the right plan for your team
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
          Scale your sales performance with AI-powered coaching and analytics
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto px-4">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isPro = key === 'pro';
          const isEnterprise = key === 'enterprise';

          return (
            <Card
              key={key}
              className={`relative border backdrop-blur-xl shadow-xl transition-all hover:scale-[1.02] ${isPro
                  ? 'border-primary bg-linear-to-br from-primary/10 to-primary/5 shadow-primary/20'
                  : 'border-white/10 bg-linear-to-br from-card/80 to-card/40'
                }`}
            >
              {isPro && (
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
                  {isEnterprise ? (
                    <span className="text-4xl font-bold">Custom</span>
                  ) : (
                    <>
                      <span className="text-5xl font-bold tracking-tight">
                        ${plan.price}
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                <CardDescription className="mt-2">
                  {key === 'starter' && 'Perfect for small teams getting started'}
                  {key === 'pro' && 'Best for growing sales teams'}
                  {key === 'enterprise' && 'Custom solutions for large organizations'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Key Features */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span>
                      <strong>{plan.maxSeats === 999 ? 'Unlimited' : plan.maxSeats}</strong> seats
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

                  {plan.roleplaySessionsPerMonth > 0 && (
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
                  )}
                </div>

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
                  variant={isPro ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(key as PlanTier)}
                  disabled={isLoading !== null}
                >
                  {isLoading === key ? (
                    'Loading...'
                  ) : (
                    <>
                      {isEnterprise ? 'Contact Sales' : 'Get Started'}
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
