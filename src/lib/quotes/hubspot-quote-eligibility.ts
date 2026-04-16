/**
 * Whether a quote row should sync to HubSpot (deal create / stage updates).
 * Training and sample quotes stay out of the sales pipeline.
 */
export function isSampleOrTrainingQuoteId(quoteId: string): boolean {
  const id = (quoteId || "").trim().toLowerCase();
  if (!id) return false;
  if (id.includes("sample")) return true;
  if (id.includes("demo")) return true;
  if (id.includes("sandbox")) return true;
  return false;
}

export function quoteRowEligibleForHubSpotDeal(
  quote: Record<string, unknown>,
): boolean {
  if (isSampleOrTrainingQuoteId(String(quote.quote_id ?? ""))) return false;
  const raw = quote.factors_applied;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const f = raw as Record<string, unknown>;
    if (f.is_sample === true) return false;
    if (String(f.quote_kind || "")
      .toLowerCase()
      .includes("sample")) {
      return false;
    }
  }
  return true;
}
