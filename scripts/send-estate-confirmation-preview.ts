/**
 * Send a sample Estate tier booking confirmation (same template as post-payment).
 * Usage: npx tsx scripts/send-estate-confirmation-preview.ts [recipient@email.com]
 * Requires: RESEND_API_KEY in .env.local (and Supabase env if you rely on platform_config for From).
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { getResend } from "@/lib/resend";
import { estateConfirmationEmail } from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

async function main() {
  const to = process.argv[2]?.trim() || "othaplug@gmail.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }

  const moveDate = "2026-05-15";
  const estateDateLabel = new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const subject = `Welcome to your Yugo Estate experience, ${estateDateLabel}`;
  const base = getEmailBaseUrl();

  const html = estateConfirmationEmail({
    clientName: "Sample Customer",
    moveCode: "PREVIEW-ESTATE",
    moveDate,
    timeWindow: "Morning (7 AM – 12 PM)",
    fromAddress: "100 Queen St W, Toronto, ON",
    toAddress: "88 Harbour St, Toronto, ON",
    tierLabel: "Estate",
    serviceLabel: "Local Residential Move",
    crewSize: 4,
    truckDisplayName: "26ft Maximum-Capacity Truck",
    totalWithTax: 15_000,
    depositPaid: 3_750,
    balanceRemaining: 11_250,
    trackingUrl: `${base}/estate/track-preview`,
    welcomePackageUrl: `${base}/estate/welcome/preview`,
    includes: [],
    coordinatorName: "Jordan Chen",
    coordinatorPhone: "(647) 555-0100",
    coordinatorEmail: "estate@helloyugo.com",
  });

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
  console.log("Sent estate confirmation to", to, "id:", data?.id);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
