import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { quotePipelineListedValue } from "@/lib/finance/revenue-forecast-amounts";

/** All terminal quote outcomes that count toward conversion denominator. */
const DECIDED_STATUSES = new Set([
  // positive
  "accepted", "confirmed", "booked", "paid",
  // negative / coordinator-marked
  "expired", "declined", "lost", "cold",
]);

/** Hood win rate includes coordinator terminal outcomes so priced quotes are not dropped from geography stats. */
const HOOD_DECIDED_STATUSES = new Set([
  "accepted",
  "expired",
  "declined",
  "lost",
  "cold",
]);

const LOSS_REASON_LABEL: Record<string, string> = {
  competitor: "Went with competitor",
  postponed: "Move postponed",
  budget: "Over budget",
  no_response: "No response",
  other: "Other",
};

/** Extract the best available price for a quote row, including factors_applied fallback. */
function extractQuotePrice(q: {
  custom_price?: unknown;
  override_price?: unknown;
  system_price?: unknown;
  tiers?: unknown;
  essential_price?: unknown;
  factors_applied?: unknown;
}): number {
  const base = quotePipelineListedValue(q);
  if (base > 0) return base;
  const f = q.factors_applied;
  if (!f || typeof f !== "object") return 0;
  const factors = f as Record<string, unknown>;
  const sp = Number(factors.system_price);
  if (Number.isFinite(sp) && sp > 0) return sp;
  const cp = Number(factors.custom_price);
  if (Number.isFinite(cp) && cp > 0) return cp;
  return 0;
}

function neighbourhoodTierFromQuote(q: { factors_applied?: unknown }): string | null {
  const raw = q.factors_applied;
  if (raw == null) return null;
  try {
    const f =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>);
    const tier = f.neighbourhood_tier;
    if (typeof tier === "string" && tier.trim()) return tier.trim();
  } catch {
    /* ignore */
  }
  return null;
}

function normalizeLostReasonKey(reason: string): string {
  const s = reason.trim();
  if (!s) return "";
  const base = s.split(":")[0]?.trim().toLowerCase() ?? "";
  return base || s.toLowerCase();
}

function formatLostReasonLabel(key: string): string {
  return LOSS_REASON_LABEL[key] ?? key;
}

