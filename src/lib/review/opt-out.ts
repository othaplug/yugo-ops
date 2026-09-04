import { SupabaseClient } from "@supabase/supabase-js";

/** Digits-only phone key so "(647) 370-4525" and "6473704525" match one opt-out. */
export function normalizeReviewPhone(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function normalizeReviewEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/**
 * Permanent, per-contact review suppression, honoured across every future job.
 * A client who unsubscribes (email) or replies STOP (SMS) is never asked again.
 * Matches on either the normalized email or the digits-only phone.
 */
export async function isReviewOptedOut(
  supabase: SupabaseClient,
  contact: { email?: string | null; phone?: string | null },
): Promise<boolean> {
  const email = normalizeReviewEmail(contact.email);
  const phone = normalizeReviewPhone(contact.phone);
  if (!email && !phone) return false;

  const ors: string[] = [];
  if (email) ors.push(`email.eq.${email}`);
  if (phone) ors.push(`phone.eq.${phone}`);

  const { data } = await supabase
    .from("review_opt_outs")
    .select("id")
    .or(ors.join(","))
    .limit(1)
    .maybeSingle();

  return !!data;
}

/** Record a permanent opt-out. Idempotent on the unique email / phone indexes. */
export async function recordReviewOptOut(
  supabase: SupabaseClient,
  contact: { email?: string | null; phone?: string | null; reason?: string },
): Promise<void> {
  const email = normalizeReviewEmail(contact.email);
  const phone = normalizeReviewPhone(contact.phone);
  if (!email && !phone) return;
  await supabase
    .from("review_opt_outs")
    .upsert(
      { email, phone, reason: contact.reason || null },
      { onConflict: email ? "email" : "phone", ignoreDuplicates: true },
    );
}
