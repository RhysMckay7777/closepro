import type { Metadata } from 'next';
import { seo } from '@/lib/seo';
import DashboardShell from './dashboard-shell';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'ClosePro dashboard – performance, figures, calls, AI roleplay, and team.',
  robots: { index: false, follow: true },
  openGraph: {
    title: `Dashboard | ${seo.siteName}`,
    description: 'ClosePro dashboard – performance, figures, calls, AI roleplay.',
    url: `${seo.baseUrl}/dashboard`,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
