'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Search, Home, Sidebar, ChevronDown, User, CreditCard, Settings, LogOut, CheckCircle2, XCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { signOut } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
// Simple date formatting helper (no external dependency needed)
const formatTimeAgo = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

interface HeaderProps {
  breadcrumbs?: Array<{ label: string; href?: string }>;
  userName?: string;
  userEmail?: string;
  userAvatar?: string | null;
  notificationCount?: number;
  onToggleSidebar?: () => void;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    inviteId?: string;
    role?: string;
    organizationName?: string;
    [key: string]: unknown;
  };
  organizationId?: string;
}

export function Header({
  breadcrumbs = [{ label: 'Overview' }, { label: 'Dashboard' }],
  userName = 'User',
  userEmail = 'user@example.com',
  userAvatar,
  onToggleSidebar,
}: HeaderProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?unread=false');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, read: true }),
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/signin');
  };

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="bg-card/95 backdrop-blur-2xl border-b border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.04)] sticky top-0 z-10">
      <div className="flex items-center justify-between h-16 sm:h-20 px-3 sm:px-4 lg:px-6 gap-2 sm:gap-3">
        {/* Left: Sidebar toggle + Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 hover:bg-accent/50 transition-all"
            >
              <Sidebar className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0 overflow-hidden">
            <div className="hidden sm:flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/70" />
            </div>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                {index > 0 && (
                  <span className="text-muted-foreground/50 shrink-0">/</span>
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-muted-foreground hover:text-foreground transition-colors truncate font-medium"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold truncate">
                    {crumb.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Search + Actions + User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-40 lg:w-56 xl:w-72 h-9 pl-9 pr-3 bg-white/5 backdrop-blur-xl border border-white/10 focus-visible:border-primary/50 focus-visible:bg-white/10 transition-all text-sm"
            />
          </div>

          {/* Mobile Search Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 hover:bg-accent/50"
            onClick={() => {
              // TODO: Open mobile search modal
            }}
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 sm:h-9 sm:w-9 hover:bg-accent/50 transition-all"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-0.5 -right-0.5 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 text-[10px] font-semibold backdrop-blur-sm shadow-lg ring-2 ring-background"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-background/95 backdrop-blur-xl border-white/10 shadow-xl p-0">
              <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
              </DropdownMenuLabel>
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  <div className="py-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`px-4 py-3 border-b border-white/5 hover:bg-accent/30 transition-colors cursor-pointer ${!notification.read ? 'bg-primary/5' : ''
                          }`}
                        onClick={() => {
                          if (!notification.read) {
                            markAsRead(notification.id);
                          }
                          // Handle notification click based on type
                          if (notification.type === 'team_invite' && notification.metadata?.inviteId) {
                            router.push(`/dashboard/team?invite=${notification.metadata.inviteId}`);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {notification.type === 'team_invite' && (
                              <Users className="h-4 w-4 text-primary" />
                            )}
                            {notification.type === 'team_invite_accepted' && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            {notification.type === 'team_invite_declined' && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            {!notification.type.startsWith('team_') && (
                              <Bell className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {formatTimeAgo(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => router.push('/dashboard/team')}
                    >
                      View all notifications
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Switcher */}
          <div className="hidden sm:block">
            <ThemeSwitcher />
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-border/50 mx-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="gap-2 h-8 sm:h-9 px-2 hover:bg-accent/50 transition-all border border-transparent hover:border-white/10"
              >
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary/20 shadow-sm">
                  <AvatarImage src={userAvatar || undefined} alt={userName} />
                  <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left min-w-0">
                  <div className="text-sm font-semibold leading-none truncate">{userName}</div>
                  <div className="text-xs text-muted-foreground leading-none truncate max-w-[120px]">
                    {userEmail}
                  </div>
                </div>
                <ChevronDown className="hidden lg:block h-4 w-4 text-muted-foreground ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-xl border-white/10 shadow-xl">
              <DropdownMenuLabel className="font-semibold">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/billing" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
