import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import Link from 'next/link';
import type { Metadata } from 'next';
import { seo } from '@/lib/seo';

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
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-4xl w-full text-center">
          <ThemeSwitcher className="mb-4 w-fit mx-auto" />
          <h1 className="text-5xl font-semibold font-serif mb-4">
            Welcome to ClosePro
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 mb-8">
            AI-powered sales coaching and performance analytics
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/signup">
              <Button variant="default">Get Started</Button>
            </Link>
            <Link href="/signin">
              <Button variant="outline">Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
