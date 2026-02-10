import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import { CircleCheck } from 'lucide-react';
import { LandingHeader } from '@/components/landing/header';
import { LandingFooter } from '@/components/landing/footer';

export const metadata: Metadata = {
  title: seo.defaultTitle,
  description: seo.defaultDescription,
  keywords: seo.defaultKeywords,
  openGraph: {
    title: seo.defaultTitle,
    description: seo.defaultDescription,
    url: seo.baseUrl,
    siteName: seo.siteName,
  },
  alternates: { canonical: seo.baseUrl },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: seo.siteName,
  description: seo.defaultDescription,
  url: seo.baseUrl,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'AI call analysis',
    'Sales performance analytics',
    'AI roleplay practice',
    'Figures and close rate tracking',
    'Team and manager dashboards',
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingHeader />
      <main className="relative min-h-screen w-full overflow-hidden scroll-smooth pt-14">
        {/* Hero */}
        <section className="relative w-full overflow-hidden bg-white py-12 md:py-20 lg:py-24 dark:bg-black/3">
          <div className="container relative mx-auto px-4 md:px-6">
            <div className="flex flex-col items-center justify-center gap-6 text-center">
              <div className="flex max-w-3xl flex-col items-center justify-center space-y-4">
                <div className="flex w-fit items-center justify-center">
                  <div className="flex items-center gap-3">
                    <div className="h-px w-16 bg-linear-to-r from-transparent to-black/10 dark:to-white/10" />
                    <div className="group flex items-center gap-2 rounded-lg border border-black/5 bg-black/2 px-3 py-1.5 transition-all duration-200 hover:border-black/10 hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/8">
                      <span className="text-xs font-medium text-black/60 transition-colors group-hover:text-black/80 dark:text-white/60 dark:group-hover:text-white/80">
                        {seo.tagline}
                      </span>
                    </div>
                    <div className="h-px w-16 bg-linear-to-l from-transparent to-black/10 dark:to-white/10" />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <h1
                    className="text-balance text-3xl font-medium tracking-tighter text-neutral-900 sm:text-4xl md:text-7xl dark:text-neutral-50"
                    style={{ textWrap: 'balance' }}
                  >
                    Close more deals.
                    <br />
                    <span className="text-neutral-500 dark:text-neutral-400">Coach reps with AI.</span>
                  </h1>
                  <p className="mx-auto max-w-[600px] text-sm leading-relaxed text-neutral-500 md:text-base dark:text-neutral-400">
                    {seo.defaultDescription}
                  </p>
                </div>
                <div className="flex min-[400px]:flex-row flex-col gap-2 pt-2">
                  <Link
                    href="/signup"
                    className="inline-flex h-9 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#e2ae47] px-3 text-sm font-medium text-neutral-900 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-[#ecbf64]/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:bg-[#ecbf64] dark:text-neutral-900 dark:hover:bg-[#ecbf64]/80"
                  >
                    Get Started
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-9 w-fit items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-dashed border-[#d09e38] bg-[#ecbf64]/10 px-3 text-sm font-medium text-neutral-900 shadow-xs transition-all duration-200 hover:scale-[1.02] hover:border-[#d09e38] hover:bg-[#ecbf64]/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-50 dark:hover:border-[#d09e38] dark:hover:bg-[#ecbf64]/20"
                  >
                    Continue to your dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>


          {/* Hero image */}
          <div className="container mx-auto mt-20 px-4 pt-6 md:px-6">
            <div className="group relative mx-auto aspect-video max-w-5xl overflow-hidden rounded-2xl border border-black/5 bg-black/10 p-2 shadow-2xl ring-1 ring-black/5 transition-all duration-500 hover:border-orange-400/40 hover:shadow-lg hover:shadow-orange-500/20 hover:ring-orange-500/30 dark:border-white/10 dark:bg-white/3 dark:ring-white/5 dark:hover:border-orange-400/40 dark:hover:ring-orange-500/30">
              <div className="relative h-full w-full overflow-hidden rounded-xl">
                <Image
                  src="/hero.png"
                  alt="ClosePro – AI call analysis and sales coaching dashboard"
                  fill
                  className="orange-hover-effect object-cover object-top"
                  sizes="100vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-linear-to-t from-orange-600/30 via-orange-500/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              </div>
            </div>
          </div>

          <div className="container relative mx-auto mt-12 px-4 md:mt-16 md:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="h-px w-16 bg-linear-to-r from-transparent to-black/10 dark:to-white/10" />
                <a
                  href="#features"
                  className="group flex cursor-pointer items-center gap-2 rounded-lg border border-black/5 bg-black/2 px-3 py-1.5 transition-all duration-200 hover:scale-105 hover:border-black/10 hover:bg-black/5 hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/8"
                >
                  <span className="text-xs font-medium text-black/60 transition-colors group-hover:text-black/80 dark:text-white/60 dark:group-hover:text-white/80">
                    See how it works
                  </span>
                </a>
                <div className="h-px w-16 bg-linear-to-l from-transparent to-black/10 dark:to-white/10" />
              </div>
            </div>
          </div>
        </section>

        {/* Features / How it works - compact */}
        <section className="w-full overflow-hidden bg-white pt-12 pb-8 md:pt-16 md:pb-10 lg:pt-20 lg:pb-12 dark:bg-black/3" id="features">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-10 space-y-3 text-center">
              <div className="mx-auto flex w-fit items-center justify-center">
                <div className="flex items-center gap-3">
                  <div className="h-px w-12 bg-linear-to-r from-transparent to-black/10 dark:to-white/10" />
                  <div className="flex items-center gap-2 rounded-lg border border-black/5 bg-black/2 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <span className="text-xs font-medium text-black/60 dark:text-white/60">How it works</span>
                  </div>
                  <div className="h-px w-12 bg-linear-to-l from-transparent to-black/10 dark:to-white/10" />
                </div>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
                Coach reps in minutes
              </h2>
              <p className="mx-auto max-w-[500px] text-sm text-neutral-500 dark:text-neutral-400">
                Three simple steps to better sales performance
              </p>
            </div>
            <div className="mx-auto max-w-4xl">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {[
                  { num: '01', title: 'Upload & analyze', desc: 'Upload sales calls or paste transcripts. Get AI-powered analysis, talking points, and coaching feedback in minutes.', checks: ['Call transcription', 'AI insights & next steps', 'Secure, private storage'], image: "/upload.png" },
                  { num: '02', title: 'Practice with AI roleplay', desc: 'Run roleplay with AI prospects tuned to your offers. Practice objection handling and close more in the field.', checks: ['Custom prospect avatars', 'Real-time scoring', 'Replay and improve'], image: "/roleplay.png" },
                  { num: '03', title: 'Track & improve', desc: 'See figures, close rate, and team performance in one place. Manager dashboards and rep-level analytics.', checks: ['Figures & close rate', 'Team and manager views', 'Performance trends'], image: "/analytics.png" },
                ].map((step) => (
                  <div
                    key={step.num}
                    className="group relative rounded-2xl border border-dashed border-black/5 p-2 transition-all hover:border-[#d09e38]/30 dark:border-white/10"
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-black/5 bg-black/3 dark:border-white/10 dark:bg-white/10">
                      <div className="diagonal-stripes relative aspect-4/3 overflow-hidden border-b border-black/5 p-2 dark:border-white/10">
                        <div className="relative h-full w-full overflow-hidden rounded-lg">
                          <Image
                            src={step.image}
                            alt={step.title}
                            fill
                            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105 group-hover:brightness-110"
                            unoptimized
                          />
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <span className="font-mono text-[10px] tracking-tighter text-black/40 dark:text-white/40">{step.num}</span>
                        <h3 className="mb-1.5 text-base font-semibold tracking-tighter text-black/80 dark:text-white/80">{step.title}</h3>
                        <p className="mb-3 text-[11px] leading-relaxed tracking-tighter text-black/60 dark:text-white/60">{step.desc}</p>
                        <div className="mt-auto space-y-1.5">
                          {step.checks.map((c) => (
                            <div key={c} className="flex items-center gap-1.5 opacity-70" style={{ transform: 'translateX(-2px)' }}>
                              <CircleCheck className="h-2.5 w-2.5 shrink-0 text-[#e2ae47]" aria-hidden />
                              <span className="text-[10px] tracking-tighter text-black/60 dark:text-white/60">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto mt-10 text-center">
              <Link
                href="#pricing"
                className="group inline-flex items-center gap-2 rounded-lg border border-dashed border-[#d09e38] bg-[#ecbf64]/10 px-4 py-2 transition-all hover:scale-[1.02] hover:bg-[#ecbf64]/20"
              >
                <span className="text-sm font-medium tracking-tighter text-black/80 dark:text-white/80">See pricing</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="w-full overflow-hidden bg-white pt-12 pb-12 md:pt-16 md:pb-16 lg:pt-20 lg:pb-20 dark:bg-black/3" id="pricing">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 space-y-3 text-center">
              <div className="mx-auto flex w-fit items-center justify-center">
                <div className="flex items-center gap-3">
                  <div className="h-px w-12 bg-linear-to-r from-transparent to-black/10 dark:to-white/10" />
                  <div className="flex items-center gap-2 rounded-lg border border-black/5 bg-black/2 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <span className="text-xs font-medium text-black/60 dark:text-white/60">Plans</span>
                  </div>
                  <div className="h-px w-12 bg-linear-to-l from-transparent to-black/10 dark:to-white/10" />
                </div>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
                Plans that scale with your team
              </h2>
              <p className="mx-auto max-w-[500px] text-sm text-neutral-500 dark:text-neutral-400">
                Start free. Upgrade when you&apos;re ready. All plans include a trial.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                { name: 'Starter', desc: 'For individual reps getting started with AI coaching', price: 'Free', cta: 'Get Started', popular: false, features: ['Call analysis & transcription', 'AI insights & next steps', 'Basic roleplay practice', 'Your figures & close rate'] },
                { name: 'Pro', desc: 'For teams that want to coach and scale performance', price: 'Custom', cta: 'Contact Sales', popular: true, features: ['Unlimited call analysis', 'AI roleplay & prospect avatars', 'Team & manager dashboards', 'Priority support'] },
                { name: 'Enterprise', desc: 'For orgs that need full control and security', price: 'Custom', cta: 'Contact Sales', popular: false, features: ['Everything in Pro', 'SSO & advanced security', 'Dedicated success manager', 'Custom integrations'] },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`group rounded-2xl border border-dashed p-2 transition-all hover:border-neutral-300 dark:bg-white/3 ${plan.popular ? 'border-[#d09e38]/50 bg-[#ecbf64]/5 dark:border-[#d09e38]/30 dark:bg-[#ecbf64]/5' : 'border-black/5 bg-black/10 dark:border-white/10 dark:bg-white/3'
                    }`}
                >
                  <div className="flex h-full flex-col rounded-xl border border-black/5 bg-black/3 p-5 dark:border-white/10 dark:bg-white/10">
                    {plan.popular && (
                      <span className="mb-2 inline-block rounded-full border border-dashed border-[#d09e38] bg-[#ecbf64]/10 px-2.5 py-0.5 text-xs font-medium text-neutral-900 dark:text-neutral-50">
                        Most Popular
                      </span>
                    )}
                    <div className="mb-4">
                      <h3 className="mb-1.5 text-xl font-semibold tracking-tighter text-black/80 dark:text-white/80">{plan.name}</h3>
                      <p className="text-xs tracking-tighter text-black/60 dark:text-white/60">{plan.desc}</p>
                    </div>
                    <div className="mb-4 flex items-end gap-1">
                      <span className="text-4xl font-semibold tracking-tighter text-black/80 dark:text-white/80">{plan.price}</span>
                      {plan.price !== 'Free' && <span className="mb-1 text-xs tracking-tighter text-black/60 dark:text-white/60">/month</span>}
                    </div>
                    <Link
                      href={plan.cta === 'Contact Sales' ? '#' : '/signin'}
                      className={`inline-flex h-9 w-full items-center justify-center rounded-lg border px-4 py-2 text-xs font-medium tracking-tighter transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${plan.popular
                        ? 'mb-4 border-[#d09e38] border-dashed bg-[#ecbf64]/20 text-neutral-900 hover:bg-[#ecbf64]/30 dark:bg-[#ecbf64]/20 dark:text-neutral-50 dark:hover:bg-[#ecbf64]/30'
                        : 'mb-4 border-dashed border-black/5 bg-black/5 text-black/80 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10'
                        }`}
                    >
                      {plan.cta}
                    </Link>
                    <div className="flex-1 space-y-2">
                      <p className="mb-3 text-xs font-medium tracking-tighter text-black/80 dark:text-white/80">What&apos;s included:</p>
                      {plan.features.map((f) => (
                        <div key={f} className="flex items-start gap-2">
                          <div className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2 text-black/70 dark:text-white/70" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
                          </div>
                          <span className="text-xs leading-tight tracking-tighter text-black/60 dark:text-white/60">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mx-auto mt-12 max-w-2xl text-center text-xs tracking-tighter text-black/60 dark:text-white/60">
              Start with a free trial. No credit card required. Cancel anytime.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full overflow-hidden bg-white pt-12 pb-24 md:pt-16 md:pb-32 lg:pt-20 lg:pb-40 dark:bg-black/3" id="faq">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-12 space-y-3 text-center">
              <div className="mx-auto flex w-fit items-center justify-center">
                <div className="flex items-center gap-3">
                  <div className="h-px w-12 bg-linear-to-r from-transparent to-black/10 dark:to-white/10" />
                  <div className="flex items-center gap-2 rounded-lg border border-black/5 bg-black/2 px-3 py-1.5 dark:border-white/10 dark:bg-white/5">
                    <span className="text-xs font-medium text-black/60 dark:text-white/60">FAQ</span>
                  </div>
                  <div className="h-px w-12 bg-linear-to-l from-transparent to-black/10 dark:to-white/10" />
                </div>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
                Frequently asked questions
              </h2>
            </div>
            <div className="mx-auto max-w-4xl space-y-3">
              {[
                { id: '001', q: 'How does ClosePro analyze my calls?', a: 'We transcribe your sales calls (upload audio or paste a transcript), then our AI analyzes them for clarity, objection handling, next steps, and coaching tips. You get actionable feedback and talking points so you can improve every conversation.' },
                { id: '002', q: 'What is AI roleplay and how does it work?', a: 'You pick an offer and we generate AI prospects (easy, realistic, hard, expert). You practice your pitch and objection handling in real time. ClosePro scores your performance and lets you replay and improve before your next real call.' },
                { id: '003', q: 'Is my call data secure and private?', a: 'Yes. Call audio and transcripts are processed securely and stored in your workspace. We don’t train general-purpose models on your data. You can delete recordings and transcripts at any time.' },
              ].map((faq) => (
                <div key={faq.id} className="rounded-2xl border border-dashed border-black/5 p-2 transition-all hover:border-neutral-300 dark:border-white/10 dark:bg-white/3">
                  <div className="overflow-hidden rounded-xl border border-black/5 bg-black/3 dark:border-white/10 dark:bg-white/10">
                    <div className="flex w-full items-center justify-between gap-4 p-5 text-left">
                      <div className="flex flex-1 items-start gap-3">
                        <span className="mt-0.5 font-mono text-xs tracking-tighter text-black/40 dark:text-white/40">{faq.id}</span>
                        <h3 className="flex-1 text-sm font-medium tracking-tighter text-black/80 sm:text-base dark:text-white/80">
                          {faq.q}
                        </h3>
                      </div>
                    </div>
                    <div className="border-t border-black/5 px-5 pt-3 pb-5 dark:border-white/10">
                      <p className="pl-8 text-sm leading-relaxed tracking-tighter text-black/60 dark:text-white/60">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="container mx-auto px-4 pb-8 pt-4 md:px-6">
          <LandingFooter />
        </footer>
      </main>
    </>
  );
}
