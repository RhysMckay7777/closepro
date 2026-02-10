import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, offers, paymentPlanInstalments } from '@/db/schema';
import { eq, or, and, isNull, inArray, sql } from 'drizzle-orm';

export const maxDuration = 60;

function emptyFigures(month: string, schemaHint?: boolean) {
  return {
    month,
    callsBooked: 0,
    callsShowed: 0,
    callsQualified: 0,
    salesMade: 0,
    closeRate: 0,
    showRate: 0,
    qualifiedRate: 0,
    cashCollected: 0,
    revenueGenerated: 0,
    cashCollectedPct: 0,
    commissionRatePct: null as number | null,
    totalCommission: 0,
    salesList: [] as Array<{
      callId: string;
      date: string;
      offerName: string;
      prospectName: string;
      cashCollected: number;
      revenueGenerated: number;
      commissionPct: number;
      commissionAmount: number;
    }>,
    ...(schemaHint && { schemaHint: 'Run "npm run db:migrate" so figures can read call data.' }),
  };
}

function isMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = e?.code ?? e?.cause?.code;
  const msg = typeof e?.message === 'string' ? e.message : '';
  return code === '42703' || (msg.includes('does not exist') && msg.includes('column'));
}

/**
 * GET - Figures for a given month (sales reality: booked, showed, qualified, closed, revenue).
 * Query: month=YYYY-MM (required).
 * Only includes: status=manual OR (status=completed AND (analysisIntent=update_figures OR analysisIntent IS NULL)).
 * Uses callDate for attribution when set (manual backdating), else createdAt.
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json(
        { error: 'Query parameter month=YYYY-MM is required' },
        { status: 400 }
      );
    }

    const [year, month] = monthParam.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const userId = session.user.id;

    let userCommissionPct: number | null = null;
    try {
      const u = await db.select({ commissionRatePct: users.commissionRatePct }).from(users).where(eq(users.id, userId)).limit(1);
      userCommissionPct = u[0]?.commissionRatePct ?? null;
    } catch {
      // column may not exist yet
    }

    let rows: Array<{
      id?: string;
      callDate: Date | null;
      createdAt: Date;
      originalCallId: string | null;
      result: string | null;
      qualified: boolean | null;
      cashCollected: number | null;
      revenueGenerated: number | null;
      prospectName?: string | null;
      commissionRatePct?: number | null;
      offerId?: string | null;
      offerName?: string | null;
    }>;

    try {
      rows = await db
        .select({
          id: salesCalls.id,
          callDate: salesCalls.callDate,
          createdAt: salesCalls.createdAt,
          originalCallId: salesCalls.originalCallId,
          result: salesCalls.result,
          qualified: salesCalls.qualified,
          cashCollected: salesCalls.cashCollected,
          revenueGenerated: salesCalls.revenueGenerated,
          prospectName: salesCalls.prospectName,
          commissionRatePct: salesCalls.commissionRatePct,
          offerId: salesCalls.offerId,
          offerName: offers.name,
        })
        .from(salesCalls)
        .leftJoin(offers, eq(salesCalls.offerId, offers.id))
        .where(
          and(
            eq(salesCalls.userId, userId),
            or(
              eq(salesCalls.status, 'manual'),
              and(
                eq(salesCalls.status, 'completed'),
                or(
                  eq(salesCalls.analysisIntent, 'update_figures'),
                  eq(salesCalls.analysisIntent, 'analysis_only'),
                  isNull(salesCalls.analysisIntent)
                )
              )
            )
          )
        );
    } catch (dbError: unknown) {
      if (!isMissingColumnError(dbError)) throw dbError;
      // Log so you can see which column is missing (check terminal when loading Figures)
      const e = dbError as { code?: string; message?: string };
      console.error('Figures API: missing column (run migrations against same DB as app):', e?.code, e?.message);
      // Try raw SQL in case Drizzle is out of sync with DB
      try {
        const raw = await db.execute<{
          call_date: Date | null;
          created_at: Date;
          original_call_id: string | null;
          result: string | null;
          qualified: boolean | null;
          cash_collected: number | null;
          revenue_generated: number | null;
        }>(sql`
          SELECT call_date, created_at, original_call_id, result, qualified, cash_collected, revenue_generated
          FROM sales_calls
          WHERE user_id = ${userId}
          AND (status = 'manual' OR (status = 'completed' AND (analysis_intent = 'update_figures' OR analysis_intent = 'analysis_only' OR analysis_intent IS NULL)))
        `);
        const rawRows = Array.isArray(raw) ? raw : (raw as { rows?: typeof raw })?.rows ?? [];
        rows = rawRows.map((r: Record<string, unknown>) => ({
          callDate: (r.call_date != null ? new Date(r.call_date as Date | string) : null) as Date | null,
          createdAt: r.created_at != null ? new Date(r.created_at as Date | string) : new Date(),
          originalCallId: (r.original_call_id ?? null) as string | null,
          result: (r.result ?? null) as string | null,
          qualified: (r.qualified ?? null) as boolean | null,
          cashCollected: (r.cash_collected ?? null) as number | null,
          revenueGenerated: (r.revenue_generated ?? null) as number | null,
        }));
      } catch (rawErr: unknown) {
        const re = rawErr as { code?: string; message?: string };
        console.error('Figures API: raw query also failed:', re?.code, re?.message);
        return NextResponse.json(emptyFigures(monthParam, true));
      }
    }

    const dateFor = (row: { callDate: Date | null; createdAt: Date }) =>
      row.callDate ? new Date(row.callDate) : new Date(row.createdAt);

    const inMonth = (row: { callDate: Date | null; createdAt: Date }) => {
      const d = dateFor(row);
      return d >= start && d <= end;
    };

    const monthRows = rows.filter(inMonth);

    const baseRows = monthRows.filter((r) => !r.originalCallId);
    const callsBooked = baseRows.length;
    const callsShowed = baseRows.filter((r) => r.result !== 'no_show').length;
    const callsQualified = baseRows.filter(
      (r) => r.result !== 'no_show' && r.qualified === true
    ).length;
    const salesMade = monthRows.filter((r) =>
      r.result === 'closed' || r.result === 'deposit'
    ).length;

    const closeRate =
      callsShowed > 0 ? Math.round((salesMade / callsShowed) * 1000) / 10 : 0;
    const showRate =
      callsBooked > 0 ? Math.round((callsShowed / callsBooked) * 1000) / 10 : 0;
    const qualifiedRate =
      callsShowed > 0
        ? Math.round((callsQualified / callsShowed) * 1000) / 10
        : 0;

    const cashCollected = monthRows.reduce(
      (sum, r) => sum + (r.cashCollected ?? 0),
      0
    );
    const revenueGenerated = monthRows.reduce(
      (sum, r) => sum + (r.revenueGenerated ?? 0),
      0
    );
    const cashCollectedPct =
      revenueGenerated > 0
        ? Math.round((cashCollected / revenueGenerated) * 1000) / 10
        : 0;

    const salesRows = monthRows.filter(
      (r) => (r.result === 'closed' || r.result === 'deposit') && r.id
    );
    const salesList: Array<{
      callId: string;
      date: string;
      offerName: string;
      prospectName: string;
      cashCollected: number;
      revenueGenerated: number;
      commissionPct: number;
      commissionAmount: number;
      isInstalment?: boolean;
      instalmentNumber?: number;
      totalInstalments?: number;
    }> = salesRows.map((r) => {
      const rev = r.revenueGenerated ?? 0;
      const pct = r.commissionRatePct ?? userCommissionPct ?? 0;
      return {
        callId: r.id!,
        date: dateFor(r).toISOString().slice(0, 10),
        offerName: r.offerName ?? '—',
        prospectName: r.prospectName || 'Unknown',
        cashCollected: r.cashCollected ?? 0,
        revenueGenerated: rev,
        commissionPct: pct,
        commissionAmount: Math.round(rev * (pct / 100)),
      };
    });

    // Fetch ALL payment plan instalments for the user's calls.
    // Show all instalments from a sale when the SALE DATE falls in the selected month.
    // This gives the full commission picture for deals closed this month.
    const callIdsWithInstalments = new Set<string>();
    try {
      const instalmentRows = await db
        .select({
          salesCallId: paymentPlanInstalments.salesCallId,
          dueDate: paymentPlanInstalments.dueDate,
          amountCents: paymentPlanInstalments.amountCents,
          commissionRatePct: paymentPlanInstalments.commissionRatePct,
          commissionAmountCents: paymentPlanInstalments.commissionAmountCents,
          prospectName: salesCalls.prospectName,
          offerId: salesCalls.offerId,
          offerName: offers.name,
          callDate: salesCalls.callDate,
          callCreatedAt: salesCalls.createdAt,
        })
        .from(paymentPlanInstalments)
        .innerJoin(salesCalls, eq(paymentPlanInstalments.salesCallId, salesCalls.id))
        .leftJoin(offers, eq(salesCalls.offerId, offers.id))
        .where(eq(salesCalls.userId, userId));

      // Group instalments by their parent call
      const byCall = new Map<string, typeof instalmentRows>();
      for (const inst of instalmentRows) {
        callIdsWithInstalments.add(inst.salesCallId);
        const arr = byCall.get(inst.salesCallId) ?? [];
        arr.push(inst);
        byCall.set(inst.salesCallId, arr);
      }

      // For each call with instalments, show ALL instalments if the sale date is in this month
      for (const [, insts] of byCall) {
        const first = insts[0];
        const saleDate = first.callDate ? new Date(first.callDate) : new Date(first.callCreatedAt);
        if (saleDate < start || saleDate > end) continue;

        // Sort by dueDate ascending for numbering
        insts.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        for (let i = 0; i < insts.length; i++) {
          const inst = insts[i];
          const d = new Date(inst.dueDate);
          const pct = inst.commissionRatePct ?? userCommissionPct ?? 0;
          const commAmt = inst.commissionAmountCents ?? Math.round(inst.amountCents * (pct / 100));
          salesList.push({
            callId: inst.salesCallId,
            date: d.toISOString().slice(0, 10),
            offerName: inst.offerName ?? '—',
            prospectName: inst.prospectName || 'Unknown',
            cashCollected: inst.amountCents,
            revenueGenerated: inst.amountCents,
            commissionPct: pct,
            commissionAmount: commAmt,
            isInstalment: true,
            instalmentNumber: i + 1,
            totalInstalments: insts.length,
          });
        }
      }
    } catch (instErr) {
      // paymentPlanInstalments table may not exist yet — gracefully skip
      console.error('Figures API: instalment query failed (may need migration):', instErr);
    }

    // Remove parent salesCalls rows that have payment plan instalments (avoid double-counting)
    const filteredSalesList = callIdsWithInstalments.size > 0
      ? salesList.filter((r) => !callIdsWithInstalments.has(r.callId) || r.isInstalment)
      : salesList;

    const totalCommission = filteredSalesList.reduce((s, row) => s + row.commissionAmount, 0);

    return NextResponse.json({
      month: monthParam,
      callsBooked,
      callsShowed,
      callsQualified,
      salesMade,
      closeRate,
      showRate,
      qualifiedRate,
      cashCollected,
      revenueGenerated,
      cashCollectedPct,
      commissionRatePct: userCommissionPct,
      salesList: filteredSalesList,
      totalCommission,
    });
  } catch (error) {
    console.error('Error fetching figures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch figures' },
      { status: 500 }
    );
  }
}
