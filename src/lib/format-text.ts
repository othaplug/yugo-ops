/**
 * Convert snake_case, kebab-case, or lowercase text to Title Case.
 * "piano_upright" → "Piano Upright"
 * "in_progress"  → "In Progress"
 * "walk_up_3rd"  → "Walk Up 3rd"
 */
export function toTitleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Public-facing access label: no underscores, title case.
 * "ground_floor" → "Ground Floor", "" → null.
 */
export function formatAccessForDisplay(access: string | null | undefined): string | null {
  if (!access || !access.trim()) return null;
  return toTitleCase(access.trim());
}

/**
 * Format address for display: omit "Canada" / "CA" at the end for Canadian addresses.
 * "203 Bentworth Ave, North York, Ontario M6A 1P9, Canada" → "203 Bentworth Ave, North York, Ontario M6A 1P9"
 */
export function formatAddressForDisplay(address: string | null | undefined): string {
  if (!address || !address.trim()) return "";
  let out = address.trim();
  out = out.replace(/,?\s*Canada\s*$/i, "").replace(/,?\s*CA\s*$/i, "").trim();
  return out.replace(/,+\s*$/, "").trim() || address.trim();
}
