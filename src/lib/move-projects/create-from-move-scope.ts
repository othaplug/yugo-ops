import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDaysIso } from "@/lib/quotes/estate-schedule";
import { labelForDayType, MOVE_DAY_STAGE_FLOW } from "@/lib/move-projects/day-types";

type BreakdownRow = { day?: number; type?: string; rate?: number };

function normalizeBreakdown(rows: unknown): BreakdownRow[] {
  if (!Array.isArray(rows)) return [];
  const out: BreakdownRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as BreakdownRow;
    out.push({
      day: typeof o.day === "number" ? o.day : undefined,
      type: typeof o.type === "string" ? o.type : "move",
      rate: typeof o.rate === "number" ? o.rate : undefined,
    });
  }
  return out.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
}

/**
 * After a moves row exists: create move_projects + phases + days from quote scope or coordinator breakdown.
 * Returns new move_projects id or null when skipped.
 */
export async function attachMultiDayMoveProjectFromScope(
  db: SupabaseClient,
  args: {
    moveId: string;
    quoteUuid: string | null;
    contactId?: string | null;
    clientName: string;
    fromAddress: string;
    toAddress: string;
    scheduledDateIso: string;
    estimatedDays: number;
    dayBreakdown: unknown;
  },
): Promise<string | null> {
  const daysNeeded = Math.max(1, Math.min(14, Math.round(args.estimatedDays)));
  if (daysNeeded <= 1) return null;

  const breakdown = normalizeBreakdown(args.dayBreakdown);
  const rows =
    breakdown.length > 0
      ? breakdown
      : Array.from({ length: daysNeeded }, (_, i) => ({
          day: i + 1,
          type: i === daysNeeded - 1 ? "move" : "pack",
          rate: undefined as number | undefined,
        }));

  let lastMoveIndex = -1;
  for (let j = rows.length - 1; j >= 0; j--) {
    const t = (rows[j]?.type || "move").toLowerCase();
    if (t === "move") {
      lastMoveIndex = j;
      break;
    }
  }

  const start = args.scheduledDateIso?.trim() || new Date().toISOString().slice(0, 10);

  const projectName =
    `${args.clientName || "Move"}`.trim().slice(0, 120) ||
    `${args.fromAddress.slice(0, 40)} to ${args.toAddress.slice(0, 40)}`;

  const endDate =
    rows.length > 0
      ? addCalendarDaysIso(start, Math.max(0, rows.length - 1))
      : start;

  const { data: project, error: pErr } = await db
    .from("move_projects")
    .insert({
      move_id: args.moveId,
      quote_id: args.quoteUuid,
      contact_id: args.contactId ?? null,
      partner_id: null,
      project_name: projectName,
      project_type: "residential_standard",
      multi_home_move_type: null,
      office_profile: {},
      start_date: start,
      end_date: endDate,
      total_days: rows.length,
      origins: [{ address: args.fromAddress, label: "Primary pickup" }],
      destinations: [{ address: args.toAddress, label: "Primary drop-off" }],
      status: "scheduled",
      coordinator_name: null,
      coordinator_id: null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (pErr || !project?.id) {
    console.error("[attachMultiDayMoveProjectFromScope] move_projects insert:", pErr?.message);
    return null;
  }

  const projectId = project.id as string;

  let dayNum = 1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const dayType = (row.type || "move").toLowerCase();
    const label = labelForDayType(dayType);
    const flow = MOVE_DAY_STAGE_FLOW[dayType] ?? MOVE_DAY_STAGE_FLOW.move;
    const dateIso = addCalendarDaysIso(start, i);

    const { data: phaseRow, error: phErr } = await db
      .from("move_project_phases")
      .insert({
        project_id: projectId,
        phase_number: i + 1,
        phase_name: label,
        phase_type: dayType,
        start_date: dateIso,
        end_date: dateIso,
        origin_index: 0,
        destination_index: 0,
        description: null,
        status: "pending",
        sort_order: i,
      })
      .select("id")
      .single();

    if (phErr || !phaseRow?.id) {
      console.error("[attachMultiDayMoveProjectFromScope] phase insert:", phErr?.message);
      continue;
    }

    const crewDefault = dayType === "move" ? 4 : 3;
    const hoursDefault = dayType === "move" ? 10 : 8;
    const truck =
      dayType === "move" ? "26ft" : null;

    const { error: dErr } = await db.from("move_project_days").insert({
      project_id: projectId,
      phase_id: phaseRow.id as string,
      day_number: dayNum++,
      date: dateIso,
      day_type: dayType,
      label,
      description: null,
      crew_size: crewDefault,
      crew_ids: null,
      truck_type: truck,
      truck_count: 1,
      estimated_hours: hoursDefault,
      origin_address: args.fromAddress,
      destination_address: dayType === "move" ? args.toAddress : args.fromAddress,
      arrival_window: null,
      start_time: null,
      end_time: null,
      status: "scheduled",
      completion_notes: null,
      issues: null,
      move_id: args.moveId,
      stages: flow.stages,
      current_stage: null,
      requires_pod: dayType === "move" && i === lastMoveIndex,
      crew_assigned: [],
      location_address:
        dayType === "move" ? `${args.fromAddress} to ${args.toAddress}` : args.fromAddress,
    });

    if (dErr) {
      console.error("[attachMultiDayMoveProjectFromScope] day insert:", dErr.message);
    }
  }

  const { error: linkErr } = await db
    .from("moves")
    .update({ move_project_id: projectId, updated_at: new Date().toISOString() })
    .eq("id", args.moveId);

  if (linkErr) {
    console.error("[attachMultiDayMoveProjectFromScope] move link:", linkErr.message);
  }

  return projectId;
}
