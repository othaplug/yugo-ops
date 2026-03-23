/**
 * Auto-Scheduling — conflict resolution engine.
 *
 * Called after deposit payment. Checks crew + truck availability for the
 * requested slot, auto-assigns if possible, or surfaces alternatives.
 * Notifies coordinator on partial / no availability.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { recommendCrew } from "@/lib/crew/recommendation";

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface AvailabilityAlternative {
  date: string;
  window: string;
  team_name: string | null;
  crew_ids: string[];
}

export type AvailabilityStatus =
  | { status: "available" }
  | { status: "partial"; alternatives: AvailabilityAlternative[] }
  | { status: "unavailable" };

// Arrival windows checked in order
const WINDOWS = [
  "6AM-8AM",
  "8AM-10AM",
  "10AM-12PM",
  "12PM-2PM",
  "2PM-4PM",
  "4PM-6PM",
];

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function windowsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  // Very rough overlap check — treat each window as a 2-hour block
  const startHour = (w: string) => parseInt(w.split(/[-AM]/)[0], 10);
  const aStart = startHour(a);
  const bStart = startHour(b);
  return Math.abs(aStart - bStart) < 2;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════
// Core availability check
// ═══════════════════════════════════════════════

export async function checkAvailability(
  date: string,
  window: string,
  crewSize: number,
  truckType: string
): Promise<AvailabilityStatus> {
  const admin = createAdminClient();

  // Get all moves on this date that are scheduled/active
  const { data: existingMoves } = await admin
    .from("moves")
    .select("id, crew_id, arrival_window, truck_primary")
    .eq("move_date", date)
    .in("status", ["scheduled", "confirmed", "en_route_to_pickup", "in_progress", "pending_approval"]);

  const movesOnDate = existingMoves ?? [];

  // Get all crew teams
  const { data: teams } = await admin
    .from("crews")
    .select("id, name, member_ids")
    .eq("active", true);

  const allTeams = teams ?? [];

  function teamAvailableForWindow(teamId: string, w: string): boolean {
    return !movesOnDate.some(
      (m) => m.crew_id === teamId && windowsOverlap(m.arrival_window ?? "", w)
    );
  }

  // Check if at least one team has enough members and is free for this window
  const availableTeams = allTeams.filter(
    (t: { id: string; member_ids?: string[] }) =>
      teamAvailableForWindow(t.id, window) &&
      (t.member_ids?.length ?? 0) >= crewSize
  );

  // Check truck availability — simple: count trucks of that type not on active moves
  const trucksInUse = movesOnDate.filter(
    (m) => m.truck_primary === truckType
  ).length;

  // For now we assume a fleet of 3 of each truck type (can be config-driven later)
  const FLEET_SIZE = 3;
  const trucksAvailable = FLEET_SIZE - trucksInUse;

  if (availableTeams.length > 0 && trucksAvailable > 0) {
    return { status: "available" };
  }

  // Build alternatives — same day, other windows
  const alternatives: AvailabilityAlternative[] = [];

  for (const altWindow of WINDOWS) {
    if (altWindow === window) continue;
    const altTeams = allTeams.filter(
      (t: { id: string; member_ids?: string[] }) =>
        teamAvailableForWindow(t.id, altWindow) &&
        (t.member_ids?.length ?? 0) >= crewSize
    );
    const altTrucksInUse = movesOnDate.filter(
      (m) =>
        m.truck_primary === truckType &&
        windowsOverlap(m.arrival_window ?? "", altWindow)
    ).length;
    if (altTeams.length > 0 && FLEET_SIZE - altTrucksInUse > 0) {
      const team = altTeams[0] as { id: string; name: string; member_ids?: string[] };
      alternatives.push({
        date,
        window: altWindow,
        team_name: team.name ?? null,
        crew_ids: team.member_ids ?? [],
      });
      if (alternatives.length >= 2) break; // max 2 same-day alternatives
    }
  }

  // Next day, same window
  const nextDay = addDays(date, 1);
  const { data: nextDayMoves } = await admin
    .from("moves")
    .select("id, crew_id, arrival_window, truck_primary")
    .eq("move_date", nextDay)
    .in("status", ["scheduled", "confirmed", "en_route_to_pickup", "in_progress", "pending_approval"]);

  const nextDayTeams = allTeams.filter(
    (t: { id: string; member_ids?: string[] }) =>
      !(nextDayMoves ?? []).some(
        (m: { crew_id: string; arrival_window: string | null }) =>
          m.crew_id === t.id && windowsOverlap(m.arrival_window ?? "", window)
      ) &&
      (t.member_ids?.length ?? 0) >= crewSize
  );

  if (nextDayTeams.length > 0) {
    const team = nextDayTeams[0] as { id: string; name: string; member_ids?: string[] };
    alternatives.push({
      date: nextDay,
      window,
      team_name: team.name ?? null,
      crew_ids: team.member_ids ?? [],
    });
  }

  if (alternatives.length > 0) {
    return { status: "partial", alternatives };
  }

  return { status: "unavailable" };
}

// ═══════════════════════════════════════════════
// Main orchestrator — called after deposit paid
// ═══════════════════════════════════════════════

export async function autoScheduleMove(
  moveId: string,
  quoteId: string,
  moveCode: string
) {
  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select(
      "id, move_date, arrival_window, crew_count, truck_primary, service_type, tier_selected, estimate, has_piano"
    )
    .eq("id", moveId)
    .single();

  if (!move?.move_date) return;

  const crewSize = (move.crew_count as number) ?? 2;
  const truckType = (move.truck_primary as string) ?? "16ft";
  const window = (move.arrival_window as string) ?? "8AM-10AM";

  const availability = await checkAvailability(
    move.move_date as string,
    window,
    crewSize,
    truckType
  );

  if (availability.status === "available") {
    // Auto-assign best available crew
    const recommended = await recommendCrew(
      {
        service_type: move.service_type as string | null,
        tier_selected: move.tier_selected as string | null,
        has_piano: move.has_piano as boolean | undefined,
        estimate: move.estimate as number | null,
      },
      move.move_date as string
    );

    if (recommended.length > 0) {
      const best = recommended[0];
      await admin
        .from("moves")
        .update({
          crew_id: best.crew.user_id,
          status: "scheduled",
          auto_scheduled: true,
          auto_scheduled_at: new Date().toISOString(),
        })
        .eq("id", moveId);

      // Notify admins of successful auto-schedule
      await notifyAdmins("move_scheduled", {
        moveId,
        subject: `Auto-scheduled: ${moveCode}`,
        body: `Move ${moveCode} auto-scheduled — ${move.move_date} ${window}. Crew: ${best.crew.name ?? "assigned"}.`,
        description: `Move ${moveCode} auto-scheduled — ${move.move_date} ${window}. Crew: ${best.crew.name ?? "assigned"}.`,
      }).catch(() => {});
    } else {
      // No crew profiles yet — mark as scheduled (unassigned crew)
      await admin
        .from("moves")
        .update({ status: "scheduled", auto_scheduled: true })
        .eq("id", moveId);
    }
  } else if (availability.status === "partial") {
    // Store alternatives and flag for coordinator
    const alts = availability.alternatives;

    await admin.from("scheduling_alternatives").insert(
      alts.map((a) => ({
        move_id: moveId,
        alt_date: a.date,
        alt_window: a.window,
        team_name: a.team_name,
        crew_ids: a.crew_ids,
      }))
    );

    await admin
      .from("moves")
      .update({ status: "confirmed_pending_schedule" })
      .eq("id", moveId);

    await notifyAdmins("scheduling_conflict", {
      moveId,
      subject: `Scheduling conflict: ${moveCode}`,
      body: `New booking ${moveCode}: requested ${move.move_date} ${window} is fully booked. ${alts.length} alternative slot(s) available.`,
      description: `New booking ${moveCode}: requested ${move.move_date} ${window} is fully booked. ${alts.length} alternative slot(s) available.`,
    }).catch(() => {});
  } else {
    // No availability at all
    await admin
      .from("moves")
      .update({ status: "confirmed_unassigned" })
      .eq("id", moveId);

    await notifyAdmins("no_availability", {
      moveId,
      subject: `URGENT — no availability: ${moveCode}`,
      body: `New booking ${moveCode} for ${move.move_date} — no crew or truck available. Needs immediate manual resolution.`,
      description: `New booking ${moveCode} for ${move.move_date} — no crew or truck available. Needs immediate manual resolution.`,
    }).catch(() => {});
  }
}
