/**
 * Estate welcome package page — colors aligned with {@link ESTATE_PAGE_BG} / quote wine shell.
 * Standalone module (no "use client") so the welcome page stays a Server Component.
 */
export const ESTATE_WELCOME_BG = "#2B0416";

export const ON_WINE = {
  primary: "#F9EDE4",
  body: "rgba(249, 237, 228, 0.92)",
  secondary: "rgba(249, 237, 228, 0.86)",
  muted: "rgba(249, 237, 228, 0.8)",
  subtle: "rgba(249, 237, 228, 0.72)",
  kicker: "#F0D8E2",
  hairline: "rgba(249, 237, 228, 0.38)",
  rule: "rgba(249, 237, 228, 0.14)",
  borderSubtle: "rgba(249, 237, 228, 0.22)",
} as const;
