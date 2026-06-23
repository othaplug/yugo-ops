/**
 * POST /api/admin/moves/[id]/scope-charge
 *
 * Super-admin-only endpoint for adding a mid-job scope charge (more items,
 * heavier handling, extra time) to an in-progress move. Reuses the existing
 * `inventory_change_requests` pipeline so the balance update, client
 * notification, and crew-side inventory propagation all behave the same as
 * a crew-walkthrough request — but auto-approved in a single request since
 * the super admin is both initiator and approver.
 *
 * Why a dedicated endpoint vs. POSTing /api/admin/inventory-change-requests
 * directly: this surface is explicitly for unplanned, real-time scope
 * additions during a live job. The body shape is admin-friendly (reason
 * checkboxes + a single dollar amount with HST flag) rather than the
 * crew-walkthrough shape (per-item surcharges). The handler converts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, isSuperAdminEmail } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";

type ScopeChargeItem = {
  /** Catalog slug if matched, otherwise leave undefined for a custom item. */
  slug?: string | null;
  item_name: string;
  weight_score?: number;
  quantity?: number;
};

type ScopeChargeBody = {
  /** Reason chips selected in the modal (more_items, heavier, extra_time, …). */
  reasons?: string[];
  /** Free-text note from the admin, shown to the client in the change notification. */
  note?: string | null;
  /** Optional itemized list when reason includes "more_items". */
  items?: ScopeChargeItem[];
  /** Total dollar amount of the charge. */
  charge_amount: number;
  /** When true, charge_amount is tax-inclusive and we back-calc HST. When false,
   *  charge_amount is pre-tax. */
  charge_includes_hst: boolean;
};

