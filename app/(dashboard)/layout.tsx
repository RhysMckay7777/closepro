'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { useSession } from '@/lib/auth-client';
import { useUser } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { TourProvider, TourOverlay, TourStepCard, TourAutoStart } from '@/components/tour';
import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({
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
    // Check if user has organizations - REQUIRED before accessing dashboard
    const checkOrganizations = async () => {
      // Skip check on create-organization page itself
      if (isCreateOrgPage) return;

      try {
        const response = await fetch('/api/organizations/list');
        if (response.ok) {
          const data = await response.json();
          // Force redirect to create-organization if user has no organizations
          // This ensures everyone must be in an organization to use the dashboard
          if (!data.organizations || data.organizations.length === 0) {
            window.location.href = '/dashboard/create-organization';
            return;
          }
        }
      } catch (error) {
        console.error('Error checking organizations:', error);
        // On error, still redirect to create-organization to be safe
        window.location.href = '/dashboard/create-organization';
      }
    };

    if (session?.user && !userLoading) {
      checkOrganizations();
    }
  }, [session, isCreateOrgPage, pathname, userLoading]);

  // Use cached user data, fallback to session data
  const userName = user?.name || session?.user?.name || 'User';
  const userEmail = user?.email || session?.user?.email || 'user@example.com';
  const userAvatar = user?.avatar || null;

  // Check if we're in a roleplay session (arena mode)
  const isRoleplaySession = pathname?.includes('/roleplay/') && pathname?.match(/\/roleplay\/[^/]+$/);

  // Don't show sidebar/header on create-organization page or roleplay sessions
  if (isCreateOrgPage || isRoleplaySession || isPricingPage) {
    return <>{children}</>;
  }

  return (
    <TourProvider>
      <TourAutoStart />
      <div className="flex h-screen overflow-hidden bg-background relative">
        {/* Decorative background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:block">
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar}
          lastLogin="Today"
          collapsed={sidebarCollapsed}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Mobile sidebar */}
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
    </TourProvider>
  );
}
