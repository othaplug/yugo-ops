import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken, signTrackToken } from "@/lib/track-token";
import { SquareClient, SquareEnvironment } from "square";
import { squarePaymentErrorsToMessage, squareThrownErrorMessage } from "@/lib/square-payment-errors";
import { recordMovePaymentLedgerEntry } from "@/lib/payments/record-move-payment";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Payment is not configured. Please contact support." },
      { status: 503 }
    );
  }

  let body: { amountCents?: number; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amountCents = typeof body.amountCents === "number"
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

  const envOverride = (process.env.SQUARE_ENVIRONMENT || "").toLowerCase();
  const useProduction =
    envOverride === "production" || (process.env.NODE_ENV === "production" && envOverride !== "sandbox");
  const squareClient = new SquareClient({
    token: accessToken,
    environment: useProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });

  try {
    const admin = createAdminClient();
    const { data: move, error: moveError } = await admin
      .from("moves")
      .select("id, client_name, client_email, move_code, square_customer_id, square_card_id")
      .eq("id", moveId)
      .single();

    if (moveError || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    let cardId = move.square_card_id ?? null;
    const customerId = move.square_customer_id ?? null;

    if (!cardId && customerId) {
      try {
        const listRes = await squareClient.cards.list({
          customerId,
          // SDK omits sortOrder by sending sort_order=null, which serializes to sort_order= and Square rejects (INVALID_ENUM_VALUE).
          sortOrder: "ASC",
        });
        const cards = listRes.data ?? [];
        cardId = cards.length > 0 ? (cards[0].id ?? null) : null;
      } catch {
        // ignore
      }
    }

    if (!cardId) {
      return NextResponse.json(
        { error: "No card on file. Please contact us to add a payment method before tipping." },
        { status: 400 }
      );
    }

    let locationId = (process.env.SQUARE_LOCATION_ID || "").trim();
    if (!locationId) {
      const listRes = await squareClient.locations.list();
      locationId = listRes.locations?.[0]?.id ?? "";
    }
    if (!locationId) {
      return NextResponse.json(
        { error: "Payment location not configured. Please contact support." },
        { status: 503 }
      );
    }

    const idempotencyKey = `tip-${moveId}`;
    const paymentRes = await squareClient.payments.create({
      sourceId: cardId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: customerId ?? undefined,
      buyerEmailAddress: move.client_email || undefined,
      referenceId: moveId,
      note: `Tip – ${move.client_name || moveId}`,
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

    // Ledger the tip so its Square receipt lands in the Files section. Tips are
    // not HST-taxed, so record the full amount as pre-tax.
    const tipReceiptUrl =
      (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;
    await recordMovePaymentLedgerEntry(admin, {
      moveId,
      entryType: "tip",
      label: "Crew tip",
      amountInclusive: amountCents / 100,
      squarePaymentId: paymentRes.payment.id,
      squareReceiptUrl: tipReceiptUrl,
      settlementMethod: "client",
      taxExempt: true,
    });

    // Record of payment email (the tip has no dedicated confirmation otherwise).
    if (move.client_email) {
      const trackingUrl = `${getEmailBaseUrl()}/track/move/${move.move_code ?? moveId}?token=${signTrackToken("move", moveId)}`;
      sendEmail({
        to: move.client_email,
        subject: `Payment received, ${move.move_code || "your move"}`,
        template: "payment-record",
        data: {
          clientName: move.client_name || "",
          moveCode: move.move_code || moveId,
          chargeLabel: "Crew tip",
          amountCharged: amountCents / 100,
          receiptUrl: tipReceiptUrl,
          trackingUrl,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      paymentId: paymentRes.payment.id,
      amountCents,
    });
  } catch (err: unknown) {
    console.error("[tip]", err);
    return NextResponse.json({ error: squareThrownErrorMessage(err) }, { status: 500 });
  }
}
