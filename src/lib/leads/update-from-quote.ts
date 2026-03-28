import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When a quote is sent to the client, link the lead and record first response metrics.
 */
export async function updateLeadAfterQuoteSent(
  sb: SupabaseClient,
  opts: {
    leadId: string;
    quoteUuid: string;
    performedByUserId?: string | null;
  }
): Promise<void> {
  const { data: lead } = await sb.from("leads").select("id, created_at, first_response_at").eq("id", opts.leadId).single();
  if (!lead) return;

  const now = new Date().toISOString();
  const firstAt = lead.first_response_at as string | null;
  const createdAt = new Date(lead.created_at as string).getTime();
  const patch: Record<string, unknown> = {
    status: "quote_sent",
    quote_uuid: opts.quoteUuid,
    response_method: "quote_sent",
  };

  if (!firstAt) {
    patch.first_response_at = now;
    patch.response_time_seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  }

  await sb.from("leads").update(patch).eq("id", opts.leadId);

  await sb.from("lead_activities").insert({
    lead_id: opts.leadId,
    activity_type: "quote_sent",
    performed_by: opts.performedByUserId ?? null,
    notes: null,
  });
}
