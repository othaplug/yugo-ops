import type { SupabaseClient } from "@supabase/supabase-js";
import { generateLeadNumber } from "./lead-number";

/**
 * `parsed_dimensions_text` / `parsed_weight_lbs_max` / `requires_specialty_quote` may be absent in
 * databases that have not run the specialty migration. Inserts that include them then fail with
 * PostgREST "could not find column … in the schema cache". We insert without them, then best-effort update.
 */
async function applyLeadsSpecialtyColumnsBestEffort(
  sb: SupabaseClient,
  leadId: string,
  patch: {
    parsed_weight_lbs_max: number | null;
    parsed_dimensions_text: string | null;
    requires_specialty_quote: boolean;
  },
) {
  const { error } = await sb.from("leads").update(patch).eq("id", leadId);
  if (!error) return;
  const m = (error.message || "").toLowerCase();
  if (
    m.includes("schema cache") ||
    (m.includes("column") && m.includes("leads") && m.includes("could not find")) ||
    m.includes("does not exist")
  ) {
    return;
  }
  throw new Error(error.message);
}
import { determinePriority, estimateValue, type LeadSource } from "./priority";
import { autoAssignLead } from "./assign";
import { notifyLeadArrived } from "./notify";
import { sendLeadAcknowledgment } from "./acknowledgment";
import { syncLeadToHubSpot } from "./hubspot-sync";
import type { ParsedInventoryItem } from "./auto-parse-inventory";
import type { SpecialtyDetected } from "./specialty-detect";
import type { CompletenessCheck, CompletenessPath } from "./assess-completeness";
import { sendSmartFollowUp } from "./smart-follow-up";

export type InboundLeadInput = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  source_detail?: string | null;
  referral_source_id?: string | null;
  service_type?: string | null;
  move_size?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  preferred_date?: string | null;
  message?: string | null;
  priority?: "urgent" | "high" | "normal" | "low" | null;
  estimated_value?: number | null;
  send_acknowledgment?: boolean;
  skip_hubspot?: boolean;
  from_access?: string | null;
  to_access?: string | null;
  preferred_time?: string | null;
  raw_inventory_text?: string | null;
  parsed_inventory?: ParsedInventoryItem[];
  parsed_box_count?: number | null;
  inventory_parse_confidence?: string | null;
  specialty_items_detected?: SpecialtyDetected[];
  has_specialty?: boolean;
  assembly_needed?: string | null;
  wrapping_needed?: string | null;
  packing_help?: string | null;
  insurance_preference?: string | null;
  how_heard?: string | null;
  referral_detail?: string | null;
  priority_reasons?: string[];
  urgency_score?: number | null;
  complexity_score?: number | null;
  recommended_tier?: string | null;
  intelligence_summary?: string | null;
  completeness_path?: CompletenessPath | null;
  completeness_score?: number | null;
  fields_present?: string[] | null;
  fields_missing?: string[] | null;
  clarifications_needed?: string[] | null;
  /** Used after insert for smart follow-up vs ack. */
  completeness?: CompletenessCheck | null;
  raw_inquiry_text?: string | null;
  detected_service_type?: string | null;
  detected_dates?: string[] | null;
  external_platform?: string | null;
  external_reference?: string | null;
  parsed_weight_lbs_max?: number | null;
  parsed_dimensions_text?: string | null;
  requires_specialty_quote?: boolean | null;
};

