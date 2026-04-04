/**
 * Shared email visual tokens aligned with quote web (forest primary CTAs, squared buttons).
 * Import from transactional templates only — do not import from client-facing React.
 */

export const EMAIL_FOREST = "#2C3E2D";

/** Wine wordmark / headings on cream (#FCF9F4) — matches web quote WINE. */
export const EMAIL_WINE = "#5C1A33";

/** Secondary wine / rose accent (Estate rail). */
export const EMAIL_ROSE = "#66143D";

/** Hairline / section rules on cream (#FCF9F4). */
export const EMAIL_FOREST_RULE = "rgba(44,62,45,0.14)";

/** Soft callout backgrounds (replaces legacy gold tint). */
export const EMAIL_FOREST_CALLOUT_BG = "rgba(44,62,45,0.06)";

export const EMAIL_FOREST_CALLOUT_BORDER = "rgba(44,62,45,0.16)";

const CTA_PAD = "12px 28px";

/** 10px caps + ~0.12em tracking — matches quote confirm CTAs. */
const CTA_TYPE =
  "font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;text-decoration:none;border-radius:0;border:none;line-height:1.25;";

/**
 * Full inline style for a primary `<a>` CTA.
 * @param fontFamily — e.g. PREMIUM_FONT or Helvetica stack
 * @param display — block CTAs stretch in narrow clients when centered in a td
 */
export function emailPrimaryCtaStyle(fontFamily: string, display: "inline-block" | "block"): string {
  const box =
    display === "block"
      ? "display:block;text-align:center;width:100%;box-sizing:border-box;"
      : "display:inline-block;";
  return `${box}background-color:${EMAIL_FOREST};color:#FFFFFF !important;-webkit-text-fill-color:#FFFFFF;padding:${CTA_PAD};${CTA_TYPE}font-family:${fontFamily};`;
}
