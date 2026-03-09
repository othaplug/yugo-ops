import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { sendEmail } from "@/lib/email/send";
import { getAdminNotificationEmail } from "@/lib/config";
import { isFeatureEnabled } from "@/lib/platform-settings";
import { getSquarePaymentConfig } from "@/lib/square-config";

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("tipping_enabled"))) {
    return NextResponse.json({ error: "Tipping is currently disabled" }, { status: 403 });
  }
  let body: { moveId?: string; amount?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { moveId, amount, token } = body;
  if (!moveId || !token) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }

  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const amountDollars = Number(amount);
  if (!Number.isFinite(amountDollars) || amountDollars < 5) {
    return NextResponse.json({ error: "Minimum tip amount is $5.00" }, { status: 400 });
  }

  const amountCents = Math.round(amountDollars * 100);
  const admin = createAdminClient();

  try {
    const { data: move, error: moveError } = await admin
      .from("moves")
      .select("id, client_name, client_email, move_code, crew_id, square_customer_id, square_card_id, tip_charged_at, status")
      .eq("id", moveId)
      .single();

    if (moveError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (move.tip_charged_at) {
      return NextResponse.json({ error: "A tip has already been charged for this move" }, { status: 409 });
    }

    if (!move.square_card_id) {
      return NextResponse.json({ error: "No card on file. Please contact us." }, { status: 400 });
    }

    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json({ error: "Payment configuration unavailable" }, { status: 503 });
    }

    const paymentRes = await squareClient.payments.create({
      sourceId: move.square_card_id,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: move.square_customer_id || undefined,
      referenceId: `TIP-${moveId}`,
      note: `Tip for crew — Move ${move.move_code || moveId}`,
      idempotencyKey: `tip-${moveId}-${Date.now()}`,
      locationId,
    });

    const paymentId = paymentRes.payment?.id;
    if (!paymentId) {
      return NextResponse.json({ error: "Payment could not be completed" }, { status: 500 });
    }

    // Calculate processing fee Yugo absorbs (3.3% + 15 cents)
    const processingFee = amountDollars * 0.033 + 0.15;
    const netAmount = amountDollars - processingFee;
    const now = new Date().toISOString();

    // Fetch crew name for the tips record
    let crewName: string | null = null;
    if (move.crew_id) {
      const { data: crew } = await admin.from("crews").select("name").eq("id", move.crew_id).single();
      crewName = crew?.name || null;
    }

    // Store in tips table + update move
    await Promise.all([
      admin.from("tips").insert({
        move_id: moveId,
        crew_id: move.crew_id,
        client_name: move.client_name,
        crew_name: crewName,
        amount: amountDollars,
        processing_fee: Math.round(processingFee * 100) / 100,
        net_amount: Math.round(netAmount * 100) / 100,
        square_payment_id: paymentId,
        charged_at: now,
      }),
      admin.from("moves").update({
        tip_amount: amountDollars,
        tip_charged_at: now,
      }).eq("id", moveId),
    ]);

    // Log status event
    await admin.from("status_events").insert({
      entity_type: "move",
      entity_id: moveId,
      event_type: "tip_received",
      description: `Tip of $${amountDollars.toFixed(2)} received from ${move.client_name || "client"} for ${crewName || "crew"}`,
      icon: "dollar",
    });

    const adminEmail = await getAdminNotificationEmail();
    sendEmail({
      to: adminEmail,
      subject: `Tip received: $${amountDollars.toFixed(2)} from ${move.client_name || "client"} for ${crewName || "crew"}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#5C1A33;margin:0 0 12px">Tip Received</h2>
        <p><strong>${move.client_name || "A client"}</strong> left a <strong>$${amountDollars.toFixed(2)} tip</strong> for <strong>${crewName || "the crew"}</strong>.</p>
        <p style="color:#666;font-size:14px">Move: ${move.move_code || moveId}<br/>Net after processing: $${netAmount.toFixed(2)}</p>
      </div>`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      tipAmount: amountDollars,
      paymentId,
    });
  } catch (err: unknown) {
    console.error("[tips/charge]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "An error occurred" },
      { status: 500 }
    );
  }
}
