import { normalizeWebflowPayload, pickField, mapInboundServiceType } from "./webflow-parse";

export type ParsedCaptureForm = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  service_type: string | null;
  move_size: string | null;
  from_address: string | null;
  from_access: string | null;
  to_address: string | null;
  to_access: string | null;
  inventory_text: string | null;
  box_count_estimate: string | null;
  assembly_needed: string | null;
  wrapping_needed: string | null;
  specialty_items_text: string | null;
  packing_help: string | null;
  insurance_preference: string | null;
  how_heard: string | null;
  referral_detail: string | null;
  message: string | null;
};

/** Normalize Webflow / capture field values like "2 BR", "5+" to quote slugs. */
export function normalizeMoveSizeSlug(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let s = raw.toLowerCase().trim().replace(/\s+/g, "");
  s = s.replace(/bedroom(s)?/g, "br").replace(/\+/g, "_plus");
  const alias: Record<string, string> = {
    studio: "studio",
    "1br": "1br",
    "2br": "2br",
    "3br": "3br",
    "4br": "4br",
    "4br_plus": "4br_plus",
    "5br": "5br_plus",
    "5br_plus": "5br_plus",
    "5+": "5br_plus",
    "5+bedroom": "5br_plus",
    partial: "partial",
    partialmove: "partial",
  };
  if (alias[s]) return alias[s];
  if (/^5br/.test(s) && s.includes("plus")) return "5br_plus";
  if (s === "4" || s === "4+") return "4br";
  return s.length <= 12 && /^[a-z0-9_]+$/.test(s) ? s : null;
}

export function parseCaptureFormPayload(raw: unknown): ParsedCaptureForm {
  const flat = normalizeWebflowPayload(raw);

  const name = pickField(flat, ["name", "full_name", "fullname"]);
  const first =
    pickField(flat, ["first_name", "firstname", "first"]) ||
    (name ? name.split(/\s+/)[0] : undefined);
  const last =
    pickField(flat, ["last_name", "lastname", "last"]) ||
    (name ? name.split(/\s+/).slice(1).join(" ") : undefined) ||
    "";

  const serviceRaw = pickField(flat, [
    "service_type",
    "move_type",
    "type_of_move",
    "service",
  ]);
  const moveRaw =
    pickField(flat, ["move_size", "bedrooms", "bedroom", "size", "home_size"]) || null;

  return {
    first_name: first?.trim() || null,
    last_name: last?.trim() || null,
    email: pickField(flat, ["email", "e_mail", "email_address"])?.trim().toLowerCase() || null,
    phone: pickField(flat, ["phone", "phone_number", "tel", "mobile"])?.trim() || null,
    preferred_date:
      pickField(flat, ["move_date", "preferred_date", "date", "moving_date"]) || null,
    preferred_time: pickField(flat, ["preferred_time", "time_window", "arrival_window"]) || null,
    service_type: serviceRaw ? mapInboundServiceType(serviceRaw) : null,
    move_size: normalizeMoveSizeSlug(moveRaw || undefined) || moveRaw?.trim() || null,
    from_address:
      pickField(flat, ["from_address", "moving_from", "pickup", "origin"]) || null,
    from_access: pickField(flat, ["from_access", "pickup_access", "origin_access"]) || null,
    to_address: pickField(flat, ["to_address", "moving_to", "dropoff", "destination"]) || null,
    to_access: pickField(flat, ["to_access", "delivery_access", "destination_access"]) || null,
    inventory_text:
      pickField(flat, [
        "inventory_text",
        "inventory",
        "items",
        "furniture_list",
        "additional_info",
        "message",
      ]) || null,
    box_count_estimate: pickField(flat, ["box_count_estimate", "boxes", "box_count"]) || null,
    assembly_needed: pickField(flat, ["assembly_needed", "assembly", "disassembly"]) || null,
    wrapping_needed: pickField(flat, ["wrapping_needed", "wrapping"]) || null,
    specialty_items_text: pickField(flat, ["specialty_items_text", "specialty", "special_items"]) || null,
    packing_help: pickField(flat, ["packing_help", "packing"]) || null,
    insurance_preference: pickField(flat, ["insurance_preference", "insurance", "valuation"]) || null,
    how_heard: pickField(flat, ["how_heard", "heard", "lead_source_free", "utm_source"]) || null,
    referral_detail: pickField(flat, ["referral_detail", "referred_by", "referrer"]) || null,
    message: pickField(flat, ["message", "comments", "notes"]) || null,
  };
}
