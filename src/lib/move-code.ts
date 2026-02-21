/** Raw job code from DB (e.g. MV3456). Prefers move.move_code; fallback from id only for legacy. */
export function getMoveCode(move: { move_code?: string | null; move_number?: string | null; id?: string | null } | string | null | undefined): string {
  if (!move) return "MV0000";
  const code = typeof move === "object" && move && ("move_code" in move ? move.move_code : move.move_number) ? (move as { move_code?: string; move_number?: string }).move_code || (move as { move_code?: string; move_number?: string }).move_number : null;
  if (code && String(code).trim()) return String(code).trim().replace(/^#/, "").slice(0, 6);
  const id = typeof move === "object" && move && "id" in move ? move.id : typeof move === "string" ? move : null;
  if (!id) return "MV0000";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return "MV" + String(Math.abs(h) % 10000).padStart(4, "0");
}

/** Display format: #[PJ|MV](4 digits), e.g. #MV3456, #PJ5435 */
export function formatJobId(rawCode: string, type: "move" | "delivery" | "partner" = "move"): string {
  const code = String(rawCode || "").trim().replace(/^#/, "");
  if (!code) return type === "move" ? "#MV0000" : "#PJ0000";
  const prefix = type === "partner" || type === "delivery" ? "PJ" : "MV";
  const normalized = code.toUpperCase().startsWith("PJ") ? code.slice(0, 6) : code.toUpperCase().startsWith("MV") ? code.slice(0, 6) : `${prefix}${code.slice(-4).padStart(4, "0")}`;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if the string is a UUID (used to distinguish from move_code in URLs). */
export function isMoveIdUuid(s: string): boolean {
  return UUID_REGEX.test(String(s || "").trim());
}

/** Canonical admin move detail URL: /admin/moves/MV3456 (prefers move_code for short URLs). */
export function getMoveDetailPath(move: { move_code?: string | null; id?: string } | null | undefined): string {
  if (!move) return "/admin/moves";
  const code = move.move_code?.trim().replace(/^#/, "");
  if (code) return `/admin/moves/${code.toUpperCase()}`;
  return `/admin/moves/${move.id || ""}`;
}

/** True if the string is a UUID (generic; use for deliveries, clients, etc.). */
export function isUuid(s: string): boolean {
  return UUID_REGEX.test(String(s || "").trim());
}

/** Canonical admin delivery/project detail URL: /admin/deliveries/PJ1234 (prefers delivery_number). */
export function getDeliveryDetailPath(delivery: { delivery_number?: string | null; id?: string } | null | undefined): string {
  if (!delivery) return "/admin/deliveries";
  const code = delivery.delivery_number?.trim();
  if (code) return `/admin/deliveries/${encodeURIComponent(code)}`;
  return `/admin/deliveries/${delivery.id || ""}`;
}

/** Path segment for track move URL (short code or id). Token is still signed with move.id. */
export function getTrackMoveSlug(move: { move_code?: string | null; id: string }): string {
  const code = move.move_code?.trim().replace(/^#/, "");
  return code ? encodeURIComponent(code.toUpperCase()) : move.id;
}

/** Path segment for track delivery URL (short code or id). Token is still signed with delivery.id. */
export function getTrackDeliverySlug(delivery: { delivery_number?: string | null; id: string }): string {
  const code = delivery.delivery_number?.trim();
  return code ? encodeURIComponent(code) : delivery.id;
}
