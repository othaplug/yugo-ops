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

/** `platform_config` key — editable in Admin → Platform → App */
export const GOOGLE_REVIEW_COUNT_LABEL_KEY = "google_review_count_label";

export const DEFAULT_GOOGLE_REVIEW_COUNT_LABEL = "360+ Reviews";

/** Trust-bar headline when showing Google review social proof on quotes. */
export function resolveGoogleReviewCountLabel(platformConfigValue?: string | null): string {
  const v = (platformConfigValue ?? "").trim();
  return v || DEFAULT_GOOGLE_REVIEW_COUNT_LABEL;
}
