import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { quoteComparisonSignalAdminEmailHtml } from "@/lib/email/admin-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";

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

function tierPricesFromQuoteRow(q: Record<string, unknown>): {
  essential: number;
  signature: number;
  estate: number;
} {
  const tiers = (q.tiers || {}) as Record<string, { price?: unknown } | undefined>;
  const num = (x: unknown) => {
    const n = Number(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const essential =
    num(tiers.essential?.price) ||
    num(tiers.curated?.price) ||
    num(tiers.essentials?.price) ||
    num(q.essential_price);
  const signature = num(tiers.signature?.price) || num(tiers.premier?.price);
  const estate = num(tiers.estate?.price);
  return { essential, signature, estate };
}

function formatMoveDateLabel(moveDate: string | null | undefined): string {
  if (!moveDate || typeof moveDate !== "string") return "";
  const d = moveDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return moveDate;
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day);
  if (Number.isNaN(dt.getTime())) return moveDate;
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Daily cron: notify coordinators when a quote shows comparison shopping patterns.
 */
export async function runQuoteComparisonCron(sb: SupabaseClient): Promise<{ scanned: number; notified: number }> {
  const { data: quotes } = await sb
    .from("quotes")
    .select(
      "id, quote_id, comparison_alert_sent_at, contact_id, tiers, move_date, from_address, to_address, move_size, essential_price",
    )
    .in("status", ["sent", "viewed", "reactivated"])
    .is("comparison_alert_sent_at", null)
    .limit(80);

  let notified = 0;
  for (const q of quotes ?? []) {
    const metrics = await computeQuoteEngagementMetrics(sb, q.id as string);
    if (!metrics.comparingRecommended) continue;

    const { data: contact } = q.contact_id
      ? await sb
          .from("contacts")
          .select("name, email, phone")
          .eq("id", q.contact_id as string)
          .maybeSingle()
      : { data: null };

    const fullName = (contact?.name || "").trim() || "Client";
    const first = fullName.split(/\s+/)[0] || "Client";
    const publicQuoteId = String(q.quote_id);
    const tierPrices = tierPricesFromQuoteRow(q as Record<string, unknown>);
    const topTierEntry = Object.entries(metrics.tierClickCounts).sort((a, b) => b[1] - a[1])[0];
    const topTierShort = topTierEntry?.[0] ?? "";

    const description = [
      `${metrics.pageViewCount} views · ${metrics.distinctViewDays} day(s) active`,
      topTierShort ? ` · strongest: ${topTierShort}` : "",
    ].join("");

    const lastEngagementLabel = metrics.lastEngagementAt
      ? new Date(metrics.lastEngagementAt).toLocaleString("en-CA", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Unknown";

    const baseUrl = getEmailBaseUrl();
    const adminQuoteUrl = `${baseUrl}/admin/quotes/${encodeURIComponent(publicQuoteId)}`;

    const html = quoteComparisonSignalAdminEmailHtml({
      clientFirstName: first,
      clientFullName: fullName,
      clientEmail: (contact?.email || "").trim(),
      clientPhone: (contact?.phone || "").trim(),
      publicQuoteId,
      moveDateLabel: formatMoveDateLabel(q.move_date as string | null | undefined),
      moveSizeLabel: String(q.move_size || "").trim(),
      fromAddress: String(q.from_address || "").trim(),
      toAddress: String(q.to_address || "").trim(),
      tierPrices,
      viewCount: metrics.pageViewCount,
      uniqueDays: metrics.distinctViewDays,
      tierClickCounts: metrics.tierClickCounts,
      maxSessionSeconds: metrics.maxSessionSeconds,
      lastEngagementLabel,
      adminQuoteUrl,
    });

    const contactEmail = (contact?.email || "").trim();
    const excludeRecipientEmails = contactEmail ? [contactEmail.toLowerCase()] : [];

    await notifyAdmins("quote_comparison_signal", {
      quoteId: publicQuoteId,
      sourceId: q.id,
      subject: `${first} may be comparing quotes · ${publicQuoteId}`,
      description,
      clientName: first,
      html,
      excludeRecipientEmails,
    }).catch(() => {});

    await sb
      .from("quotes")
      .update({ comparison_alert_sent_at: new Date().toISOString() })
      .eq("id", q.id as string);
    notified++;
  }

  return { scanned: quotes?.length ?? 0, notified };
}
