/**
 * Send all Estate-related HTML samples to one inbox (Resend).
 * Usage: npx tsx scripts/send-estate-samples.ts [recipient@email.com]
 *
 * Preview URLs (local dev, npm run dev):
 *   http://127.0.0.1:3000/estate/welcome/preview
 *   http://127.0.0.1:3000/estate/track-preview
 *
 * Production: set ESTATE_UI_PREVIEW=true or CLIENT_TRACK_PREVIEW=true for preview paths.
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import {
  estateConfirmationEmail,
  statusUpdateEmailHtml,
  PREMIUM_TRACK_CTA_LABEL,
} from "@/lib/email-templates";

const delay = (ms: number) => new Promise((r) => setTimeout(r, 550));

async function sendOrThrow(
  label: string,
  fn: () => Promise<SendEmailResult>,
): Promise<void> {
  const r = await fn();
  if (!r.success) {
    console.error(`FAIL ${label}:`, r.error);
    process.exit(1);
  }
  console.log("Sent:", label, r.id ?? "");
}

async function main() {
  const to = (process.argv[2] ?? "othaplug@gmail.com").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    console.error("RESEND_API_KEY missing or placeholder in .env.local");
    process.exit(1);
  }

  const base = getEmailBaseUrl();
  const welcomePreviewUrl = `${base}/estate/welcome/preview`;
  const trackPreviewUrl = `${base}/estate/track-preview`;
  const moveDate = "2026-05-15";
  const estateDateLabel = new Date(moveDate + "T00:00:00").toLocaleDateString(
    "en-CA",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );

  const reviewUrls = {
    reviewUrl: `${base}/review?token=style-sample-token`,
    reviewRedirectUrl: `${base}/api/review/redirect?token=style-sample-token`,
  };

  console.log(`Sending Estate samples to ${to}`);
  console.log(`Welcome preview: ${welcomePreviewUrl}`);
  console.log(`Track preview: ${trackPreviewUrl}`);
  console.log("---");

  await sendOrThrow("Estate booking confirmation + welcome guide CTA", () =>
    sendEmail({
      to,
      subject: `Welcome to your Yugo Estate experience, ${estateDateLabel}`,
      html: estateConfirmationEmail({
        clientName: "Alex Sample",
        moveCode: "ESTATE-SAMPLE",
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
        trackingUrl: trackPreviewUrl,
        welcomePackageUrl: welcomePreviewUrl,
        includes: [],
        coordinatorName: "Jordan Chen",
        coordinatorPhone: "(647) 555-0100",
        coordinatorEmail: "estate@helloyugo.com",
      }),
      tags: [{ name: "sample", value: "estate-confirmation" }],
    }),
  );
  await delay(0);

  await sendOrThrow("Estate 30-day concierge check-in", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] 30-day concierge check-in",
      template: "estate-30day-checkin",
      data: {
        clientName: "Alex Sample",
        moveCode: "ESTATE-SAMPLE",
        trackingUrl: trackPreviewUrl,
        welcomeGuideUrl: welcomePreviewUrl,
        coordinatorName: "Jordan Chen",
        coordinatorPhone: "(647) 555-0100",
        coordinatorEmail: "estate@helloyugo.com",
      },
    }),
  );
  await delay(0);

  await sendOrThrow("Estate review request", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] Review request (Estate)",
      template: "review-request-estate",
      data: {
        clientName: "Alex Sample",
        tier: "estate",
        ...reviewUrls,
        trackingUrl: trackPreviewUrl,
        coordinatorName: "Jordan Chen",
        referralUrl: `${base}/client`,
      },
    }),
  );
  await delay(0);

  await sendOrThrow("Estate status — crew en route (cream shell, estate tone)", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] Live update — crew en route",
      html: statusUpdateEmailHtml({
        headline:
          "Your Estate crew is on the way. We will keep you informed at every step.",
        body: "Your crew has shared a live update. Follow every step on your Estate tracker below.",
        ctaUrl: trackPreviewUrl,
        ctaLabel: PREMIUM_TRACK_CTA_LABEL,
        includeFooter: false,
        eyebrow: "Estate live update",
        tone: "estate",
      }),
      tags: [{ name: "sample", value: "estate-status-en-route" }],
    }),
  );
  await delay(0);

  await sendOrThrow("Estate status — arrived at new home", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] Live update — arrived at new home",
      html: statusUpdateEmailHtml({
        headline: "Your crew has arrived and is ready to unload.",
        body: "Your crew has shared a live update. Follow every step on your Estate tracker below.",
        ctaUrl: trackPreviewUrl,
        ctaLabel: PREMIUM_TRACK_CTA_LABEL,
        includeFooter: false,
        eyebrow: "Estate live update",
        tone: "estate",
      }),
      tags: [{ name: "sample", value: "estate-status-arrived-dest" }],
    }),
  );
  await delay(0);

  await sendOrThrow("Estate status — move complete", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] Estate move complete",
      html: statusUpdateEmailHtml({
        headline: "Move complete. It was our privilege today.",
        body: "It was a pleasure caring for your home today. Your documents and receipt remain available in your portal.",
        ctaUrl: trackPreviewUrl,
        ctaLabel: PREMIUM_TRACK_CTA_LABEL,
        includeFooter: false,
        eyebrow: "Estate complete",
        tone: "estate",
      }),
      tags: [{ name: "sample", value: "estate-status-complete" }],
    }),
  );
  await delay(0);

  await sendOrThrow("Pre-move 72hr (same template as all tiers; subject differs on cron for Estate)", () =>
    sendEmail({
      to,
      subject: "[Yugo Estate sample] Pre-move 72hr checklist (shared template)",
      template: "pre-move-72hr",
      data: {
        clientName: "Alex Sample",
        moveCode: "ESTATE-SAMPLE",
        moveDate,
        fromAddress: "100 Queen St W, Toronto, ON",
        toAddress: "88 Harbour St, Toronto, ON",
        fromAccess: "elevator_booked",
        toAccess: "loading_dock",
        trackingUrl: trackPreviewUrl,
      },
    }),
  );

  console.log("---");
  console.log("Done. Open previews locally (npm run dev):");
  console.log("  Estate welcome:  http://127.0.0.1:3000/estate/welcome/preview");
  console.log("  Estate track:    http://127.0.0.1:3000/estate/track-preview");
  console.log("  Standard track (before complete): http://127.0.0.1:3000/track/move/preview/active");
  console.log("  Standard track (move day):        http://127.0.0.1:3000/track/move/preview/move-day");
  console.log("  Standard track (completed):       http://127.0.0.1:3000/track/move/preview/completed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
