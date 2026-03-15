import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Backfill move.client_email (and optionally client_name) from linked quote -> contact.
 * Updates the move row so future requests have the email. Returns the email we have after backfill (move or from contact).
 */
export async function backfillMoveClientEmailFromQuote(
  admin: SupabaseClient,
  moveId: string
): Promise<{ email: string | null; name: string | null }> {
  const { data: move } = await admin
    .from("moves")
    .select("id, client_email, client_name, quote_id")
    .eq("id", moveId)
    .single();

  if (!move) return { email: null, name: null };
  const existingEmail = (move.client_email || "").trim();
  if (existingEmail) return { email: existingEmail, name: move.client_name ?? null };

  const quoteId = (move as { quote_id?: string | null }).quote_id;
  if (!quoteId) return { email: null, name: move.client_name ?? null };

  const { data: quote } = await admin
    .from("quotes")
    .select("id, contact_id")
    .eq("id", quoteId)
    .single();

  if (!quote?.contact_id) return { email: null, name: move.client_name ?? null };

  const { data: contact } = await admin
    .from("contacts")
    .select("email, name")
    .eq("id", quote.contact_id)
    .single();

  const email = (contact?.email || "").trim() || null;
  const name = (contact?.name || "").trim() || (move.client_name && move.client_name.trim()) || null;

  if (email) {
    await admin
      .from("moves")
      .update({
        client_email: email,
        ...(name && !(move.client_name || "").trim() ? { client_name: name } : {}),
      })
      .eq("id", moveId);
  }

  return { email, name };
}

/**
 * Create a client_referral for the given move if the client doesn't already have one.
 * Call this when a move is completed so the referral code is available on the dashboard immediately.
 * Deep flow: if move has no client_email, backfill from quote -> contact, then insert.
 */
export async function createClientReferralIfNeeded(
  admin: SupabaseClient,
  moveId: string
): Promise<void> {
  let move = await admin
    .from("moves")
    .select("id, client_email, client_name, client_phone")
    .eq("id", moveId)
    .single()
    .then((r) => r.data as { id: string; client_email?: string | null; client_name?: string | null; client_phone?: string | null } | null);

  if (!move) return;

  let clientEmail = (move.client_email || "").trim();
  if (!clientEmail) {
    const backfilled = await backfillMoveClientEmailFromQuote(admin, moveId);
    clientEmail = backfilled.email || "";
    if (backfilled.name) move = { ...move, client_name: move.client_name || backfilled.name };
  }
  if (!clientEmail) return;

  const { data: existingRef } = await admin
    .from("client_referrals")
    .select("id")
    .eq("referrer_email", clientEmail)
    .limit(1);

  if (existingRef?.length) return;

  const existingByMove = await admin
    .from("client_referrals")
    .select("id")
    .eq("referrer_move_id", moveId)
    .limit(1);
  if (existingByMove.data?.length) return;

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
    referrer_email: clientEmail,
    referrer_phone: move.client_phone || null,
    referral_code: code,
    status: "active",
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
