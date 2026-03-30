import type { SupabaseClient } from "@supabase/supabase-js";
import { createLeadPipeline, type InboundLeadInput } from "./inbound";
import { parseCaptureFormPayload, type ParsedCaptureForm } from "./parse-capture-form";
import { autoParseInventory } from "./auto-parse-inventory";
import { detectSpecialtyItems } from "./specialty-detect";
import { scoreLeadIntelligence } from "./lead-intelligence-score";
import { determinePriority, type LeadSource } from "./priority";
import type { ItemWeightLike } from "@/lib/inventory-search";
import { detectMultipleDates } from "./detect-multiple-dates";
import { detectServiceTypeFromText } from "./detect-service-type-text";
import { assessCompleteness } from "./assess-completeness";
import { parseLeadTextMetrics } from "./parse-text-metrics";

function inferSource(parsed: ReturnType<typeof parseCaptureFormPayload>): LeadSource {
  const h = (parsed.how_heard || "").toLowerCase();
  if (h.includes("google") || h.includes("ads") || h.includes("ppc")) return "google_ads";
  if (h.includes("referral") || h.includes("friend") || h.includes("word of mouth")) return "referral";
  if (h.includes("realtor") || h.includes("agent")) return "realtor";
  if (h.includes("instagram") || h.includes("facebook") || h.includes("social")) return "social_media";
  return "website_form";
}

function mergeMessage(parsed: ReturnType<typeof parseCaptureFormPayload>): string | null {
  const parts = [
    parsed.inventory_text,
    parsed.specialty_items_text,
    parsed.message,
    parsed.how_heard ? `How they heard: ${parsed.how_heard}` : null,
  ].filter(Boolean) as string[];
  const s = parts.join("\n\n").trim();
  return s ? s.slice(0, 8000) : null;
}

function maxPriority(
  a: "urgent" | "high" | "normal" | "low",
  b: "urgent" | "high" | "normal" | "low",
): "urgent" | "high" | "normal" | "low" {
  const r = (x: typeof a) => (x === "urgent" ? 4 : x === "high" ? 3 : x === "normal" ? 2 : 1);
  return r(a) >= r(b) ? a : b;
}

export type CreateLeadFromParsedOpts = {
  source?: LeadSource;
  source_detail?: string;
  send_acknowledgment?: boolean;
  skip_hubspot?: boolean;
  raw_inquiry_text?: string | null;
  external_platform?: string | null;
  external_reference?: string | null;
};

/**
 * Score + persist from an already-parsed capture shape (Webflow, manual merge, etc.).
 */
