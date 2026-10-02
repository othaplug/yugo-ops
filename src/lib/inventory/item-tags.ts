/**
 * Operator-set tags on an individual inventory line (e.g. "sentimental", "crating required").
 * These are additive to catalog-derived badges like Heavy (from weight tier) and Fragile
 * (from catalog.fragile boolean) — the render layer dedupes so a user-tagged "fragile"
 * does not double up with the auto fragile badge.
 */

export const ITEM_TAG_OPTIONS = [
  { code: "heavy", label: "Heavy" },
  { code: "fragile", label: "Fragile" },
  { code: "sentimental", label: "Sentimental" },
  { code: "valuable", label: "Valuable" },
  { code: "disassembly_required", label: "Disassembly required" },
  { code: "crating_required", label: "Crating required" },
] as const;

export type ItemTagCode = (typeof ITEM_TAG_OPTIONS)[number]["code"];

const VALID_CODES = new Set<string>(ITEM_TAG_OPTIONS.map((t) => t.code));

/** Keep only known codes, dedupe, preserve first-seen order. Safe on any input. */
export function normalizeItemTags(raw: unknown): ItemTagCode[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ItemTagCode[] = [];
  for (const t of raw) {
    const s = typeof t === "string" ? t.trim().toLowerCase() : "";
    if (VALID_CODES.has(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s as ItemTagCode);
    }
  }
  return out;
}

export function itemTagLabel(code: string): string {
  return ITEM_TAG_OPTIONS.find((t) => t.code === code)?.label ?? code;
}
