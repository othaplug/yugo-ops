import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

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
    .select("id, quote_number, client_name, client_email, client_phone, essential_price, move_date, from_address, to_address, expires_at")
    .eq("status", "expired")
    .gte("expires_at", fourDaysAgo.toISOString())
    .lte("expires_at", threeDaysAgo.toISOString())
    .is("reengagement_sent", null);

  const results = { sent: 0, errors: [] as string[] };

  for (const quote of quotes ?? []) {
    try {
      // Extend quote expiry by 48 hours
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 2);

      await supabase
        .from("quotes")
        .update({
          status: "reactivated",
          expires_at: newExpiry.toISOString().slice(0, 10),
          reengagement_sent: new Date().toISOString(),
        })
        .eq("id", quote.id);

      if (!quote.client_email) continue;

      const firstName = (quote.client_name || "").split(" ")[0] || "there";
      const quoteUrl = `${baseUrl}/quote/${quote.id}`;
      const html = buildReengagementEmail({
        firstName,
        quoteNumber: quote.quote_number || quote.id,
        price: Number(quote.essential_price || 0),
        moveDate: quote.move_date,
        quoteUrl,
      });

      const result = await sendEmail({
        to: quote.client_email,
        subject: `Your Yugo quote — still available for 48 hours`,
        html,
      });

      if (result.success) {
        results.sent++;
        // SMS follow-up
        if (quote.client_phone) {
          await sendSMS(
            quote.client_phone,
            `Hi ${firstName}, your Yugo moving quote is still available for 48 hours at the original price. View: ${quoteUrl}`
          ).catch(() => {});
        }
      } else {
        results.errors.push(`${quote.quote_number}: ${result.error}`);
      }
    } catch (err) {
      results.errors.push(`${quote.quote_number}: ${err instanceof Error ? err.message : String(err)}`);
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

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="background:#f5f4f2;margin:0;padding:0;font-family:'Inter',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#0d0b08;border-radius:12px;padding:28px;margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A962;margin:0 0 4px;">YUGO MOVING</p>
      <h1 style="font-size:22px;font-weight:700;color:#e8e0d0;font-family:'Instrument Serif',Georgia,serif;margin:0;">Your quote is still available</h1>
    </div>
    <div style="background:#fff;border-radius:12px;padding:28px;margin-bottom:16px;">
      <p style="font-size:14px;color:#1a1714;margin:0 0 12px;">Hi ${opts.firstName},</p>
      <p style="font-size:13px;color:#4a4540;line-height:1.6;margin:0 0 16px;">
        Your Yugo moving quote has expired, but we'd love to help with your move.
        We'll honour the original price for the next <strong>48 hours</strong>.
      </p>
      ${
        moveDateLabel
          ? `<div style="background:#faf9f7;border-radius:8px;padding:14px 16px;margin-bottom:20px;font-size:12px;color:#6b6560;">
          Planned move date: <strong style="color:#1a1714;">${moveDateLabel}</strong>
        </div>`
          : ""
      }
      <div style="background:#faf9f7;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
        <div style="font-size:11px;color:#9c9489;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Original quoted price</div>
        <div style="font-size:28px;font-weight:700;color:#B8962E;">$${opts.price.toLocaleString()}</div>
      </div>
      <div style="text-align:center;">
        <a href="${opts.quoteUrl}" style="display:inline-block;background:#B8962E;color:#0d0b08;padding:14px 32px;font-size:11px;font-weight:700;text-decoration:none;letter-spacing:1.2px;text-transform:uppercase;border-radius:8px;">View &amp; Book Quote</a>
      </div>
      <p style="font-size:11px;color:#9c9489;text-align:center;margin:16px 0 0;">This offer expires in 48 hours.</p>
    </div>
    <p style="font-size:11px;color:#9c9489;text-align:center;">Questions? Call or text us anytime.</p>
  </div>
</body></html>`;
}
