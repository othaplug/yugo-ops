/**
 * Combine a unit/suite number with a street address for display, e.g.
 *   formatAddressWithUnit("1234", "50 Carroll Street, Toronto ON")
 *     -> "Suite 1234 - 50 Carroll Street, Toronto ON"
 *
 * Single source of truth so every surface (quote page, move detail, crew app,
 * PDFs, tracking, calendar, dispatch) renders the unit the same way. The street
 * address is kept separate from the unit at the data layer (units don't geocode)
 * and combined only for display.
 */
export function formatAddressWithUnit(
  unit: string | null | undefined,
  address: string | null | undefined,
): string {
  const a = (address ?? "").trim();
  const u = (unit ?? "").trim();
  if (!u) return a;
  if (!a) return unitLabel(u);
  // Guard against double-prefixing if the unit is somehow already in the address.
  if (a.toLowerCase().startsWith(unitLabel(u).toLowerCase())) return a;
  return `${unitLabel(u)} - ${a}`;
}

/**
 * Normalize a raw unit entry into a labelled form. A bare number becomes
 * "Suite 1234"; an entry that already carries its own label (Suite/Unit/Apt/PH/#)
 * is used as written.
 */
export function unitLabel(unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  if (!u) return "";
  if (/^(suite|unit|apt\.?|apartment|#|ph\b|penthouse|no\.?)/i.test(u)) return u;
  return `Suite ${u}`;
}
