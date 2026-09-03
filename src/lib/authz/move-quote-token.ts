import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify that `token` is the public_action_token of the quote that a move was
 * booked from — the client's per-booking secret. Used to authorize the client
 * scheduling routes, which act on a move by its UUID and previously had no auth
 * at all (anyone with the UUID could read/reschedule a victim's move).
 */
export async function verifyMoveQuoteToken(
  admin: SupabaseClient,
  moveId: string | null | undefined,
  token: string | null | undefined,
): Promise<boolean> {
  const id = String(moveId ?? "").trim();
  const tok = String(token ?? "").trim();
  if (!id || !tok) return false;
  const { data: move } = await admin.from("moves").select("quote_id").eq("id", id).single();
  const quoteId = (move?.quote_id as string | null) ?? null;
  if (!quoteId) return false;
  const { data: quote } = await admin
    .from("quotes")
    .select("public_action_token")
    .eq("id", quoteId)
    .single();
  const stored = (quote?.public_action_token as string | null)?.trim();
  return !!stored && stored === tok;
}
