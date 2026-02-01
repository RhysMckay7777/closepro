'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { useSession } from '@/lib/auth-client';
import { useUser } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TourProvider, TourOverlay, TourStepCard, TourAutoStart } from '@/components/tour';
import { ErrorBoundary } from '@/components/error-boundary';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  performance: 'Performance',
  figures: 'Figures',
  calls: 'Calls',
  new: 'New',
  roleplay: 'AI Roleplay',
  prospect: 'Prospect Selection',
  prospects: 'Prospects',
  results: 'Results',
  offers: 'Offers',
  'prospect-avatars': 'Prospect Avatars',
  team: 'Team',
  manager: 'Manager',
  categories: 'Categories',
  insights: 'Insights',
  reps: 'Reps',
  profile: 'Profile',
  settings: 'Settings',
  billing: 'Billing',
  'create-organization': 'Create Organization',
  edit: 'Edit',
  review: 'Review',
};

function getBreadcrumbsFromPathname(pathname: string | null): Array<{ label: string; href?: string }> {
  if (!pathname || !pathname.startsWith('/dashboard')) {
    return [{ label: 'Overview', href: '/dashboard' }, { label: 'Dashboard' }];
  }
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) {
    return [{ label: 'Overview', href: '/dashboard' }, { label: 'Dashboard' }];
  }
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: 'Overview', href: '/dashboard' },
  ];
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const href = '/' + segments.slice(0, i + 1).join('/');
    const label = SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    const isLast = i === segments.length - 1;
    if (isLast) {
      crumbs.push({ label });
    } else {
      crumbs.push({ label, href });
    }
  }
  return crumbs;
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile);
  const { data: session } = useSession();
  const { user, loading: userLoading } = useUser();
  const isCreateOrgPage = pathname?.includes('/create-organization');
  const isPricingPage = pathname?.includes('/pricing');

  useEffect(() => {
    const checkOrganizations = async () => {
      if (isCreateOrgPage) return;
      try {
        const response = await fetch('/api/organizations/list');
        if (response.ok) {
          const data = await response.json();
          if (!data.organizations || data.organizations.length === 0) {
            window.location.href = '/dashboard/create-organization';
            return;
          }
        }
      } catch (error) {
        console.error('Error checking organizations:', error);
        window.location.href = '/dashboard/create-organization';
      }
    };
    if (session?.user && !userLoading) {
      checkOrganizations();
    }
  }, [session, isCreateOrgPage, pathname, userLoading]);

  const userName = user?.name || session?.user?.name || 'User';
  const userEmail = user?.email || session?.user?.email || 'user@example.com';
  const userAvatar = user?.avatar || null;
  const breadcrumbs = useMemo(() => getBreadcrumbsFromPathname(pathname ?? null), [pathname]);
  const isRoleplaySession = pathname?.includes('/roleplay/') && pathname?.match(/\/roleplay\/[^/]+$/);

  if (isCreateOrgPage || isRoleplaySession || isPricingPage) {
    return <>{children}</>;
  }

  return (
    <TourProvider>
      <TourAutoStart />
      <div className="flex h-screen overflow-hidden bg-background relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />
        <div className="hidden lg:block">
          <Sidebar
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            lastLogin="Today"
            collapsed={sidebarCollapsed}
          />
        </div>
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}
        <div className={cn(
          "fixed left-0 top-0 h-full z-50 lg:hidden transition-transform duration-300",
          sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
        )}>
          <Sidebar
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            lastLogin="Today"
            collapsed={false}
          />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0">
          <Header
            breadcrumbs={breadcrumbs}
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            notificationCount={2}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
        <TourOverlay />
        <TourStepCard />
      </div>
    </TourProvider>
  );
}
