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
  lowSatisfactionEmail,
  LowSatisfactionData,
  referralOfferEmail,
  ReferralOfferData,
} from "./lifecycle-templates";

const FROM_ADDRESS = "YUGO <notifications@opsplus.co>";

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
  | "referral-offer";

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
  if (template.startsWith("quote-")) {
    return renderQuoteTemplate(template, data as QuoteTemplateData);
  }

  const renderers: Record<string, (d: any) => string> = {
    "pre-move-72hr": preMove72hrEmail,
    "pre-move-24hr": preMove24hrEmail,
    "balance-receipt": balanceReceiptEmail,
    "move-complete": moveCompleteEmail,
    "review-request": reviewRequestEmail,
    "low-satisfaction": lowSatisfactionEmail,
    "referral-offer": referralOfferEmail,
  };

  const renderer = renderers[template];
  if (!renderer) throw new Error(`Unknown email template: ${template}`);
  return renderer(data);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const html = opts.html ?? renderTemplate(opts.template!, opts.data);

  const resend = getResend();

  const tags = [...(opts.tags ?? [])];
  if (opts.template) {
    tags.push({ name: "template", value: opts.template });
  }

  const { data: result, error } = await resend.emails.send({
    from: opts.from ?? FROM_ADDRESS,
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
