import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmins } from "@/lib/notifications/dispatch";

export type QuoteEngagementMetrics = {
  pageViewCount: number;
  distinctViewDays: number;
  tierClickCounts: Record<string, number>;
  maxSessionSeconds: number;
  maxScrollPct: number;
  lastEngagementAt: string | null;
  comparingRecommended: boolean;
  comparingLabel: string;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Aggregate quote_engagement rows for admin UI and comparison heuristics.
 */
export async function computeQuoteEngagementMetrics(
  sb: SupabaseClient,
  quoteInternalId: string,
): Promise<QuoteEngagementMetrics> {
  const { data: rows } = await sb
    .from("quote_engagement")
    .select("event_type, event_data, session_duration_seconds, created_at")
    .eq("quote_id", quoteInternalId)
    .order("created_at", { ascending: true });

  const pageViewDays = new Set<string>();
  let pageViewCount = 0;
  const tierClickCounts: Record<string, number> = {};
  let maxSessionSeconds = 0;
  let maxScrollPct = 0;
  let lastEngagementAt: string | null = null;

  for (const r of rows ?? []) {
    const t = String(r.event_type || "");
    const created = String(r.created_at || "");
    if (created) lastEngagementAt = created;

    if (r.session_duration_seconds != null && r.session_duration_seconds > maxSessionSeconds) {
      maxSessionSeconds = r.session_duration_seconds;
    }

    const data = (r.event_data || {}) as Record<string, unknown>;

    if (t === "page_view") {
      pageViewCount++;
      if (created.length >= 10) pageViewDays.add(dayKey(created));
    }

    if (t === "engagement_ping") {
      const sp = typeof data.scroll_pct === "number" ? data.scroll_pct : Number(data.scroll_pct);
      if (Number.isFinite(sp)) maxScrollPct = Math.max(maxScrollPct, sp);
      const el = typeof data.elapsed_seconds === "number" ? data.elapsed_seconds : Number(data.elapsed_seconds);
      if (Number.isFinite(el)) maxSessionSeconds = Math.max(maxSessionSeconds, el);
      if (created.length >= 10) pageViewDays.add(dayKey(created));
    }

    if (t === "tier_clicked") {
      const tier = typeof data.tier === "string" ? data.tier.toLowerCase().trim() : "";
      if (tier) tierClickCounts[tier] = (tierClickCounts[tier] || 0) + 1;
    }
  }

  const distinctViewDays = pageViewDays.size;
  const tierClickTotal = Object.values(tierClickCounts).reduce((a, b) => a + b, 0);
  const comparingRecommended =
    (pageViewCount >= 3 && distinctViewDays >= 2) || tierClickTotal >= 4;

  let comparingLabel = "No strong comparison signal";
  if (comparingRecommended) {
    comparingLabel = "Comparing — call recommended";
  } else if (pageViewCount >= 2 || tierClickTotal >= 2) {
    comparingLabel = "Moderate interest";
  }

  return {
    pageViewCount,
    distinctViewDays,
    tierClickCounts,
    maxSessionSeconds,
    maxScrollPct,
    lastEngagementAt,
    comparingRecommended,
    comparingLabel,
  };
}

/**
 * Daily cron: notify coordinators when a quote shows comparison shopping patterns.
 */
export async function runQuoteComparisonCron(sb: SupabaseClient): Promise<{ scanned: number; notified: number }> {
  const { data: quotes } = await sb
    .from("quotes")
    .select("id, quote_id, comparison_alert_sent_at, contact_id")
    .in("status", ["sent", "viewed", "reactivated"])
    .is("comparison_alert_sent_at", null)
    .limit(80);

  let notified = 0;
  for (const q of quotes ?? []) {
    const metrics = await computeQuoteEngagementMetrics(sb, q.id as string);
    if (!metrics.comparingRecommended) continue;

    const { data: contact } = q.contact_id
      ? await sb.from("contacts").select("name").eq("id", q.contact_id as string).maybeSingle()
      : { data: null };

    const first = (contact?.name || "").trim().split(/\s+/)[0] || "Client";
    const tierParts = Object.entries(metrics.tierClickCounts)
      .map(([k, v]) => `${k} ${v}×`)
      .join(", ");
    const body = `Viewed ${metrics.pageViewCount} times across ${metrics.distinctViewDays} day(s).${
      tierParts ? ` Tier clicks: ${tierParts}.` : ""
    } Max time on page ~${Math.max(metrics.maxSessionSeconds, 0)}s.`;

    await notifyAdmins("quote_comparison_signal", {
      quoteId: String(q.quote_id),
      sourceId: q.id,
      subject: `${first} may be comparing quotes`,
      description: body,
      clientName: first,
    }).catch(() => {});

    await sb
      .from("quotes")
      .update({ comparison_alert_sent_at: new Date().toISOString() })
      .eq("id", q.id as string);
    notified++;
  }

  return { scanned: quotes?.length ?? 0, notified };
}
