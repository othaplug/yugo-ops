/**
 * Payloads for design QA: one email per registered TemplateName plus shared HTML templates.
 * Used by POST /api/admin/email/send-style-samples and scripts/send-all-email-samples.ts
 */
import { getEmailBaseUrl } from "@/lib/email-base-url";
import type { TemplateName } from "@/lib/email/send";
import type { QuoteTemplateData } from "@/lib/email/quote-templates";
import { DEFAULT_GOOGLE_BUSINESS_REVIEW_URL } from "@/lib/google-review-url";
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
  bookingConfirmationEmail,
  essentialConfirmationEmail,
  invitePartnerEmail,
  signatureConfirmationEmail,
} from "@/lib/email-templates";

export type StyleSampleRecipientContext = {
  to: string;
  base: string;
  track: string;
};

export function buildStyleSampleRecipientContext(to: string): StyleSampleRecipientContext {
  const base = getEmailBaseUrl();
  const track = `${base}/track/move/sample-move?token=demo`;
  return { to, base, track };
}

export type StyleSampleTemplateJob = { template: TemplateName; subject: string; data: unknown };

export type StyleSampleHtmlJob = { subject: string; html: string; tag?: string };

function sampleTiers(): Record<string, { label: string; price: number; includes: string[] }> {
  return {
    essential: {
      label: "Essential",
      price: 1899,
      includes: ["2 movers", "16 ft truck", "Basic furniture protection"],
    },
    signature: {
      label: "Signature",
      price: 2499,
      includes: ["3 movers", "26 ft truck", "Full wrapping", "GPS tracking"],
    },
    estate: {
      label: "Estate",
      price: 3899,
      includes: ["White glove handling", "4 movers", "Premium valuation"],
    },
  };
}

function quoteDataResidential(ctx: StyleSampleRecipientContext): QuoteTemplateData {
  return {
    clientName: "Alex Sample",
    quoteId: "q-sample",
    quoteUrl: `${ctx.base}/quote/demo-q`,
    serviceType: "residential",
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    fromAddress: "100 King St W, Toronto, ON",
    toAddress: "200 Queen St E, Toronto, ON",
    fromAccess: "elevator_booked",
    toAccess: "stairs_walkup",
    moveDate: "2026-05-15",
    moveSize: "2br",
    distance: "12 km",
    estCrewSize: 3,
    estHours: 6,
    truckSize: "26 ft box truck",
    tiers: sampleTiers(),
    recommendedTier: "signature",
    coordinatorName: "Sam Coordinator",
    coordinatorPhone: "(647) 370-4525",
  };
}

