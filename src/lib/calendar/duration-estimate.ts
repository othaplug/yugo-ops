import type { SupabaseClient } from "@supabase/supabase-js";

interface EstimateParams {
  job_type: "move" | "delivery" | "project_phase";
  sub_type: string;
  inventory_score?: number;
  floor?: number;
  has_elevator?: boolean;
  distance_km?: number;
  item_count?: number;
  has_assembly?: boolean;
  has_disassembly?: boolean;
}

interface EstimateResult {
  estimated_hours: number;
  suggested_start: string;
  suggested_end: string;
  confidence: "high" | "medium" | "low";
  breakdown: string;
}

export async function estimateDuration(
  supabase: SupabaseClient,
  params: EstimateParams
): Promise<EstimateResult> {
  const { data: defaults } = await supabase
    .from("duration_defaults")
    .select("*")
    .eq("job_type", params.job_type)
    .eq("sub_type", params.sub_type)
    .single();

  let hours = defaults?.default_hours || 4.0;
  let breakdown = `Base: ${hours}h`;

  if (params.inventory_score && params.job_type === "move") {
    if (params.inventory_score > 1.15) {
      hours += 1.0;
      breakdown += " + Heavy inventory: +1.0h";
    } else if (params.inventory_score < 0.85) {
      hours -= 0.5;
      breakdown += " + Light inventory: -0.5h";
    }
  }

  if (params.floor && params.floor > 2 && !params.has_elevator) {
    const adder = Math.min((params.floor - 2) * 0.3, 1.5);
    hours += adder;
    breakdown += ` + Stairs (floor ${params.floor}): +${adder.toFixed(1)}h`;
  }

  if (params.distance_km && params.distance_km > 30) {
    const adder = Math.min((params.distance_km - 30) * 0.02, 2.0);
    hours += adder;
    breakdown += ` + Distance (${params.distance_km}km): +${adder.toFixed(1)}h`;
  }

  if (params.has_assembly) {
    hours += 0.5;
    breakdown += " + Assembly: +0.5h";
  }
  if (params.has_disassembly) {
    hours += 0.5;
    breakdown += " + Disassembly: +0.5h";
  }

  if (params.item_count && params.item_count > 5) {
    const adder = Math.min((params.item_count - 5) * 0.2, 2.0);
    hours += adder;
    breakdown += ` + Items (${params.item_count}): +${adder.toFixed(1)}h`;
  }

  hours = Math.round(hours * 4) / 4;
  breakdown += ` = ${hours}h`;

  const startHour = 8;
  const endTotal = startHour + hours;
  const endH = Math.floor(endTotal);
  const endM = Math.round((endTotal % 1) * 60);
  const suggestedStart = `${String(startHour).padStart(2, "0")}:00`;
  const suggestedEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  const factorCount = [
    params.inventory_score,
    params.floor,
    params.distance_km,
    params.item_count,
  ].filter(Boolean).length;

  const confidence: "high" | "medium" | "low" =
    factorCount >= 3 ? "high" : factorCount >= 1 ? "medium" : "low";

  return { estimated_hours: hours, suggested_start: suggestedStart, suggested_end: suggestedEnd, confidence, breakdown };
}
