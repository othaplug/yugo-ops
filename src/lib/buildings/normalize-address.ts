/** Normalize free-text address for fuzzy matching (no PII mutation of DB rows). */
export function normalizeAddressForMatch(addr: string): string {
  return (addr || "")
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|crescent|cres|court|ct|lane|ln)\b/g, "")
    .replace(/\b(unit|suite|apt|apartment|#)\s*[\w-]+/g, "")
    .replace(/[,.\-#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const CA_POSTAL_RE = /[a-z]\d[a-z]\s?\d[a-z]\d/i

export function extractCanadianPostalCode(addr: string): string | null {
  const m = (addr || "").match(CA_POSTAL_RE)
  if (!m?.[0]) return null
  return m[0].replace(/\s/g, "").toUpperCase()
}

export function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}
