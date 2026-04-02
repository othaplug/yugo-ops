import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { sendEmail } from "@/lib/email/send";

/**
 * Vercel Cron: runs daily at 10 AM EST (15:00 UTC).
 * Auto-charges partner statements that are due today and have a card on file.
 * Processing costs are baked into delivery rates — no fee added here.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const results = { charged: 0, failed: 0, skipped: 0, errors: [] as string[] };

  // Fetch due statements where the partner has a card on file
  const { data: statements } = await supabase
    .from("partner_statements")
    .select(`
      *,
      organizations!partner_id (
        id, name, email, billing_email, phone,
        square_customer_id, square_card_id, card_on_file
      )
    `)
    .eq("status", "sent")
    .lte("due_date", today);

  if (!statements || statements.length === 0) {
    return NextResponse.json({ ok: true, ...results, message: "No statements due today" });
  }

  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) {
    return NextResponse.json({ error: "Square location not configured" }, { status: 503 });
  }

  for (const stmt of statements) {
    const org = stmt.organizations as {
      id: string;
      name: string;
      email?: string;
      billing_email?: string;
      phone?: string;
      square_customer_id?: string;
      square_card_id?: string;
      card_on_file?: boolean;
    } | null;

    const balanceOwing = Number(stmt.total) - Number(stmt.paid_amount || 0);
    if (balanceOwing <= 0) {
      results.skipped++;
      continue;
    }

    if (!org?.card_on_file || !org?.square_card_id) {
      // No card — send invoice-style email with payment link
      const partnerEmail = org?.billing_email || org?.email;
      if (partnerEmail) {
        await sendEmail({
          to: partnerEmail,
          subject: `Statement ${stmt.statement_number} - balance of $${balanceOwing.toFixed(2)} CAD`,
          template: "partner-statement-due",
          data: {
            partnerName: org?.name || "Partner",
            statementNumber: stmt.statement_number,
            amount: balanceOwing,
            dueDate: stmt.due_date,
            paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/partner/statements/${stmt.id}/pay`,
          },
        }).catch(() => {});
      }
      results.skipped++;
      continue;
    }

    const amountCents = Math.round(balanceOwing * 100);

    try {
      const paymentRes = await squareClient.payments.create({
        sourceId: org.square_card_id,
        amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
        customerId: org.square_customer_id || undefined,
        referenceId: stmt.statement_number,
        note: `Yugo statement ${stmt.statement_number}, ${org.name}`,
        idempotencyKey: `stmt-auto-${stmt.id}-${new Date().toISOString().split("T")[0]}`,
        locationId,
      });

      const paymentId = paymentRes.payment?.id;
      if (!paymentId) throw new Error("No payment ID returned");

      const receiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;
      const newPaidAmount = Number(stmt.paid_amount || 0) + balanceOwing;

      await supabase
        .from("partner_statements")
        .update({
          status: "paid",
          paid_amount: newPaidAmount,
          paid_at: new Date().toISOString(),
          square_invoice_id: paymentId,
        })
        .eq("id", stmt.id);

      // Confirmation email
      const partnerEmail = org.billing_email || org.email;
      if (partnerEmail) {
        await sendEmail({
          to: partnerEmail,
          subject: `Payment confirmed, statement ${stmt.statement_number}`,
          template: "partner-statement-paid",
          data: {
            partnerName: org.name,
            statementNumber: stmt.statement_number,
            amount: balanceOwing,
            receiptUrl: receiptUrl ?? null,
          },
        }).catch(() => {});
      }

      results.charged++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${stmt.statement_number}:${errorMsg}`);
      results.failed++;

      // Alert coordinator
      const adminEmail = process.env.SUPER_ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `URGENT: Partner statement charge failed, ${org.name} ${stmt.statement_number}`,
          template: "partner-statement-charge-failed",
          data: {
            partnerName: org.name,
            partnerEmail: org.billing_email || org.email || "",
            statementNumber: stmt.statement_number,
            amount: balanceOwing,
            errorMessage: errorMsg,
          },
        }).catch(() => {});
      }

      // Send failure notice to partner
      const partnerEmail = org.billing_email || org.email;
      if (partnerEmail) {
        await sendEmail({
          to: partnerEmail,
          subject: `Payment failed, statement ${stmt.statement_number}`,
          template: "partner-statement-charge-failed-partner",
          data: {
            partnerName: org.name,
            statementNumber: stmt.statement_number,
            amount: balanceOwing,
            updateCardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/partner/settings/billing`,
          },
        }).catch(() => {});
      }
    }
  }

  if (results.errors.length > 0) {
    await supabase.from("webhook_logs").insert({
      source: "cron_charge_partner_statements",
      event_type: "partial_failure",
      payload: results,
      status: "error",
      error: results.errors.join("; ").slice(0, 500),
    }).then(() => {});
  }

  return NextResponse.json({ ok: true, ...results });
}
