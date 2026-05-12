import { NextRequest, NextResponse } from "next/server";
import {
  quoteFollowupUrgencyEmail,
  quoteFollowupExpiryWarningEmail,
} from "@/lib/email/lifecycle-templates";
import { finalizeClientEmailHtml } from "@/lib/email/finalize-client-html";

/**
 * Dev-only preview of the new quote follow-up templates (urgency, expiry warning).
 * Returns 404 in production unless ALLOW_EMAIL_PREVIEW is set.
 *
 * GET /api/cron/preview-quote-followup?variant=urgency&days=2
 * GET /api/cron/preview-quote-followup?variant=expiry&hours=6
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMAIL_PREVIEW) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") ?? "urgency";

  const baseSample = {
    clientName: "Vasu Beachoo",
    quoteUrl: "https://www.yugoplus.co/quote/YG-30226",
    serviceLabel: "Residential Move",
    declineUrl: "https://www.yugoplus.co/quote/YG-30226?action=decline&token=demo",
    openPixelSrc: null,
  };

  let html: string;
  if (variant === "expiry") {
    const hours = Math.max(0, parseInt(url.searchParams.get("hours") ?? "12", 10) || 12);
    html = quoteFollowupExpiryWarningEmail({
      ...baseSample,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      hoursUntilExpiry: hours,
    });
  } else {
    const days = Math.max(0, parseInt(url.searchParams.get("days") ?? "3", 10) || 3);
    html = quoteFollowupUrgencyEmail({
      ...baseSample,
      moveDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      daysUntilMove: days,
    });
  }

  return new NextResponse(finalizeClientEmailHtml(html), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
