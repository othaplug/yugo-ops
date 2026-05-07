import { isClientLogisticsDeliveryServiceType } from "@/lib/quotes/b2b-quote-copy";

/**
 * SMS copy when a quote link is sent. Keep in sync with brand voice.
 * Blank lines between paragraphs for readability on phones.
 */
export function buildQuoteSmsBody(params: {
  firstName?: string | null;
  serviceType: string;
  quoteUrl: string;
  eventName?: string | null;
}): string {
  const fn = params.firstName?.trim();
  const greet = fn ? `Hi ${fn},` : "Hi,";
  const st = params.serviceType;

  if (st === "event") {
    const ev = params.eventName?.trim();
    const label = ev ? ev : "your event";
    return [
      greet,
      `Your Yugo quote for ${label} is ready. We have put together a tailored proposal just for you.`,
      `View your quote:\n${params.quoteUrl}`,
      `We are happy to answer any questions. Reply here or call (647) 370-4525.`,
    ].join("\n\n");
  }

  if (isClientLogisticsDeliveryServiceType(st)) {
    return [
      greet,
      `Your delivery quote from Yugo is ready. We have everything lined up whenever you are.`,
      `View your quote:\n${params.quoteUrl}`,
      `Questions? We are here. Reply or call (647) 370-4525.`,
    ].join("\n\n");
  }

  if (st === "bin_rental") {
    return [
      greet,
      `Your Yugo bin rental quote is ready and waiting.`,
      `View your quote:\n${params.quoteUrl}`,
      `Questions? Reply here or call (647) 370-4525.`,
    ].join("\n\n");
  }

  return [
    greet,
    `Your Yugo moving quote is ready. We have crafted a plan tailored to your move.`,
    `View your quote:\n${params.quoteUrl}`,
    `Questions? We are here. Reply or call (647) 370-4525.`,
  ].join("\n\n");
}

/** Automated follow-up SMS (cron / manual batch) - OpenPhone */
export function buildQuoteFollowupSmsBody(params: {
  firstName?: string | null;
  serviceType: string;
  quoteUrl: string;
  followupNumber: 1 | 2 | 3;
  expiresAt?: string | null;
  eventName?: string | null;
}): string {
  const name = params.firstName?.trim() || "there";
  const url = params.quoteUrl;

  if (params.followupNumber === 1) {
    return [
      `Hi ${name},`,
      `Your Yugo quote is still available whenever you are ready. We would love to take care of your move.`,
      `Happy to answer any questions you may have.`,
      `View your quote:\n${url}`,
    ].join("\n\n");
  }

  if (params.followupNumber === 2) {
    const daysLeft = params.expiresAt
      ? Math.max(1, Math.ceil((new Date(params.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    const n = daysLeft ?? 7;
    return [
      `Hi ${name},`,
      `Just a heads up — your Yugo quote is valid for ${n} more day${n === 1 ? "" : "s"}.`,
      `Lock in your date and rate whenever you are ready.`,
      `View your quote:\n${url}`,
    ].join("\n\n");
  }

  const st = params.serviceType;
  const closingLine = isClientLogisticsDeliveryServiceType(st)
    ? `We would love to complete your delivery.`
    : st === "bin_rental"
      ? `We would love to take care of your bin rental.`
      : `We would love to take care of your move.`;

  return [
    `Hi ${name},`,
    `A gentle reminder that your Yugo quote expires tomorrow. ${closingLine}`,
    `View your quote:\n${url}`,
  ].join("\n\n");
}
