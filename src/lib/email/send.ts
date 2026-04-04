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
  partnerStatementDueEmail,
  partnerStatementPaidEmail,
  partnerStatementChargeFailedEmail,
  partnerStatementChargeFailedPartnerEmail,
  partnerCardExpiringEmail,
  adminCardExpiringNoticeEmail,
  clientCardExpiringEmail,
} from "./lifecycle-templates";

import { getNotificationsFromEmail } from "@/lib/config";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { finalizeClientEmailHtml } from "@/lib/email/finalize-client-html";

export { finalizeClientEmailHtml } from "@/lib/email/finalize-client-html";

const DEFAULT_FROM = "Yugo <notifications@opsplus.co>";

export type TemplateName =
  | "quote-residential"
  | "quote-longdistance"
  | "quote-office"
  | "quote-singleitem"
  | "quote-whiteglove"
  | "quote-specialty"
  | "quote-event"
  | "quote-labouronly"
  | "quote-binrental"
  | "quote-b2boneoff"
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
  "quote-event": QuoteTemplateData;
  "quote-labouronly": QuoteTemplateData;
  "quote-binrental": QuoteTemplateData;
  "quote-b2boneoff": QuoteTemplateData;
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

/** Staff-only templates: no default client support reply-to. */
const ADMIN_INTERNAL_EMAIL_TEMPLATES = new Set<string>([
  "balance-charge-failed-admin",
  "admin-card-expiring-notice",
]);

function defaultReplyToForTemplate(template: string | undefined): string | undefined {
  if (!template || ADMIN_INTERNAL_EMAIL_TEMPLATES.has(template)) return undefined;
  return getClientSupportEmail();
}

/** Minimal HTML → text for multipart/alternative (improves deliverability vs. HTML-only). */
function roughPlainTextFromHtml(html: string): string {
  const stripped = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&middot;/gi, " · ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return stripped
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 120_000);
}

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

    "partner-statement-due": partnerStatementDueEmail,
    "partner-statement-paid": partnerStatementPaidEmail,
    "partner-statement-charge-failed": partnerStatementChargeFailedEmail,
    "partner-statement-charge-failed-partner": partnerStatementChargeFailedPartnerEmail,
    "partner-card-expiring": partnerCardExpiringEmail,
    "admin-card-expiring-notice": adminCardExpiringNoticeEmail,
    "client-card-expiring": clientCardExpiringEmail,
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

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  let html = opts.html ?? renderTemplate(opts.template!, opts.data);
  html = finalizeClientEmailHtml(html);

  const resend = getResend();
  const fromAddr = opts.from ?? await getEmailFrom();

  const tags = [...(opts.tags ?? [])];
  if (opts.template) {
    tags.push({ name: "template", value: opts.template });
  }

  const plainText =
    opts.template && html.length > 0 ? roughPlainTextFromHtml(html) : undefined;

  const { data: result, error } = await resend.emails.send({
    from: fromAddr,
    to: [opts.to],
    subject: opts.subject,
    html,
    text: plainText,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: typeof a.content === "string" ? a.content : a.content.toString("base64"),
    })),
    replyTo: opts.replyTo ?? defaultReplyToForTemplate(opts.template),
    tags: tags.length > 0 ? tags : undefined,
    headers: {
      /* Omit non-standard Precedence — can contribute to bulk/promotions heuristics in some clients */
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
