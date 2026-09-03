/**
 * POST /api/admin/moves/[id]/add-addon
 *
 * Add an add-on to an already-booked move. The admin picks an add-on (TV
 * mounting, bin rental, assembly, packing supplies, ...); we price it through
 * the SAME engine the quote uses (calculateAddons + addonAmountForTier, so tier
 * exclusions and variant_matrix pricing are identical), append it to
 * moves.addons, and add its cost to the move.
 *
 * Two modes:
 *   - default ("add to balance"): bump estimate / amount / balance_amount by the
 *     add-on cost. The 48hr balance auto-charge then collects it with the rest of
 *     the balance. This is "add to total, charge after".
 *   - charge_now: charge the card on file immediately via chargeApprovedFeeOnCard
 *     (writes a ledger row + Square receipt) and bump the recognised totals,
 *     leaving the balance untouched. Use when the balance was already collected.
 *
 * Never double-prices: the add-on cost is derived fresh from the catalog, and the
 * charge path and the balance path are mutually exclusive.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";
import { chargeApprovedFeeOnCard } from "@/lib/charge-approved-fee";
import {
  calculateAddons,
  addonAmountForTier,
  type AddonSelection,
} from "@/lib/quotes/price-addons";
import { logAudit } from "@/lib/audit";

const HST_RATE = 0.13;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, admin, error } = await requireAdmin();
  if (error) return error;
  if (!user || !canEditFinalJobPrice(admin?.role ?? null, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  let body: {
    addon_id?: string;
    quantity?: number;
    tier_index?: number;
    variants?: Array<{ size?: string; type?: string; inches?: number; quantity?: number }>;
    charge_now?: boolean;
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const addonId = String(body.addon_id ?? "").trim();
  if (!addonId) {
    return NextResponse.json({ error: "Pick an add-on" }, { status: 400 });
  }
  const quantity = Math.max(1, Math.round(Number(body.quantity ?? 1)) || 1);
  const tierIndex =
    body.tier_index != null && Number.isFinite(Number(body.tier_index))
      ? Math.max(0, Math.round(Number(body.tier_index)))
      : undefined;
  const chargeNow = body.charge_now === true;
  const idemKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim().slice(0, 64)
      : randomUUID();

  const db = createAdminClient();

  const { data: move, error: moveErr } = await db
    .from("moves")
    .select(
      "id, move_code, client_name, quote_id, addons, tier_selected, estimate, amount, balance_amount, total_price, final_amount, total_paid, square_customer_id, square_card_id",
    )
    .eq("id", moveId)
    .single();
  if (moveErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  // Tier + base price come from the originating quote (for tier exclusions and
  // percent add-ons). Fall back to the move's own numbers when there is no quote.
  let tier: string | null = (move.tier_selected as string | null) ?? null;
  let basePrice = Number(move.estimate) || 0;
  let moveSize: string | null = null;
  let serviceType: string | null = null;
  if (move.quote_id) {
    const { data: q } = await db
      .from("quotes")
      .select("selected_tier, tiers, custom_price, move_size, service_type")
      .eq("id", move.quote_id)
      .maybeSingle();
    if (q) {
      tier = tier ?? (q.selected_tier as string | null) ?? null;
      moveSize = (q.move_size as string | null) ?? null;
      serviceType = (q.service_type as string | null) ?? null;
      if (tier && q.tiers) {
        const tp = (q.tiers as Record<string, { price?: number }>)?.[tier]?.price;
        if (typeof tp === "number") basePrice = tp;
      } else if (q.custom_price != null) {
        basePrice = Number(q.custom_price) || basePrice;
      }
    }
  }

  const selection: AddonSelection = {
    addon_id: addonId,
    quantity,
    ...(tierIndex != null ? { tier_index: tierIndex } : {}),
    ...(Array.isArray(body.variants) && body.variants.length > 0
      ? { variants: body.variants }
      : {}),
  };

  const priced = await calculateAddons(db, [selection], basePrice, moveSize, serviceType);
  const line = priced.breakdown[0];
  if (!line) {
    return NextResponse.json({ error: "That add-on could not be found" }, { status: 400 });
  }
  const deltaPreTax = tier
    ? Math.round(addonAmountForTier(priced, tier) * 100) / 100
    : Math.round(priced.total * 100) / 100;
  if (deltaPreTax <= 0) {
    return NextResponse.json(
      {
        error: `${line.name} is already included in the ${tier ?? "current"} tier, so there is nothing to add.`,
      },
      { status: 400 },
    );
  }
  const deltaInclusive = Math.round(deltaPreTax * (1 + HST_RATE) * 100) / 100;

  // Persist the selection onto the move so every add-on surface shows it.
  const existingAddons = Array.isArray(move.addons) ? move.addons : [];
  const newAddon = {
    addon_id: addonId,
    slug: line.slug,
    quantity,
    ...(tierIndex != null ? { tier_index: tierIndex } : {}),
    ...(selection.variants ? { variants: selection.variants } : {}),
    added_by_admin: true,
    added_at: new Date().toISOString(),
  };

  if (chargeNow) {
    if (!move.square_card_id && !move.square_customer_id) {
      return NextResponse.json(
        { error: "No card on file, cannot charge now. Add to the balance instead." },
        { status: 400 },
      );
    }
    const result = await chargeApprovedFeeOnCard({
      admin: db,
      moveId,
      feeInclusive: deltaInclusive,
      label: `Add-on, ${line.name}${line.detail ? ` (${line.detail})` : ""}`,
      idemSuffix: `addon-${idemKey}`,
    });
    if (!result.charged) {
      return NextResponse.json(
        { error: result.reason || "The card could not be charged." },
        { status: 402 },
      );
    }
    // Idempotent retry: this payment was already charged + ledgered before, so
    // the addon was already appended and the totals already bumped. Re-appending
    // the addon and re-bumping would double-count. Return the existing charge.
    if (result.alreadyRecorded) {
      return NextResponse.json({
        ok: true,
        mode: "charged",
        already_recorded: true,
        addon: line.name,
        detail: line.detail ?? null,
        pre_tax: deltaPreTax,
        inclusive: deltaInclusive,
        receipt_url: result.receiptUrl,
        square_payment_id: result.squarePaymentId,
      });
    }
    // Bump recognised totals (tax-inclusive fields) so the contract reflects it.
    const totalsPatch: Record<string, unknown> = { addons: [...existingAddons, newAddon] };
    const oldEstimate = Number(move.estimate) || 0;
    if (oldEstimate > 0) totalsPatch.estimate = Math.round((oldEstimate + deltaPreTax) * 100) / 100;
    const oldAmount = Number(move.amount) || 0;
    if (oldAmount > 0 && oldEstimate > 0) {
      const looksInclusive = Math.abs(oldAmount - oldEstimate * (1 + HST_RATE)) < 1;
      totalsPatch.amount =
        Math.round((oldAmount + (looksInclusive ? deltaInclusive : deltaPreTax)) * 100) / 100;
    }
    for (const field of ["final_amount", "total_price"] as const) {
      const cur = Number(move[field]) || 0;
      if (cur > 0) totalsPatch[field] = Math.round((cur + deltaInclusive) * 100) / 100;
    }
    if (move.total_paid != null) {
      totalsPatch.total_paid =
        Math.round(((Number(move.total_paid) || 0) + deltaInclusive) * 100) / 100;
    }
    await db.from("moves").update(totalsPatch).eq("id", moveId);

    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: "move_addon_added",
      resourceType: "move",
      resourceId: moveId,
      details: {
        move_code: move.move_code,
        addon: line.name,
        detail: line.detail,
        pre_tax: deltaPreTax,
        inclusive: deltaInclusive,
        charged_now: true,
        square_payment_id: result.squarePaymentId,
      },
    });

    return NextResponse.json({
      ok: true,
      mode: "charged",
      addon: line.name,
      detail: line.detail ?? null,
      pre_tax: deltaPreTax,
      inclusive: deltaInclusive,
      receipt_url: result.receiptUrl,
      square_payment_id: result.squarePaymentId,
    });
  }

  // Default: add to the move total + balance; collected on the 48hr auto-charge.
  const oldEstimate = Number(move.estimate) || 0;
  const oldAmount = Number(move.amount) || 0;
  const oldBalance = Number(move.balance_amount) || 0;
  const totalsPatch: Record<string, unknown> = {
    addons: [...existingAddons, newAddon],
    balance_amount: Math.round((oldBalance + deltaInclusive) * 100) / 100,
  };
  if (oldEstimate > 0) totalsPatch.estimate = Math.round((oldEstimate + deltaPreTax) * 100) / 100;
  if (oldAmount > 0) {
    const looksInclusive = oldEstimate > 0 && Math.abs(oldAmount - oldEstimate * (1 + HST_RATE)) < 1;
    totalsPatch.amount =
      Math.round((oldAmount + (looksInclusive ? deltaInclusive : deltaPreTax)) * 100) / 100;
  }
  for (const field of ["final_amount", "total_price"] as const) {
    const cur = Number(move[field]) || 0;
    if (cur > 0) totalsPatch[field] = Math.round((cur + deltaInclusive) * 100) / 100;
  }

  const { error: updErr } = await db.from("moves").update(totalsPatch).eq("id", moveId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message || "Failed to add the add-on" }, { status: 400 });
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "move_addon_added",
    resourceType: "move",
    resourceId: moveId,
    details: {
      move_code: move.move_code,
      addon: line.name,
      detail: line.detail,
      pre_tax: deltaPreTax,
      inclusive: deltaInclusive,
      charged_now: false,
      new_balance: totalsPatch.balance_amount,
    },
  });

  return NextResponse.json({
    ok: true,
    mode: "balance",
    addon: line.name,
    detail: line.detail ?? null,
    pre_tax: deltaPreTax,
    inclusive: deltaInclusive,
    new_balance: totalsPatch.balance_amount,
  });
}