export function getStyleSampleTemplateJobs(ctx: StyleSampleRecipientContext): StyleSampleTemplateJob[] {
  const { base, track } = ctx;
  const quoteUrl = `${base}/quote/demo`;
  const fq2Exp = new Date(Date.now() + 5 * 86400000).toISOString();
  const fq2Base = {
    clientName: "Alex Sample",
    quoteUrl,
    serviceLabel: "Residential move",
    moveDate: "2026-05-01",
    expiresAt: fq2Exp,
  };
  const fq3Exp = new Date(Date.now() + 2 * 86400000).toISOString();
  const fq3Base = {
    clientName: "Alex Sample",
    quoteUrl,
    serviceLabel: "Residential move",
    expiresAt: fq3Exp,
  };
  const rv = {
    clientName: "Alex Sample",
    tier: "signature" as const,
    reviewUrl: `${base}/review?token=style-sample-token`,
    reviewRedirectUrl: `${base}/api/review/redirect?token=style-sample-token`,
    trackingUrl: track,
    coordinatorName: "Sam Coordinator",
  };

  const qRes = quoteDataResidential(ctx);
  const qLong: QuoteTemplateData = {
    ...qRes,
    serviceType: "long_distance",
    distance: "450 km",
    moveSize: "3br",
  };
  const qOffice: QuoteTemplateData = {
    ...qRes,
    serviceType: "office",
    companyName: "Sample Corp Ltd",
    customPrice: 12500,
    tiers: null,
    recommendedTier: null,
  };
  const qSingle: QuoteTemplateData = {
    ...qRes,
    serviceType: "single_item",
    itemDescription: "Grand piano (baby grand)",
    itemCategory: "Instruments",
    customPrice: 890,
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };
  const qWg: QuoteTemplateData = {
    ...qSingle,
    serviceType: "white_glove",
    itemDescription: "Antique glass cabinet",
    customPrice: 2400,
  };
  const qSpec: QuoteTemplateData = {
    ...qRes,
    serviceType: "specialty",
    projectType: "Gallery installation",
    customPrice: 5600,
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };
  const qEvent: QuoteTemplateData = {
    ...qRes,
    serviceType: "event",
    eventName: "Spring Gala 2026",
    customPrice: 4800,
    eventDeposit: 1200,
    eventLegBlocks: [
      {
        label: "Leg 1 — Load-in",
        deliveryDay: "Friday, May 2, 2026",
        returnDay: "Sunday, May 4, 2026",
        origin: "100 Warehouse Rd, Mississauga, ON",
        venue: "Metro Convention Centre",
        crewLine: "4 crew, 26 ft truck",
        delivery: 2200,
        ret: 1800,
        legSubtotal: 4000,
      },
    ],
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };
  const qLabour: QuoteTemplateData = {
    ...qRes,
    serviceType: "labour_only",
    labourDescription: "Load/unload PODS; 2-bedroom equivalent",
    labourCrewSize: 2,
    labourHours: 4,
    labourRate: 75,
    labourVisits: 2,
    customPrice: 600,
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };
  const qBin: QuoteTemplateData = {
    ...qRes,
    serviceType: "bin_rental",
    binBundleLabel: "2-bedroom bundle",
    binDropOffDate: "2026-04-28",
    binPickupDate: "2026-05-12",
    binMoveDate: "2026-05-05",
    binDeliveryAddress: "100 King St W, Toronto, ON",
    binPickupAddress: "100 King St W, Toronto, ON",
    binLineItems: [
      { label: "Bin rental (35 bins × 14 days)", amount: 420 },
      { label: "Delivery & pickup", amount: 89 },
    ],
    binSubtotal: 509,
    binTax: 66,
    binGrandTotal: 575,
    binIncludeLines: ["35 reusable bins", "Wardrobe boxes on move day", "Zip ties included"],
    customPrice: null,
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };
  const qB2b: QuoteTemplateData = {
    ...qRes,
    serviceType: "b2b_one_off",
    b2bBusinessName: "Design Studio North",
    b2bItems: "Sofa (3-seater), 2 accent chairs, coffee table",
    b2bVerticalCode: "designer",
    b2bHandlingType: "white_glove",
    customPrice: 850,
    tiers: null,
    recommendedTier: null,
    moveSize: null,
  };

  return [
    { template: "quote-residential", subject: "[Yugo sample] Quote — residential", data: qRes },
    { template: "quote-longdistance", subject: "[Yugo sample] Quote — long distance", data: qLong },
    { template: "quote-office", subject: "[Yugo sample] Quote — office", data: qOffice },
    { template: "quote-singleitem", subject: "[Yugo sample] Quote — single item", data: qSingle },
    { template: "quote-whiteglove", subject: "[Yugo sample] Quote — white glove", data: qWg },
    { template: "quote-specialty", subject: "[Yugo sample] Quote — specialty", data: qSpec },
    { template: "quote-event", subject: "[Yugo sample] Quote — event", data: qEvent },
    { template: "quote-labouronly", subject: "[Yugo sample] Quote — labour only", data: qLabour },
    { template: "quote-binrental", subject: "[Yugo sample] Quote — bin rental", data: qBin },
    { template: "quote-b2boneoff", subject: "[Yugo sample] Quote — B2B one-off", data: qB2b },

    {
      template: "pre-move-72hr",
      subject: "[Yugo sample] Pre-move, 72 hours",
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
      subject: "[Yugo sample] Pre-move, 24 hours",
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
        coordinatorPhone: "(647) 370-4525",
        trackingUrl: track,
      },
    },
    {
      template: "balance-receipt",
      subject: "[Yugo sample] Balance receipt",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        amount: 1249,
        paymentMethod: "Visa •••• 4242",
        totalPaid: 2498,
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
      data: { clientName: "Alex Sample", referralUrl: `${base}/client` },
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
        refundAmount: 500,
        trackingUrl: track,
      },
    },
    {
      template: "balance-reminder-72hr",
      subject: "[Yugo sample] Balance reminder, 72h",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-18",
        balanceAmount: 1249,
        trackingUrl: track,
      },
    },
    {
      template: "balance-reminder-48hr",
      subject: "[Yugo sample] Balance reminder, 48h",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        moveDate: "2026-04-18",
        balanceAmount: 1249,
        ccTotal: 1249,
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
        baseBalance: 1200,
        processingFee: 39.6,
        transactionFee: 0,
        totalCharged: 1239.6,
        trackingUrl: track,
      },
    },
    {
      template: "balance-charge-failed-client",
      subject: "[Yugo sample] Balance charge failed (client)",
      data: { clientName: "Alex Sample", moveCode: "MV-SAMPLE", balanceAmount: 1249 },
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
        balanceAmount: 1249,
        errorMessage: "card_declined",
      },
    },
    {
      template: "review-request",
      subject: "[Yugo sample] Review request (legacy shell)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        googleReviewUrl: DEFAULT_GOOGLE_BUSINESS_REVIEW_URL,
        referralUrl: `${base}/client`,
        trackingUrl: track,
      },
    },
    {
      template: "review-request-curated",
      subject: "[Yugo sample] Review, curated tier (legacy shell)",
      data: { ...rv, tier: "signature" },
    },
    {
      template: "review-request-signature",
      subject: "[Yugo sample] Review, signature (legacy shell)",
      data: {
        clientName: rv.clientName,
        tier: "signature",
        reviewUrl: rv.reviewUrl,
        reviewRedirectUrl: rv.reviewRedirectUrl,
        trackingUrl: rv.trackingUrl,
      },
    },
    {
      template: "review-request-estate",
      subject: "[Yugo sample] Review, estate (legacy shell)",
      data: { ...rv, tier: "estate" },
    },
    {
      template: "review-request-reminder",
      subject: "[Yugo sample] Review reminder (legacy shell)",
      data: {
        clientName: "Alex Sample",
        reviewUrl: `${base}/review?token=style-sample-token`,
        reviewRedirectUrl: `${base}/api/review/redirect?token=style-sample-token`,
      },
    },
    {
      template: "review-request-essentials",
      subject: "[Yugo sample] Review request — essentials template",
      data: { ...rv, tier: "essential" },
    },
    {
      template: "review-request-premier",
      subject: "[Yugo sample] Review request — premier template",
      data: { ...rv, tier: "signature" },
    },
    {
      template: "review-request-essential",
      subject: "[Yugo sample] Review request — essential (curated renderer)",
      data: { ...rv, tier: "essential" },
    },
    {
      template: "low-satisfaction",
      subject: "[Yugo sample] Low satisfaction (legacy shell)",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        coordinatorName: "Sam Coordinator",
        coordinatorPhone: "(647) 370-4525",
        coordinatorEmail: "coord@helloyugo.com",
        trackingUrl: track,
      },
    },
    {
      template: "quote-followup-1",
      subject: "[Yugo sample] Quote follow-up 1",
      data: { clientName: "Alex Sample", quoteUrl, serviceLabel: "Residential move" },
    },
    { template: "quote-followup-2", subject: "[Yugo sample] Quote follow-up 2 (default)", data: fq2Base },
    {
      template: "quote-followup-2-warm",
      subject: "[Yugo sample] Quote follow-up 2 (warm)",
      data: { ...fq2Base, tier: "signature" },
    },
    {
      template: "quote-followup-2-essentials",
      subject: "[Yugo sample] Quote follow-up 2 (essentials)",
      data: { ...fq2Base, tier: "essential" },
    },
    {
      template: "quote-followup-2-essential",
      subject: "[Yugo sample] Quote follow-up 2 (essential)",
      data: { ...fq2Base, tier: "essential" },
    },
    {
      template: "quote-followup-2-curated",
      subject: "[Yugo sample] Quote follow-up 2 (curated)",
      data: { ...fq2Base, tier: "curated" },
    },
    { template: "quote-followup-3", subject: "[Yugo sample] Quote follow-up 3", data: fq3Base },
    {
      template: "quote-followup-3-hot",
      subject: "[Yugo sample] Quote follow-up 3 (hot)",
      data: { ...fq3Base, tier: "hot" },
    },
    {
      template: "quote-followup-3-unseen",
      subject: "[Yugo sample] Quote follow-up 3 (unseen)",
      data: { ...fq3Base },
    },
    {
      template: "quote-updated",
      subject: "[Yugo sample] Quote updated",
      data: {
        clientName: "Alex Sample",
        quoteUrl,
        serviceLabel: "Residential move",
        changesSummary: "Added packing for kitchen. Updated crew size to 4.",
      },
    },
    {
      template: "partner-statement-due",
      subject: "[Yugo sample] Partner statement due",
      data: {
        partnerName: "Sample Partner Co",
        statementNumber: "ST-2401",
        amount: 1250.4,
        paymentUrl: `${base}/partner/statements/sample/pay`,
      },
    },
    {
      template: "partner-statement-paid",
      subject: "[Yugo sample] Partner statement paid",
      data: {
        partnerName: "Sample Partner Co",
        statementNumber: "ST-2401",
        amount: 1250.4,
        receiptUrl: `${base}/partner/statements/sample`,
      },
    },
    {
      template: "partner-statement-charge-failed",
      subject: "[Yugo sample] Partner statement charge failed (admin)",
      data: {
        partnerName: "Sample Partner Co",
        statementNumber: "ST-2401",
        amount: 1250.4,
        errorMessage: "insufficient_funds",
      },
    },
    {
      template: "partner-statement-charge-failed-partner",
      subject: "[Yugo sample] Partner statement charge failed (partner)",
      data: {
        partnerName: "Sample Partner Co",
        statementNumber: "ST-2401",
        amount: 1250.4,
        updateCardUrl: `${base}/partner/settings/billing`,
      },
    },
    {
      template: "partner-card-expiring",
      subject: "[Yugo sample] Partner card expiring",
      data: {
        partnerName: "Sample Partner Co",
        cardBrand: "Visa",
        cardLastFour: "4242",
        updateCardUrl: `${base}/partner/settings/billing`,
      },
    },
    {
      template: "admin-card-expiring-notice",
      subject: "[Yugo sample] Admin — card expiring notice",
      data: {
        entityType: "partner",
        entityName: "Sample Partner Co",
        cardLastFour: "4242",
        updateCardUrl: `${base}/admin/partners/sample/billing`,
      },
    },
    {
      template: "client-card-expiring",
      subject: "[Yugo sample] Client card expiring",
      data: {
        clientName: "Alex Sample",
        moveCode: "MV-SAMPLE",
        updateCardUrl: `${base}/track/move/sample-move`,
      },
    },
  ];
}

