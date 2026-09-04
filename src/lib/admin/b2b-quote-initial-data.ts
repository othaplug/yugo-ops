import type { B2BJobsInitialData } from "@/components/admin/b2b/B2BJobsDeliveryForm";
import {
  createEmptyPickupStop,
  createFinalDeliveryStop,
  newLocalId,
  type MultiStopDraftStop,
  type MultiStopDraftItem,
} from "@/components/admin/b2b/b2b-multi-stop-types";

/**
 * Build the B2BJobsDeliveryForm `initialData` prefill from a source quote row
 * (the shape returned by /api/admin/quotes/copy-prefill: the quotes row plus
 * factors_applied). Extracted from QuoteFormClient's inline edit-prefill effect
 * so the embedded create-form path and the dedicated B2B edit screen build the
 * exact same prefill — no divergence.
 */
export function buildB2bInitialDataFromQuote(
  Q: Record<string, unknown>,
): B2BJobsInitialData {
  const fa = (Q.factors_applied ?? {}) as Record<string, unknown>;
  const cStr = (v: unknown): string => (v != null ? String(v).trim() : "");
  const contactRel = Array.isArray(Q.contacts) ? Q.contacts[0] : Q.contacts;
  const c = (contactRel ?? {}) as Record<string, unknown>;
  const faNum = (key: string): number | null => {
    const v = fa[key];
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Line items → the form's item rows.
  const evLinesRaw = fa.b2b_line_items;
  const evLines = Array.isArray(evLinesRaw)
    ? evLinesRaw
        .filter(
          (row): row is Record<string, unknown> =>
            row !== null && typeof row === "object",
        )
        .map((row) => ({
          description: String(row.description ?? "Item"),
          quantity: Math.max(1, Number(row.quantity ?? row.qty) || 1),
          weight_category: String(row.weight_category ?? "standard"),
          actual_weight_lbs:
            typeof row.actual_weight_lbs === "number" ? row.actual_weight_lbs : undefined,
          fragile: !!row.fragile,
          unit_type: typeof row.unit_type === "string" ? row.unit_type : undefined,
          stop_assignment:
            typeof row.stop_assignment === "string" ? row.stop_assignment : undefined,
          serial_number:
            typeof row.serial_number === "string" ? row.serial_number : undefined,
          declared_value:
            typeof row.declared_value === "string" ? row.declared_value : undefined,
          crating_required: !!row.crating_required,
          hookup_required: !!row.hookup_required,
          haul_away_line: !!row.haul_away_line,
          line_assembly_required: !!row.line_assembly_required,
        }))
    : [];

  const bOvNum = faNum("b2b_subtotal_override");
  const initPayment = fa.b2b_payment_method === "invoice" ? "invoice" : "card";
  const initTerms =
    fa.b2b_invoice_terms === "net_15"
      ? "net_15"
      : fa.b2b_invoice_terms === "net_30"
        ? "net_30"
        : "on_completion";

  // Reconstruct minimal multi-stop route so a multi-stop B2B quote loads in
  // "multi" mode with addresses in place. Persisted b2b_stops carries only
  // address/type/access; per-stop contacts/readiness fall back to defaults.
  let initRouteMode: "single" | "multi" = "single";
  let initMultiStops: MultiStopDraftStop[] | undefined;
  const rawStops = fa.b2b_stops;
  if (Array.isArray(rawStops) && rawStops.length >= 2) {
    const built: MultiStopDraftStop[] = rawStops
      .filter(
        (s): s is { address?: unknown; type?: unknown; access?: unknown } =>
          s !== null && typeof s === "object",
      )
      .map((s, idx) => {
        const addr = typeof s.address === "string" ? s.address : "";
        const stopType =
          typeof s.type === "string" && s.type.toLowerCase() === "pickup"
            ? "pickup"
            : "delivery";
        const base =
          stopType === "pickup" ? createEmptyPickupStop() : createFinalDeliveryStop();
        return {
          ...base,
          address: addr,
          accessType:
            typeof s.access === "string" && s.access ? s.access : base.accessType,
          isFinalDestination: idx === rawStops.length - 1,
        };
      });
    if (built.length >= 2) {
      // In multi-stop mode the form reads items from each stop's items[], not
      // the flat lines array — so a multi-stop quote's persisted b2b_line_items
      // must be seeded onto a stop or they're lost on edit (and validation fails
      // with "add at least one line item"). b2b_line_items carries no reliable
      // stop assignment, so put them all on the FIRST pickup stop; the operator
      // can move them. is_high_value is inferred from a declared_value flag.
      const stopItems: MultiStopDraftItem[] = evLines.map((l) => ({
        localId: newLocalId(),
        description: l.description,
        quantity: l.quantity,
        weight_range: l.weight_category,
        fragile: l.fragile,
        is_high_value: !!l.declared_value,
        requires_assembly: !!l.line_assembly_required,
      }));
      const firstPickupIdx = built.findIndex((s) => s.stopType === "pickup");
      if (firstPickupIdx >= 0 && stopItems.length > 0) {
        built[firstPickupIdx] = { ...built[firstPickupIdx], items: stopItems };
      }
      initRouteMode = "multi";
      initMultiStops = built;
    }
  }

  return {
    businessName: cStr(fa.b2b_retailer_source) || cStr(fa.b2b_business_name),
    contactName: cStr(c.name) || cStr(fa.b2b_contact_name),
    contactPhone: cStr(c.phone) || cStr(fa.b2b_contact_phone),
    contactEmail: cStr(c.email) || cStr(fa.b2b_contact_email),
    timeWindow: cStr(fa.b2b_delivery_window),
    routeMode: initRouteMode,
    multiStops: initMultiStops,
    verticalCode: cStr(fa.b2b_vertical_code),
    partnerOrgId: cStr(fa.b2b_partner_org_id),
    handlingType: cStr(fa.b2b_handling_type) || "threshold",
    pickupAddress: cStr(Q.from_address),
    deliveryAddress: cStr(Q.to_address),
    pickupAccess: cStr(Q.from_access) || "loading_dock",
    deliveryAccess: cStr(Q.to_access) || "elevator",
    lines: evLines,
    scheduledDate: cStr(Q.move_date).slice(0, 10) || undefined,
    timeSensitive: fa.b2b_time_sensitive === true,
    assemblyRequired: fa.b2b_assembly_required === true,
    debrisRemoval: fa.b2b_debris_removal === true,
    stairsFlights: cStr(fa.b2b_stairs_flights),
    highValue: fa.b2b_high_value === true,
    artwork: fa.b2b_artwork === true,
    antiques: fa.b2b_antiques === true,
    skidCount: cStr(fa.b2b_skid_count),
    boxCount: cStr(fa.b2b_box_count),
    totalLoadWeightLbs: cStr(fa.b2b_total_load_weight_lbs),
    haulAwayUnits: cStr(fa.b2b_haul_away_units),
    returnsPickup: fa.b2b_returns_pickup === true,
    sameDay: fa.b2b_same_day === true,
    specialInstructions: cStr(fa.b2b_special_instructions),
    accessNotes: cStr(fa.b2b_access_notes),
    crewOverride: cStr(fa.b2b_crew_override),
    truckOverride: cStr(fa.b2b_truck_override),
    hoursOverride: cStr(fa.b2b_hours_override),
    paymentMethod: initPayment,
    invoiceTerms: initTerms,
    overridePrice: bOvNum != null && bOvNum > 0 ? String(Math.round(bOvNum)) : "",
    overrideReason: cStr(fa.b2b_subtotal_override_reason),
  };
}
