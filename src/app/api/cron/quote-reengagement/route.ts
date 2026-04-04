import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { equinoxPromoLayout, equinoxPromoCta, equinoxPromoFinePrint } from "@/lib/email-templates";
import { getClientSupportEmail } from "@/lib/email/client-support-email";

/**
 * Vercel Cron: runs daily.
 * 3 days after a quote expires without booking, sends a re-engagement email + SMS
 * honouring the original price for 48 hours.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();

  const { data: cfg } = await supabase
    .from("platform_config")
    .select("key, value")
    .eq("key", "quote_reengagement_enabled")
    .maybeSingle();
  if (cfg?.value === "false") {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  // Quotes that expired 3 days ago and haven't been re-engaged
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, quote_id, custom_price, essential_price, move_date, expires_at, contact_id")
    .eq("status", "expired")
    .gte("expires_at", fourDaysAgo.toISOString())
    .lte("expires_at", threeDaysAgo.toISOString())
    .is("reengagement_sent", null);

  const contactIds = [...new Set((quotes ?? []).map((q) => q.contact_id).filter(Boolean))] as string[];
  let contactsById: Record<string, { name: string | null; email: string | null; phone: string | null }> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, email, phone")
      .in("id", contactIds);
    contactsById = Object.fromEntries((contacts ?? []).map((c) => [c.id, c]));
  }

  const results = { sent: 0, errors: [] as string[] };

  for (const quote of quotes ?? []) {
    try {
      // Extend quote expiry by 48 hours from now
      const newExpiry = new Date();
      newExpiry.setTime(newExpiry.getTime() + 48 * 3600_000);

      await supabase
        .from("quotes")
        .update({
          status: "reactivated",
          expires_at: newExpiry.toISOString(),
          reengagement_sent: new Date().toISOString(),
        })
        .eq("id", quote.id);

      const contact = quote.contact_id ? contactsById[quote.contact_id] : undefined;
      const clientEmail = contact?.email?.trim() || null;
      if (!clientEmail) continue;

      const firstName = (contact?.name || "").split(" ")[0] || "there";
      const quoteSlug = quote.quote_id || quote.id;
      const quoteUrl = `${baseUrl}/quote/${encodeURIComponent(quoteSlug)}`;
      const pricePreTax = Number(quote.custom_price ?? quote.essential_price ?? 0);
      const html = buildReengagementEmail({
        firstName,
        quoteNumber: quoteSlug,
        price: pricePreTax,
        moveDate: quote.move_date,
        quoteUrl,
      });

      const result = await sendEmail({
        to: clientEmail,
        subject: `Your Yugo quote is available for 48 more hours`,
        html,
      });

      if (result.success) {
        results.sent++;
        // SMS follow-up
        const clientPhone = contact?.phone?.trim();
        if (clientPhone) {
          await sendSMS(
            clientPhone,
            [
              `Hi ${firstName},`,
              `Your Yugo moving quote is still available for 48 hours at the original price.`,
              `View your quote:\n${quoteUrl}`,
            ].join("\n\n"),
          ).catch(() => {});
        }
      } else {
        results.errors.push(`${quoteSlug}: ${result.error}`);
      }
    } catch (err) {
      const slug = quote.quote_id || quote.id;
      results.errors.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

function buildReengagementEmail(opts: {
  firstName: string;
  quoteNumber: string;
  price: number;
  moveDate: string | null;
  quoteUrl: string;
}): string {
  const moveDateLabel = opts.moveDate
    ? new Date(opts.moveDate + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return equinoxPromoLayout(
    `
    <h1 style="font-size:30px;font-weight:700;color:#3A3532;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${opts.firstName}, your quote is back.</h1>
    <p style="font-size:15px;color:#6B635C;line-height:1.6;margin:0 0 28px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your quote expired, but we&apos;re holding your original price for the next <strong style="color:#3A3532;">48 hours</strong>. After that, pricing resets.</p>
    <div style="border-top:1px solid rgba(92,26,51,0.14);padding-top:24px;margin-bottom:8px;">
      <div style="font-size:32px;font-weight:700;color:#3A3532;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:-0.02em;margin-bottom:8px;">$${opts.price.toLocaleString()}</div>
      ${moveDateLabel ? `<div style="font-size:12px;color:#6B635C;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Move date &middot; ${moveDateLabel}</div>` : ""}
    </div>
    ${equinoxPromoCta(opts.quoteUrl, "Book at Original Price")}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:#2C3E2D;text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `,
    "generic",
  );
}
