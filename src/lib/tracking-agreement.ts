/**
 * Tracking-portal agreement (TrackingAgreementModal).
 *
 * One place to version the terms and name the entity types. Bump
 * TRACKING_TERMS_VERSION whenever the Terms / Privacy / Cookie language that the
 * modal gates on materially changes — every client is then re-prompted and a
 * fresh acceptance row is written against the new version.
 */
export const TRACKING_TERMS_VERSION = "2026-10-13";

/** Entity kinds that can carry a tracking-agreement acceptance. */
export type AgreementEntityType = "move" | "delivery" | "inbound_shipment";

/**
 * Per-version cookie name. Including the version means a terms bump invalidates
 * the fast-path cookie on its own (an old cookie no longer matches), so the
 * client re-accepts without us having to clear anything.
 */
export function trackingTermsCookieName(version: string = TRACKING_TERMS_VERSION): string {
  return `yugo-tracking-terms-${version}`;
}
