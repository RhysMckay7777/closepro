import type { Metadata } from 'next';
import { seo } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Sign in',
  description: `Sign in to ${seo.siteName} – AI sales coaching and performance analytics.`,
  openGraph: { title: `Sign in | ${seo.siteName}`, url: `${seo.baseUrl}/signin` },
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
