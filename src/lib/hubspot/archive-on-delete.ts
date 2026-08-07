/**
 * Delete-time HubSpot cleanup.
 *
 * Called from admin/moves/[id] DELETE, admin/quotes/[quoteId] DELETE,
 * and admin/deliveries/[id] DELETE after the DB row is removed. Hard-
 * archives the associated HubSpot deal so it disappears from active
 * pipelines and reports — HubSpot keeps it restorable via portal for
 * ~90 days, which is our audit trail.
 *
 * Prior behavior was `syncDealStage(hsId, "lost")` on the moves +
 * quotes deletes, which left the deal visible in Closed-Lost columns
 * forever and did nothing at all for deliveries. Operator wants a real
 * delete on Ops → real delete on HubSpot, so this replaces that.
 *
 * Fire-and-forget: errors are logged but never thrown. A HubSpot
 * outage should never block a delete in Ops.
 */
import { archiveHubSpotDeal } from "./safe-deal-write";

export async function hubspotArchiveOnDelete(
  hsDealId: string | null | undefined,
): Promise<void> {
  const id = (hsDealId ?? "").trim();
  if (!id) return;
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.warn("[hubspot] archive skipped: HUBSPOT_ACCESS_TOKEN not set");
    return;
  }
  try {
    await archiveHubSpotDeal(token, id);
  } catch (e) {
    console.error(
      "[hubspot] archive failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}
