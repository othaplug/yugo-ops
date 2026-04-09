/** PM portal: which contract move types appear for residential vs commercial property partners. */

export const COMMERCIAL_ONLY_PM_REASON_CODES = new Set([
  "office_suite_setup",
  "office_suite_clearout",
  "office_setup",
  "office_clearout",
]);

export function isCommercialPmVertical(vertical: string | null | undefined): boolean {
  return String(vertical || "").trim() === "property_management_commercial";
}

/** Matrix row `reason_code` — hide commercial office rows for residential PM verticals. */
export function pmRateCardReasonRowVisible(
  reasonCode: string,
  vertical: string | null | undefined,
): boolean {
  const rc = String(reasonCode || "").trim();
  if (!rc) return false;
  if (COMMERCIAL_ONLY_PM_REASON_CODES.has(rc)) {
    return isCommercialPmVertical(vertical);
  }
  return true;
}

/** Schedule form: always show these first (if present in contract reasons). */
export const PM_PRIMARY_REASON_CODES_ORDERED = [
  "tenant_move_in",
  "tenant_move_out",
  "reno_move_out",
  "reno_move_in",
  "reno_bundle",
  "suite_transfer",
  "emergency",
] as const;
