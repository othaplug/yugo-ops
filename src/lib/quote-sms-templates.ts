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

/** Automated follow-up SMS (cron) — same voice as initial quote SMS */
export function buildQuoteFollowupSmsBody(params: {
  firstName?: string | null;
  serviceType: string;
  quoteUrl: string;
  followupNumber: 1 | 2 | 3;
  expiresAt?: string | null;
  eventName?: string | null;
}): string {
  const greeting = params.firstName?.trim() ? `Hi ${params.firstName.trim()}, ` : "Hi, ";
  const st = params.serviceType;
  const ev = params.eventName?.trim();
  const eventForClause =
    st === "event" ? (ev ? `for ${ev}` : "for your event") : "";

  const movingFollow = () => {
    if (st === "event") {
      return `${greeting}following up on your Yugo quote ${eventForClause}.`;
    }
    if (st === "single_item") {
      return `${greeting}following up on your delivery quote from Yugo.`;
    }
    return `${greeting}following up on your Yugo moving quote.`;
  };

  const viewLine =
    st === "single_item" && params.followupNumber === 1
      ? `View & book: ${params.quoteUrl}`
      : `View your quote: ${params.quoteUrl}`;

  const signOff =
    st === "single_item" ? "\n\n— The Yugo Team" : "\n\nQuestions? Reply here or call (647) 370-4525.\n\n— The Yugo Team";

  if (params.followupNumber === 1) {
    return `${movingFollow()}

${viewLine}${signOff}`;
  }

  if (params.followupNumber === 2) {
    const daysLeft = params.expiresAt
      ? Math.max(0, Math.ceil((new Date(params.expiresAt).getTime() - Date.now()) / 86_400_000))
      : null;
    const expPart =
      daysLeft !== null
        ? `expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
        : "expires soon";
    if (st === "event") {
      return `${greeting}your Yugo quote ${eventForClause} ${expPart}. Lock your dates here: ${params.quoteUrl}${signOff}`;
    }
    if (st === "single_item") {
      return `${greeting}your delivery quote ${expPart}. ${viewLine}${signOff}`;
    }
    return `${greeting}your Yugo moving quote ${expPart}. ${viewLine}${signOff}`;
  }

  // followup 3
  if (st === "event") {
    return `${greeting}last reminder — your event quote expires tomorrow. ${viewLine}${signOff}`;
  }
  if (st === "single_item") {
    return `${greeting}last reminder — your quote expires tomorrow. ${viewLine}${signOff}`;
  }
  return `${greeting}last reminder — your moving quote expires tomorrow. ${viewLine}${signOff}`;
}
