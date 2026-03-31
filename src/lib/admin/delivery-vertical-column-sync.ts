/**
 * Optional first-class columns on delivery_verticals mirror key default_config
 * fields for SQL reporting / exports. Engine still reads merged JSON on load.
 */

export function deliveryVerticalColumnsFromDefaultConfig(
  dc: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const iib = dc.items_included_in_base;
  if (typeof iib === "number" && Number.isFinite(iib)) out.items_included_in_base = iib;

  const pia = dc.per_item_rate_after_base;
  if (typeof pia === "number" && Number.isFinite(pia)) out.per_item_rate_after_base = pia;

  if (typeof dc.assembly_included === "boolean") out.assembly_included = dc.assembly_included;

  const sib = dc.stops_included_in_base;
  if (typeof sib === "number" && Number.isFinite(sib)) {
    out.stops_included_in_base = sib;
  } else {
    const fs = dc.free_stops;
    if (typeof fs === "number" && Number.isFinite(fs)) out.stops_included_in_base = fs;
  }

  const sr = dc.stop_rate;
  if (typeof sr === "number" && Number.isFinite(sr)) out.per_stop_rate = sr;

  const skid = dc.skid_handling_fee;
  if (typeof skid === "number" && Number.isFinite(skid)) out.skid_handling_fee = skid;

  const wlr = dc.weight_line_rates;
  if (wlr && typeof wlr === "object" && !Array.isArray(wlr)) {
    out.weight_surcharges = wlr;
  }

  const hr = dc.handling_rates;
  if (hr && typeof hr === "object" && !Array.isArray(hr)) {
    out.handling_levels = hr;
  }

  if (Array.isArray(dc.volume_discount_tiers)) {
    out.volume_discount_tiers = dc.volume_discount_tiers;
  }

  return out;
}

/** Overlay non-null column values onto mergedRates for pricing. */
export function overlayDeliveryVerticalDbColumns(
  row: Record<string, unknown>,
  merged: Record<string, unknown>,
): void {
  const n = (k: string) => {
    const v = row[k];
    if (v !== null && v !== undefined) merged[k] = v;
  };
  n("items_included_in_base");
  n("per_item_rate_after_base");
  n("assembly_included");
  n("stops_included_in_base");
  n("skid_handling_fee");

  const vd = row.volume_discount_tiers;
  if (Array.isArray(vd) && vd.length > 0) {
    merged.volume_discount_tiers = vd;
  }

  if (row.per_stop_rate != null && row.per_stop_rate !== undefined) {
    merged.stop_rate = row.per_stop_rate;
  }

  const ws = row.weight_surcharges;
  if (ws && typeof ws === "object" && !Array.isArray(ws) && Object.keys(ws as object).length > 0) {
    merged.weight_line_rates = ws;
  }

  const hl = row.handling_levels;
  if (hl && typeof hl === "object" && !Array.isArray(hl) && Object.keys(hl as object).length > 0) {
    merged.handling_rates = hl;
  }
}
