import type { Metadata } from 'next';
import { seo } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Sign up',
  description: `Create your ${seo.siteName} account – AI sales coaching and performance analytics.`,
  openGraph: { title: `Sign up | ${seo.siteName}`, url: `${seo.baseUrl}/signup` },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
