import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadAssignmentMode = "round_robin" | "smart" | "manual";

const VALID: LeadAssignmentMode[] = ["round_robin", "smart", "manual"];

export async function getLeadAssignmentMode(sb: SupabaseClient): Promise<LeadAssignmentMode> {
  const { data } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", "lead_assignment_mode")
    .maybeSingle();
  const v = String(data?.value || "").trim().toLowerCase();
  if (VALID.includes(v as LeadAssignmentMode)) return v as LeadAssignmentMode;
  return "smart";
}
