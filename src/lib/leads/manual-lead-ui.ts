/** Shared classes for manual lead forms: no focus ring or active border change */
export const MANUAL_LEAD_FIELD_CLASS =
  "mt-1 w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[var(--tx)] outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-[var(--brd)] focus-visible:border-[var(--brd)] active:border-[var(--brd)]"

export const MANUAL_LEAD_TEXTAREA_CLASS = `${MANUAL_LEAD_FIELD_CLASS} min-h-[4.5rem] max-h-32 resize-y font-mono text-[11px]`

export const REFERRER_OR_SITE_LABEL = "Referrer or site (optional)"
