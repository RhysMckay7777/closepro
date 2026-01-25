'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InviteUserDialog } from '@/components/team/invite-user-dialog';
import {
  Users,
  UserPlus,
  Mail,
  MoreVertical,
  Shield,
  AlertCircle,
  Crown,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  profilePhoto?: string | null;
  role: 'admin' | 'manager' | 'rep';
  createdAt: string;
}

interface TeamData {
  members: TeamMember[];
  currentSeats: number;
  maxSeats: number;
  canAddSeats: boolean;
  planTier: string;
}

interface PendingInvite {
  id: string;
  organizationId: string;
  organizationName: string;
  inviterId: string;
  inviterName: string;
  inviterEmail: string;
  inviterProfilePhoto?: string | null;
  role: 'admin' | 'manager' | 'rep';
  status: string;
  createdAt: string;
}

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [decliningInviteId, setDecliningInviteId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamData();
    fetchPendingInvites();
  }, []);

  const fetchTeamData = async () => {
    try {
      const response = await fetch('/api/team');
      if (!response.ok) throw new Error('Failed to fetch team data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load team information');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingInvites = async () => {
    try {
      const response = await fetch('/api/team/invites');
      if (!response.ok) throw new Error('Failed to fetch invites');
      const result = await response.json();
      setPendingInvites(result.invites || []);
    } catch (err) {
      console.error('Error fetching invites:', err);
    } finally {
      setLoadingInvites(false);
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setAcceptingInviteId(inviteId);
    try {
      const response = await fetch(`/api/team/invite/${inviteId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to accept invite');
      }

      const result = await response.json();

      // Show success message briefly, then reload to show the new organization
      if (result.message) {
        alert(result.message);
      }

      // Reload the page to ensure we're viewing the correct organization
      // This is necessary because the user might have joined a different org
      window.location.reload();
    } catch (err: any) {
      console.error('Error accepting invite:', err);
      alert(err.message || 'Failed to accept invite');
      setAcceptingInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to decline this invitation?')) {
      return;
    }

    setDecliningInviteId(inviteId);
    try {
      const response = await fetch(`/api/team/invite/${inviteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to decline invite');
      }

      // Refresh invites
      await fetchPendingInvites();
    } catch (err) {
      console.error('Error declining invite:', err);
      alert('Failed to decline invite');
    } finally {
      setDecliningInviteId(null);
    }
  };

  const handleInviteMember = () => {
    setInviteDialogOpen(true);
  };

  const handleInviteSuccess = () => {
    fetchTeamData();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      fetchTeamData();
    } catch (err) {
      console.error('Error removing member:', err);
      alert('Failed to remove team member');
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'manager':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-3 w-3" />;
      case 'manager':
        return <Shield className="h-3 w-3" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading team...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || 'Failed to load team data'}</AlertDescription>
      </Alert>
    );
  }

  const seatsPercentage = (data.currentSeats / data.maxSeats) * 100;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onSuccess={handleInviteSuccess}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold tracking-tight">
            Team Management
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Manage your team members and roles
          </p>
        </div>
        <Button
          onClick={handleInviteMember}
          disabled={!data?.canAddSeats}
          className="w-full sm:w-auto shrink-0"
          size="lg"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Seat Usage Alert */}
      {!data.canAddSeats && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-foreground">
            You've reached your seat limit ({data.maxSeats} seats).{' '}
            <a href="/pricing" className="underline font-medium hover:text-primary transition-colors">
              Upgrade your plan
            </a>{' '}
            to add more team members.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Seat Usage Card */}
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Seat Usage
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {data.currentSeats}/{data.maxSeats}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={Math.min(seatsPercentage, 100)} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              {Math.round(seatsPercentage)}% of seats used
            </p>
          </CardContent>
        </Card>

        {/* Plan Tier Card */}
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold capitalize">{data.planTier}</span>
              <Badge variant="secondary" className="capitalize">
                {data.planTier}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {data.maxSeats} seats included
            </p>
          </CardContent>
        </Card>

        {/* Growth Card */}
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-serif font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Team Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold">{data.members.length}</span>
              <span className="text-sm text-muted-foreground">active members</span>
            </div>
            {data.canAddSeats && (
              <p className="text-xs text-muted-foreground mt-2">
                {data.maxSeats - data.currentSeats} seat{data.maxSeats - data.currentSeats !== 1 ? 's' : ''} available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites */}
      {loadingInvites ? (
        <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-5 w-5 text-primary" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <div className="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Loading invites...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : pendingInvites.length > 0 ? (
        <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 backdrop-blur-xl shadow-xl">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-lg sm:text-xl">
              <Clock className="h-5 w-5 text-primary" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              You have {pendingInvites.length} pending invitation{pendingInvites.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvites.map((invite) => {
                const inviterInitials = invite.inviterName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div
                    key={invite.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-white/5 border border-primary/20 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-10 w-10 ring-2 ring-primary/20 shrink-0">
                        <AvatarImage src={invite.inviterProfilePhoto || undefined} alt={invite.inviterName} />
                        <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-sm font-medium">
                          {inviterInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <p className="font-medium text-base">{invite.organizationName}</p>
                          <Badge variant="outline" className="text-xs capitalize shrink-0">
                            {invite.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Invited by <span className="font-medium text-foreground">{invite.inviterName}</span>
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {invite.inviterEmail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAcceptInvite(invite.id)}
                        disabled={acceptingInviteId === invite.id || decliningInviteId === invite.id}
                        className="flex-1 sm:flex-initial gap-2"
                      >
                        {acceptingInviteId === invite.id ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                            <span className="hidden sm:inline">Accepting...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Accept</span>
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeclineInvite(invite.id)}
                        disabled={acceptingInviteId === invite.id || decliningInviteId === invite.id}
                        className="flex-1 sm:flex-initial gap-2"
                      >
                        {decliningInviteId === invite.id ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                            <span className="hidden sm:inline">Declining...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Decline</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Team Members List */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg sm:text-xl">Team Members</CardTitle>
          <CardDescription>
            All members in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Users className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">No team members yet</p>
              <p className="text-sm text-muted-foreground/70 mb-6">
                Start building your team by inviting your first member
              </p>
              <Button
                onClick={handleInviteMember}
                variant="outline"
                size="lg"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Your First Member
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 ring-2 ring-primary/20 shrink-0">
                      <AvatarImage src={member.profilePhoto || undefined} alt={member.name} />
                      <AvatarFallback className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground text-sm font-medium">
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-base truncate">{member.name}</p>
                        <Badge
                          variant={getRoleBadgeVariant(member.role)}
                          className="text-xs capitalize gap-1 shrink-0"
                        >
                          {getRoleIcon(member.role)}
                          {member.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{member.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-xl border-white/10 w-48">
                        <DropdownMenuItem className="cursor-pointer">
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer focus:text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={member.role === 'admin'}
                        >
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
