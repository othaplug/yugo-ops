import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/**
 * Client-facing activity feed for a move.
 *
 * Synthesizes a single chronological timeline from disparate tables
 * (`quotes`, `payment_transactions`, `extra_items`,
 * `inventory_change_requests`, the `moves` row itself) so the client can
 * see every event since they accepted the quote in one place.
 *
 * Why a synthesizer instead of a dedicated `move_events` table:
 *   - Every event we care about is already persisted somewhere with a
 *     timestamp — we just need to read and merge.
 *   - A new event table introduces a write-amplification risk (every state
 *     change has to remember to log) and would replay history we already
 *     have.
 *   - Synthesizing on-demand keeps the storage layer small. If query cost
 *     ever matters we can cache the response per-move; for now this runs
 *     once per dashboard load.
 *
 * Driven by P0 of the Chidera Allison (MV-30228) call review on
 * 2026-06-23. Her exact words: "I'm flying blind if the dashboard isn't
 * accurate." This feed makes the dashboard authoritative for state
 * changes that previously only existed in the admin's head.
 */

export type ClientActivityEvent = {
  id: string;
  /** ISO timestamp — the feed renders newest-first by default. */
  at: string;
  /** Short noun phrase shown as the row title. */
  title: string;
  /** Optional secondary line (amount, item description, etc.). */
  detail?: string | null;
  /**
   * Category drives the icon + tone on the client side. Keep this set small
   * so the UI can switch on it exhaustively.
   */
  kind:
    | "quote_accepted"
    | "deposit_paid"
    | "balance_paid"
    | "refund_issued"
    | "scope_charge"
    | "items_requested"
    | "items_awaiting_client"
    | "items_approved"
    | "items_removed"
    | "schedule_changed"
    | "move_confirmed"
    | "move_completed";
  /** Optional dollar amount (positive for charges, negative for refunds). */
  amountCents?: number | null;
};

