/**
 * Webflow form webhooks send different shapes; normalize to lowercase_snake keys.
 */
export function normalizeWebflowPayload(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};

  const set = (k: string, v: unknown) => {
    if (v == null) return;
    const s = String(v).trim();
    if (!s) return;
    const key = k
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (key) out[key] = s;
  };

  if (!raw || typeof raw !== "object") return out;

  const obj = raw as Record<string, unknown>;

  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    for (const [k, v] of Object.entries(obj.data as Record<string, unknown>)) {
      set(k, v);
    }
  }

  if (Array.isArray(obj.payload)) {
    for (const item of obj.payload) {
      if (item && typeof item === "object") {
        const i = item as { name?: string; value?: unknown };
        if (i.name) set(i.name, i.value);
      }
    }
  }

  for (const [k, v] of Object.entries(obj)) {
    if (k === "data" || k === "payload") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      set(k, v);
    }
  }

  return out;
}

export function pickField(flat: Record<string, string>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = flat[k];
    if (v) return v;
  }
  return undefined;
}

/** Returns null when the visitor chose "other" / unsure — caller may infer from message text. */
export function mapInboundServiceType(raw: string | undefined): string | null {
  const r = (raw || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/\//g, "_")
    .replace(/_+/g, "_");
  if (!r) return null;
  if (
    r === "other" ||
    r === "not_sure" ||
    r === "unsure" ||
    r === "dont_know" ||
    r === "don_t_know" ||
    r === "unknown"
  ) {
    return null;
  }
  const map: Record<string, string> = {
    specialty_transport: "specialty",
    specialtytransport: "specialty",
    specialty_delivery: "specialty",
    commercial_specialty: "specialty",
    custom_other: "b2b_oneoff",
    customother: "b2b_oneoff",
    other_service: "b2b_oneoff",
    b2b_specialty: "b2b_oneoff",
    residential: "local_move",
    local: "local_move",
    local_move: "local_move",
    long_distance: "long_distance",
    longdistance: "long_distance",
    office: "office_move",
    office_move: "office_move",
    commercial: "office_move",
    single_item: "single_item",
    singleitem: "single_item",
    white_glove: "white_glove",
    whiteglove: "white_glove",
    specialty: "specialty",
    event: "event",
    labour: "labour_only",
    labour_only: "labour_only",
    labor_only: "labour_only",
    bin: "bin_rental",
    bin_rental: "bin_rental",
    b2b: "b2b_oneoff",
  };
  return map[r] ?? "local_move";
}