export function getStyleSampleHtmlJobs(ctx: StyleSampleRecipientContext): StyleSampleHtmlJob[] {
  const { base, track, to } = ctx;
  return [
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
    { subject: "[Yugo sample] Verification code", html: verificationCodeEmail({ code: "482910", purpose: "2fa" }) },
    {
      subject: "[Yugo sample] Tracking link",
      html: trackingLinkEmail({ clientName: "Alex", trackUrl: track, moveNumber: "MV-SAMPLE" }),
    },
    {
      subject: "[Yugo sample] Status update (crew)",
      html: statusUpdateEmailHtml({
        headline: "Crew is on the way",
        body: "Your crew is en route to the pickup address. You can track live from your portal.",
        ctaUrl: track,
        ctaLabel: "Track move",
        includeFooter: true,
        eyebrow: "Live update",
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
}

export function getPremiumBookingHtmlJobs(ctx: StyleSampleRecipientContext): StyleSampleHtmlJob[] {
  const { base, track } = ctx;
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
    totalWithTax: 4200,
    depositPaid: 1050,
    balanceRemaining: 3150,
    trackingUrl: track,
    includes: [
      "Dedicated moving truck",
      "Professional crew of 3",
      "Full protective wrapping for all furniture",
      "Mattress and TV protection included",
      "Enhanced valuation coverage",
      "Real-time GPS tracking",
    ] as string[],
  };
  return [
    {
      subject: "[Yugo sample] Signature booking confirmation (premium)",
      html: signatureConfirmationEmail({
        ...tierCommon,
        moveCode: "PREVIEW-SIG",
        tierLabel: "Signature",
      }),
    },
    {
      subject: "[Yugo sample] Essential booking confirmation (premium)",
      html: essentialConfirmationEmail({
        ...tierCommon,
        moveCode: "PREVIEW-ESS",
        tierLabel: "Essential",
        includes: [],
      }),
    },
    {
      subject: "[Yugo sample] Deposit booking / equinox layout",
      html: bookingConfirmationEmail({
        clientName: "Sample Customer",
        moveCode: "PREVIEW-DEP",
        moveDate: "2026-05-15",
        fromAddress: tierCommon.fromAddress,
        toAddress: tierCommon.toAddress,
        tierLabel: "Signature",
        serviceLabel: "Local Residential Move",
        totalWithTax: 4200,
        depositPaid: 1050,
        balanceRemaining: 3150,
        trackingUrl: track,
      }),
    },
    {
      subject: "[Yugo sample] Partner onboarding / invite (premium)",
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
}

export function countAllStyleSampleEmails(ctx: StyleSampleRecipientContext): number {
  return (
    getStyleSampleTemplateJobs(ctx).length +
    getStyleSampleHtmlJobs(ctx).length +
    getPremiumBookingHtmlJobs(ctx).length
  );
}
