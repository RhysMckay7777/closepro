import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, paymentPlanInstalments, users, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST - Log a call manually (updates figures and creates payment plan instalments if applicable)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      date,
      offerId,
      offerType,
      callType,
      result,
      qualified,
      prospectName,
      cashCollected,
      revenueGenerated,
      depositTaken,
      reasonForOutcome,
      commissionRatePct,
      objections,
      // Payment plan fields
      paymentType, // 'paid_in_full' | 'payment_plan'
      numberOfInstalments,
      monthlyAmount,
    } = body;

    if (!offerId || !result || !reasonForOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, result, reasonForOutcome' },
        { status: 400 }
      );
    }

    const validResults = ['no_show', 'closed', 'lost', 'unqualified', 'follow_up', 'deposit'] as const;
    if (!validResults.includes(result)) {
      return NextResponse.json(
        { error: `Invalid result. Must be one of: ${validResults.join(', ')}` },
        { status: 400 }
      );
    }

    const validOfferTypes = ['b2c_health', 'b2c_relationships', 'b2c_wealth', 'mixed_wealth', 'b2b_services'] as const;
    if (offerType != null && offerType !== '' && !validOfferTypes.includes(offerType)) {
      return NextResponse.json(
        { error: `Invalid offer type. Must be one of: ${validOfferTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validCallTypes = ['closing_call', 'follow_up', 'no_show'] as const;
    if (callType != null && callType !== '' && !validCallTypes.includes(callType)) {
      return NextResponse.json(
        { error: `Invalid call type. Must be one of: ${validCallTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Get user's organization and default commission rate
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, session.user.id))
        .limit(1);

      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    const callDate = date ? new Date(date) : new Date();
    if (isNaN(callDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    // Qualified if result ≠ Unqualified; only "Unqualified" marks the call as not qualified
    const qualifiedFromResult = result !== 'unqualified';

    // Determine effective commission rate (per-call override or user default)
    const userCommissionPct = (user[0] as any).commissionRatePct ?? null;
    const effectiveCommissionPct = typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100
      ? Math.round(commissionRatePct)
      : userCommissionPct;

    // Insert the call record
    const [insertedCall] = await db.insert(salesCalls).values({
      organizationId,
      userId: session.user.id,
      fileName: 'manual',
      fileUrl: '',
      status: 'manual',
      offerId: offerId || null,
      offerType: offerType && validOfferTypes.includes(offerType) ? offerType : null,
      callType: callType && validCallTypes.includes(callType) ? callType : 'closing_call',
      result,
      qualified: qualifiedFromResult,
      prospectName: typeof prospectName === 'string' ? prospectName.trim().slice(0, 500) || null : null,
      cashCollected: cashCollected != null ? Number(cashCollected) : null,
      revenueGenerated: revenueGenerated != null ? Number(revenueGenerated) : null,
      depositTaken: depositTaken ?? null,
      reasonForOutcome: reasonForOutcome || null,
      callDate,
      commissionRatePct: effectiveCommissionPct,
    }).returning();

    console.log('[Manual Call] Created call:', {
      callId: insertedCall.id,
      result,
      cashCollected,
      revenueGenerated,
      commissionRatePct: effectiveCommissionPct,
      paymentType,
    });

    // Create payment plan instalments if applicable
    if (result === 'closed' && paymentType === 'payment_plan' && numberOfInstalments && monthlyAmount) {
      const numInstalments = Number(numberOfInstalments);
      const monthlyAmountCents = Math.round(Number(monthlyAmount) * 100); // Convert to cents if needed

      if (numInstalments > 0 && monthlyAmountCents > 0) {
        const instalmentValues = [];

        for (let i = 0; i < numInstalments; i++) {
          // Calculate due date: first instalment is today/callDate, subsequent ones are monthly
          const dueDate = new Date(callDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          // Calculate commission for this instalment
          const commissionAmount = effectiveCommissionPct
            ? Math.round(monthlyAmountCents * (effectiveCommissionPct / 100))
            : null;

          instalmentValues.push({
            salesCallId: insertedCall.id,
            dueDate,
            amountCents: monthlyAmountCents,
            commissionRatePct: effectiveCommissionPct,
            commissionAmountCents: commissionAmount,
          });
        }

        await db.insert(paymentPlanInstalments).values(instalmentValues);

        console.log('[Manual Call] Created payment plan instalments:', {
          callId: insertedCall.id,
          count: numInstalments,
          monthlyAmountCents,
          commissionRatePct: effectiveCommissionPct,
        });
      }
    }

    return NextResponse.json({
      message: 'Call logged successfully (figures updated)',
      callId: insertedCall.id,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error logging manual call:', error);
    const msg = error instanceof Error ? error.message : 'Failed to log call';
    const code = (error as { code?: string })?.code;
    if (code === '42703' || (typeof msg === 'string' && (msg.includes('invalid input value') || msg.includes('enum')))) {
      return NextResponse.json(
        { error: 'Database schema may be out of date. Please run migrations.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

