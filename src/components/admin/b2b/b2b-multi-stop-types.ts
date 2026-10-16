export type ReadinessValue = "confirmed" | "pending" | "delayed" | "partial";

export type MultiStopDraftItem = {
  localId: string;
  description: string;
  quantity: number;
  weight_range: string;
  fragile: boolean;
  is_high_value: boolean;
  requires_assembly: boolean;
  /**
   * Local ID of the DROP stop this item is destined for. Only meaningful when
   * the route has more than one drop; the single-drop case leaves this
   * undefined and the server routes the item to the sole drop by default.
   */
  destinationStopLocalId?: string;
};

export type MultiStopDraftStop = {
  localId: string;
  stopType: "pickup" | "delivery";
  vendorName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  accessType: string;
  accessNotes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  readiness: ReadinessValue;
  readinessNotes: string;
  notes: string;
  specialInstructions: string;
  isFinalDestination: boolean;
  deliveryPhase: number;
  estimatedDurationMinutes: number;
  items: MultiStopDraftItem[];
  collapsed: boolean;
};

export function newLocalId(): string {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyPickupStop(): MultiStopDraftStop {
  return {
    localId: newLocalId(),
    stopType: "pickup",
    vendorName: "",
    address: "",
    lat: null,
    lng: null,
    accessType: "ground_floor",
    accessNotes: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    readiness: "confirmed",
    readinessNotes: "",
    notes: "",
    specialInstructions: "",
    isFinalDestination: false,
    deliveryPhase: 1,
    estimatedDurationMinutes: 30,
    items: [],
    collapsed: false,
  };
}

export function createEmptyDropoffStop(): MultiStopDraftStop {
  return {
    localId: newLocalId(),
    stopType: "delivery",
    vendorName: "",
    address: "",
    lat: null,
    lng: null,
    accessType: "elevator",
    accessNotes: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    readiness: "confirmed",
    readinessNotes: "",
    notes: "",
    specialInstructions: "",
    isFinalDestination: false,
    deliveryPhase: 1,
    estimatedDurationMinutes: 45,
    items: [],
    collapsed: false,
  };
}

export function createFinalDeliveryStop(): MultiStopDraftStop {
  const stop = createEmptyDropoffStop();
  stop.isFinalDestination = true;
  return stop;
}

export function defaultMultiStopRoute(): MultiStopDraftStop[] {
  return [createEmptyPickupStop(), createFinalDeliveryStop()];
}

/** Pickup stops in route order. */
export function getPickupStops(stops: MultiStopDraftStop[]): MultiStopDraftStop[] {
  return stops.filter((s) => s.stopType === "pickup");
}

/** Drop stops in route order. */
export function getDropStops(stops: MultiStopDraftStop[]): MultiStopDraftStop[] {
  return stops.filter((s) => s.stopType === "delivery");
}

/**
 * Enforce the invariant: exactly one drop is marked `isFinalDestination` and it
 * is always the LAST drop in route order. Call this after any add / remove /
 * reorder on drops. Idempotent.
 */
export function stampFinalDestination(stops: MultiStopDraftStop[]): MultiStopDraftStop[] {
  const drops = getDropStops(stops);
  if (drops.length === 0) return stops;
  const finalId = drops[drops.length - 1]!.localId;
  return stops.map((s) =>
    s.stopType === "delivery"
      ? { ...s, isFinalDestination: s.localId === finalId }
      : s,
  );
}

/**
 * Reconcile every item's `destinationStopLocalId` against the current drop
 * list. Any item pointing at a drop that no longer exists falls back to the
 * first drop. Single-drop routes leave the field unset so the server default
 * (first drop) applies. Call after drop add / remove / reorder.
 */
export function reconcileItemDestinations(stops: MultiStopDraftStop[]): MultiStopDraftStop[] {
  const drops = getDropStops(stops);
  const validIds = new Set(drops.map((d) => d.localId));
  const fallback = drops[0]?.localId;
  if (drops.length <= 1) {
    return stops.map((s) => ({
      ...s,
      items: s.items.map((it) =>
        it.destinationStopLocalId
          ? { ...it, destinationStopLocalId: undefined }
          : it,
      ),
    }));
  }
  return stops.map((s) => ({
    ...s,
    items: s.items.map((it) =>
      it.destinationStopLocalId && validIds.has(it.destinationStopLocalId)
        ? it
        : { ...it, destinationStopLocalId: fallback },
    ),
  }));
}

export function flattenMultiStopToLineRows(stops: MultiStopDraftStop[]): Array<{
  description: string;
  quantity: number;
  weight_category: string;
  fragile: boolean;
  line_assembly_required?: boolean;
  declared_value?: string;
}> {
  const rows: Array<{
    description: string;
    quantity: number;
    weight_category: string;
    fragile: boolean;
    line_assembly_required?: boolean;
    declared_value?: string;
  }> = [];
  for (const s of stops) {
    if (s.stopType !== "pickup") continue;
    for (const it of s.items) {
      const d = it.description.trim();
      if (!d) continue;
      rows.push({
        description: d,
        quantity: Math.max(1, it.quantity),
        weight_category: it.weight_range,
        fragile: it.fragile,
        line_assembly_required: it.requires_assembly,
        ...(it.is_high_value ? { declared_value: "High value" } : {}),
      });
    }
  }
  return rows;
}

export function orderedAddressesForRoute(stops: MultiStopDraftStop[]): string[] {
  return stops.map((s) => s.address.trim()).filter(Boolean);
}

export function multiStopPayloadStops(stops: MultiStopDraftStop[]) {
  return stops.map((s) => ({
    local_id: s.localId,
    stop_type: s.stopType,
    address: s.address.trim(),
    lat: s.lat,
    lng: s.lng,
    vendor_name: s.vendorName.trim() || null,
    contact_name: s.contactName.trim() || null,
    contact_phone: s.contactPhone.trim() || null,
    contact_email: s.contactEmail.trim() || null,
    access_type: s.accessType || null,
    access_notes: s.accessNotes.trim() || null,
    readiness: s.readiness,
    readiness_notes: s.readinessNotes.trim() || null,
    special_instructions: s.specialInstructions.trim() || null,
    notes: s.notes.trim() || null,
    is_final_destination: s.isFinalDestination,
    delivery_phase: s.deliveryPhase,
    estimated_duration_minutes: s.estimatedDurationMinutes,
    items: s.items.map((it) => ({
      description: it.description.trim(),
      quantity: Math.max(1, it.quantity),
      weight_range: it.weight_range,
      is_fragile: it.fragile,
      is_high_value: it.is_high_value,
      requires_assembly: it.requires_assembly,
      ...(it.destinationStopLocalId
        ? { destination_stop_local_id: it.destinationStopLocalId }
        : {}),
    })),
  }));
}
