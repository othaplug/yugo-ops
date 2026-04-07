/**
 * Auto-cold rules for quote nurture — pauses follow-ups and alerts coordinators.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { notifyAdmins } from "@/lib/notifications/dispatch";

type AdminClient = ReturnType<typeof createAdminClient>;

async function countPageViews(sb: AdminClient, quoteInternalId: string): Promise<number> {
  const { count, error } = await sb
    .from("quote_engagement")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quoteInternalId)
    .eq("event_type", "page_view");
  if (error) return 0;
  return count ?? 0;
}

async function followupStats(sb: AdminClient, quoteInternalId: string): Promise<{
  sent: number;
  opens: number;
}> {
  const { data } = await sb
    .from("quote_followups")
    .select("email_opened")
    .eq("quote_id", quoteInternalId);
  const rows = data ?? [];
  return {
    sent: rows.length,
    opens: rows.filter((r) => r.email_opened).length,
  };
}

export async function markQuoteCold(
  sb: AdminClient,
  quote: {
    id: string;
    quote_id: string;
    hubspot_deal_id?: string | null;
    contact_id?: string | null;
  },
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await sb
    .from("quotes")
    .update({
      status: "cold",
      cold_reason: reason,
      auto_followup_active: false,
      went_cold_at: now,
      updated_at: now,
    })
    .eq("id", quote.id)
    .in("status", ["sent", "viewed", "draft", "reactivated"]);

  const { data: contact } = quote.contact_id
    ? await sb.from("contacts").select("name, email").eq("id", quote.contact_id).maybeSingle()
    : { data: null };

  const contactEmail = (contact?.email || "").trim();
  await notifyAdmins("quote_cold", {
    quoteId: quote.quote_id,
    sourceId: quote.id,
    description: `${quote.quote_id} went cold (${reason}). ${contact?.name ? `${contact.name} — ` : ""}Consider a quick call.`,
    clientName: contact?.name ?? undefined,
    excludeRecipientEmails: contactEmail ? [contactEmail.toLowerCase()] : [],
  }).catch(() => {});

  const hid = quote.hubspot_deal_id?.trim();
  if (hid) {
    await syncDealStage(hid, "cold").catch(() => {});
  }
}

/**
 * Evaluate nurture quotes for auto-cold (batch). Skips accepted / declined / lost / expired / cold.
 */
export async function processColdRules(sb: AdminClient): Promise<{ marked: number; errors: string[] }> {
  const errors: string[] = [];
  let marked = 0;
  const now = new Date();

  const { data: candidates } = await sb
    .from("quotes")
    .select("id, quote_id, hubspot_deal_id, contact_id, expires_at, status")
    .eq("auto_followup_active", true)
    .in("status", ["sent", "viewed", "reactivated"])
    .limit(80);

  for (const q of candidates ?? []) {
    try {
      const views = await countPageViews(sb, q.id);
      const fu = await followupStats(sb, q.id);
      const expired = q.expires_at ? new Date(q.expires_at) < now : false;

      // Rule 1: past expiry, never engaged on the quote page
      if (expired && views === 0) {
        await markQuoteCold(sb, q, "no_engagement");
        marked++;
        continue;
      }

      // Rule 2: 3+ follow-ups, no recorded opens
      if (fu.sent >= 3 && fu.opens === 0) {
        await markQuoteCold(sb, q, "no_opens_after_3");
        marked++;
        continue;
      }

      // Rule 3: 2+ follow-ups, 2+ opens, still no page views
      if (fu.sent >= 2 && fu.opens >= 2 && views === 0) {
        await markQuoteCold(sb, q, "opens_no_visit");
        marked++;
        continue;
      }

      // Rule 4: 2+ follow-ups and 2+ page views — high interest, no booking
      if (fu.sent >= 2 && views >= 2) {
        await markQuoteCold(sb, q, "viewed_no_action");
        marked++;
        continue;
      }
    } catch (e) {
      errors.push(`${q.quote_id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { marked, errors };
}
