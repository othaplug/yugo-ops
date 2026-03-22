/**
 * SMS copy when a quote link is sent. Keep in sync with brand voice.
 */
export function buildQuoteSmsBody(params: {
  firstName?: string | null;
  serviceType: string;
  quoteUrl: string;
  eventName?: string | null;
}): string {
  const greeting = params.firstName?.trim() ? `Hi ${params.firstName.trim()}, ` : "Hi, ";
  const st = params.serviceType;

  if (st === "event") {
    const ev = params.eventName?.trim();
    const label = ev ? ev : "your event";
    return `${greeting}your Yugo quote for ${label} is ready.

View your quote: ${params.quoteUrl}

Questions? Reply here or call (647) 370-4525.

— The Yugo Team`;
  }

  if (st === "single_item") {
    return `${greeting}your delivery quote from Yugo is ready.

View & book: ${params.quoteUrl}

— The Yugo Team`;
  }

  return `${greeting}your Yugo moving quote is ready.

View your quote: ${params.quoteUrl}

Questions? Reply here or call (647) 370-4525.

— The Yugo Team`;
}

/** Automated follow-up SMS (cron / manual batch) — OpenPhone */
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
    return `Hi ${name}, just following up on your Yugo quote. Any questions? ${url} — The Yugo Team`;
  }
  if (params.followupNumber === 2) {
    const daysLeft = params.expiresAt
      ? Math.max(1, Math.ceil((new Date(params.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    const n = daysLeft ?? 7;
    return `Hi ${name}, your Yugo quote expires in ${n} days. Book now to lock in your date: ${url}`;
  }
  return `Hi ${name}, your Yugo quote expires tomorrow. Don't miss out: ${url}`;
}
