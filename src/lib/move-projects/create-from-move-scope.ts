import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDaysIso } from "@/lib/quotes/estate-schedule";
import type {
  PackingRoomsPayload,
  MoveProjectSchedulePayload,
} from "@/lib/move-projects/planner-payload";
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

function toPgTime(s: string | null | undefined): string | null {
  if (!s || !String(s).trim()) return null;
  const t = String(s).trim().slice(0, 8);
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return null;
}

function planForDayRow(
  plan: MoveProjectSchedulePayload | null | undefined,
  dayNum: number,
  index: number,
) {
  if (!plan?.days?.length) return null;
  const byNum = plan.days.find((d) => d.day === dayNum);
  return byNum ?? plan.days[index] ?? null;
}

function packingRoomsFromPayload(room: PackingRoomsPayload | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!room || typeof room !== "object") return out;
  for (const key of ["kitchen", "living", "bedrooms", "dining", "garage", "storage"] as const) {
    if (Object.prototype.hasOwnProperty.call(room, key)) {
      const v = (room as Record<string, unknown>)[key];
      if (typeof v === "boolean") out[key] = v;
    }
  }
  return out;
}

function packingRoomsDescription(room: Record<string, boolean>): string | null {
  const map: Record<string, string> = {
    kitchen: "Kitchen",
    living: "Living room",
    bedrooms: "Bedrooms",
    dining: "Dining",
    garage: "Garage",
    storage: "Storage / utility",
  };
  const on = Object.entries(room)
    .filter(([, v]) => v === true)
    .map(([k]) => map[k] || k);
  return on.length > 0 ? `Planned packing focus: ${on.join(", ")}` : null;
}

const isCargoServiceDay = (t: string) => t === "move" || t === "volume";

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
    plannedSchedule?: MoveProjectSchedulePayload | null;
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



  const start = args.scheduledDateIso?.trim() || new Date().toISOString().slice(0, 10);
  const planned = args.plannedSchedule;

  const projectName =
    `${args.clientName || "Move"}`.trim().slice(0, 120) ||
    `${args.fromAddress.slice(0, 40)} to ${args.toAddress.slice(0, 40)}`;

  const dateIsoForIndex = (i: number, planDate: string | null | undefined) => {
    if (planDate && /^\d{4}-\d{2}-\d{2}$/.test(planDate.trim())) {
      return planDate.trim().slice(0, 10);
    }
    return addCalendarDaysIso(start, i);
  };

  const endDateFromPlanOrDefault = () => {
    if (planned?.days?.length) {
      const ok = planned.days
        .map((d) => d.date?.trim().slice(0, 10))
        .filter((x): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x));
      if (ok.length > 0) {
        return ok.reduce((a, b) => (a.localeCompare(b) >= 0 ? a : b));
      }
    }
    return rows.length > 0 ? addCalendarDaysIso(start, Math.max(0, rows.length - 1)) : start;
  };

  const endDate = endDateFromPlanOrDefault();

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

  const ALLOWED_DT = new Set(["pack", "move", "unpack", "crating", "volume"]);

  const normalizedDayTypeFromInputs = (
    planTypeExplicit: unknown,
    fallbackRaw: unknown,
  ): string => {
    const t0 =
      typeof planTypeExplicit === "string"
        ? planTypeExplicit.trim().toLowerCase()
        : ""
    const t1 = ALLOWED_DT.has(t0) ? t0 : String(fallbackRaw || "move").trim().toLowerCase()
    return ALLOWED_DT.has(t1) ? t1 : "move";
  };

  const resolvedDayTypes = rows.map((row, i) => {
    const rowDayOrdinal = typeof row.day === "number" ? row.day : i + 1;
    const pr = planForDayRow(planned ?? null, rowDayOrdinal, i);
    return normalizedDayTypeFromInputs(pr?.type, row.type || "move");
  });

  let lastCargoIndexSeen = -1;
  for (let k = 0; k < resolvedDayTypes.length; k++) {
    if (isCargoServiceDay(resolvedDayTypes[k]!)) lastCargoIndexSeen = k;
  }

  let dayNum = 1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowDayOrdinal = typeof row.day === "number" ? row.day : i + 1;
    const planRow = planForDayRow(planned ?? null, rowDayOrdinal, i);
    const dayType = resolvedDayTypes[i]!;

    const label = labelForDayType(dayType);
    const flow = MOVE_DAY_STAGE_FLOW[dayType] ?? MOVE_DAY_STAGE_FLOW.move;
    const dateIso = dateIsoForIndex(i, planRow?.date ?? null);

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

    const crewDefault = isCargoServiceDay(dayType) ? 4 : 3;
    const hoursDefault = isCargoServiceDay(dayType) ? 10 : 8;

    let truckDefault: string | null = null;
    if (isCargoServiceDay(dayType)) truckDefault = "26ft";

    const crewSize =
      typeof planRow?.crew_size === "number" && Number.isFinite(planRow.crew_size)
        ? Math.max(1, Math.min(20, Math.round(planRow.crew_size)))
        : crewDefault;

    const estimatedHours =
      typeof planRow?.estimated_hours === "number" && Number.isFinite(planRow.estimated_hours)
        ? Math.max(0.25, Math.min(24, planRow.estimated_hours))
        : hoursDefault;

    let truckNormalized: string | null = truckDefault;
    if (typeof planRow?.truck === "string") {
      const tr = planRow.truck.trim();
      truckNormalized = tr.length === 0 ? null : tr.slice(0, 48);
    }

    const crewAssigned =
      Array.isArray(planRow?.crew_member_ids) && planRow.crew_member_ids.length > 0
        ? planRow.crew_member_ids

            .filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x.trim()))

            .map((x) => x.trim())
            .slice(0, 24)
        : [];

    const packRooms = packingRoomsFromPayload(planRow?.packing_rooms ?? null);
    const packingLine = packingRoomsDescription(packRooms);
    const planNotes =
      typeof planRow?.notes === "string" ? planRow.notes.trim().slice(0, 1600) : "";
    const descParts = [planNotes, packingLine].filter((x) => x && x.length > 0);
    const descriptionOut = descParts.length > 0 ? descParts.join("\n\n") : null;

    let destinationAddressRow = args.fromAddress;
    if (dayType === "move" || dayType === "volume") destinationAddressRow = args.toAddress;
    if (dayType === "unpack") destinationAddressRow = args.toAddress;

    const locationResolved =
      dayType === "move" || dayType === "volume"
        ? `${args.fromAddress} to ${args.toAddress}`
        : dayType === "unpack"
          ? `${args.toAddress} (unpack and setup)`
          : args.fromAddress;

    const requiresPod =
      (dayType === "move" || dayType === "volume") && i === lastCargoIndexSeen;

    const { error: dErr } = await db.from("move_project_days").insert({
      project_id: projectId,
      phase_id: phaseRow.id as string,
      day_number: dayNum++,
      date: dateIso,
      day_type: dayType,
      label,
      description: descriptionOut,
      crew_size: crewSize,
      crew_ids: null,
      truck_type: truckNormalized,
      truck_count: 1,
      estimated_hours: estimatedHours,
      origin_address: args.fromAddress,
      destination_address: destinationAddressRow,
      arrival_window: null,
      start_time: toPgTime(planRow?.start_time ?? null),
      end_time: null,
      status: "scheduled",
      completion_notes: null,
      issues: null,
      move_id: args.moveId,
      stages: flow.stages,
      current_stage: null,
      requires_pod: requiresPod,
      crew_assigned: crewAssigned,
      location_address: locationResolved,
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
