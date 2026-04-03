/**
 * Send a sample Essential or Signature booking confirmation (includes help/FAQ block).
 * Usage: npx tsx scripts/send-move-confirmation-preview.ts [email] [essential|signature]
 * Requires: RESEND_API_KEY in .env.local
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { getResend } from "@/lib/resend";
import { essentialConfirmationEmail, signatureConfirmationEmail } from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

async function main() {
  const to = process.argv[2]?.trim() || "othaplug@gmail.com";
  const tierArg = (process.argv[3]?.trim().toLowerCase() || "signature") as string;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }
  const tier = tierArg === "essential" ? "essential" : "signature";

  const base = getEmailBaseUrl();
  const trackingUrl = `${base}/track/preview-move`;

  const common = {
    clientName: "Sample Customer",
    moveDate: "2026-05-15" as const,
    timeWindow: "Morning (7 AM – 12 PM)",
    fromAddress: "100 Queen St W, Toronto, ON",
    toAddress: "88 Harbour St, Toronto, ON",
    serviceLabel: "Local Residential Move",
    crewSize: 3,
    truckDisplayName: "20ft Dedicated Moving Truck",
    totalWithTax: 4_200,
    depositPaid: 1_050,
    balanceRemaining: 3_150,
    trackingUrl,
    includes: [
      "Dedicated moving truck",
      "Professional crew of 3",
      "Full protective wrapping for all furniture",
      "Mattress and TV protection included",
      "Enhanced valuation coverage",
      "Real-time GPS tracking",
    ] as string[],
  };

  const html =
    tier === "essential"
      ? essentialConfirmationEmail({
          ...common,
          moveCode: "PREVIEW-ESS",
          tierLabel: "Essential",
          includes: [],
        })
      : signatureConfirmationEmail({
          ...common,
          moveCode: "PREVIEW-SIG",
          tierLabel: "Signature",
        });

  const subject =
    tier === "essential"
      ? `Your Yugo move is confirmed, PREVIEW-ESS`
      : `Your Yugo Signature move is confirmed, PREVIEW-SIG`;

  const resend = getResend();
  const from = await getEmailFrom();

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    headers: {
      Precedence: "auto",
      "X-Auto-Response-Suppress": "All",
    },
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }
  console.log(`Sent ${tier} confirmation to`, to, "id:", data?.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
