/**
 * Lists quotes that would receive each follow-up stage on the next cron run (same DB filters).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";

export type DueFollowupRow = { quote_id: string; stage: 1 | 2 | 3 };

function contactHasEmail(contacts: unknown): boolean {
  if (contacts == null) return false;
  const c = Array.isArray(contacts)
    ? (contacts as { email?: string | null }[])[0]
    : (contacts as { email?: string | null });
  return Boolean(c?.email?.trim());
}

export async function getDueFollowupsPreview(): Promise<DueFollowupRow[]> {
  const supabase = createAdminClient();
  const now = new Date();
  const cfg = await getFeatureConfig(["followup_max_attempts"]);
  const maxAttempts = Math.max(0, parseInt(cfg.followup_max_attempts, 10) || 3);

  const out: DueFollowupRow[] = [];

  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rule1 } = await supabase
    .from("quotes")
    .select("quote_id, contacts:contact_id(name, email, phone)")
    .eq("status", "sent")
    .eq("auto_followup_active", true)
    .lt("sent_at", cutoff24h)
    .is("viewed_at", null)
    .is("followup_1_sent", null)
    .limit(50);

  for (const q of rule1 ?? []) {
    if (contactHasEmail(q.contacts)) out.push({ quote_id: q.quote_id, stage: 1 });
  }

  if (maxAttempts >= 2) {
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { data: rule2 } = await supabase
      .from("quotes")
      .select("quote_id, contacts:contact_id(name, email, phone)")
      .eq("status", "viewed")
      .eq("auto_followup_active", true)
      .lt("viewed_at", cutoff48h)
      .is("accepted_at", null)
      .is("followup_2_sent", null)
      .limit(50);
    for (const q of rule2 ?? []) {
      if (contactHasEmail(q.contacts)) out.push({ quote_id: q.quote_id, stage: 2 });
    }
  }

  if (maxAttempts >= 3) {
    const cutoff5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rule3 } = await supabase
      .from("quotes")
      .select("quote_id, contacts:contact_id(name, email, phone)")
      .in("status", ["viewed", "sent"])
      .eq("auto_followup_active", true)
      .lt("viewed_at", cutoff5d)
      .is("accepted_at", null)
      .is("followup_3_sent", null)
      .limit(50);
    for (const q of rule3 ?? []) {
      if (contactHasEmail(q.contacts)) out.push({ quote_id: q.quote_id, stage: 3 });
    }
  }

  return out;
}
