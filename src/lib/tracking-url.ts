/** Build tracking URL for vendor carriers. Fallback to 17track for unknown carriers. */
export function getTrackingUrl(carrier: string | null, trackingNumber: string): string {
  if (!trackingNumber) return "#";
  const c = (carrier || "").toLowerCase();
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes("dhl")) return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  return `https://t.17track.net/en#nums=${encodeURIComponent(trackingNumber)}`;
}