export async function createLeadPipeline(sb: SupabaseClient, input: InboundLeadInput) {
  const lead_number = await generateLeadNumber(sb);

  const priority =
    input.priority ??
    determinePriority({
      source: input.source,
      move_size: input.move_size,
      preferred_date: input.preferred_date,
      service_type: input.service_type,
      message: input.message,
      source_detail: input.source_detail,
    });

  const estimated_value =
    input.estimated_value ?? estimateValue(input.move_size ?? undefined);

  const row = {
    lead_number,
    first_name: input.first_name?.trim() || null,
    last_name: input.last_name?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    source: input.source,
    source_detail: input.source_detail?.trim() || null,
    referral_source_id: input.referral_source_id || null,
    service_type: input.service_type?.trim() || null,
    move_size: input.move_size?.trim() || null,
    from_address: input.from_address?.trim() || null,
    to_address: input.to_address?.trim() || null,
    preferred_date: input.preferred_date?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? input.preferred_date
      : input.preferred_date
        ? (() => {
            const d = new Date(input.preferred_date);
            return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          })()
        : null,
    message: input.message?.trim() || null,
    priority,
    estimated_value,
    status: "new" as const,
    from_access: input.from_access?.trim() || null,
    to_access: input.to_access?.trim() || null,
    preferred_time: input.preferred_time?.trim() || null,
    raw_inventory_text: input.raw_inventory_text?.trim() || null,
    parsed_inventory: input.parsed_inventory ?? [],
    parsed_box_count: input.parsed_box_count ?? null,
    inventory_parse_confidence: input.inventory_parse_confidence?.trim() || null,
    specialty_items_detected: input.specialty_items_detected ?? [],
    has_specialty: input.has_specialty ?? (input.specialty_items_detected?.length ?? 0) > 0,
    assembly_needed: input.assembly_needed?.trim() || null,
    wrapping_needed: input.wrapping_needed?.trim() || null,
    packing_help: input.packing_help?.trim() || null,
    insurance_preference: input.insurance_preference?.trim() || null,
    how_heard: input.how_heard?.trim() || null,
    referral_detail: input.referral_detail?.trim() || null,
    priority_reasons: input.priority_reasons ?? [],
    urgency_score: input.urgency_score ?? 50,
    complexity_score: input.complexity_score ?? 50,
    recommended_tier: input.recommended_tier?.trim() || null,
    intelligence_summary: input.intelligence_summary?.trim() || null,
    completeness_path: (input.completeness_path ?? "auto_quote") as CompletenessPath,
    completeness_score: input.completeness_score ?? 0,
    fields_present: input.fields_present ?? [],
    fields_missing: input.fields_missing ?? [],
    clarifications_needed: input.clarifications_needed ?? [],
    raw_inquiry_text: input.raw_inquiry_text?.trim() || null,
    detected_service_type: input.detected_service_type?.trim() || null,
    detected_dates: input.detected_dates ?? [],
    external_platform: input.external_platform?.trim() || null,
    external_reference: input.external_reference?.trim() || null,
    parsed_weight_lbs_max: input.parsed_weight_lbs_max ?? null,
    parsed_dimensions_text: input.parsed_dimensions_text?.trim() || null,
    requires_specialty_quote: input.requires_specialty_quote ?? false,
  };

  const {
    parsed_weight_lbs_max,
    parsed_dimensions_text,
    requires_specialty_quote,
    ...insertRow
  } = row;

  const { data: inserted, error } = await sb
    .from("leads")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const lead = inserted as Record<string, unknown>;

  await applyLeadsSpecialtyColumnsBestEffort(sb, lead.id as string, {
    parsed_weight_lbs_max,
    parsed_dimensions_text,
    requires_specialty_quote,
  });

  await sb.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "created",
    performed_by: null,
    notes: input.source_detail || null,
  });

  await autoAssignLead(sb, lead.id as string);

  const { data: refreshed } = await sb.from("leads").select("*").eq("id", lead.id as string).single();

  const full = (refreshed || lead) as Parameters<typeof notifyLeadArrived>[1];

  await notifyLeadArrived(sb, full);

  const path = (input.completeness_path ?? "auto_quote") as CompletenessPath;
  if (input.send_acknowledgment !== false) {
    if (path === "auto_quote") {
      await sendLeadAcknowledgment({
        first_name: row.first_name,
        email: row.email,
        phone: row.phone,
        move_size: row.move_size,
        preferred_date: row.preferred_date,
        from_address: row.from_address,
        to_address: row.to_address,
        service_type: row.service_type,
      });
    } else if (path === "needs_info" && input.completeness) {
      const ok = await sendSmartFollowUp(
        sb,
        {
          id: lead.id as string,
          first_name: row.first_name,
          email: row.email,
          phone: row.phone,
        },
        input.completeness,
      );
      if (!ok) {
        await sendLeadAcknowledgment({
          first_name: row.first_name,
          email: row.email,
          phone: row.phone,
          move_size: row.move_size,
          preferred_date: row.preferred_date,
          from_address: row.from_address,
          to_address: row.to_address,
          service_type: row.service_type,
        });
      }
    }
  }

  if (!input.skip_hubspot) {
    const { data: again } = await sb.from("leads").select("*").eq("id", lead.id as string).single();
    await syncLeadToHubSpot(sb, (again || full) as never);
  }

  const { data: final } = await sb.from("leads").select("*").eq("id", lead.id as string).single();
  return (final || full) as typeof full;
}
