import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { chargeApprovedFeeOnCard } from "@/lib/charge-approved-fee";
import { buildPublicMoveTrackUrl } from "@/lib/notifications/public-track-url";

/**
 * Public endpoint hit from the "Accept" / "Decline" buttons in the extra-item
 * staging email + SMS. Token-protected with the existing move track token.
 *
 *   GET /api/track/moves/[id]/extra-items/[itemId]/respond?action=accept|decline&token=...
 *
 * Accept → charges the card on file via chargeApprovedFeeOnCard, sets the row
 *   to `approved` + `payment_charged=true`. Returns a 302 to the track page
 *   with a success banner.
 *
 * Decline → sets the row to `rejected`. Returns a 302 to the track page with
 *   a decline banner.
 *
 * Idempotency:
 *   - Refuses to act if the item is no longer in `awaiting_client` (already
 *     responded to, or admin reverted the staging). Returns the same redirect
 *     with a stale-link message so the email link is safe to share.
 *   - Idempotency key on the Square charge is the itemId so a double-click
 *     can't double-bill.
 *
 * This route is the heart of the "client must consent before money moves"
 * policy change from the Chidera Allison post-mortem.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: moveId, itemId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const actionRaw = (req.nextUrl.searchParams.get("action") || "").toLowerCase();

  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }
  if (actionRaw !== "accept" && actionRaw !== "decline") {
    return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });
  }
  const action: "accept" | "decline" = actionRaw;

  const admin = createAdminClient();
  const { data: item, error: fetchErr } = await admin
    .from("extra_items")
    .select("id, status, fee_cents, description, payment_charged")
    .eq("id", itemId)
    .eq("job_id", moveId)
    .maybeSingle();
  if (fetchErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code")
    .eq("id", moveId)
    .maybeSingle();
  const portalUrl = buildPublicMoveTrackUrl({
    id: moveId,
    move_code: move?.move_code ?? null,
  });

  // Stale link guard: only act if the item is still awaiting a client
  // decision. Acceptable for an admin to revert staging (back to `pending`)
  // or for the client to have already responded — either way, the previously-
  // sent email is now harmless.
  if (item.status !== "awaiting_client") {
    const stale = encodeURIComponent("This request has already been answered.");
    return NextResponse.redirect(`${portalUrl}&notice=${stale}`);
  }

  if (action === "decline") {
    await admin
      .from("extra_items")
      .update({ status: "rejected" })
      .eq("id", itemId);
    const msg = encodeURIComponent("You declined the added charge. We'll let your coordinator know.");
    return NextResponse.redirect(`${portalUrl}&notice=${msg}`);
  }

  // Accept: charge then mark approved. If charge fails (no card on file,
  // declined, etc.) we leave the item in `awaiting_client` so the client can
  // retry from the portal — and surface a clear notice on the redirect.
  const feeCents = Number(item.fee_cents || 0);
  if (feeCents <= 0) {
    // Edge case: admin staged a 0-fee item. Treat accept as approval w/o
    // touching the card.
    await admin
      .from("extra_items")
      .update({ status: "approved" })
      .eq("id", itemId);
    const msg = encodeURIComponent("Thanks — no charge was needed.");
    return NextResponse.redirect(`${portalUrl}&notice=${msg}`);
  }

  const result = await chargeApprovedFeeOnCard({
    admin,
    moveId,
    feeInclusive: feeCents / 100,
    label: `Extra item — ${String(item.description || "Added item")}`,
    idemSuffix: itemId,
  });
  if (!result.charged) {
    const why = encodeURIComponent(
      `We couldn't charge your card: ${result.reason || "unknown error"}. Please update your payment method or contact your coordinator.`,
    );
    return NextResponse.redirect(`${portalUrl}&notice=${why}`);
  }

  await admin
    .from("extra_items")
    .update({
      status: "approved",
      payment_charged: true,
      square_payment_id: result.squarePaymentId,
      charged_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  const ok = encodeURIComponent(
    `Thanks — $${(feeCents / 100).toFixed(2)} was charged to your card on file.`,
  );
  return NextResponse.redirect(`${portalUrl}&notice=${ok}`);
}