export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const supabase = createAdminClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const QUOTE_FIELDS =
      "id, status, selected_tier, recommended_tier, factors_applied, created_at, service_type, custom_price, override_price, system_price, tiers, essential_price, labour_rate_per_mover, labour_validation_status, loss_reason";

    const [
      { count: quotesLast30 },
      { count: movesLast30 },
      { count: deliveriesLast30 },
      { data: allQuotesData, error: quotesErr },
    ] = await Promise.all([
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("moves")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo),
      supabase
        .from("quotes")
        .select(QUOTE_FIELDS)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (quotesErr) {
      console.error("[analytics] quotes query failed:", quotesErr.message);
    }

    const quotes = allQuotesData || [];
    const total = quotesLast30 ?? 0;
    const acceptedAll = quotes.filter((q) => q.status === "accepted").length;
    const decidedAll = quotes.filter((q) => DECIDED_STATUSES.has(String(q.status))).length;
    const conversionRate =
      decidedAll > 0 ? Math.round((acceptedAll / decidedAll) * 100) : 0;

    const tierCounts: Record<string, number> = {};
    for (const q of quotes) {
      const tier = String(q.selected_tier || q.recommended_tier || "").trim();
      if (!tier) continue;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }
    const mostQuotedTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    const listedAmounts = quotes.map((q) => extractQuotePrice(q)).filter((v) => v > 0);
    const avgQuoteAmount =
      listedAmounts.length > 0
        ? Math.round(listedAmounts.reduce((s, v) => s + v, 0) / listedAmounts.length)
        : 0;

    const hoodWins: Record<string, { won: number; decided: number }> = {};
    for (const q of quotes) {
      const hood = neighbourhoodTierFromQuote(q);
      if (!hood) continue;
      if (!HOOD_DECIDED_STATUSES.has(String(q.status))) continue;
      if (!hoodWins[hood]) hoodWins[hood] = { won: 0, decided: 0 };
      hoodWins[hood].decided++;
      if (q.status === "accepted") hoodWins[hood].won++;
    }
    const hoodEntries = Object.entries(hoodWins).filter(([, v]) => v.decided >= 1);
    const sortedByRate = [...hoodEntries].sort(
      (a, b) => b[1].won / b[1].decided - a[1].won / a[1].decided,
    );
    const sortedByRateAsc = [...hoodEntries].sort(
      (a, b) => a[1].won / a[1].decided - b[1].won / b[1].decided,
    );
    const highestConvertingHood = sortedByRate[0];
    const lowestConvertingHood = sortedByRateAsc[0];

    const { data: analytics } = await supabase
      .from("quote_analytics")
      .select("outcome, lost_reason, quoted_amount, neighbourhood_tier");

    const rows = analytics || [];

    const lostReasons: Record<string, number> = {};
    for (const r of rows) {
      if (r.outcome === "lost" && r.lost_reason) {
        const key = normalizeLostReasonKey(String(r.lost_reason));
        if (key) lostReasons[key] = (lostReasons[key] || 0) + 1;
      }
    }
    for (const q of quotes) {
      if (q.status === "lost" && q.loss_reason) {
        const key = normalizeLostReasonKey(String(q.loss_reason));
        if (key) lostReasons[key] = (lostReasons[key] || 0) + 1;
      }
    }
    const totalLost = Object.values(lostReasons).reduce((s, v) => s + v, 0);
    const topLostEntry = Object.entries(lostReasons).sort((a, b) => b[1] - a[1])[0];
    const topLostReason = topLostEntry
      ? `${formatLostReasonLabel(topLostEntry[0])} (${totalLost > 0 ? Math.round((topLostEntry[1] / totalLost) * 100) : 0}%)`
      : "-";

    const labourRows = (quotes || []).filter(
      (q) => q.labour_rate_per_mover != null && q.labour_validation_status != null,
    );
    const labourWithRate = labourRows.filter((q) => Number(q.labour_rate_per_mover) > 0);
    const labourTotal = labourWithRate.length;
    const aboveCeiling = labourWithRate.filter((q) => q.labour_validation_status === "above_ceiling").length;
    const belowFloor = labourWithRate.filter((q) => q.labour_validation_status === "below_floor").length;

    const avgByService: Record<string, { sum: number; n: number }> = {};
    for (const q of labourWithRate) {
      const st = (q.service_type as string) || "unknown";
      const rate = Number(q.labour_rate_per_mover);
      if (!avgByService[st]) avgByService[st] = { sum: 0, n: 0 };
      avgByService[st].sum += rate;
      avgByService[st].n++;
    }
    const labourAvgByService = Object.fromEntries(
      Object.entries(avgByService).map(([k, v]) => [
        k,
        v.n > 0 ? Math.round((v.sum / v.n) * 10) / 10 : 0,
      ]),
    );

    const aboveByService: Record<string, number> = {};
    for (const q of labourWithRate) {
      if (q.labour_validation_status !== "above_ceiling") continue;
      const st = (q.service_type as string) || "unknown";
      aboveByService[st] = (aboveByService[st] || 0) + 1;
    }
    const topAboveCeilingService = Object.entries(aboveByService).sort((a, b) => b[1] - a[1])[0];

    return NextResponse.json({
      quotesSent: total,
      movesLast30: (movesLast30 ?? 0) + (deliveriesLast30 ?? 0),
      conversionRate,
      avgQuoteAmount,
      mostQuotedTier,
      highestConvertingHood: highestConvertingHood
        ? `${highestConvertingHood[0]} (${Math.round((highestConvertingHood[1].won / highestConvertingHood[1].decided) * 100)}%)`
        : "-",
      lowestConvertingHood: lowestConvertingHood
        ? `${lowestConvertingHood[0]} (${Math.round((lowestConvertingHood[1].won / lowestConvertingHood[1].decided) * 100)}%)`
        : "-",
      topLostReason,
      labourAnalytics: {
        quotesWithLabourCheck: labourTotal,
        pctAboveCeiling: labourTotal > 0 ? Math.round((aboveCeiling / labourTotal) * 100) : 0,
        pctBelowFloor: labourTotal > 0 ? Math.round((belowFloor / labourTotal) * 100) : 0,
        countAboveCeiling: aboveCeiling,
        countBelowFloor: belowFloor,
        avgRateByService: labourAvgByService,
        topAboveCeilingService: topAboveCeilingService
          ? { service_type: topAboveCeilingService[0], count: topAboveCeilingService[1] }
          : null,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
