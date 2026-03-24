import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderQuoteTemplate, QuoteTemplateData } from "./quote-templates";
import {
  preMove72hrEmail,
  PreMove72hrData,
  preMove24hrEmail,
  PreMove24hrData,
  moveCompleteEmail,
  MoveCompleteData,
  balanceReceiptEmail,
  BalanceReceiptData,
  reviewRequestEmail,
  ReviewRequestData,
  reviewRequestCuratedEmail,
  reviewRequestSignatureEmail,
  reviewRequestEstateEmail,
  reviewRequestReminderEmail,
  ReviewRequestTierData,
  ReviewRequestReminderData,
  lowSatisfactionEmail,
  LowSatisfactionData,
  referralOfferEmail,
  ReferralOfferData,
  quoteFollowup1Email,
  QuoteFollowup1Data,
  quoteFollowup2Email,
  QuoteFollowup2Data,
  quoteFollowup3Email,
  QuoteFollowup3Data,
  cancellationConfirmEmail,
  CancellationConfirmData,
  quoteUpdatedEmail,
  QuoteUpdatedData,
  balanceReminder72hrEmail,
  BalanceReminder72hrData,
  balanceReminder48hrEmail,
  BalanceReminder48hrData,
  balanceAutoChargeReceiptEmail,
  BalanceAutoChargeReceiptData,
  balanceChargeFailedClientEmail,
  BalanceChargeFailedClientData,
  balanceChargeFailedAdminEmail,
  BalanceChargeFailedAdminData,
} from "./lifecycle-templates";

import { getNotificationsFromEmail } from "@/lib/config";

const DEFAULT_FROM = "Yugo <notifications@opsplus.co>";

export type TemplateName =
  | "quote-residential"
  | "quote-longdistance"
  | "quote-office"
  | "quote-singleitem"
  | "quote-whiteglove"
  | "quote-specialty"
  | "booking-confirmation"
  | "move-updated"
  | "pre-move-72hr"
  | "pre-move-24hr"
  | "balance-receipt"
  | "move-complete"
  | "review-request"
  | "low-satisfaction"
  | "referral-offer"
  | "quote-followup-1"
  | "quote-followup-2"
  | "quote-followup-2-warm"
  | "quote-followup-2-essentials"
  | "quote-followup-2-cold"
  | "quote-followup-2-essential"
  | "quote-followup-2-curated"
  | "quote-followup-3"
  | "quote-followup-3-hot"
  | "quote-followup-3-unseen"
  | "cancellation-confirm"
  | "quote-updated"
  | "balance-reminder-72hr"
  | "balance-reminder-48hr"
  | "balance-auto-charge-receipt"
  | "balance-charge-failed-client"
  | "balance-charge-failed-admin"
  | "review-request-essentials"
  | "review-request-premier"
  | "review-request-estate"
  | "review-request-essential"
  | "review-request-curated"
  | "review-request-signature"
  | "review-request-reminder"
  | "partner-statement-due"
  | "partner-statement-paid"
  | "partner-statement-charge-failed"
  | "partner-statement-charge-failed-partner"
  | "partner-card-expiring"
  | "admin-card-expiring-notice"
  | "client-card-expiring";

