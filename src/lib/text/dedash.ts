/**
 * Em/en dash removal — single source of truth.
 *
 * Brand rule: NO em dashes (—) or en dashes (–) anywhere in the app, admin or
 * client, including inventory item names. Apply these helpers at every boundary
 * where DYNAMIC text (database rows, user input, catalog data) reaches the UI,
 * an email, or an export. Static source copy is handled separately by the lint
 * rule that blocks em/en dashes in string literals and JSX.
 *
 * Two helpers because the correct replacement is context-dependent:
 *   - cleanItemName: "Base — Variant" separators become a comma ("Base, Variant").
 *   - dedash: general prose; numeric ranges become "to", other dashes a comma.
 */

const EM_EN = /[—–]/; // — (em) or – (en)

/**
 * Normalize an inventory item / label. A dash used as a "base — variant"
 * separator becomes a comma, which reads as proper English without the nested
 * parentheses a "(variant)" rewrite would create on already-parenthesized names.
 *   "Mattress — Queen"                 -> "Mattress, Queen"
 *   "Dining Chair — Standard x6"       -> "Dining Chair, Standard x6"
 *   "Bed Frame — Storage / Lift (Queen)" -> "Bed Frame, Storage / Lift (Queen)"
 */
export function cleanItemName(input: string | null | undefined): string {
  const s = String(input ?? "");
  if (!EM_EN.test(s)) return s;
  return s
    // numeric size range, e.g. 'TV (55–65")' -> 'TV (55-65")' — a hyphen reads
    // as a range and matches the hyphen-keyed size catalog, not a comma.
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Normalize general prose. Numeric ranges ("6–8 hours") read as "6 to 8 hours";
 * any other em/en dash becomes a comma. Use for dynamic strings that are not
 * item names (e.g. DB-stored notes, descriptions) reaching the UI.
 */
export function dedash(input: string | null | undefined): string {
  const s = String(input ?? "");
  if (!EM_EN.test(s)) return s;
  return s
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
