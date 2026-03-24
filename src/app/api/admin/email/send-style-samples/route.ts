import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/check-role";
import { sendEmail } from "@/lib/email/send";
import type { TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import {
  postMovePerksEmail,
  moveAnniversaryEmail,
  internalLowSatAlertEmail,
} from "@/lib/email/lifecycle-templates";
import {
  verificationCodeEmail,
  trackingLinkEmail,
  statusUpdateEmailHtml,
  deliveryNotificationEmail,
  moveNotificationEmail,
  inviteUserEmail,
} from "@/lib/email-templates";

const DEFAULT_TO = "oche@helloyugo.com";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Owner-only: send one sample of each client lifecycle / shared HTML email for design QA.
 * POST /api/admin/email/send-style-samples
 * Body (optional): { "to": "you@domain.com", "dryRun": false }
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured. Cannot send samples." },
      { status: 503 },
    );
  }

  let body: { to?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const to = (typeof body.to === "string" && body.to.trim()) || DEFAULT_TO;
  const dryRun = Boolean(body.dryRun);

  const base = getEmailBaseUrl();
  const track = `${base}/track/move/sample-move?token=demo`;

  type TemplateJob = { template: TemplateName; subject: string; data: unknown };
  const templateJobs: TemplateJob[] = [
    {
      template: "pre-move-72hr",
      subject: "[Yugo sample] Pre-move — 72 hours",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-15",
        fromAddress: "100 King St W, Toronto, ON",
        toAddress: "200 Queen St E, Toronto, ON",
        fromAccess: "elevator_booked",
        toAccess: "loading_dock",
        trackingUrl: track,
      },
    },
    {
      template: "pre-move-24hr",
      subject: "[Yugo sample] Pre-move — 24 hours",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-16",
        fromAddress: "100 King St W, Toronto, ON",
        toAddress: "200 Queen St E, Toronto, ON",
        crewLeadName: "Jordan",
        crewSize: 3,
        truckInfo: "26 ft box truck",
        arrivalWindow: "8:00 AM – 10:00 AM",
        coordinatorName: "Sam Coordinator",
        coordinatorPhone: "4165550100",
        trackingUrl: track,
      },
    },
    {
      template: "balance-receipt",
      subject: "[Yugo sample] Balance receipt",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        amount: 124900,
        paymentMethod: "Visa •••• 4242",
        totalPaid: 249800,
        trackingUrl: track,
      },
    },
    {
      template: "move-complete",
      subject: "[Yugo sample] Move complete",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        fromAddress: "100 King St W, Toronto, ON",
        toAddress: "200 Queen St E, Toronto, ON",
        completedDate: "2026-04-16",
        trackingUrl: track,
      },
    },
    {
      template: "referral-offer",
      subject: "[Yugo sample] Referral offer",
      data: {
        clientName: "Alex Sample",
        referralUrl: `${base}/client`,
      },
    },
    {
      template: "cancellation-confirm",
      subject: "[Yugo sample] Cancellation (with refund)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        fromAddress: "100 King St W, Toronto, ON",
        toAddress: "200 Queen St E, Toronto, ON",
        moveDate: "2026-04-20",
        cancellationReason: "Plans changed",
        refundAmount: 50000,
        trackingUrl: track,
      },
    },
    {
      template: "balance-reminder-72hr",
      subject: "[Yugo sample] Balance reminder — 72h",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-18",
        balanceAmount: 124900,
        trackingUrl: track,
      },
    },
    {
      template: "balance-reminder-48hr",
      subject: "[Yugo sample] Balance reminder — 48h",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-18",
        balanceAmount: 124900,
        ccTotal: 124900,
        autoChargeDate: "2026-04-16",
        paymentPageUrl: `${base}/track/move/sample-move`,
        trackingUrl: track,
      },
    },
    {
      template: "balance-auto-charge-receipt",
      subject: "[Yugo sample] Auto-charge receipt",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        baseBalance: 120000,
        processingFee: 3960,
        transactionFee: 0,
        totalCharged: 123960,
        trackingUrl: track,
      },
    },
    {
      template: "balance-charge-failed-client",
      subject: "[Yugo sample] Balance charge failed (client)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        balanceAmount: 124900,
      },
    },
    {
      template: "balance-charge-failed-admin",
      subject: "[Yugo sample] Balance charge failed (admin)",
      data: {
        clientName: "Alex Sample",
        clientEmail: "client@example.com",
        clientPhone: "4165550199",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-18",
        balanceAmount: 124900,
        errorMessage: "card_declined",
      },
    },
    {
      template: "review-request",
      subject: "[Yugo sample] Review request (legacy shell)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        googleReviewUrl: "https://maps.google.com/?q=Yugo",
        referralUrl: `${base}/client`,
        trackingUrl: track,
      },
    },
    {
      template: "review-request-curated",
      subject: "[Yugo sample] Review — curated tier (legacy shell)",
      data: {
        clientName: "Alex Sample",
        tier: "signature",
        reviewUrl: `${base}/review?demo=1`,
        reviewRedirectUrl: `${base}/review?redirect=1`,
        trackingUrl: track,
        coordinatorName: "Sam",
      },
    },
    {
      template: "review-request-signature",
      subject: "[Yugo sample] Review — signature (legacy shell)",
      data: {
        clientName: "Alex Sample",
        tier: "signature",
        reviewUrl: `${base}/review?demo=1`,
        reviewRedirectUrl: `${base}/review?redirect=1`,
        trackingUrl: track,
      },
    },
    {
      template: "review-request-estate",
      subject: "[Yugo sample] Review — estate (legacy shell)",
      data: {
        clientName: "Alex Sample",
        tier: "estate",
        reviewUrl: `${base}/review?demo=1`,
        reviewRedirectUrl: `${base}/review?redirect=1`,
        trackingUrl: track,
        coordinatorName: "Sam Coordinator",
      },
    },
    {
      template: "review-request-reminder",
      subject: "[Yugo sample] Review reminder (legacy shell)",
      data: {
        clientName: "Alex Sample",
        reviewUrl: `${base}/review?demo=1`,
        reviewRedirectUrl: `${base}/review?redirect=1`,
      },
    },
    {
      template: "low-satisfaction",
      subject: "[Yugo sample] Low satisfaction (legacy shell)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        coordinatorName: "Sam Coordinator",
        coordinatorPhone: "4165550100",
        coordinatorEmail: "coord@helloyugo.com",
        trackingUrl: track,
      },
    },
    {
      template: "quote-followup-1",
      subject: "[Yugo sample] Quote follow-up 1 (legacy shell)",
      data: {
        clientName: "Alex Sample",
        quoteUrl: `${base}/quote/demo`,
        serviceLabel: "Residential move",
      },
    },
    {
      template: "quote-followup-2",
      subject: "[Yugo sample] Quote follow-up 2 (legacy shell)",
      data: {
        clientName: "Alex Sample",
        quoteUrl: `${base}/quote/demo`,
        serviceLabel: "Residential move",
        moveDate: "2026-05-01",
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
    },
    {
      template: "quote-followup-3",
      subject: "[Yugo sample] Quote follow-up 3 (legacy shell)",
      data: {
        clientName: "Alex Sample",
        quoteUrl: `${base}/quote/demo`,
        serviceLabel: "Residential move",
        expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      },
    },
    {
      template: "quote-updated",
      subject: "[Yugo sample] Quote updated (legacy shell)",
      data: {
        clientName: "Alex Sample",
        quoteUrl: `${base}/quote/demo`,
        serviceLabel: "Residential move",
        changesSummary: "Added packing for kitchen. Updated crew size to 4.",
      },
    },
  ];

  const htmlJobs: { subject: string; html: string; tag?: string }[] = [
    {
      subject: "[Yugo sample] Post-move perks (HTML)",
      html: postMovePerksEmail({
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        referralCode: "YUGO-SAMPLE",
        referredDiscount: 50,
        referrerCredit: 50,
        trackingUrl: track,
        activePerks: [
          {
            title: "Storage partner discount",
            description: "15% off first month at partner facilities.",
            offer_type: "percentage_off",
            discount_value: 15,
            redemption_code: "YUGO15",
            redemption_url: `${base}/perks`,
          },
        ],
      }),
      tag: "move-complete",
    },
    {
      subject: "[Yugo sample] Move anniversary (HTML)",
      html: moveAnniversaryEmail({
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2025-03-23",
        fromAddress: "100 King St W, Toronto, ON",
        toAddress: "200 Queen St E, Toronto, ON",
        referralCode: "YUGO-YEAR",
        referredDiscount: 50,
      }),
      tag: "move-complete",
    },
    {
      subject: "[Yugo sample] Internal low satisfaction alert (HTML)",
      html: internalLowSatAlertEmail({
        clientName: "Alex Sample",
        clientEmail: "client@example.com",
        clientPhone: "4165550199",
        moveCode: "MV-SAMPLE",
        npsScore: 2,
        moveDate: "2026-04-10",
      }),
    },
    {
      subject: "[Yugo sample] Verification code",
      html: verificationCodeEmail({ code: "482910", purpose: "2fa" }),
    },
    {
      subject: "[Yugo sample] Tracking link",
      html: trackingLinkEmail({
        clientName: "Alex",
        trackUrl: track,
        moveNumber: "MV-SAMPLE",
      }),
    },
    {
      subject: "[Yugo sample] Status update (crew)",
      html: statusUpdateEmailHtml({
        headline: "Crew is on the way",
        body: "Your crew is en route to the pickup address. You can track live from your portal.",
        ctaUrl: track,
        ctaLabel: "Track move",
        includeFooter: true,
      }),
    },
    {
      subject: "[Yugo sample] Delivery notification",
      html: deliveryNotificationEmail({
        delivery_number: "DL-SAMPLE",
        customer_name: "Alex Sample",
        delivery_address: "200 Queen St E, Toronto, ON",
        pickup_address: "100 King St W, Toronto, ON",
        scheduled_date: "Saturday, April 19, 2026",
        delivery_window: "10 AM – 2 PM",
        status: "scheduled",
        items_count: 12,
        trackUrl: `${base}/track/delivery/demo`,
      }),
    },
    {
      subject: "[Yugo sample] Move notification",
      html: moveNotificationEmail({
        move_id: "sample-move",
        move_number: "MV-SAMPLE",
        client_name: "Alex Sample",
        move_type: "residential",
        status: "in_progress",
        stage: "on_route",
        from_address: "100 King St W, Toronto, ON",
        to_address: "200 Queen St E, Toronto, ON",
        scheduled_date: "April 19, 2026",
        trackUrl: track,
      }),
    },
    {
      subject: "[Yugo sample] Staff invite",
      html: inviteUserEmail({
        name: "Alex Sample",
        email: to,
        roleLabel: "Dispatcher",
        tempPassword: "DemoPass!1",
        loginUrl: `${base}/login?welcome=1`,
      }),
    },
  ];

  const results: { subject: string; ok: boolean; id?: string; error?: string }[] = [];

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      to,
      count: templateJobs.length + htmlJobs.length,
      subjects: [
        ...templateJobs.map((j) => j.subject),
        ...htmlJobs.map((j) => j.subject),
      ],
    });
  }

  for (const job of templateJobs) {
    const r = await sendEmail({
      to,
      subject: job.subject,
      template: job.template,
      data: job.data as never,
    });
    results.push({
      subject: job.subject,
      ok: r.success,
      id: r.id,
      error: r.error,
    });
    await delay(450);
  }

  for (const job of htmlJobs) {
    const r = await sendEmail({
      to,
      subject: job.subject,
      html: job.html,
      tags: job.tag ? [{ name: "template", value: job.tag }] : undefined,
    });
    results.push({
      subject: job.subject,
      ok: r.success,
      id: r.id,
      error: r.error,
    });
    await delay(450);
  }

  const failed = results.filter((x) => !x.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    to,
    sent: results.length,
    failed: failed.length,
    results,
  });
}
