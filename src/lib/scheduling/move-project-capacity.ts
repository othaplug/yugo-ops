/**
 * Count trucks and labour demand from scheduled move_project_days so
 * auto-scheduling and availability checks account for multi-day projects.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export function normalizeTruckTypeKey(t: string | null | undefined): string {
  return (t || "").toLowerCase().replace(/\s+/g, "").replace(/_/g, "");
}

const ACTIVE_DAY_STATUSES = ["scheduled", "in_progress"] as const;

/**
 * How many trucks of a given type are already allocated by move project days on this calendar date.
 */
export async function countMoveProjectTrucksForDate(
  admin: SupabaseClient,
  date: string,
  truckType: string,
): Promise<number> {
  const want = normalizeTruckTypeKey(truckType);
  if (!want) return 0;

  const { data: rows, error } = await admin
    .from("move_project_days")
    .select("truck_type, truck_count")
    .eq("date", date)
    .in("status", [...ACTIVE_DAY_STATUSES]);

  if (error || !rows?.length) return 0;

  let n = 0;
  for (const row of rows) {
    const tt = normalizeTruckTypeKey(row.truck_type as string | null);
    if (!tt || tt !== want) continue;
    const c = Number(row.truck_count);
    n += Number.isFinite(c) && c > 0 ? c : 1;
  }
  return n;
}

/**
 * Sum of crew_size across active move project days on this date (labour pool pressure).
 */
export async function sumMoveProjectCrewDemandForDate(admin: SupabaseClient, date: string): Promise<number> {
  const { data: rows, error } = await admin
    .from("move_project_days")
    .select("crew_size")
    .eq("date", date)
    .in("status", [...ACTIVE_DAY_STATUSES]);

  if (error || !rows?.length) return 0;
  return rows.reduce((acc, row) => acc + Math.max(0, Number(row.crew_size) || 0), 0);
}
