/**
 * Residential Signature tier — deep green shell + cream type (parallel role to Estate wine).
 * Voice/copy stays Signature-specific in components; these tokens are colour only.
 */

export const SIGNATURE_PAGE_BG = "#15261A";

/** Text on deep green — same keys as ESTATE_ON_WINE for shared styling logic */
/** Tuned for WCAG-friendly contrast on #15261A (avoid grey forest on green). */
export const SIGNATURE_ON_SHELL = {
  primary: "#F4FAF5",
  body: "rgba(244, 250, 245, 0.94)",
  secondary: "rgba(244, 250, 245, 0.9)",
  muted: "rgba(244, 250, 245, 0.84)",
  subtle: "rgba(244, 250, 245, 0.78)",
  /** Inactive progress labels — still clearly legible on deep green */
  faded: "rgba(244, 250, 245, 0.76)",
  /** Uppercase section labels — light sage, not dim grey */
  kicker: "#D2EBD8",
  hairline: "rgba(244, 250, 245, 0.42)",
  borderSubtle: "rgba(184, 212, 190, 0.34)",
  borderDash: "rgba(200, 228, 206, 0.48)",
} as const;

/** Primary CTA / accent on green shell (no gold) */
export const SIGNATURE_CTA = "#3A5C40";
export const SIGNATURE_CTA_HOVER = "#456E4C";

export const signatureCtaButtonClassCompact =
  "w-full max-w-md py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] transition-all bg-[#3A5C40] text-[#F4FAF5] hover:bg-[#456E4C]";