const HST_RATE = 0.13;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Gate: super admin only (regular admins shouldn't be able to add ad-hoc
  // charges that bypass the quote / change-request review path).
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  if (!isSuperAdminEmail(user?.email)) {
    return NextResponse.json(
      { error: "Super admin access required to add a scope charge." },
      { status: 403 },
    );
  }

  const { id: moveId } = await params;

  let body: ScopeChargeBody;
  try {
    body = (await req.json()) as ScopeChargeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const chargeAmountRaw = Number(body.charge_amount);
  if (!Number.isFinite(chargeAmountRaw) || chargeAmountRaw <= 0) {
    return NextResponse.json(
      { error: "charge_amount must be a positive number" },
      { status: 400 },
    );
  }

  // Tax handling: convert the admin's input to a pre-tax delta. The
  // downstream pipeline (inventory_change_requests + moves.amount) operates
  // on pre-tax dollars; HST is computed from move.amount × 0.13 on render.
  const preTaxDelta = body.charge_includes_hst
    ? Math.round((chargeAmountRaw / (1 + HST_RATE)) * 100) / 100
    : Math.round(chargeAmountRaw * 100) / 100;
  const hstDelta = Math.round(preTaxDelta * HST_RATE * 100) / 100;

  const db = createAdminClient();

  const { data: move, error: moveErr } = await db
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, client_phone, quote_id, amount, estimate, balance_amount, total_paid, status, balance_paid_at, payment_marked_paid, inventory_score, scheduled_date, from_address, to_address, hubspot_deal_id",
    )
    .eq("id", moveId)
    .single();

  if (moveErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  // Normalize the item list. Quantity defaults to 1. Items missing a name
  // are silently dropped (no-op rather than 400 — keeps the request tolerant
  // when the admin clears an item line).
  const itemsAdded = (Array.isArray(body.items) ? body.items : [])
    .map((row) => {
      const name = String(row?.item_name ?? "").trim();
      if (!name) return null;
      return {
        item_name: name,
        item_slug: row?.slug ?? null,
        weight_score:
          typeof row?.weight_score === "number" && Number.isFinite(row.weight_score)
            ? row.weight_score
            : 1.0,
        quantity: Math.max(1, Math.floor(Number(row?.quantity) || 1)),
        // Distribute the pre-tax delta across items so each line has a
        // per-item surcharge (informational only — the totals come from
        // the move row, not the line items).
        surcharge: 0,
        source: "admin_scope_charge" as const,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  // Even-share the surcharge across items so the client-facing notification
  // shows roughly what each item costs. Pure cosmetics — billing reads the
  // move row.
  if (itemsAdded.length > 0) {
    const perLine = Math.round((preTaxDelta / itemsAdded.length) * 100) / 100;
    for (let i = 0; i < itemsAdded.length; i++) {
      itemsAdded[i].surcharge =
        i === itemsAdded.length - 1
          ? Math.round((preTaxDelta - perLine * (itemsAdded.length - 1)) * 100) / 100
          : perLine;
    }
  }

  // Build the admin_notes string. Captures the structured reason chips +
  // the free-text note in one place so audit log / change-request panel /
  // client email all read the same explanation.
  const reasonLabels: Record<string, string> = {
    more_items: "More items than expected",
    heavier: "Heavier than expected",
    extra_time: "Additional time on-site",
    additional_services: "Additional services",
    other: "Other",
  };
  const reasonLine =
    (body.reasons ?? [])
      .map((r) => reasonLabels[r] ?? r)
      .filter(Boolean)
      .join(", ") || "Mid-job scope change";
  const noteTrim = (body.note ?? "").trim();
  const adminNotes = noteTrim
    ? `${reasonLine}. ${noteTrim}`
    : reasonLine;

  // 1) Insert the change request as already-approved. Source='admin' is
  //    valid per inventory_change_requests.source CHECK constraint
  //    (20260326000001_move_day_walkthrough.sql).
  const originalSubtotal = Number(move.amount) || 0;
  const newSubtotal =
    Math.round((originalSubtotal + preTaxDelta) * 100) / 100;

  // Map the move's current status to a valid move_phase value. The
  // inventory_change_requests CHECK constraint only accepts:
  //   pre_move | at_pickup | during_loading | at_delivery | post_move
  // (see 20260326000001_move_day_walkthrough.sql). Earlier this sent
  // "in_progress" which isn't in the list — the insert failed with a
  // constraint violation and the modal showed a raw Postgres error.
  const movePhaseFromStatus = ((): string => {
    const s = String(move.status ?? "").toLowerCase().replace(/-/g, "_");
    if (
      s === "loading" ||
      s === "in_transit" ||
      s === "en_route_to_destination" ||
      s === "dispatched"
    ) return "during_loading";
    if (s === "arrived_at_pickup" || s === "arrived") return "at_pickup";
    if (s === "arrived_at_destination" || s === "unloading") return "at_delivery";
    if (s === "completed" || s === "paid") return "post_move";
    if (s === "en_route_to_pickup" || s === "en_route") return "at_pickup";
    return "pre_move";
  })();

  const { data: requestRow, error: insErr } = await db
    .from("inventory_change_requests")
    .insert({
      move_id: moveId,
      quote_id: move.quote_id ?? null,
      status: "approved",
      source: "admin",
      move_phase: movePhaseFromStatus,
      items_added: itemsAdded,
      items_removed: [],
      auto_calculated_delta: preTaxDelta,
      admin_adjusted_delta: null,
      admin_notes: adminNotes,
      original_subtotal: originalSubtotal,
      new_subtotal: newSubtotal,
      additional_deposit_required: preTaxDelta,
      submitted_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      confirmed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !requestRow?.id) {
    console.error("[scope-charge] inventory_change_requests insert failed:", insErr?.message);
    return NextResponse.json(
      { error: insErr?.message || "Could not record scope charge" },
      { status: 500 },
    );
  }

  // 2) Apply items to move_inventory so the crew page on the field sees
  //    them immediately. Inline (rather than importing the private helper
  //    from /api/admin/inventory-change-requests/[id]/route.ts) to keep
  //    this route self-contained.
  if (itemsAdded.length > 0) {
    const { data: maxSort } = await db
      .from("move_inventory")
      .select("sort_order")
      .eq("move_id", moveId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let sortOrder = (maxSort?.sort_order ?? 0) + 1;
    for (const a of itemsAdded) {
      const qty = Math.max(1, Math.floor(Number(a.quantity) || 1));
      const label = qty > 1 ? `${a.item_name} ×${qty}` : a.item_name;
      await db.from("move_inventory").insert({
        move_id: moveId,
        room: "Other",
        item_name: label,
        sort_order: sortOrder++,
      });
    }
  }

  // 3) Update the move totals.
  //    - amount / estimate: pre-tax engine total, bumped by preTaxDelta.
  //    - balance_amount: TAX-INCLUSIVE remaining (matches the OVERDUE
  //      card's display: contract incl HST minus collected). We add the
  //      full tax-inclusive delta (preTax + HST), NOT just preTaxDelta,
  //      so the new balance reflects what the client actually owes.
  //      Earlier versions of this route added only preTaxDelta which
  //      silently understated the new balance by the HST portion.
  //    - total_paid: freeze at current amount when the move was already
  //      marked paid so the new delta shows as additional balance owing.
  const curBalance = Number(move.balance_amount) || 0;
  const inclusiveDelta =
    Math.round((preTaxDelta + hstDelta) * 100) / 100;
  const newBalance = Math.max(0, curBalance + inclusiveDelta);
  const movePaid = !!(
    move.balance_paid_at ||
    move.payment_marked_paid ||
    String(move.status ?? "").toLowerCase() === "paid"
  );
  const moveUpdate: Record<string, unknown> = {
    amount: newSubtotal,
    estimate: newSubtotal,
    balance_amount: newBalance,
    updated_at: new Date().toISOString(),
  };
  if (movePaid && move.total_paid == null) {
    moveUpdate.total_paid = originalSubtotal;
  }
  const { error: updateErr } = await db
    .from("moves")
    .update(moveUpdate)
    .eq("id", moveId);
  if (updateErr) {
    console.error("[scope-charge] move update failed:", updateErr.message);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 4) Ledger entry. entry_type='adjustment' is in the move_payment_ledger
  //    CHECK constraint (see 20260325000000_move_payment_ledger.sql). This
  //    explains where the bump came from when reconciling later.
  await db.from("move_payment_ledger").insert({
    move_id: moveId,
    entry_type: "adjustment",
    label: `Scope charge — ${reasonLine}`.slice(0, 200),
    pre_tax_amount: preTaxDelta,
    hst_amount: hstDelta,
    inventory_change_request_id: requestRow.id,
    settlement_method: "admin",
    paid_at: new Date().toISOString(),
  });

  // 4b) HubSpot: push updated subtotal so the deal card reflects the new amount
  const hsToken = process.env.HUBSPOT_ACCESS_TOKEN;
  const hid = ((move as { hubspot_deal_id?: string | null }).hubspot_deal_id ?? "").trim();
  if (hsToken && hid) {
    const hst = Math.round(newSubtotal * 0.13 * 100) / 100;
    safePatchDeal(hsToken, hid, {
      sub_total: String(Math.round(newSubtotal * 100) / 100),
      taxes: String(hst),
      total_price: String(Math.round((newSubtotal + hst) * 100) / 100),
    }).catch(() => {});
  }

  // 5) Audit log. Captures who added it and the financial delta — useful
  //    when reconciling outstanding balances later.
  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "scope_charge_added",
    resourceType: "move",
    resourceId: moveId,
    details: {
      move_code: move.move_code,
      pre_tax_delta: preTaxDelta,
      hst_delta: hstDelta,
      charge_amount_entered: chargeAmountRaw,
      includes_hst: !!body.charge_includes_hst,
      reasons: body.reasons ?? [],
      item_count: itemsAdded.length,
      new_balance: newBalance,
    },
  });

  return NextResponse.json({
    ok: true,
    inventory_change_request_id: requestRow.id,
    pre_tax_delta: preTaxDelta,
    hst_delta: hstDelta,
    new_amount: newSubtotal,
    new_balance: newBalance,
  });
}
