/**
 * Client-facing UI palette. Matches the public quote page so all customer touchpoints
 * (tracking, client landing, payment, etc.) share the same look and feel.
 * Do not change these values without aligning with the quote page design.
 */
export const WINE = "#5C1A33";
export const FOREST = "#2C3E2D";
export const GOLD = "#B8962E";
export const CREAM = "#FAF7F2";

/** Secondary / supporting copy on cream & warm white (WCAG AA on CREAM). */
export const TEXT_MUTED_ON_LIGHT = "#4F4B47";
/** Form placeholders on white inputs (AA on #FFFFFF). */
export const PLACEHOLDER_ON_WHITE = "#6B6B6B";

/**
 * Tight uppercase labels on live track / cream cards — smaller type and less
 * letter-spacing than quote page eyebrows (`QUOTE_EYEBROW_CLASS` in quote-shared).
 */
export const TRACK_EYEBROW_CLASS =
  "text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] leading-none [font-family:var(--font-body)]";

/** Collapsible card titles (e.g. Move details) — same rhythm, one step up from eyebrows. */
export const TRACK_CARD_TITLE_CLASS =
  "text-[12px] sm:text-[13px] font-bold uppercase tracking-[0.08em] leading-none [font-family:var(--font-body)]";

/**
 * Partner portal settings — section / form eyebrows. DM Sans, tight caps.
 */
export const PARTNER_SETTINGS_EYEBROW_CLASS =
  "text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.05em] leading-none [font-family:var(--font-body)]";

/**
 * Partner settings menu rows & preference card titles. DM Sans, tight caps (replaces wine serif on those lines).
 */
export const PARTNER_SETTINGS_MENU_TITLE_CLASS =
  "text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.05em] leading-snug [font-family:var(--font-body)]";

/**
 * Partner settings sign-out label — DM Sans, tight caps (same rhythm as menu titles).
 */
export const PARTNER_SETTINGS_SIGN_OUT_LABEL_CLASS =
  "text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.05em] leading-none [font-family:var(--font-body)]";

/** Partner settings account card — contact name, DM Sans tight caps (matches menu row titles). */
export const PARTNER_SETTINGS_ACCOUNT_NAME_CLASS =
  "text-[14px] sm:text-[15px] font-bold uppercase tracking-[0.05em] leading-snug truncate [font-family:var(--font-body)]";

/** Partner settings section caps on cream — solid forest (avoids low-contrast translucent greens). */
export const PARTNER_SETTINGS_SECTION_LABEL_COLOR = "#2C3E2D";
