'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Mic,
  Users,
  BarChart3,
  Target,
  Settings,
  HelpCircle,
  User,
  CreditCard,
  ChevronRight,
  Headphones,
  Bot,
  DollarSign,
  Building2,
  Check,
  Loader2,
  Compass,
} from 'lucide-react';
import { useTour } from '@/components/tour';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        title: 'Performance',
        href: '/dashboard/performance',
        icon: BarChart3,
      },
      {
        title: 'Figures',
        href: '/dashboard/performance/figures',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Training',
    items: [
      {
        title: 'Calls',
        href: '/dashboard/calls',
        icon: Mic,
      },
      {
        title: 'AI Roleplay',
        href: '/dashboard/roleplay',
        icon: Bot,
        badge: 'Pro+',
      },
      {
        title: 'Offers',
        href: '/dashboard/offers',
        icon: Target,
      },
    ],
  },
  {
    title: 'Team',
    items: [
      {
        title: 'Manager Dashboard',
        href: '/dashboard/manager',
        icon: BarChart3,
        badge: 'Manager',
      },
      {
        title: 'Team Performance',
        href: '/dashboard/team',
        icon: Users,
      }
    ],
  },
  {
    title: 'Account',
    items: [
      {
        title: 'Profile',
        href: '/dashboard/profile',
        icon: User,
      },
      {
        title: 'Pricing',
        href: '/pricing',
        icon: DollarSign,
      },
      {
        title: 'Billing',
        href: '/dashboard/billing',
        icon: CreditCard,
      },
    ],
  },
];

interface Organization {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'rep';
  isPrimary: boolean;
  planTier: string;
}

interface SidebarProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string | null;
  lastLogin?: string;
  collapsed?: boolean;
}

export function Sidebar({
  userName = 'User',
  userEmail = 'user@closepro.com',
  userAvatar,
  lastLogin,
  collapsed = true,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { start: startTour } = useTour();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [switchingOrg, setSwitchingOrg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations/list');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        const primary = data.organizations?.find((org: Organization) => org.isPrimary) || data.organizations?.[0];
        setCurrentOrg(primary || null);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    if (switchingOrg || currentOrg?.id === orgId) return;

    setSwitchingOrg(orgId);
    try {
      const response = await fetch('/api/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch organization');
      }

      // Reload page to reflect new organization
      window.location.reload();
    } catch (error) {
      console.error('Error switching organization:', error);
      alert('Failed to switch organization');
      setSwitchingOrg(null);
    }
  };

  // Get initials for avatar
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside
      className={cn(
        'bg-card/95 backdrop-blur-xl flex flex-col h-screen transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-primary/5 w-full lg:w-84',
        collapsed && 'lg:w-16'
      )}
    >
      {/* Logo and branding */}
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.12)] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.16)] transition-all">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <div className="font-serif font-semibold text-foreground text-base">ClosePro</div>
              <div className="text-xs text-muted-foreground">
                AI Sales Coaching
              </div>
            </div>
          )}
        </Link>
      </div>



      {/* Organization/Workspace Card */}
      {!collapsed && (
        <div className="mx-4 mb-4">
          {loadingOrgs ? (
            <div className="w-full p-4 rounded-2xl bg-card flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div className="flex-1">
                <div className="h-4 bg-white/5 rounded w-24 mb-2" />
                <div className="h-3 bg-white/5 rounded w-16" />
              </div>
            </div>
          ) : organizations.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full p-4 rounded-2xl bg-card hover:bg-accent/50 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)] flex items-center gap-3 text-left group">
                  <div className="h-10 w-10 rounded-xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                    <Building2 className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {currentOrg?.name || organizations[0]?.name || 'Organization'}
                    </div>
                    <div className="text-xs text-muted-foreground truncate capitalize">
                      {currentOrg?.planTier || organizations[0]?.planTier || 'Plan'} Plan
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 bg-background/95 backdrop-blur-xl border-white/10 shadow-xl">
                <DropdownMenuLabel className="font-semibold">Switch Organization</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                    disabled={switchingOrg === org.id || currentOrg?.id === org.id}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{org.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {org.planTier} • {org.role}
                        </div>
                      </div>
                      {switchingOrg === org.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : currentOrg?.id === org.id ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : null}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full p-4 rounded-2xl bg-card">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="font-semibold text-sm text-foreground">No Organization</div>
              <div className="text-xs text-muted-foreground">Create one to get started</div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 space-y-8">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3 px-2">
                {section.title}
              </div>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                const dataTour =
                  item.href === '/dashboard/offers' ? 'nav-offers' :
                  item.href === '/dashboard/roleplay' ? 'nav-roleplay' :
                  item.href === '/dashboard/calls' ? 'nav-calls' : undefined;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(dataTour && { 'data-tour': dataTour })}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group',
                      isActive
                        ? 'bg-primary/10 text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)]'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                      item.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r shadow-sm" />
                    )}
                    <Icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <Badge
                            variant={item.badge === 'Beta' ? 'secondary' : 'destructive'}
                            className="h-5 text-xs px-1.5 shadow-sm"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}


      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-6 space-y-1 mb-6">
          <button
            type="button"
            onClick={() => startTour()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] w-full text-left"
          >
            <Compass className="h-4 w-4 shrink-0" />
            <span>Take a tour</span>
          </button>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Link>
          <Link
            href="/dashboard/support"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <Headphones className="h-4 w-4 shrink-0" />
            <span>Support</span>
          </Link>
        </div>
      )}

      {/* User Profile Card */}
      {!collapsed && (
        <div className="mx-4 mb-4">
          <Link
            href="/dashboard/profile"
            className="w-full p-4 rounded-2xl bg-card hover:bg-accent/50 transition-all shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)] flex items-center gap-3 text-left group"
          >
            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
              <AvatarImage src={userAvatar || undefined} alt={userName} />
              <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">
                {userName}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>
      )}
      <div className="p-6 mt-auto">
        <div className="text-xs text-muted-foreground">
          © 2026 ClosePro
        </div>
      </div>
    </aside>
  );
}
