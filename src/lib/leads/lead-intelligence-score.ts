import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPostalPrefix } from "@/lib/maps/distance";
import { daysBetween, type LeadPriority } from "./priority";
import type { ParsedCaptureForm } from "./parse-capture-form";
import type { ParsedInventory } from "./auto-parse-inventory";
import type { SpecialtyDetected } from "./specialty-detect";

export type LeadIntelligence = {
  priority: LeadPriority;
  reasons: string[];
  estimatedValue: number;
  urgencyScore: number;
  complexityScore: number;
  recommendedTier: "curated" | "signature" | "estate";
  neighbourhoodTier: string | null;
  neighbourhoodName: string | null;
};

const SIZE_VALUE: Record<string, number> = {
  studio: 500,
  "1br": 700,
  "2br": 1100,
  "3br": 1600,
  "4br": 2200,
  "5br_plus": 3000,
  partial: 450,
};

function priorityRank(p: LeadPriority): number {
  return p === "urgent" ? 4 : p === "high" ? 3 : p === "normal" ? 2 : 1;
}

function maxPriority(a: LeadPriority, b: LeadPriority): LeadPriority {
  return priorityRank(a) >= priorityRank(b) ? a : b;
}

async function lookupNeighbourhood(
  sb: SupabaseClient,
  address: string | null | undefined,
): Promise<{ tier: string | null; name: string | null }> {
  const fsa = address ? extractPostalPrefix(address) : null;
  if (!fsa) return { tier: null, name: null };
  const { data } = await sb
    .from("neighbourhood_tiers")
    .select("tier, neighbourhood_name")
    .eq("postal_prefix", fsa)
    .maybeSingle();
  return { tier: data?.tier ?? null, name: data?.neighbourhood_name ?? null };
}

export async function scoreLeadIntelligence(
  sb: SupabaseClient,
  parsed: ParsedCaptureForm,
  inventory: ParsedInventory,
  specialty: SpecialtyDetected[],
): Promise<LeadIntelligence> {
  const reasons: string[] = [];
  let priority: LeadPriority = "normal";
  let urgencyScore = 50;
  let complexityScore = 50;

  const { tier: neighbourhoodTier, name: neighbourhoodName } = await lookupNeighbourhood(
    sb,
    parsed.from_address,
  );

  if (parsed.preferred_date) {
    const d = new Date(parsed.preferred_date + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      const days = daysBetween(new Date(), d);
      if (days >= 0 && days <= 3) {
        urgencyScore = 100;
        priority = "urgent";
        reasons.push(`Move in ${days} days — respond immediately`);
      } else if (days >= 0 && days <= 7) {
        urgencyScore = 90;
        priority = maxPriority(priority, "urgent");
        reasons.push(`Move in ${days} days — fast turnaround`);
      } else if (days >= 0 && days <= 14) {
        urgencyScore = 70;
        priority = maxPriority(priority, "high");
        reasons.push(`Move in ${days} days`);
      } else if (days >= 0 && days <= 30) {
        urgencyScore = 50;
      } else if (days > 30) {
        urgencyScore = 30;
        reasons.push(`Move in ${days} days — schedule follow-up`);
      }
    }
  }

  if (neighbourhoodTier === "A") {
    priority = maxPriority(priority, "high");
    reasons.push(
      neighbourhoodName
        ? `Premium area: ${neighbourhoodName}`
        : "Premium postal tier (A)",
    );
  }

  const ms = (parsed.move_size || "").toLowerCase();
  const estimatedValue = SIZE_VALUE[ms] ?? 800;
  if (estimatedValue >= 2000) {
    priority = maxPriority(priority, "high");
    reasons.push(`High-value size band: about $${estimatedValue}`);
  }

  if (specialty.length > 0) {
    complexityScore += Math.min(40, specialty.length * 10);
    const names = specialty.map((s) => s.keyword_matched).join(", ");
    reasons.push(`Specialty signals: ${names}`);
    if (
      specialty.some((s) =>
        ["piano", "safe", "pool_table", "hot_tub"].includes(s.type),
      )
    ) {
      priority = maxPriority(priority, "high");
      reasons.push("Heavy or complex specialty — consider onsite assessment");
    }
  }

  const assembly = (parsed.assembly_needed || "").toLowerCase();
  if (assembly === "both" || assembly === "yes" || assembly === "true") {
    complexityScore += 10;
    reasons.push("Assembly or disassembly requested");
  }

  if (specialty.some((s) => s.type === "fragile_flag")) {
    reasons.push("Client flagged fragile or valuable items — consider Signature+");
  }

  const wrap = (parsed.wrapping_needed || "").toLowerCase();
  if (wrap === "yes" || wrap === "true") {
    reasons.push("Wrapping requested — Signature upsell fit");
  }

  const pack = (parsed.packing_help || "").toLowerCase();
  if (pack === "yes" || pack === "true") {
    reasons.push("Packing help requested — full-pack upsell");
  }

  const ins = (parsed.insurance_preference || "").toLowerCase();
  if (ins && ins !== "none" && ins !== "no") {
    reasons.push("Insurance interest — premium tier signal");
  }

  const heard = (parsed.how_heard || "").toLowerCase();
  if (
    heard.includes("referral") ||
    heard.includes("friend") ||
    heard.includes("word of mouth")
  ) {
    priority = maxPriority(priority, "high");
    reasons.push("Referral or word-of-mouth — prioritize");
    if (parsed.referral_detail) reasons.push(`Referral detail: ${parsed.referral_detail}`);
  }

  if (inventory.confidence === "low" || inventory.items.some((i) => i.needs_review)) {
    complexityScore += 5;
    reasons.push("Inventory parse needs coordinator review");
  }

  let recommendedTier: "curated" | "signature" | "estate" = "curated";
  if (
    specialty.length > 0 ||
    wrap === "yes" ||
    wrap === "true" ||
    neighbourhoodTier === "A" ||
    estimatedValue >= 2000
  ) {
    recommendedTier = "signature";
  }
  if (
    specialty.some((s) => s.surcharge >= 200) ||
    (neighbourhoodTier === "A" && estimatedValue >= 3000)
  ) {
    recommendedTier = "estate";
  }

  reasons.push(`Recommended package: ${recommendedTier.toUpperCase()}`);

  return {
    priority,
    reasons,
    estimatedValue,
    urgencyScore,
    complexityScore: Math.min(100, complexityScore),
    recommendedTier,
    neighbourhoodTier,
    neighbourhoodName,
  };
}