type TemplateDataMap = {
  "quote-residential": QuoteTemplateData;
  "quote-longdistance": QuoteTemplateData;
  "quote-office": QuoteTemplateData;
  "quote-singleitem": QuoteTemplateData;
  "quote-whiteglove": QuoteTemplateData;
  "quote-specialty": QuoteTemplateData;
  "pre-move-72hr": PreMove72hrData;
  "pre-move-24hr": PreMove24hrData;
  "balance-receipt": BalanceReceiptData;
  "move-complete": MoveCompleteData;
  "review-request": ReviewRequestData;
  "low-satisfaction": LowSatisfactionData;
  "referral-offer": ReferralOfferData;
  "quote-followup-1": QuoteFollowup1Data;
  "quote-followup-2": QuoteFollowup2Data;
  "quote-followup-2-warm": QuoteFollowup2Data;
  "quote-followup-2-essentials": QuoteFollowup2Data;
  "quote-followup-2-cold": QuoteFollowup2Data;
  "quote-followup-2-essential": QuoteFollowup2Data;
  "quote-followup-2-curated": QuoteFollowup2Data;
  "quote-followup-3": QuoteFollowup3Data;
  "quote-followup-3-hot": QuoteFollowup3Data;
  "quote-followup-3-unseen": QuoteFollowup3Data;
  "cancellation-confirm": CancellationConfirmData;
  "quote-updated": QuoteUpdatedData;
  "balance-reminder-72hr": BalanceReminder72hrData;
  "balance-reminder-48hr": BalanceReminder48hrData;
  "balance-auto-charge-receipt": BalanceAutoChargeReceiptData;
  "balance-charge-failed-client": BalanceChargeFailedClientData;
  "balance-charge-failed-admin": BalanceChargeFailedAdminData;
  "review-request-essentials": ReviewRequestTierData;
  "review-request-premier": ReviewRequestTierData;
  "review-request-estate": ReviewRequestTierData;
  "review-request-essential": ReviewRequestTierData;
  "review-request-curated": ReviewRequestTierData;
  "review-request-signature": ReviewRequestTierData;
  "review-request-reminder": ReviewRequestReminderData;
  "partner-statement-due": Record<string, unknown>;
  "partner-statement-paid": Record<string, unknown>;
  "partner-statement-charge-failed": Record<string, unknown>;
  "partner-statement-charge-failed-partner": Record<string, unknown>;
  "partner-card-expiring": Record<string, unknown>;
  "admin-card-expiring-notice": Record<string, unknown>;
  "client-card-expiring": Record<string, unknown>;
};

interface SendEmailBaseOptions {
  to: string;
  subject: string;
  from?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer | string }[];
  tags?: { name: string; value: string }[];
}

interface SendWithHtml extends SendEmailBaseOptions {
  html: string;
  template?: never;
  data?: never;
}

interface SendWithTemplate extends SendEmailBaseOptions {
  html?: never;
  template: TemplateName;
  data: TemplateDataMap[keyof TemplateDataMap];
}

