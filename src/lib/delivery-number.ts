/**
 * Generate a unique delivery number in DLV-xxxx format.
 * Used by all delivery creation paths for consistent IDs.
 */
export function generateDeliveryNumber(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `DLV-${String(n).padStart(4, "0")}`;
}

/**
 * Normalize any delivery ID format (PJ9146, DLV-9146, DEL-9146, etc.) to canonical DLV-xxxx.
 * Used for display and invoice numbers.
 */
export function normalizeDeliveryNumber(raw: string | null | undefined): string {
  const code = String(raw || "").trim().replace(/^#/, "");
  if (!code) return "DLV-0000";
  const match = code.match(/(\d{4})$/);
  const digits = match ? match[1] : "0000";
  return `DLV-${digits}`;
}

/** True if the string looks like a delivery ID (PJ, DLV, DEL- prefix). */
export function isDeliveryId(s: string | null | undefined): boolean {
  const code = String(s || "").trim().toUpperCase();
  return code.startsWith("PJ") || code.startsWith("DLV") || code.startsWith("DEL-");
}
