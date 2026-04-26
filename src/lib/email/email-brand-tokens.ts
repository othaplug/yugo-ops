/**
 * Shared email visual tokens aligned with quote web (forest primary CTAs, squared buttons).
 * Import from transactional templates only — do not import from client-facing React.
 *
 * Quote HTML emails declare `color-scheme: only light` and explicit hex backgrounds on
 * `html` / `body` / tables so Apple Mail, iOS, and clients that honor `prefers-color-scheme`
 * do not auto-invert or substitute system colours for our cream shell and tier cards.
 *
 * Other client mail: {@link getFragmentClientEmailDarkLockCss} in `email-client-dark-lock.ts`
 * (fragments) and {@link resolveFullDocumentDarkLockCss} (full HTML injected via
 * `injectEmailResponsiveCssIntoFullDocument`).
 */

export const EMAIL_FOREST = "#2C3E2D";

/** Premium client email page — matches quote-adjacent cream shell. */
export const EMAIL_PREMIUM_PAGE = "#FCF9F4";

/** Warm inset / island (web quote #FFFBF7) — cards, admin inner, table bands. */
export const EMAIL_PREMIUM_ISLAND = "#FFFBF7";

/**
 * Muted fills for credential blocks, progress bars, callouts — forest-tinted cream (not cold #EBEBEB).
 */
export const EMAIL_PREMIUM_MUTED_FILL = "rgba(44,62,45,0.06)";

/** Section header row background inside summary tables on cream. */
export const EMAIL_PREMIUM_TABLE_HEAD = "#FFFBF7";

/** Body / UI sans stack — Brown first (self-hosted on web; mail clients fall back), then system UI. */
export const EMAIL_SANS_STACK =
  "'Brown',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * Label column in key:value tables (move details parity): uppercase, tracked, muted ink.
 */
export const EMAIL_STRUCTURED_LABEL_STYLE =
  "color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;vertical-align:top";

/** Wine wordmark / headings on cream (#FCF9F4) — matches web quote WINE. */
export const EMAIL_WINE = "#5C1A33";

/** Secondary wine / rose accent (Estate rail). */
export const EMAIL_ROSE = "#66143D";

/** Signature shell green — matches web `SIGNATURE_PAGE_BG`. */
export const EMAIL_SIGNATURE_SHELL = "#15261A";

/** Hairline / section rules on cream (#FCF9F4). */
export const EMAIL_FOREST_RULE = "rgba(44,62,45,0.14)";

/** Soft callout backgrounds (replaces legacy gold tint). */
export const EMAIL_FOREST_CALLOUT_BG = "rgba(44,62,45,0.06)";

export const EMAIL_FOREST_CALLOUT_BORDER = "rgba(44,62,45,0.16)";

/** Sticky expiry strip parity (web quote) — mint tint, forest text. */
export const EMAIL_QUOTE_EXPIRY_BG = "rgba(244, 250, 245, 0.98)";
export const EMAIL_QUOTE_EXPIRY_BORDER = "rgba(44, 62, 45, 0.12)";
export const EMAIL_QUOTE_EXPIRY_TEXT = EMAIL_FOREST;

/** Residential tier card faces — aligned with web `TIER_META` + Estate wine card. */
export const EMAIL_TIER_ESSENTIAL_BG = "#FFFFFF";
export const EMAIL_TIER_ESSENTIAL_BORDER = "#E2DDD5";
export const EMAIL_TIER_SIGNATURE_BG = "#FFFDF8";
export const EMAIL_TIER_SIGNATURE_BORDER_MUTED = "rgba(92, 26, 51, 0.22)";
export const EMAIL_TIER_ESTATE_BG = EMAIL_WINE;
export const EMAIL_TIER_ESTATE_ACCENT = "#E8C4D0";
export const EMAIL_TIER_BODY_TEXT = "#3E4D40";
export const EMAIL_TIER_INK = "#2A2523";
export const EMAIL_TIER_ON_DARK = "#F5EEE6";

const CTA_PAD = "12px 28px";

/** 10px caps + ~0.12em tracking — matches quote confirm CTAs. */
const CTA_TYPE =
  "font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;border-radius:0;border:none;line-height:1.25;";

/**
 * Full inline style for a primary `<a>` CTA.
 * @param fontFamily — e.g. PREMIUM_FONT or Helvetica stack
 * @param display — block CTAs stretch in narrow clients when centered in a td
 */
export function emailPrimaryCtaStyle(
  fontFamily: string,
  display: "inline-block" | "block",
): string {
  const box =
    display === "block"
      ? "display:block;text-align:center;width:100%;box-sizing:border-box;"
      : "display:inline-block;";
  return `${box}background-color:${EMAIL_FOREST};color:#FFFFFF !important;-webkit-text-fill-color:#FFFFFF;padding:${CTA_PAD};${CTA_TYPE}font-family:${fontFamily};`;
}
