import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { squareIdem } from "@/lib/square-idempotency";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { squarePaymentErrorsToMessage, squareThrownErrorMessage } from "@/lib/square-payment-errors";

/**
 * POST /api/track/delivery/[id]/tip
 * Client-facing tip for a delivery.
 * Accepts a Square sourceId (from the Web Payments SDK card tokenization) so
 * any customer can tip regardless of whether they have a card on file.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deliveryId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("delivery", deliveryId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Payment is not configured. Please contact support." },
      { status: 503 }
    );
  }

  let body: { sourceId?: string; amountCents?: number; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const sourceId = (body.sourceId || "").trim();
  if (!sourceId) {
    return NextResponse.json({ error: "Payment token is required" }, { status: 400 });
  }

  const amountCents =
    typeof body.amountCents === "number"
      ? Math.round(body.amountCents)
      : typeof body.amount === "number"
        ? Math.round(body.amount * 100)
        : 0;

  if (amountCents < 100) {
    return NextResponse.json(
      { error: "Minimum tip amount is $1.00" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: delivery, error: deliveryError } = await admin
    .from("deliveries")
    .select("id, customer_name, client_name")
    .eq("id", deliveryId)
    .single();

  if (deliveryError || !delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  try {
    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json(
        { error: "Payment location not configured. Please contact support." },
        { status: 503 }
      );
    }

    const idempotencyKey = squareIdem("tip-delivery", deliveryId);
    const paymentRes = await squareClient.payments.create({
      sourceId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      referenceId: deliveryId,
      note: `Tip (delivery) – ${delivery.customer_name || delivery.client_name || deliveryId}`,
      idempotencyKey,
      locationId,
    });

    if (paymentRes.errors && paymentRes.errors.length > 0) {
      return NextResponse.json(
        { error: squarePaymentErrorsToMessage(paymentRes.errors) },
        { status: 400 }
      );
    }

    if (!paymentRes.payment?.id) {
      return NextResponse.json(
        { error: "Payment could not be completed. Please try again or contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: paymentRes.payment.id,
      amountCents,
    });
  } catch (err: unknown) {
    console.error("[delivery tip]", err);
    return NextResponse.json({ error: squareThrownErrorMessage(err) }, { status: 500 });
  }
}
