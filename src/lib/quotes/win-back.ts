import type { SupabaseClient } from "@supabase/supabase-js";

/** Delay in days before sending win-back email, keyed by normalized reason. */
export const WIN_BACK_DELAYS: Record<string, number> = {
  found_another: 180,
  postponed: 90,
  diy: 60,
  no_response: 90,
  budget: 90,
  other: 120,
};

const DEFAULT_WIN_BACK_DAYS = 120;

/**
 * Map decline_reason, loss_reason, or free-text (e.g. "other: notes") to a delay key.
 */
export function normalizeWinBackReasonKey(raw: string | null | undefined): string {
  if (!raw || !String(raw).trim()) return "other";
  const s = String(raw).trim().toLowerCase();
  const head = s.split(":")[0]?.trim() || s;
  if (WIN_BACK_DELAYS[head] != null) return head;
  if (head.includes("postpon")) return "postponed";
  if (head.includes("diy") || head.includes("themselves")) return "diy";
  if (head.includes("found") && head.includes("another")) return "found_another";
  if (head.includes("budget") || head.includes("price")) return "budget";
  return "other";
}

export function winBackDelayDaysForKey(key: string): number {
  return WIN_BACK_DELAYS[key] ?? DEFAULT_WIN_BACK_DAYS;
}

/**
 * Schedule a single pending win-back email for a quote (internal UUID).
 * Skips if a pending win_back row already exists or quote is not lost/declined.
 */
export async function scheduleWinBackEmail(
  sb: SupabaseClient,
  quoteInternalId: string,
  reasonRaw: string | null | undefined,
): Promise<void> {
  const key = normalizeWinBackReasonKey(reasonRaw);
  const delayDays = winBackDelayDaysForKey(key);

  const { data: quote } = await sb
    .from("quotes")
    .select("id, status")
    .eq("id", quoteInternalId)
    .maybeSingle();

  if (!quote) return;
  const st = String(quote.status || "").toLowerCase();
  if (st !== "lost" && st !== "declined") return;

  const { data: existing } = await sb
    .from("scheduled_emails")
    .select("id")
    .eq("quote_id", quoteInternalId)
    .eq("type", "win_back")
    .eq("status", "pending")
    .limit(1);

  if (existing && existing.length > 0) return;

  const sendAt = new Date();
  sendAt.setDate(sendAt.getDate() + delayDays);

  const { error } = await sb.from("scheduled_emails").insert({
    quote_id: quoteInternalId,
    type: "win_back",
    scheduled_for: sendAt.toISOString(),
    status: "pending",
    metadata: { reason_key: key },
  });

  if (error) {
    console.error("[win-back] schedule insert failed:", error.message);
  }
}
