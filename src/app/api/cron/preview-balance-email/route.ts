import { NextRequest, NextResponse } from "next/server";
import {
  balanceReminder72hrEmail,
  balanceReminder48hrEmail,
} from "@/lib/email/lifecycle-templates";

/**
 * Dev-only preview of the no-card balance reminder emails. Disabled in production.
 * GET /api/dev/preview-balance-email?variant=72hr|48hr&card=yes|no
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_EMAIL_PREVIEW) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") ?? "72hr";
  const hasCard = url.searchParams.get("card") === "yes";

  const sample = {
    clientName: "Samantha Lance",
    moveCode: "MV-30211",
    moveDate: "2026-05-14",
    balanceAmount: 2047,
    trackingUrl: "https://www.yugoplus.co/track/move/MV-30211?token=demo",
    paymentPageUrl: "https://www.yugoplus.co/pay/037da65d-a3f8-429a-abb5-5e861a5864ad",
    hasCardOnFile: hasCard,
  };

  let html: string;
  if (variant === "48hr") {
    html = balanceReminder48hrEmail({
      ...sample,
      ccTotal: sample.balanceAmount * 1.033 + 0.15,
      autoChargeDate: "2026-05-12",
    });
  } else {
    html = balanceReminder72hrEmail({
      ...sample,
      estateBalanceChargeBeforePacking: false,
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
