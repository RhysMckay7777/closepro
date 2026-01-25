// Organization utilities for multi-org support
import { db } from '@/db';
import { users, userOrganizations, organizations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(userId: string) {
  const orgs = await db
    .select({
      organization: organizations,
      membership: userOrganizations,
    })
    .from(userOrganizations)
    .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
    .where(eq(userOrganizations.userId, userId))
    .orderBy(desc(userOrganizations.isPrimary));

  return orgs.map(({ organization, membership }) => ({
    ...organization,
    role: membership.role,
    isPrimary: membership.isPrimary,
    joinedAt: membership.joinedAt,
  })).sort((a, b) => {
    // Primary org first, then by name
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get user's role in a specific organization
 */
export async function getUserRoleInOrganization(
  userId: string,
  organizationId: string
): Promise<'admin' | 'manager' | 'rep' | null> {
  const membership = await db
    .select()
    .from(userOrganizations)
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId)
      )
    )
    .limit(1);

  return membership[0]?.role || null;
}

/**
 * Check if user is member of organization
 */
export async function isUserInOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const membership = await db
    .select()
    .from(userOrganizations)
    .where(
      and(
        eq(userOrganizations.userId, userId),
        eq(userOrganizations.organizationId, organizationId)
      )
    )
    .limit(1);

  return membership.length > 0;
}
