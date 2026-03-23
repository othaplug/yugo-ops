/**
 * Smart routing: suggests optimal crew-to-job assignment
 * based on geography to minimize total deadhead distance.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getDrivingDistance } from "@/lib/mapbox/driving-distance";

const YUGO_BASE = "Toronto, Ontario, Canada";

export interface RoutingJob {
  id: string;
  move_code?: string;
  delivery_number?: string;
  job_type: "move" | "delivery";
  from_address: string;
  crew_id: string | null;
  crew_name?: string;
}

export interface RoutingTeam {
  id: string;
  name: string;
  previousJobDestination?: string | null;
}

export interface RoutingAssignment {
  teamId: string;
  teamName: string;
  jobId: string;
  jobCode: string;
}

export interface RoutingSuggestion {
  suggestion: string;
  savings_km: number;
  savings_minutes: number;
  current: RoutingAssignment[];
  recommended: RoutingAssignment[];
}

// Simple permutation generator for small arrays (≤5)
function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i]!, ...perm]);
    }
  }
  return result;
}

async function getApproxDistance(from: string, to: string): Promise<number> {
  try {
    const result = await getDrivingDistance(from, to);
    return result?.distance_km ?? 20;
  } catch {
    // Fallback: rough postal code comparison
    return 20;
  }
}

export async function suggestOptimalRouting(date: string): Promise<RoutingSuggestion | null> {
  const supabase = createAdminClient();

  // Get moves and deliveries for the date
  const [{ data: moves }, { data: deliveries }] = await Promise.all([
    supabase
      .from("moves")
      .select("id, move_code, from_address, crew_id, crews(id, name)")
      .in("status", ["confirmed", "scheduled"])
      .eq("scheduled_date", date)
      .not("crew_id", "is", null),
    supabase
      .from("deliveries")
      .select("id, delivery_number, pickup_address, crew_id, crews(id, name)")
      .in("status", ["pending", "confirmed", "scheduled"])
      .eq("scheduled_date", date)
      .not("crew_id", "is", null),
  ]);

  const jobs: RoutingJob[] = [
    ...(moves ?? []).map((m) => ({
      id: m.id,
      move_code: m.move_code,
      job_type: "move" as const,
      from_address: m.from_address || "",
      crew_id: m.crew_id,
    })),
    ...(deliveries ?? []).map((d) => ({
      id: d.id,
      delivery_number: d.delivery_number,
      job_type: "delivery" as const,
      from_address: (d as { pickup_address?: string }).pickup_address || "",
      crew_id: d.crew_id,
    })),
  ].filter((j) => j.from_address);

  if (jobs.length < 2) return null;

  // Unique teams
  const teamMap = new Map<string, RoutingTeam>();
  for (const job of jobs) {
    if (job.crew_id && !teamMap.has(job.crew_id)) {
      teamMap.set(job.crew_id, { id: job.crew_id, name: `Team ${job.crew_id.slice(0, 6)}` });
    }
  }
  const teams = Array.from(teamMap.values());
  if (teams.length < 2 || teams.length > 5) return null; // Skip if too many permutations

  // Compute current total deadhead
  let currentDeadhead = 0;
  const currentAssignments: RoutingAssignment[] = [];
  for (const job of jobs) {
    if (job.crew_id) {
      const dist = await getApproxDistance(YUGO_BASE, job.from_address);
      currentDeadhead += dist;
      const team = teamMap.get(job.crew_id);
      currentAssignments.push({
        teamId: job.crew_id,
        teamName: team?.name || job.crew_id,
        jobId: job.id,
        jobCode: job.move_code || job.delivery_number || job.id,
      });
    }
  }

  // Try all team-to-job permutations
  let bestDeadhead = currentDeadhead;
  let bestAssignment: RoutingAssignment[] = currentAssignments;

  // Only attempt if jobs.length === teams.length (1-to-1)
  if (teams.length === jobs.length) {
    const teamPerms = permutations(teams);
    for (const teamPerm of teamPerms) {
      let totalDist = 0;
      const candidateAssignments: RoutingAssignment[] = [];
      for (let i = 0; i < jobs.length; i++) {
        const team = teamPerm[i]!;
        const job = jobs[i]!;
        const dist = await getApproxDistance(YUGO_BASE, job.from_address);
        totalDist += dist;
        candidateAssignments.push({
          teamId: team.id,
          teamName: team.name,
          jobId: job.id,
          jobCode: job.move_code || job.delivery_number || job.id,
        });
      }
      if (totalDist < bestDeadhead) {
        bestDeadhead = totalDist;
        bestAssignment = candidateAssignments;
      }
    }
  }

  const savingsKm = Math.max(0, currentDeadhead - bestDeadhead);

  // Only suggest if saving > 15% or > 15 km
  if (savingsKm < 15 && savingsKm / Math.max(currentDeadhead, 1) < 0.15) return null;

  const savingsMinutes = Math.round((savingsKm / 30) * 60);

  // Store suggestion
  await supabase.from("routing_suggestions").insert({
    date,
    suggestion: {
      text: buildSuggestionText(currentAssignments, bestAssignment),
      current: currentAssignments,
      recommended: bestAssignment,
    },
    savings_km: savingsKm,
    savings_min: savingsMinutes,
  }).then(() => {}, () => {});

  return {
    suggestion: buildSuggestionText(currentAssignments, bestAssignment),
    savings_km: Math.round(savingsKm),
    savings_minutes: savingsMinutes,
    current: currentAssignments,
    recommended: bestAssignment,
  };
}

function buildSuggestionText(
  current: RoutingAssignment[],
  recommended: RoutingAssignment[]
): string {
  const swaps: string[] = [];
  for (const rec of recommended) {
    const cur = current.find((c) => c.jobId === rec.jobId);
    if (cur && cur.teamId !== rec.teamId) {
      swaps.push(`${rec.teamName} → ${rec.jobCode}`);
    }
  }
  if (swaps.length === 0) return "Swap crew assignments";
  return `Reassign: ${swaps.join(", ")}`;
}
