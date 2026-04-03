/**
 * Send sample emails showcasing the premium cream / wine template refresh.
 * Usage: npx tsx scripts/send-premium-email-samples.ts [to@email.com]
 * Requires: RESEND_API_KEY in .env.local
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { getResend } from "@/lib/resend";
import {
  bookingConfirmationEmail,
  essentialConfirmationEmail,
  invitePartnerEmail,
  signatureConfirmationEmail,
} from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const to = process.argv[2]?.trim() || "othaplug@gmail.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }

  const base = getEmailBaseUrl();
  const trackingUrl = `${base}/track/preview-move`;
  const loginUrl = `${base}/partner/login?preview=1`;

  const tierCommon = {
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

  const payloads: { subject: string; html: string }[] = [
    {
      subject: "[Sample] Signature booking confirmation (premium refresh)",
      html: signatureConfirmationEmail({
        ...tierCommon,
        moveCode: "PREVIEW-SIG",
        tierLabel: "Signature",
      }),
    },
    {
      subject: "[Sample] Essential booking confirmation (premium refresh)",
      html: essentialConfirmationEmail({
        ...tierCommon,
        moveCode: "PREVIEW-ESS",
        tierLabel: "Essential",
        includes: [],
      }),
    },
    {
      subject: "[Sample] Deposit booking email / equinox layout",
      html: bookingConfirmationEmail({
        clientName: "Sample Customer",
        moveCode: "PREVIEW-DEP",
        moveDate: "2026-05-15",
        fromAddress: tierCommon.fromAddress,
        toAddress: tierCommon.toAddress,
        tierLabel: "Signature",
        serviceLabel: "Local Residential Move",
        totalWithTax: 4_200,
        depositPaid: 1_050,
        balanceRemaining: 3_150,
        trackingUrl,
      }),
    },
    {
      subject: "[Sample] Partner onboarding / invite (premium refresh)",
      html: invitePartnerEmail({
        contactName: "Jordan Sample",
        companyName: "Sample Property Group",
        email: "partner.preview@example.com",
        typeLabel: "Property Management (Residential)",
        tempPassword: "TempPass42",
        loginUrl,
      }),
    },
  ];

  const resend = getResend();
  const from = await getEmailFrom();

  for (let i = 0; i < payloads.length; i++) {
    const { subject, html } = payloads[i];
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
      console.error("Resend error:", subject, error);
      process.exit(1);
    }
    console.log("Sent:", subject, "id:", data?.id);
    if (i < payloads.length - 1) await delay(600);
  }
  console.log("Done. Check inbox:", to);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
