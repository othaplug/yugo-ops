/**
 * Delivery `category` must align with `organizations.type` when a delivery has
 * `organization_id` (single source of truth). Client payloads must not override it.
 */

const VALID_DELIVERY_CATEGORIES = new Set([
  "retail",
  "b2b",
  "b2c",
  "designer",
  "hospitality",
  "realtor",
  "stager",
  "other",
])

export function normalizeDeliveryCategory(raw: string | null | undefined): string {
  const lower = String(raw ?? "")
    .toLowerCase()
    .trim()
  if (!lower) return "retail"
  if (VALID_DELIVERY_CATEGORIES.has(lower)) return lower
  if (lower.startsWith("b2b")) return "b2b"
  return "retail"
}
