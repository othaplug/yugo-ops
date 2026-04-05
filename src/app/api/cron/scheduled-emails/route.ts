import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  buildWinBackEmailHtml,
  WIN_BACK_EMAIL_SUBJECT,
} from "@/lib/email/win-back-email";
import {
  buildPaymentFailedClientEmailHtml,
  PAYMENT_FAILED_CLIENT_SUBJECT,
} from "@/lib/email/payment-failed-client-email";
import { humanizePaymentProcessorMessage } from "@/lib/email/payment-error-message";

/**
 * Vercel Cron: send due scheduled_emails (win-back, payment retry reminders).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error: qErr } = await sb
    .from("scheduled_emails")
    .select("id, quote_id, move_id, type, metadata")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .limit(50);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  for (const row of due || []) {
    results.processed++;
    const rowId = row.id as string;
    const type = String(row.type || "");

    try {
      if (type === "win_back") {
        const quoteId = row.quote_id as string | null;
        if (!quoteId) {
          await sb.from("scheduled_emails").update({ status: "cancelled", cancelled_at: now }).eq("id", rowId);
          results.skipped++;
          continue;
        }

        const { data: quote } = await sb
          .from("quotes")
          .select("id, quote_id, status, contact_id")
          .eq("id", quoteId)
          .maybeSingle();

        if (!quote) {
          await sb.from("scheduled_emails").update({ status: "cancelled", cancelled_at: now }).eq("id", rowId);
          results.skipped++;
          continue;
        }

        const st = String(quote.status || "").toLowerCase();
        if (st !== "lost" && st !== "declined") {
          await sb.from("scheduled_emails").update({ status: "cancelled", cancelled_at: now }).eq("id", rowId);
          results.skipped++;
          continue;
        }

        const contactId = quote.contact_id as string | null;
        if (!contactId) {
          results.errors.push(`win_back ${rowId}: no contact`);
          await sb
            .from("scheduled_emails")
            .update({ last_error: "no contact", status: "cancelled", cancelled_at: now })
            .eq("id", rowId);
          continue;
        }

        const { data: contact } = await sb
          .from("contacts")
          .select("email, name")
          .eq("id", contactId)
          .maybeSingle();

        const email = (contact?.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          results.errors.push(`win_back ${rowId}: no email`);
          await sb
            .from("scheduled_emails")
            .update({ last_error: "no email", status: "cancelled", cancelled_at: now })
            .eq("id", rowId);
          continue;
        }

        const first = (contact?.name || "").trim().split(/\s+/)[0] || "there";
        const html = buildWinBackEmailHtml({ firstName: first });
        const send = await sendEmail({ to: email, subject: WIN_BACK_EMAIL_SUBJECT, html });
        if (!send.success) {
          await sb
            .from("scheduled_emails")
            .update({ last_error: send.error || "send failed" })
            .eq("id", rowId);
          results.errors.push(`win_back ${rowId}: ${send.error}`);
          continue;
        }

        await sb
          .from("scheduled_emails")
          .update({ status: "sent", sent_at: now, last_error: null })
          .eq("id", rowId);
        results.sent++;
        continue;
      }

      if (type === "payment_retry_reminder") {
        const quoteInternalId = row.quote_id as string | null;
        if (!quoteInternalId) {
          await sb.from("scheduled_emails").update({ status: "cancelled", cancelled_at: now }).eq("id", rowId);
          results.skipped++;
          continue;
        }

        const { data: quote } = await sb
          .from("quotes")
          .select("id, quote_id, status, contact_id, payment_error")
          .eq("id", quoteInternalId)
          .maybeSingle();

        if (!quote || String(quote.status || "").toLowerCase() !== "payment_failed") {
          await sb.from("scheduled_emails").update({ status: "cancelled", cancelled_at: now }).eq("id", rowId);
          results.skipped++;
          continue;
        }

        const contactId = quote.contact_id as string | null;
        if (!contactId) {
          await sb
            .from("scheduled_emails")
            .update({ status: "cancelled", cancelled_at: now, last_error: "no contact" })
            .eq("id", rowId);
          results.skipped++;
          continue;
        }

        const { data: contact } = await sb
          .from("contacts")
          .select("email, name")
          .eq("id", contactId)
          .maybeSingle();

        const email = (contact?.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          await sb
            .from("scheduled_emails")
            .update({ status: "cancelled", cancelled_at: now, last_error: "no email" })
            .eq("id", rowId);
          continue;
        }

        const first = (contact?.name || "").trim().split(/\s+/)[0] || "there";
        const human = humanizePaymentProcessorMessage(String(quote.payment_error || "Please try again or use a different card."));
        const html = await buildPaymentFailedClientEmailHtml({
          firstName: first,
          quoteId: String(quote.quote_id),
          friendlyReason: human,
        });
        const send = await sendEmail({ to: email, subject: PAYMENT_FAILED_CLIENT_SUBJECT, html });
        if (!send.success) {
          await sb
            .from("scheduled_emails")
            .update({ last_error: send.error || "send failed" })
            .eq("id", rowId);
          results.errors.push(`payment_retry_reminder ${rowId}: ${send.error}`);
          continue;
        }

        await sb
          .from("scheduled_emails")
          .update({ status: "sent", sent_at: now, last_error: null })
          .eq("id", rowId);
        results.sent++;
        continue;
      }

      results.skipped++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.errors.push(`${row.id}: ${msg}`);
      await sb.from("scheduled_emails").update({ last_error: msg }).eq("id", row.id as string);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