function fmtCurrency(cents: number | null | undefined): string {
  const n = Number(cents ?? 0);
  if (!Number.isFinite(n) || n === 0) return "";
  return `$${(Math.abs(n) / 100).toFixed(2)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [moveRes, paymentsRes, extrasRes, changesRes] = await Promise.all([
    admin
      .from("moves")
      .select(
        "id, status, quote_id, completed_at, payment_marked_paid_at, deposit_paid_at, balance_paid_at, created_at",
      )
      .eq("id", moveId)
      .maybeSingle(),
    admin
      .from("payment_transactions")
      .select("id, amount, type, label, created_at, payment_method")
      .eq("move_id", moveId)
      .order("created_at", { ascending: true }),
    admin
      .from("extra_items")
      .select("id, description, quantity, fee_cents, status, added_at, payment_charged")
      .eq("job_id", moveId)
      .eq("job_type", "move")
      .order("added_at", { ascending: true }),
    admin
      .from("inventory_change_requests")
      .select("id, payment_amount, status, created_at")
      .eq("move_id", moveId)
      .order("created_at", { ascending: true }),
  ]);

  const move = moveRes.data as
    | (Record<string, unknown> & {
        quote_id?: string | null;
        deposit_paid_at?: string | null;
        balance_paid_at?: string | null;
        completed_at?: string | null;
        created_at?: string | null;
      })
    | null;
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const events: ClientActivityEvent[] = [];

  // 1) Quote accepted — the start of the client's journey. Falls back to
  //    move.created_at if the linked quote row isn't reachable for some
  //    reason (deleted, regenerated, etc.).
  let quoteAcceptedAt: string | null = null;
  if (move.quote_id) {
    const { data: q } = await admin
      .from("quotes")
      .select("accepted_at, created_at")
      .eq("id", String(move.quote_id))
      .maybeSingle();
    quoteAcceptedAt = (q?.accepted_at as string | null) ?? null;
  }
  const journeyStart = quoteAcceptedAt ?? (move.created_at as string | null);
  if (journeyStart) {
    events.push({
      id: `accept-${moveId}`,
      at: journeyStart,
      title: "Quote accepted",
      detail: "Your move is booked.",
      kind: "quote_accepted",
    });
  }

  // 2) Payment transactions (deposit, balance, scope charges, refunds).
  //    type is the engine's classifier; label is admin-facing. We mirror
  //    them to a client-friendly title.
  const payments = (paymentsRes.data ?? []) as Array<{
    id: string;
    amount: number | null;
    type?: string | null;
    label?: string | null;
    created_at: string | null;
    payment_method?: string | null;
  }>;
  for (const tx of payments) {
    if (!tx.created_at) continue;
    const cents = Math.round(Number(tx.amount ?? 0) * 100);
    const t = String(tx.type || "").toLowerCase();
    if (t === "refund" || cents < 0) {
      events.push({
        id: `pay-${tx.id}`,
        at: tx.created_at,
        title: "Refund issued",
        detail: fmtCurrency(cents) || null,
        kind: "refund_issued",
        amountCents: cents,
      });
    } else if (t === "deposit") {
      events.push({
        id: `pay-${tx.id}`,
        at: tx.created_at,
        title: "Deposit paid",
        detail: fmtCurrency(cents) || null,
        kind: "deposit_paid",
        amountCents: cents,
      });
    } else if (t === "balance" || t === "final") {
      events.push({
        id: `pay-${tx.id}`,
        at: tx.created_at,
        title: "Balance paid",
        detail: fmtCurrency(cents) || null,
        kind: "balance_paid",
        amountCents: cents,
      });
    } else if (t === "scope_charge" || t === "extra_item" || t === "change_request") {
      events.push({
        id: `pay-${tx.id}`,
        at: tx.created_at,
        title: tx.label || "Scope charge",
        detail: fmtCurrency(cents) || null,
        kind: "scope_charge",
        amountCents: cents,
      });
    } else {
      // Unknown payment type — still surface so the client sees nothing is
      // hidden. Title falls back to a generic phrase.
      events.push({
        id: `pay-${tx.id}`,
        at: tx.created_at,
        title: tx.label || "Payment",
        detail: fmtCurrency(cents) || null,
        kind: cents > 0 ? "scope_charge" : "refund_issued",
        amountCents: cents,
      });
    }
  }

  // Fallback when no payment_transactions rows exist: synthesize deposit /
  // balance entries from the move row's *_paid_at columns. Many older flows
  // never wrote a transaction row.
  if (
    payments.length === 0 &&
    (move.deposit_paid_at || move.balance_paid_at)
  ) {
    if (move.deposit_paid_at) {
      events.push({
        id: `dep-${moveId}`,
        at: String(move.deposit_paid_at),
        title: "Deposit paid",
        kind: "deposit_paid",
      });
    }
    if (move.balance_paid_at) {
      events.push({
        id: `bal-${moveId}`,
        at: String(move.balance_paid_at),
        title: "Balance paid",
        kind: "balance_paid",
      });
    }
  }

  // 3) Extra items (requested / approved / removed).
  const extras = (extrasRes.data ?? []) as Array<{
    id: string;
    description?: string | null;
    quantity?: number | null;
    fee_cents?: number | null;
    status?: string | null;
    added_at: string | null;
    payment_charged?: boolean | null;
  }>;
  for (const x of extras) {
    if (!x.added_at) continue;
    const qty = Number(x.quantity ?? 1);
    const descBase = x.description?.trim() || "Extra item";
    const desc = qty > 1 ? `${qty}× ${descBase}` : descBase;
    const fee = fmtCurrency(x.fee_cents);
    const status = String(x.status || "").toLowerCase();
    if (status === "rejected" || status === "cancelled" || status === "removed") {
      events.push({
        id: `item-${x.id}`,
        at: x.added_at,
        title: "Item removed",
        detail: desc,
        kind: "items_removed",
      });
    } else if (status === "approved") {
      events.push({
        id: `item-${x.id}`,
        at: x.added_at,
        title: x.payment_charged ? "Items approved & charged" : "Items approved",
        detail: fee ? `${desc} · ${fee}` : desc,
        kind: "items_approved",
        amountCents: x.fee_cents ?? null,
      });
    } else if (status === "awaiting_client") {
      // Admin staged a fee — client has the email with Accept/Decline. The
      // activity feed mirrors that so the client sees it on the dashboard
      // too, not just buried in an email.
      events.push({
        id: `item-${x.id}`,
        at: x.added_at,
        title: "Awaiting your decision",
        detail: fee ? `${desc} · ${fee} — tap Accept in your email to approve` : desc,
        kind: "items_awaiting_client",
        amountCents: x.fee_cents ?? null,
      });
    } else {
      // Pending — client or crew requested but admin hasn't priced yet.
      events.push({
        id: `item-${x.id}`,
        at: x.added_at,
        title: "Items requested",
        detail: fee ? `${desc} · projected ${fee}` : `${desc} · fee TBD`,
        kind: "items_requested",
        amountCents: x.fee_cents ?? null,
      });
    }
  }

  // 4) Inventory change requests (crew-side walkthrough delta). Same shape
  //    as extras for client display purposes.
  const changes = (changesRes.data ?? []) as Array<{
    id: string;
    payment_amount?: number | null;
    status?: string | null;
    created_at: string | null;
  }>;
  for (const c of changes) {
    if (!c.created_at) continue;
    const cents = Math.round(Number(c.payment_amount ?? 0) * 100);
    const fee = fmtCurrency(cents);
    const s = String(c.status || "").toLowerCase();
    if (s === "approved") {
      events.push({
        id: `chg-${c.id}`,
        at: c.created_at,
        title: "Scope change approved",
        detail: fee || null,
        kind: "items_approved",
        amountCents: cents,
      });
    } else if (s === "rejected" || s === "cancelled") {
      events.push({
        id: `chg-${c.id}`,
        at: c.created_at,
        title: "Scope change cancelled",
        kind: "items_removed",
      });
    } else {
      events.push({
        id: `chg-${c.id}`,
        at: c.created_at,
        title: "Scope change requested",
        detail: fee ? `projected ${fee}` : null,
        kind: "items_requested",
        amountCents: cents,
      });
    }
  }

  // 5) Move completion is the natural cap.
  if (move.completed_at) {
    events.push({
      id: `done-${moveId}`,
      at: String(move.completed_at),
      title: "Move completed",
      kind: "move_completed",
    });
  }

  // Newest first — feeds read naturally as "what changed since I last
  // looked?" instead of "what happened way back when?"
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return NextResponse.json({ events });
}
