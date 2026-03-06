import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/check-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SEASONAL: Record<number, { label: string; multiplier: number }> = {
  0:  { label: "Low season",      multiplier: 0.75 },
  1:  { label: "Low season",      multiplier: 0.85 },
  2:  { label: "Standard season", multiplier: 1.00 },
  3:  { label: "Standard",        multiplier: 1.00 },
  4:  { label: "Shoulder season", multiplier: 1.08 },
  5:  { label: "Peak season",     multiplier: 1.15 },
  6:  { label: "Peak season",     multiplier: 1.20 },
  7:  { label: "Peak season",     multiplier: 1.15 },
  8:  { label: "Shoulder season", multiplier: 1.08 },
  9:  { label: "Standard season", multiplier: 1.00 },
  10: { label: "Low season",      multiplier: 0.85 },
  11: { label: "Low season",      multiplier: 0.80 },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function movRev(m: { estimate?: unknown; amount?: unknown }): number {
  return Number(m.estimate || m.amount || 0);
}

function dlvRev(d: { admin_adjusted_price?: unknown; total_price?: unknown; quoted_price?: unknown }): number {
  return Number(d.admin_adjusted_price || d.total_price || d.quoted_price || 0);
}

function quoteValue(q: { custom_price?: unknown; tiers?: unknown }): number {
  if (q.custom_price) return Number(q.custom_price) || 0;
  if (!q.tiers) return 0;
  const tiers: Record<string, Record<string, unknown>> =
    typeof q.tiers === "string" ? JSON.parse(q.tiers) : q.tiers;
  if (!tiers || typeof tiers !== "object") return 0;
  const premier = tiers.premier as Record<string, unknown> | undefined;
  if (premier?.total) return Number(premier.total);
  const vals = Object.values(tiers)
    .map((t) => Number((t as Record<string, unknown>)?.total || (t as Record<string, unknown>)?.price || 0))
    .filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function convProb(status: string, events: Set<string> | undefined): number {
  if (status === "expired") return 0;
  const viewed = status === "viewed" || !!events?.has("page_view");
  const tierClicked = !!events?.has("tier_clicked");
  const contractViewed = !!events?.has("contract_viewed");
  if (viewed && tierClicked && contractViewed) return 0.6;
  if (viewed) return 0.3;
  return 0.15;
}

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? null : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export async function GET(req: Request) {
  const { error } = await requireOwner();
  if (error) return error;

  const db = createAdminClient();
  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("range") || "30") || 30, 90);

  const now = new Date();
  const today = iso(now);
  const endDate = iso(new Date(now.getTime() + days * 86_400_000));

  const thisMonthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastMonthStart = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const lastMonthEnd = iso(new Date(now.getFullYear(), now.getMonth(), 0));

  /* ── Batch 1: parallel queries ── */
  const [
    movesRes, deliveriesRes, activeQuotesRes, pendingDlvsRes,
    leadsRes, crewsRes, quotesMetricsRes, claimsRes, leadsCountRes,
  ] = await Promise.all([
    db.from("moves")
      .select("id, estimate, amount, status, service_type, move_type, scheduled_date")
      .gte("scheduled_date", lastMonthStart).lte("scheduled_date", endDate)
      .not("status", "eq", "cancelled"),

    db.from("deliveries")
      .select("id, total_price, admin_adjusted_price, quoted_price, status, scheduled_date, category")
      .gte("scheduled_date", lastMonthStart).lte("scheduled_date", endDate)
      .not("status", "eq", "cancelled"),

    db.from("quotes")
      .select("id, status, tiers, custom_price, move_date, engagement_summary")
      .in("status", ["sent", "viewed"]),

    db.from("deliveries")
      .select("id, total_price, quoted_price, admin_adjusted_price, scheduled_date")
      .eq("status", "pending_approval"),

    db.from("quote_requests")
      .select("id, widget_estimate_low, widget_estimate_high")
      .eq("status", "new"),

    db.from("crews").select("id, name"),

    db.from("quotes")
      .select("id, status, created_at, accepted_at")
      .gte("created_at", lastMonthStart),

    db.from("claims")
      .select("id, amount")
      .in("status", ["open", "pending"]),

    db.from("quote_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thisMonthStart),
  ]);

  const allMoves = movesRes.data || [];
  const allDeliveries = deliveriesRes.data || [];
  const activeQuotes = activeQuotesRes.data || [];
  const pendingDlvs = pendingDlvsRes.data || [];
  const leads = leadsRes.data || [];
  const totalCrews = Math.max((crewsRes.data || []).length, 1);
  const quotesForMetrics = quotesMetricsRes.data || [];
  const openClaims = claimsRes.error ? [] : (claimsRes.data || []);
  const widgetLeadsThisMonth = leadsCountRes.count || 0;

  /* ── Batch 2: engagement for active quotes ── */
  const engagementMap: Record<string, Set<string>> = {};
  const quoteIds = activeQuotes.map((q) => q.id);

  if (quoteIds.length > 0) {
    const { data: eng } = await db
      .from("quote_engagement")
      .select("quote_id, event_type")
      .in("quote_id", quoteIds);

    for (const e of eng || []) {
      if (!engagementMap[e.quote_id]) engagementMap[e.quote_id] = new Set();
      engagementMap[e.quote_id].add(e.event_type);
    }
  }

  /* ══════════ PIPELINE ══════════ */

  const confirmedStatuses = new Set(["confirmed", "scheduled"]);

  const confirmedMoves = allMoves.filter(
    (m) => confirmedStatuses.has(m.status) && m.scheduled_date >= today && m.scheduled_date <= endDate,
  );
  const confirmedDlvs = allDeliveries.filter(
    (d) => confirmedStatuses.has(d.status) && d.scheduled_date >= today && d.scheduled_date <= endDate,
  );

  const confirmedMoveTotal = confirmedMoves.reduce((s, m) => s + movRev(m), 0);
  const confirmedDlvTotal = confirmedDlvs.reduce((s, d) => s + dlvRev(d), 0);

  const projectedItems = activeQuotes.map((q) => {
    const prob = convProb(q.status, engagementMap[q.id]);
    const value = quoteValue(q);
    return { id: q.id, revenue: value, probability: prob, weighted: value * prob, moveDate: q.move_date };
  });
  const projectedQuoteTotal = projectedItems.reduce((s, i) => s + i.weighted, 0);
  const pendingDlvTotal = pendingDlvs.reduce((s, d) => s + dlvRev(d), 0);

  const highProb = projectedItems.filter((i) => i.probability >= 0.6).length;
  const midProb = projectedItems.filter((i) => i.probability >= 0.3 && i.probability < 0.6).length;
  const lowProb = projectedItems.filter((i) => i.probability > 0 && i.probability < 0.3).length;

  const leadsEstimate = leads.reduce((s, l) => {
    const mid = (Number(l.widget_estimate_low || 0) + Number(l.widget_estimate_high || 0)) / 2;
    return s + (mid > 0 ? mid : 800);
  }, 0);

  /* ══════════ DAILY REVENUE ══════════ */

  const dailyRevenue: Record<string, unknown>[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = iso(d);
    const isToday = dateStr === today;

    const dayMoveRev = confirmedMoves
      .filter((m) => m.scheduled_date === dateStr)
      .reduce((s, m) => s + movRev(m), 0);

    const dayDlvRev = confirmedDlvs
      .filter((dl) => dl.scheduled_date === dateStr)
      .reduce((s, dl) => s + dlvRev(dl), 0);

    const dayProjected = projectedItems
      .filter((q) => q.moveDate === dateStr)
      .reduce((s, q) => s + q.weighted, 0);

    dailyRevenue.push({
      date: dateStr,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dayLabel: DAY_LABELS[d.getDay()],
      residential: Math.round(dayMoveRev),
      b2b: Math.round(dayDlvRev),
      projected: Math.round(dayProjected),
      isToday,
    });
  }

  /* ══════════ CAPACITY (Next 7 Days) ══════════ */

  const activeJobStatuses = new Set([
    "confirmed", "scheduled", "in_progress", "dispatched", "in-transit", "in_transit",
  ]);

  const capacity: Record<string, unknown>[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = iso(d);

    const bookedMoves = allMoves.filter(
      (m) => m.scheduled_date === dateStr && activeJobStatuses.has(m.status),
    ).length;
    const bookedDlvs = allDeliveries.filter(
      (dl) => dl.scheduled_date === dateStr && activeJobStatuses.has(dl.status),
    ).length;
    const booked = bookedMoves + bookedDlvs;
    const pct = Math.min(Math.round((booked / totalCrews) * 100), 100);

    const parts: string[] = [];
    if (bookedMoves > 0) parts.push(`${bookedMoves} move${bookedMoves > 1 ? "s" : ""}`);
    if (bookedDlvs > 0) parts.push(`${bookedDlvs} deliver${bookedDlvs > 1 ? "ies" : "y"}`);

    capacity.push({
      date: dateStr,
      dayLabel: DAY_LABELS[d.getDay()],
      booked,
      total: totalCrews,
      pct,
      moveCount: bookedMoves,
      deliveryCount: bookedDlvs,
      details: parts.length ? `${booked}/${totalCrews} crews — ${parts.join(" + ")}` : "No bookings",
    });
  }

  /* ══════════ SEASONAL ══════════ */

  const seasonal = Array.from({ length: 4 }, (_, i) => {
    const m = (now.getMonth() + i) % 12;
    const s = SEASONAL[m];
    return { month: MONTH_NAMES[m], label: s.label, multiplier: s.multiplier, isCurrent: i === 0 };
  });

  const peakMonth = seasonal.slice(1).find((s) => s.multiplier > 1.0);
  const seasonalTip = peakMonth
    ? `Revenue typically increases ${Math.round((peakMonth.multiplier - 1) * 100)}% in ${peakMonth.month}. Consider raising your marketing budget in ${MONTH_NAMES[(MONTH_NAMES.indexOf(peakMonth.month) + 11) % 12]} to capture early bookers.`
    : null;

  /* ══════════ KEY METRICS ══════════ */

  const revenueStatuses = new Set(["confirmed", "scheduled", "completed", "delivered", "done", "paid"]);
  const dlvRevenueStatuses = new Set(["confirmed", "scheduled", "delivered", "completed"]);

  const thisMonthMoves = allMoves.filter(
    (m) => m.scheduled_date >= thisMonthStart && m.scheduled_date <= today && revenueStatuses.has(m.status),
  );
  const lastMonthMoves = allMoves.filter(
    (m) => m.scheduled_date >= lastMonthStart && m.scheduled_date <= lastMonthEnd && revenueStatuses.has(m.status),
  );
  const thisMonthDlvs = allDeliveries.filter(
    (d) => d.scheduled_date >= thisMonthStart && d.scheduled_date <= today && dlvRevenueStatuses.has(d.status),
  );
  const lastMonthDlvs = allDeliveries.filter(
    (d) => d.scheduled_date >= lastMonthStart && d.scheduled_date <= lastMonthEnd && dlvRevenueStatuses.has(d.status),
  );

  const thisMonthConfirmed = thisMonthMoves.reduce((s, m) => s + movRev(m), 0) +
    thisMonthDlvs.reduce((s, d) => s + dlvRev(d), 0);
  const lastMonthConfirmed = lastMonthMoves.reduce((s, m) => s + movRev(m), 0) +
    lastMonthDlvs.reduce((s, d) => s + dlvRev(d), 0);

  const thisMonthB2B = thisMonthDlvs.reduce((s, d) => s + dlvRev(d), 0);
  const lastMonthB2B = lastMonthDlvs.reduce((s, d) => s + dlvRev(d), 0);

  const thisMonthQuotes = quotesForMetrics.filter((q) => q.created_at >= thisMonthStart);
  const lastMonthQuotes = quotesForMetrics.filter(
    (q) => q.created_at >= lastMonthStart && q.created_at < thisMonthStart,
  );

  const tmAccepted = thisMonthQuotes.filter((q) => q.status === "accepted").length;
  const tmTerminal = thisMonthQuotes.filter((q) => ["accepted", "expired", "declined"].includes(q.status)).length;
  const thisMonthConversion = tmTerminal > 0 ? Math.round((tmAccepted / tmTerminal) * 100) : 0;

  const lmAccepted = lastMonthQuotes.filter((q) => q.status === "accepted").length;
  const lmTerminal = lastMonthQuotes.filter((q) => ["accepted", "expired", "declined"].includes(q.status)).length;
  const lastMonthConversion = lmTerminal > 0 ? Math.round((lmAccepted / lmTerminal) * 100) : 0;

  const avgDays = (quotes: typeof quotesForMetrics) => {
    const accepted = quotes.filter((q) => q.status === "accepted" && q.accepted_at);
    if (!accepted.length) return 0;
    const total = accepted.reduce((s, q) => {
      return s + (new Date(q.accepted_at!).getTime() - new Date(q.created_at).getTime()) / 86_400_000;
    }, 0);
    return Math.round((total / accepted.length) * 10) / 10;
  };
  const avgDaysThis = avgDays(thisMonthQuotes);
  const avgDaysLast = avgDays(lastMonthQuotes);

  const daysPassed = now.getDate();
  const thisMonthUtil = daysPassed * totalCrews > 0
    ? Math.round(((thisMonthMoves.length + thisMonthDlvs.length) / (daysPassed * totalCrews)) * 100)
    : 0;
  const lastDaysInMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const lastMonthUtil = lastDaysInMonth * totalCrews > 0
    ? Math.round(((lastMonthMoves.length + lastMonthDlvs.length) / (lastDaysInMonth * totalCrews)) * 100)
    : 0;

  const openClaimsValue = openClaims.reduce((s, c: Record<string, unknown>) => s + Number(c.amount || 0), 0);

  return NextResponse.json({
    pipeline: {
      confirmed: {
        total: Math.round(confirmedMoveTotal + confirmedDlvTotal),
        moveCount: confirmedMoves.length,
        moveRevenue: Math.round(confirmedMoveTotal),
        deliveryCount: confirmedDlvs.length,
        deliveryRevenue: Math.round(confirmedDlvTotal),
      },
      projected: {
        total: Math.round(projectedQuoteTotal + pendingDlvTotal * 0.6),
        quoteCount: activeQuotes.length,
        quoteRevenue: Math.round(projectedQuoteTotal),
        partnerRequestCount: pendingDlvs.length,
        partnerRevenue: Math.round(pendingDlvTotal * 0.6),
        highProb,
        midProb,
        lowProb,
      },
      potential: {
        total: Math.round(leadsEstimate * 0.3),
        leadCount: leads.length,
        rawEstimate: Math.round(leadsEstimate),
      },
    },
    dailyRevenue,
    capacity,
    seasonal,
    seasonalTip,
    metrics: {
      confirmedRevenue: {
        thisMonth: Math.round(thisMonthConfirmed),
        lastMonth: Math.round(lastMonthConfirmed),
        change: pctChange(thisMonthConfirmed, lastMonthConfirmed),
      },
      b2bRevenue: {
        thisMonth: Math.round(thisMonthB2B),
        lastMonth: Math.round(lastMonthB2B),
        change: pctChange(thisMonthB2B, lastMonthB2B),
      },
      avgDaysToBook: {
        thisMonth: avgDaysThis,
        lastMonth: avgDaysLast,
        change: pctChange(avgDaysThis, avgDaysLast),
      },
      conversionRate: {
        thisMonth: thisMonthConversion,
        lastMonth: lastMonthConversion,
        change: pctChange(thisMonthConversion, lastMonthConversion),
      },
      widgetLeads: {
        thisMonth: widgetLeadsThisMonth,
        lastMonth: null,
        change: null,
      },
      capacityUtilization: {
        thisMonth: thisMonthUtil,
        lastMonth: lastMonthUtil,
        change: pctChange(thisMonthUtil, lastMonthUtil),
      },
      openClaims: {
        thisMonth: openClaimsValue,
        lastMonth: 0,
        change: null,
      },
    },
  });
}
