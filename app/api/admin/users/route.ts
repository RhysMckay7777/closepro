import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/db';
import { organizations, subscriptions, userOrganizations, users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

/**
 * GET /api/admin/users
 *
 * Lists all organizations with their current plan, owner info, and member count.
 * Admin-only endpoint (ADMIN_EMAILS env var).
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    // Fetch all organizations with member counts and subscription info
    const orgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        planTier: organizations.planTier,
        maxSeats: organizations.maxSeats,
        isActive: organizations.isActive,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .orderBy(desc(organizations.createdAt));

    // For each org, get the owner (first admin or first member) and member count
    const enrichedOrgs = await Promise.all(
      orgs.map(async (org) => {
        // Get member count
        const memberCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userOrganizations)
          .where(eq(userOrganizations.organizationId, org.id));

        // Get first admin member (or first member if no admin)
        const members = await db
          .select({
            userId: userOrganizations.userId,
            role: userOrganizations.role,
            userName: users.name,
            userEmail: users.email,
          })
          .from(userOrganizations)
          .innerJoin(users, eq(userOrganizations.userId, users.id))
          .where(eq(userOrganizations.organizationId, org.id))
          .orderBy(
            sql`CASE WHEN ${userOrganizations.role} = 'admin' THEN 0 WHEN ${userOrganizations.role} = 'manager' THEN 1 ELSE 2 END`
          )
          .limit(3);

        // Get active subscription
        const activeSub = await db
          .select({
            planTier: subscriptions.planTier,
            status: subscriptions.status,
            callsPerMonth: subscriptions.callsPerMonth,
            roleplaySessionsPerMonth: subscriptions.roleplaySessionsPerMonth,
            seats: subscriptions.seats,
          })
          .from(subscriptions)
          .where(eq(subscriptions.organizationId, org.id))
          .orderBy(desc(subscriptions.createdAt))
          .limit(1);

        return {
          ...org,
          memberCount: memberCountResult[0]?.count || 0,
          owner: members[0]
            ? {
                name: members[0].userName,
                email: members[0].userEmail,
                role: members[0].role,
              }
            : null,
          members: members.map((m) => ({
            name: m.userName,
            email: m.userEmail,
            role: m.role,
          })),
          subscription: activeSub[0] || null,
        };
      })
    );

    return NextResponse.json({ organizations: enrichedOrgs });
  } catch (error) {
    console.error('[admin/users] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
