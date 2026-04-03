'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Crown,
  Zap,
  Star,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrgMember {
  name: string;
  email: string;
  role: string;
}

interface OrgData {
  id: string;
  name: string;
  planTier: string;
  maxSeats: number;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  owner: OrgMember | null;
  members: OrgMember[];
  subscription: {
    planTier: string;
    status: string;
    callsPerMonth: number;
    roleplaySessionsPerMonth: number;
    seats: number;
  } | null;
}

const PLAN_CONFIG: Record<string, { label: string; icon: typeof Star; color: string; badge: 'secondary' | 'default' | 'outline' }> = {
  rep: { label: 'Rep', icon: Zap, color: 'text-primary', badge: 'default' },
  manager: { label: 'Manager', icon: Crown, color: 'text-amber-500', badge: 'default' },
  enterprise: { label: 'Enterprise', icon: Crown, color: 'text-amber-500', badge: 'outline' },
};

export default function AdminPage() {
  const [orgs, setOrgs] = useState<OrgData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        setError('Access denied — your account is not an admin.');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setOrgs(data.organizations);
    } catch {
      setError('Failed to load admin data. Check that ADMIN_EMAILS is configured.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChange = (orgId: string, newPlan: string) => {
    setPendingChanges((prev) => ({ ...prev, [orgId]: newPlan }));
  };

  const applyPlanChange = async (orgId: string) => {
    const newPlan = pendingChanges[orgId];
    if (!newPlan) return;

    setApplying(orgId);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, planTier: newPlan }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }

      const result = await res.json();
      setSuccessMsg(result.message);

      // Update local state
      setOrgs((prev) =>
        prev.map((org) =>
          org.id === orgId
            ? {
                ...org,
                planTier: newPlan,
                subscription: result.subscription,
              }
            : org
        )
      );

      // Clear pending change
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[orgId];
        return next;
      });

      // Auto-clear success after 4 seconds
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setApplying(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (error === 'Access denied — your account is not an admin.') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md border border-destructive/30">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-serif font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              Your account does not have admin privileges. Contact the platform administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold">Admin Panel</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage organization plans and permissions
        </p>
      </div>

      {/* Success message */}
      {successMsg && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-foreground">{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {error && error !== 'Access denied — your account is not an admin.' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{orgs.length}</div>
            <div className="text-xs text-muted-foreground">Total Orgs</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {orgs.filter((o) => ['rep', 'manager', 'pro'].includes(o.subscription?.planTier || o.planTier)).length}
            </div>
            <div className="text-xs text-muted-foreground">Paid Plans</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {orgs.reduce((sum, o) => sum + o.memberCount, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">
              {orgs.filter((o) => o.isActive).length}
            </div>
            <div className="text-xs text-muted-foreground">Active Orgs</div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations list */}
      <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organizations
          </CardTitle>
          <CardDescription className="text-xs">
            Change an organization&apos;s plan to grant or revoke access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No organizations found
              </p>
            ) : (
              orgs.map((org) => {
                const currentPlan = org.subscription?.planTier || org.planTier;
                const config = PLAN_CONFIG[currentPlan] || PLAN_CONFIG.rep;
                const PlanIcon = config.icon;
                const hasPendingChange = pendingChanges[org.id] && pendingChanges[org.id] !== currentPlan;

                return (
                  <div
                    key={org.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Org info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{org.name}</span>
                        <Badge variant={config.badge} className="text-[10px] h-5 shrink-0">
                          <PlanIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground truncate">
                          {org.owner?.email || 'No owner'}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Users className="h-3 w-3" />
                          {org.memberCount}
                        </span>
                      </div>
                    </div>

                    {/* Plan selector + apply button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={pendingChanges[org.id] || currentPlan}
                        onValueChange={(val) => handlePlanChange(org.id, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rep">
                            <span className="flex items-center gap-1.5">
                              <Zap className="h-3 w-3" /> Rep — £9/mo
                            </span>
                          </SelectItem>
                          <SelectItem value="manager">
                            <span className="flex items-center gap-1.5">
                              <Crown className="h-3 w-3" /> Manager — £59/mo
                            </span>
                          </SelectItem>
                          <SelectItem value="enterprise">
                            <span className="flex items-center gap-1.5">
                              <Crown className="h-3 w-3" /> Enterprise
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant={hasPendingChange ? 'default' : 'ghost'}
                        className="h-8 text-xs px-3"
                        disabled={!hasPendingChange || applying === org.id}
                        onClick={() => applyPlanChange(org.id)}
                      >
                        {applying === org.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
