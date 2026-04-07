import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getTrackMoveSlug } from "@/lib/move-code";
import { signTrackToken } from "@/lib/track-token";

/** Signed public tracking link for partner-facing move cards (server-only). */
export function partnerMoveTrackingUrl(move: { id: string; move_code?: string | null }): string {
  const base = getEmailBaseUrl().replace(/\/$/, "");
  return `${base}/track/move/${getTrackMoveSlug(move)}?token=${signTrackToken("move", move.id)}`;
}
