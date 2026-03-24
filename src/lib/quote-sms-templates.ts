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
    return `${greeting}your Yugo quote for ${label} is ready whenever you are.

View your quote: ${params.quoteUrl}

We are happy to answer any questions. Reply here or call (647) 370-4525.

The Yugo Team`;
  }

  if (st === "single_item") {
    return `${greeting}your delivery quote from Yugo is ready.

View and book at your convenience: ${params.quoteUrl}

The Yugo Team`;
  }

  return `${greeting}your Yugo moving quote is ready.

View your quote: ${params.quoteUrl}

We are here if you have any questions. Reply or call (647) 370-4525.

The Yugo Team`;
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
    return `Hi ${name}, your Yugo quote is still available whenever you are ready. Happy to answer any questions: ${url}`;
  }
  if (params.followupNumber === 2) {
    const daysLeft = params.expiresAt
      ? Math.max(1, Math.ceil((new Date(params.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    const n = daysLeft ?? 7;
    return `Hi ${name}, just a note that your Yugo quote is valid for ${n} more day${n === 1 ? "" : "s"}. Lock in your date and rate when you are ready: ${url}`;
  }
  return `Hi ${name}, a gentle reminder that your Yugo quote expires tomorrow. We would love to take care of your move: ${url}`;
}