export async function createLeadFromParsedCapture(
  sb: SupabaseClient,
  parsed: ParsedCaptureForm,
  opts?: CreateLeadFromParsedOpts,
): Promise<{ lead_id: string }> {
  if (!parsed.email && !parsed.phone) {
    throw new Error("At least one of email or phone is required");
  }

  const { data: weightRows } = await sb
    .from("item_weights")
    .select("slug, item_name, weight_score, active")
    .eq("active", true);

  const weights = (weightRows || []) as ItemWeightLike[];

  const detectedSvc = detectServiceTypeFromText(
    parsed.message || "",
    parsed.inventory_text || "",
  );
  const effectiveService =
    parsed.service_type ?? (detectedSvc && detectedSvc.confidence >= 0.8 ? detectedSvc.slug : null);
  const parsedForScoring: typeof parsed = { ...parsed, service_type: effectiveService };

  const inv = autoParseInventory(parsed.inventory_text, weights);
  const spec = detectSpecialtyItems(parsed.inventory_text, parsed.specialty_items_text);
  const intel = await scoreLeadIntelligence(sb, parsedForScoring, inv, spec);

  const textBlob = [parsed.message, parsed.inventory_text, mergeMessage(parsed)]
    .filter(Boolean)
    .join("\n");
  const datesDetected = detectMultipleDates(textBlob);
  const textMetrics = parseLeadTextMetrics(textBlob);
  let completeness = assessCompleteness(parsedForScoring, inv, {
    service_inferred: parsed.service_type ? null : detectedSvc,
  });

  const heavyWeight = textMetrics.maxWeightLbs != null && textMetrics.maxWeightLbs > 300;
  const specialtyService =
    effectiveService === "specialty" ||
    effectiveService === "b2b_oneoff" ||
    (effectiveService === "single_item" && heavyWeight);
  const requiresSpecialtyQuote = heavyWeight || specialtyService;
  if (requiresSpecialtyQuote) {
    completeness = {
      ...completeness,
      path: "manual_review",
      clarifications_needed: [
        ...completeness.clarifications_needed,
        ...(heavyWeight
          ? [`Weight over 300 lb detected (${Math.round(textMetrics.maxWeightLbs!)} lb) — specialty coordinator quote`]
          : []),
        ...(specialtyService && !heavyWeight
          ? ["Specialty or one-off commercial delivery — use Specialty Quote Builder (no auto-quote)"]
          : []),
      ],
    };
  }

  let boxCount = inv.boxCount;
  if (parsed.box_count_estimate) {
    const n = parseInt(String(parsed.box_count_estimate).replace(/\D/g, ""), 10);
    if (!Number.isNaN(n) && n > 0) boxCount = Math.max(boxCount, n);
  }

  const leadSource = opts?.source ?? inferSource(parsed);

  const basePriority = determinePriority({
    source: leadSource,
    move_size: parsed.move_size,
    preferred_date: parsed.preferred_date,
    service_type: effectiveService,
    message: mergeMessage(parsed),
    source_detail: opts?.source_detail ?? null,
  });

  const priority = maxPriority(intel.priority, basePriority);

  const preferredDate =
    parsed.preferred_date?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? parsed.preferred_date
      : parsed.preferred_date
        ? (() => {
            const d = new Date(parsed.preferred_date);
            return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          })()
        : null;

  const input: InboundLeadInput = {
    first_name: parsed.first_name,
    last_name: parsed.last_name,
    email: parsed.email,
    phone: parsed.phone,
    source: leadSource,
    source_detail: opts?.source_detail?.trim() || "Webflow quote form",
    service_type: effectiveService,
    move_size: parsed.move_size,
    from_address: parsed.from_address,
    to_address: parsed.to_address,
    preferred_date: preferredDate,
    message: mergeMessage(parsed),
    priority,
    estimated_value: intel.estimatedValue,
    send_acknowledgment: opts?.send_acknowledgment,
    skip_hubspot: opts?.skip_hubspot,
    from_access: parsed.from_access,
    to_access: parsed.to_access,
    preferred_time: parsed.preferred_time,
    raw_inventory_text: parsed.inventory_text,
    parsed_inventory: inv.items,
    parsed_box_count: boxCount > 0 ? boxCount : null,
    inventory_parse_confidence: inv.confidence === "none" ? null : inv.confidence,
    specialty_items_detected: spec,
    has_specialty: spec.length > 0,
    assembly_needed: parsed.assembly_needed,
    wrapping_needed: parsed.wrapping_needed,
    packing_help: parsed.packing_help,
    insurance_preference: parsed.insurance_preference,
    how_heard: parsed.how_heard,
    referral_detail: parsed.referral_detail,
    priority_reasons: intel.reasons,
    urgency_score: intel.urgencyScore,
    complexity_score: intel.complexityScore,
    recommended_tier: intel.recommendedTier,
    intelligence_summary: intel.reasons.join(" · ").slice(0, 4000),
    completeness_path: completeness.path,
    completeness_score: completeness.score,
    fields_present: completeness.present,
    fields_missing: completeness.missing,
    clarifications_needed: completeness.clarifications_needed,
    completeness,
    detected_service_type: detectedSvc?.slug ?? null,
    detected_dates: datesDetected,
    raw_inquiry_text: opts?.raw_inquiry_text?.trim() || null,
    external_platform: opts?.external_platform?.trim() || null,
    external_reference: opts?.external_reference?.trim() || null,
    parsed_weight_lbs_max: textMetrics.maxWeightLbs,
    parsed_dimensions_text: textMetrics.dimensionsSnippet,
    requires_specialty_quote: requiresSpecialtyQuote,
  };

  const lead = await createLeadPipeline(sb, input);
  return { lead_id: lead.id as string };
}

/**
 * Full lead capture: parse JSON body, then `createLeadFromParsedCapture`.
 */
export async function runLeadCapture(
  sb: SupabaseClient,
  raw: unknown,
  opts?: { source_detail?: string; send_acknowledgment?: boolean; skip_hubspot?: boolean },
): Promise<{ lead_id: string }> {
  const parsed = parseCaptureFormPayload(raw);
  return createLeadFromParsedCapture(sb, parsed, opts);
}
