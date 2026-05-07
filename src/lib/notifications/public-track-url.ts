import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { getTrackDeliverySlug, getTrackMoveSlug } from "@/lib/move-code";

/** Client-facing move tracking URL. Slug prefers `move_code`; token is always signed with UUID `id`. */
export const buildPublicMoveTrackUrl = (move: {
  id: string;
  move_code?: string | null;
}): string => {
  const base = getEmailBaseUrl();
  const slug = getTrackMoveSlug(move);
  return `${base}/track/move/${slug}?token=${signTrackToken("move", move.id)}`;
};

/** Client-facing delivery tracking URL. Slug prefers `delivery_number`. */
export const buildPublicDeliveryTrackUrl = (delivery: {
  id: string;
  delivery_number?: string | null;
}): string => {
  const base = getEmailBaseUrl();
  const slug = getTrackDeliverySlug(delivery);
  return `${base}/track/delivery/${slug}?token=${signTrackToken("delivery", delivery.id)}`;
};

/**
 * Short SMS-safe tracking URL — /t/[code] signs token server-side on redirect.
 * Keeps SMS links clean and readable.
 */
export const buildSmsTrackUrl = (code: string): string => {
  const base = getEmailBaseUrl().replace(/\/$/, "");
  return `${base}/t/${encodeURIComponent(code.toUpperCase())}`;
};
