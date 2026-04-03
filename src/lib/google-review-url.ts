/**
 * Canonical Google Business review link for Yugo.
 * Override with platform_config `google_review_url` or env `GOOGLE_REVIEW_URL`.
 */
export const DEFAULT_GOOGLE_BUSINESS_REVIEW_URL =
  "https://g.page/r/CU67iDN6TgMIEB0/review/";

export function resolveGoogleReviewUrl(platformConfigValue?: string | null): string {
  const fromConfig = (platformConfigValue ?? "").trim();
  const fromEnv =
    typeof process !== "undefined" ? (process.env.GOOGLE_REVIEW_URL ?? "").trim() : "";
  if (fromConfig) return fromConfig;
  if (fromEnv) return fromEnv;
  return DEFAULT_GOOGLE_BUSINESS_REVIEW_URL;
}
