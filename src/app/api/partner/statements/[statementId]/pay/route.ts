import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/partner-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { squareThrownErrorMessage, squarePaymentErrorsToMessage } from "@/lib/square-payment-errors";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ statementId: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`stmtpay:${ip}`, 5, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { orgIds, error: authErr } = await requirePartner();
  if (authErr) return authErr;

  const { statementId } = await params;
  const supabase = createAdminClient();

  // Fetch statement and verify it belongs to the authenticated partner
  const { data: statement } = await supabase
    .from("partner_statements")
    .select("*, organizations(id, name, email, billing_email)")
    .eq("id", statementId)
    .in("partner_id", orgIds)
    .single();

  if (!statement) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  if (statement.status === "paid") {
    return NextResponse.json({ error: "This statement has already been paid in full" }, { status: 409 });
  }

  const body = await req.json();
  const { sourceId, amount } = body as { sourceId: string; amount: number };

  if (!sourceId || !amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
  }

  // Validate amount does not exceed balance owing (allow $0.50 rounding tolerance)
  const balanceOwing = Number(statement.total) - Number(statement.paid_amount || 0);
  const amountCents = Math.round(amount * 100);
  const balanceOwingCents = Math.round(balanceOwing * 100);
  if (amountCents > balanceOwingCents + 50) {
    return NextResponse.json({ error: "Amount exceeds balance owing" }, { status: 400 });
  }

  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) {
    return NextResponse.json(
      { error: "Payment is not configured. Please contact your coordinator." },
      { status: 503 },
    );
  }

  const org = statement.organizations as {
    id: string;
    name: string;
    email: string;
    billing_email?: string;
  } | null;
  const partnerEmail = org?.billing_email || org?.email;
  const partnerName = org?.name || "Partner";

  // Find or create Square customer for this partner organisation
  let squareCustomerId: string | undefined;
  if (partnerEmail) {
    try {
      const searchRes = await squareClient.customers.search({
        query: { filter: { emailAddress: { exact: partnerEmail } } },
      });
      squareCustomerId = searchRes.customers?.[0]?.id;
    } catch {
      // fall through — customer lookup is best-effort
    }
    if (!squareCustomerId) {
      try {
        const createRes = await squareClient.customers.create({
          givenName: partnerName,
          emailAddress: partnerEmail,
          referenceId: org?.id,
        });
        squareCustomerId = createRes.customer?.id;
      } catch {
        // continue without customer record
      }
    }
  }

  // Process payment
  let squarePaymentId: string | undefined;
  let squareReceiptUrl: string | null = null;

  try {
    const paymentRes = await squareClient.payments.create({
      sourceId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      ...(squareCustomerId ? { customerId: squareCustomerId } : {}),
      referenceId: statement.statement_number,
      note: `Yugo statement ${statement.statement_number}`,
      idempotencyKey: `stmt-pay-${statement.id}`,
      locationId,
    });

    squarePaymentId = paymentRes.payment?.id;
    squareReceiptUrl =
      (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

    if (!squarePaymentId) {
      return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
    }
  } catch (e) {
    const squareErr = e as {
      errors?: Array<{ code?: string; message?: string; detail?: string }>;
    } | null;
    const msg = squareErr?.errors
      ? squarePaymentErrorsToMessage(squareErr.errors)
      : squareThrownErrorMessage(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Update statement — mark paid or partial
  const newPaidAmount = Number(statement.paid_amount || 0) + amount;
  const newStatus = newPaidAmount >= Number(statement.total) - 0.01 ? "paid" : "partial";

  await supabase
    .from("partner_statements")
    .update({
      status: newStatus,
      paid_amount: newPaidAmount,
      paid_at: new Date().toISOString(),
      square_invoice_id: squarePaymentId,
    })
    .eq("id", statementId);

  return NextResponse.json({
    success: true,
    status: newStatus,
    paid_amount: newPaidAmount,
    square_payment_id: squarePaymentId,
    receipt_url: squareReceiptUrl,
  });
}
