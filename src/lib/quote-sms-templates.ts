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
      `Your Yugo quote for ${label} is ready whenever you are.`,
      `View your quote:\n${params.quoteUrl}`,
      `We are happy to answer any questions. Reply here or call (647) 370-4525.`,
      `The Yugo Team`,
    ].join("\n\n");
  }

  if (st === "single_item") {
    return [
      greet,
      `Your delivery quote from Yugo is ready.`,
      `View and book at your convenience:\n${params.quoteUrl}`,
      `The Yugo Team`,
    ].join("\n\n");
  }

  return [
    greet,
    `Your Yugo moving quote is ready.`,
    `View your quote:\n${params.quoteUrl}`,
    `We are here if you have any questions. Reply or call (647) 370-4525.`,
    `The Yugo Team`,
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
      `Your Yugo quote is still available whenever you are ready.`,
      `Happy to answer any questions.`,
      `Open your quote:\n${url}`,
    ].join("\n\n");
  }
  if (params.followupNumber === 2) {
    const daysLeft = params.expiresAt
      ? Math.max(1, Math.ceil((new Date(params.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    const n = daysLeft ?? 7;
    return [
      `Hi ${name},`,
      `Your Yugo quote is valid for ${n} more day${n === 1 ? "" : "s"}.`,
      `Lock in your date and rate when you are ready.`,
      `View quote:\n${url}`,
    ].join("\n\n");
  }
  return [
    `Hi ${name},`,
    `A gentle reminder that your Yugo quote expires tomorrow.`,
    `We would love to take care of your move.`,
    `View quote:\n${url}`,
  ].join("\n\n");
}
