export type ReadinessValue = "confirmed" | "pending" | "delayed" | "partial";

export type MultiStopDraftItem = {
  localId: string;
  description: string;
  quantity: number;
  weight_range: string;
  fragile: boolean;
  is_high_value: boolean;
  requires_assembly: boolean;
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

export function createFinalDeliveryStop(): MultiStopDraftStop {
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
    isFinalDestination: true,
    deliveryPhase: 1,
    estimatedDurationMinutes: 45,
    items: [],
    collapsed: false,
  };
}

export function defaultMultiStopRoute(): MultiStopDraftStop[] {
  return [createEmptyPickupStop(), createFinalDeliveryStop()];
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
    if (s.isFinalDestination) continue;
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
    })),
  }));
}
