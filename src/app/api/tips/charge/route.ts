import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isMoveIdUuid } from "@/lib/move-code";
import { squareClient } from "@/lib/square";
import { sendEmail } from "@/lib/email/send";
import { getAdminNotificationEmail } from "@/lib/config";
import { tipReceivedAdminEmailHtml } from "@/lib/email/admin-templates";
import { isFeatureEnabled } from "@/lib/platform-settings";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { squarePaymentErrorsToMessage, squareThrownErrorMessage } from "@/lib/square-payment-errors";
import { notifyTipRecordedForCrewProfiles } from "@/lib/crew/profile-after-job";

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("tipping_enabled"))) {
    return NextResponse.json({ error: "Tipping is currently disabled" }, { status: 403 });
  }
  let body: { moveId?: string; slug?: string; amount?: number; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { moveId, slug: urlSlug, amount, token } = body;
  if ((!moveId && !urlSlug) || !token) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }
  const moveIdOrSlug = (moveId || urlSlug || "").trim();
  if (!moveIdOrSlug) {
    return NextResponse.json({ error: "Missing moveId or token" }, { status: 400 });
  }

  const amountDollars = Number(amount);
  if (!Number.isFinite(amountDollars) || amountDollars < 5) {
    return NextResponse.json({ error: "Minimum tip amount is $5.00" }, { status: 400 });
  }

  const amountCents = Math.round(amountDollars * 100);
  const admin = createAdminClient();

  try {
    let move: { id: string; client_name: string | null; client_email: string | null; move_code: string | null; crew_id: string | null; square_customer_id: string | null; square_card_id: string | null; tip_charged_at: string | null; status: string | null } | null = null;
    let resolvedMoveId: string | null = null;

    // 1) Try by UUID (moveId)
    if (moveId?.trim()) {
      const byId = await admin
        .from("moves")
        .select("id, client_name, client_email, move_code, crew_id, square_customer_id, square_card_id, tip_charged_at, status")
        .eq("id", moveId.trim())
        .maybeSingle();
      if (byId.data) {
        move = byId.data;
        resolvedMoveId = move.id;
      }
    }

    // 2) If not found and value looks like move_code (e.g. MV0025), resolve by move_code
    if (!move && !isMoveIdUuid(moveIdOrSlug)) {
      const code = String(moveIdOrSlug).replace(/^#/, "").trim().toUpperCase();
      if (code) {
        const byCode = await admin
          .from("moves")
          .select("id, client_name, client_email, move_code, crew_id, square_customer_id, square_card_id, tip_charged_at, status")
          .ilike("move_code", code)
          .maybeSingle();
        if (byCode.data) {
          move = byCode.data;
          resolvedMoveId = move.id;
        }
      }
    }

    // 3) Fallback: resolve by URL slug (same as track page) so /track/move/MV0025 always works
    if (!move && urlSlug?.trim()) {
      const code = String(urlSlug).replace(/^#/, "").trim().toUpperCase();
      if (code) {
        const bySlug = await admin
          .from("moves")
          .select("id, client_name, client_email, move_code, crew_id, square_customer_id, square_card_id, tip_charged_at, status")
          .ilike("move_code", code)
          .maybeSingle();
        if (bySlug.data) {
          move = bySlug.data;
          resolvedMoveId = move.id;
        }
      }
    }

    if (!move || !resolvedMoveId) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    if (!verifyTrackToken("move", resolvedMoveId, token)) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
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
      referenceId: `TIP-${resolvedMoveId}`,
      note: `Tip for crew Move ${move.move_code || resolvedMoveId}`,
      idempotencyKey: `tip-${resolvedMoveId}`,
      locationId,
    });

    if (paymentRes.errors && paymentRes.errors.length > 0) {
      return NextResponse.json(
        { error: squarePaymentErrorsToMessage(paymentRes.errors) },
        { status: 400 }
      );
    }

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

    const { data: tipRow, error: tipInsErr } = await admin
      .from("tips")
      .insert({
        move_id: resolvedMoveId,
        job_type: "move",
        method: "square",
        crew_id: move.crew_id,
        client_name: move.client_name,
        crew_name: crewName,
        amount: amountDollars,
        processing_fee: Math.round(processingFee * 100) / 100,
        net_amount: Math.round(netAmount * 100) / 100,
        square_payment_id: paymentId,
        charged_at: now,
      })
      .select("id")
      .single();

    if (tipInsErr || !tipRow?.id) {
      return NextResponse.json({ error: tipInsErr?.message || "Could not record tip" }, { status: 500 });
    }

    await admin
      .from("moves")
      .update({
        tip_amount: amountDollars,
        tip_charged_at: now,
      })
      .eq("id", resolvedMoveId);

    notifyTipRecordedForCrewProfiles(
      admin,
      tipRow.id,
      move.crew_id,
      resolvedMoveId,
      Math.round(netAmount * 100) / 100,
    ).catch((e) => console.error("[crew-profile] tip rollup:", e));

    // Log status event
    await admin.from("status_events").insert({
      entity_type: "move",
      entity_id: resolvedMoveId,
      event_type: "tip_received",
      description: `Tip of $${amountDollars.toFixed(2)} received from ${move.client_name || "client"} for ${crewName || "crew"}`,
      icon: "dollar",
    });

    const adminEmail = await getAdminNotificationEmail();
    sendEmail({
      to: adminEmail,
      subject: `Tip received: $${amountDollars.toFixed(2)} from ${move.client_name || "client"} for ${crewName || "crew"}`,
      html: tipReceivedAdminEmailHtml({
        clientName: move.client_name || "A client",
        amount: `$${amountDollars.toFixed(2)}`,
        crewName: crewName || "the crew",
        moveCode: move.move_code || resolvedMoveId,
        netAmount: `$${netAmount.toFixed(2)}`,
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      tipAmount: amountDollars,
      paymentId,
    });
  } catch (err: unknown) {
    console.error("[tips/charge]", err);
    return NextResponse.json({ error: squareThrownErrorMessage(err) }, { status: 500 });
  }
}
