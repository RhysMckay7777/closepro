import type { Metadata } from 'next';
import { seo } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `ClosePro plans and pricing – AI sales coaching, call analysis, and roleplay. Starter, Pro, and Enterprise.`,
  openGraph: {
    title: `Pricing | ${seo.siteName}`,
    description: 'ClosePro plans – AI sales coaching and performance analytics.',
    url: `${seo.baseUrl}/pricing`,
  },
  alternates: { canonical: `${seo.baseUrl}/pricing` },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
