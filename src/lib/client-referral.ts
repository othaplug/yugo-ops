import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a client_referral for the given move if the client doesn't already have one.
 * Call this when a move is completed so the referral code is available on the dashboard immediately.
 */
export async function createClientReferralIfNeeded(
  admin: SupabaseClient,
  moveId: string
): Promise<void> {
  const { data: move } = await admin
    .from("moves")
    .select("id, client_email, client_name, client_phone")
    .eq("id", moveId)
    .single();

  if (!move?.client_email) return;

  const { data: existingRef } = await admin
    .from("client_referrals")
    .select("id")
    .eq("referrer_email", move.client_email)
    .limit(1);

  if (existingRef?.length) return;

  const firstName = (move.client_name || "CLIENT")
    .split(" ")[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `YUGO-${firstName}-${rand}`;

  await admin.from("client_referrals").insert({
    referrer_move_id: move.id,
    referrer_name: move.client_name ?? "Client",
    referrer_email: move.client_email,
    referrer_phone: move.client_phone || null,
    referral_code: code,
    status: "active",
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
