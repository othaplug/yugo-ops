/**
 * When service is in this set, home/bedroom move size does not apply (align with assess-completeness).
 * Include common slug aliases.
 */
/** Same idea as `MOVE_SIZE_NA` in assess-completeness.ts, plus slug aliases. */
export const LEAD_SERVICE_OMIT_MOVE_SIZE = new Set([
  "event",
  "labour_only",
  "b2b_oneoff",
  "b2b_one_off",
  "bin_rental",
  "pm_inquiry",
])

/** Show move size dropdown in admin when service calls for a home-sized move, not e.g. bin rental. */
export const isLeadMoveSizeApplicable = (
  serviceType: string | null | undefined,
): boolean => {
  const t = (serviceType || "").trim()
  if (!t) return false
  return !LEAD_SERVICE_OMIT_MOVE_SIZE.has(t)
}

export const LEAD_MOVE_SIZE_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Not set" },
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 bedroom" },
  { value: "2br", label: "2 bedroom" },
  { value: "3br", label: "3 bedroom" },
  { value: "4br", label: "4 bedroom" },
  { value: "5br_plus", label: "5+ bedroom" },
  { value: "partial", label: "Partial" },
]
