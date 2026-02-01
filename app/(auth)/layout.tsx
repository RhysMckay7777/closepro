import type { Metadata } from 'next';
import { seo } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Account',
  description: `Sign in or sign up to ${seo.siteName} – AI sales coaching and performance analytics.`,
  robots: { index: false, follow: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
