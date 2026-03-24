import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const supabase = createAdminClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: recentQuotes } = await supabase
      .from("quotes")
      .select("id, status, selected_tier, factors_applied, created_at")
      .gte("created_at", thirtyDaysAgo);

    const quotes = recentQuotes || [];
    const total = quotes.length;
    const accepted = quotes.filter((q) => q.status === "accepted").length;
    const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    const tierCounts: Record<string, number> = {};
    for (const q of quotes) {
      if (q.selected_tier) tierCounts[q.selected_tier] = (tierCounts[q.selected_tier] || 0) + 1;
    }
    const mostQuotedTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    const { data: analytics } = await supabase
      .from("quote_analytics")
      .select("outcome, lost_reason, quoted_amount, neighbourhood_tier")
      .gte("created_at", thirtyDaysAgo);

    const rows = analytics || [];
    const amounts = rows.filter((r) => r.quoted_amount).map((r) => Number(r.quoted_amount));
    const avgQuoteAmount = amounts.length > 0 ? Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length) : 0;

    const hoodWins: Record<string, { won: number; total: number }> = {};
    for (const r of rows) {
      const hood = r.neighbourhood_tier || "unknown";
      if (!hoodWins[hood]) hoodWins[hood] = { won: 0, total: 0 };
      hoodWins[hood].total++;
      if (r.outcome === "won") hoodWins[hood].won++;
    }
    const hoodEntries = Object.entries(hoodWins).filter(([, v]) => v.total >= 2);
    const highestConvertingHood = hoodEntries.sort((a, b) => (b[1].won / b[1].total) - (a[1].won / a[1].total))[0];
    const lowestConvertingHood = hoodEntries.sort((a, b) => (a[1].won / a[1].total) - (b[1].won / b[1].total))[0];

    const lostReasons: Record<string, number> = {};
    for (const r of rows) {
      if (r.outcome === "lost" && r.lost_reason) {
        lostReasons[r.lost_reason] = (lostReasons[r.lost_reason] || 0) + 1;
      }
    }
    const totalLost = Object.values(lostReasons).reduce((s, v) => s + v, 0);
    const topLostEntry = Object.entries(lostReasons).sort((a, b) => b[1] - a[1])[0];
    const topLostReason = topLostEntry
      ? `${topLostEntry[0]} (${totalLost > 0 ? Math.round((topLostEntry[1] / totalLost) * 100) : 0}%)`
      : "-";

    return NextResponse.json({
      quotesSent: total,
      conversionRate,
      avgQuoteAmount,
      mostQuotedTier,
      highestConvertingHood: highestConvertingHood
        ? `${highestConvertingHood[0]} (${Math.round((highestConvertingHood[1].won / highestConvertingHood[1].total) * 100)}%)`
        : "-",
      lowestConvertingHood: lowestConvertingHood
        ? `${lowestConvertingHood[0]} (${Math.round((lowestConvertingHood[1].won / lowestConvertingHood[1].total) * 100)}%)`
        : "-",
      topLostReason,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