export type SendEmailOptions = SendWithHtml | SendWithTemplate;

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function renderTemplate(template: string, data: unknown): string {
  const renderers: Record<string, (d: any) => string> = {
    "pre-move-72hr": preMove72hrEmail,
    "pre-move-24hr": preMove24hrEmail,
    "balance-receipt": balanceReceiptEmail,
    "move-complete": moveCompleteEmail,
    "review-request": reviewRequestEmail,
    "low-satisfaction": lowSatisfactionEmail,
    "referral-offer": referralOfferEmail,
    "quote-followup-1": quoteFollowup1Email,
    "quote-followup-2": quoteFollowup2Email,
    "quote-followup-2-warm": quoteFollowup2Email,
    "quote-followup-2-essentials": quoteFollowup2Email,
    "quote-followup-2-cold": quoteFollowup2Email,
    "quote-followup-2-essential": quoteFollowup2Email,
    "quote-followup-2-curated": quoteFollowup2Email,
    "quote-followup-3": quoteFollowup3Email,
    "quote-followup-3-hot": quoteFollowup3Email,
    "quote-followup-3-unseen": quoteFollowup3Email,
    "cancellation-confirm": cancellationConfirmEmail,
    "quote-updated": quoteUpdatedEmail,
    "balance-reminder-72hr": balanceReminder72hrEmail,
    "balance-reminder-48hr": balanceReminder48hrEmail,
    "balance-auto-charge-receipt": balanceAutoChargeReceiptEmail,
    "balance-charge-failed-client": balanceChargeFailedClientEmail,
    "balance-charge-failed-admin": balanceChargeFailedAdminEmail,
    "review-request-essential": reviewRequestCuratedEmail,
    "review-request-curated": reviewRequestCuratedEmail,
    "review-request-signature": reviewRequestSignatureEmail,
    "review-request-estate": reviewRequestEstateEmail,
    "review-request-essentials": reviewRequestCuratedEmail,
    "review-request-premier": reviewRequestSignatureEmail,
    "review-request-reminder": reviewRequestReminderEmail,

    // Partner billing & card lifecycle — simple transactional templates
    "partner-statement-due": (d: any) => `<p>Hi ${d.partnerName},</p><p>Statement <strong>${d.statementNumber}</strong> is due, <strong>$${Number(d.amount).toFixed(2)} CAD</strong>.</p><p><a href="${d.paymentUrl}">Pay Now</a></p>`,
    "partner-statement-paid": (d: any) => `<p>Hi ${d.partnerName},</p><p>Payment confirmed for statement <strong>${d.statementNumber}</strong>, <strong>$${Number(d.amount).toFixed(2)} CAD</strong>.</p>${d.receiptUrl ? `<p><a href="${d.receiptUrl}">View Receipt</a></p>` : ""}`,
    "partner-statement-charge-failed": (d: any) => `<p>URGENT: Card declined for <strong>${d.partnerName}</strong>, statement ${d.statementNumber} ($${Number(d.amount).toFixed(2)}).</p><p>Error: ${d.errorMessage}</p>`,
    "partner-statement-charge-failed-partner": (d: any) => `<p>Hi ${d.partnerName},</p><p>We were unable to charge your card on file for statement <strong>${d.statementNumber}</strong> ($${Number(d.amount).toFixed(2)} CAD).</p><p>Please <a href="${d.updateCardUrl}">update your payment method</a> to avoid service interruption.</p>`,
    "partner-card-expiring": (d: any) => `<p>Hi ${d.partnerName},</p><p>Your <strong>${d.cardBrand} ending in ${d.cardLastFour}</strong> on file with Yugo expires soon.</p><p><a href="${d.updateCardUrl}">Update your card</a> to avoid any interruption to automatic billing.</p>`,
    "admin-card-expiring-notice": (d: any) => `<p>${d.entityType === "partner" ? "Partner" : "Client"} <strong>${d.entityName}</strong> has a card expiring soon (ending ${d.cardLastFour}).</p><p><a href="${d.updateCardUrl}">View profile</a></p>`,
    "client-card-expiring": (d: any) => `<p>Hi ${d.clientName},</p><p>The card on file for your upcoming Yugo move (${d.moveCode}) expires soon.</p><p><a href="${d.updateCardUrl}">Update your card here</a> to ensure your balance payment goes through smoothly.</p>`,
  };

  const renderer = renderers[template];
  if (renderer) return renderer(data);

  if (template.startsWith("quote-")) {
    return renderQuoteTemplate(template, data as QuoteTemplateData);
  }

  throw new Error(`Unknown email template: ${template}`);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Returns the configured "From" address for outbound emails.
 * Reads from platform_config with a fallback to the hardcoded default.
 */
export async function getEmailFrom(): Promise<string> {
  try {
    return await getNotificationsFromEmail();
  } catch {
    return DEFAULT_FROM;
  }
}

const INSTRUMENT_SERIF_LINK =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
const EMAIL_DOC_BG = "#0A0A0A";

const INSTRUMENT_SERIF_FACE = `
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjnTLgNs.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7Motmp5g.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`;

/** Wraps email HTML fragment in full document with Instrument Serif so all client-facing emails can use the hero font. */
function wrapClientEmailDocument(innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">${INSTRUMENT_SERIF_FACE}</style>
</head>
<body style="margin:0;padding:0;background:${EMAIL_DOC_BG};min-height:100vh">
  ${innerHtml}
</body>
</html>`;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  let html = opts.html ?? renderTemplate(opts.template!, opts.data);
  if (!html.trimStart().startsWith("<!DOCTYPE")) {
    html = wrapClientEmailDocument(html);
  }

  const resend = getResend();
  const fromAddr = opts.from ?? await getEmailFrom();

  const tags = [...(opts.tags ?? [])];
  if (opts.template) {
    tags.push({ name: "template", value: opts.template });
  }

  const { data: result, error } = await resend.emails.send({
    from: fromAddr,
    to: [opts.to],
    subject: opts.subject,
    html,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: typeof a.content === "string" ? a.content : a.content.toString("base64"),
    })),
    replyTo: opts.replyTo,
    tags: tags.length > 0 ? tags : undefined,
    headers: {
      Precedence: "auto",
      "X-Auto-Response-Suppress": "All",
    },
  });

  const supabase = createAdminClient();
  Promise.resolve(
    supabase.from("email_log").insert({
      recipient: opts.to,
      subject: opts.subject,
      template: opts.template ?? null,
      resend_id: result?.id ?? null,
      status: error ? "failed" : "sent",
      error_message: error ? JSON.stringify(error) : null,
    }),
  ).catch(() => {});

  if (error) {
    return { success: false, error: JSON.stringify(error) };
  }

  return { success: true, id: result?.id };
}
