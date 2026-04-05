/**
 * Send 3 sample client emails (Signature confirmation, Estate confirmation, move track ping).
 * Links point at preview routes — require CLIENT_TRACK_PREVIEW=true or ESTATE_UI_PREVIEW=true
 * (or NODE_ENV=development) on the host in {@link getEmailBaseUrl}, or those URLs return 404.
 *
 * Usage: npx tsx scripts/send-three-sample-client-emails.ts [recipient@email.com]
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { getResend } from "@/lib/resend";
import {
  estateConfirmationEmail,
  signatureConfirmationEmail,
  statusUpdateEmailHtml,
} from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const DEFAULT_TO = "othaplug@gmail.com";

function sharedTierParams(base: string) {
  const moveDate = "2026-05-15";
  return {
    clientName: "Alex Sample",
    moveCode: "SAMPLE-MOVE-001",
    moveDate,
    timeWindow: "Morning (7 AM – 12 PM)",
    fromAddress: "100 Queen St W, Toronto, ON",
    toAddress: "88 Harbour St, Toronto, ON",
    serviceLabel: "Local Residential Move",
    crewSize: 3,
    truckDisplayName: "26ft Truck",
    totalWithTax: 4_800,
    depositPaid: 1_200,
    balanceRemaining: 3_600,
    coordinatorName: "Jordan Chen",
    coordinatorPhone: "(647) 555-0100",
    coordinatorEmail: "estate@helloyugo.com",
    includes: [
      "Professional crew and equipment",
      "Floor and doorway protection",
      "Real-time tracking on move day",
    ] as string[],
  };
}

async function main() {
  const to = process.argv[2]?.trim() || DEFAULT_TO;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }

  const base = getEmailBaseUrl();
  const trackSignature = `${base}/track/move/preview/active`;
  const trackEstate = `${base}/estate/track-preview`;
  const welcomePreview = `${base}/estate/welcome/preview`;

  const common = sharedTierParams(base);
  const resend = getResend();
  const from = await getEmailFrom();

  const sigHtml = signatureConfirmationEmail({
    ...common,
    tierLabel: "Signature",
    trackingUrl: trackSignature,
  });

  const estateDateLabel = new Date(`${common.moveDate}T00:00:00`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const estateHtml = estateConfirmationEmail({
    ...common,
    moveCode: "PREVIEW-ESTATE",
    tierLabel: "Estate",
    crewSize: 4,
    truckDisplayName: "26ft Maximum-Capacity Truck",
    totalWithTax: 15_000,
    depositPaid: 3_750,
    balanceRemaining: 11_250,
    trackingUrl: trackEstate,
    welcomePackageUrl: welcomePreview,
  });

  const trackHtml = statusUpdateEmailHtml({
    headline: "Your crew is on the way",
    body: "You have a live update for your move. Open your tracker for the latest status, ETA, and crew details.",
    ctaUrl: trackSignature,
    ctaLabel: "TRACK YOUR MOVE",
    includeFooter: true,
    eyebrow: "Live update",
    tone: "premium",
  });

  const sends: { subject: string; html: string }[] = [
    {
      subject: `[Yugo sample] Signature move confirmed — ${common.moveCode}`,
      html: sigHtml,
    },
    {
      subject: `Welcome to your Yugo Estate experience, ${estateDateLabel}`,
      html: estateHtml,
    },
    {
      subject: `[Yugo sample] Move track — ${common.moveCode}`,
      html: trackHtml,
    },
  ];

  for (const { subject, html } of sends) {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      headers: {
        "X-Auto-Response-Suppress": "All",
      },
    });
    if (error) {
      console.error("Resend error:", subject, error);
      process.exit(1);
    }
    console.log("Sent:", subject, "id:", data?.id);
  }

  console.log("\nPreview links used (must be allowed on this origin):");
  console.log("  Track (Signature / generic):", trackSignature);
  console.log("  Track (Estate):             ", trackEstate);
  console.log("  Welcome guide:              ", welcomePreview);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
