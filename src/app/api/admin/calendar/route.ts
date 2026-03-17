import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import type { CalendarEvent, YearHeatData, CalendarStatus } from "@/lib/calendar/types";
import { JOB_COLORS } from "@/lib/calendar/types";
import { requireStaff } from "@/lib/api-auth";
import { toTitleCase } from "@/lib/format-text";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const db = createAdminClient();
    const params = req.nextUrl.searchParams;
    const start = params.get("start");
    const end = params.get("end");
    const view = params.get("view");
    const crewFilter = params.get("crew_id") || "";
    const typeFilter = params.get("type") || "";
    const statusFilter = params.get("status") || "";

    if (view === "year") {
      const year = params.get("year") || new Date().getFullYear().toString();
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;

      const [{ data: moveCounts }, { data: delCounts }, { data: phaseCounts }] = await Promise.all([
        db.from("moves").select("scheduled_date").gte("scheduled_date", yearStart).lte("scheduled_date", yearEnd).not("scheduled_date", "is", null),
        db.from("deliveries").select("scheduled_date").gte("scheduled_date", yearStart).lte("scheduled_date", yearEnd).not("scheduled_date", "is", null),
        db.from("project_phases").select("scheduled_date").gte("scheduled_date", yearStart).lte("scheduled_date", yearEnd).not("scheduled_date", "is", null).neq("status", "skipped"),
      ]);

      const heat: YearHeatData = {};
      for (const m of moveCounts || []) {
        const dk = (m.scheduled_date as string)?.slice(0, 10);
        if (!dk) continue;
        if (!heat[dk]) heat[dk] = { total: 0, moves: 0, deliveries: 0, projects: 0 };
        heat[dk].moves++;
        heat[dk].total++;
      }
      for (const d of delCounts || []) {
        const dk = (d.scheduled_date as string)?.slice(0, 10);
        if (!dk) continue;
        if (!heat[dk]) heat[dk] = { total: 0, moves: 0, deliveries: 0, projects: 0 };
        heat[dk].deliveries++;
        heat[dk].total++;
      }
      for (const p of phaseCounts || []) {
        const dk = (p.scheduled_date as string)?.slice(0, 10);
        if (!dk) continue;
        if (!heat[dk]) heat[dk] = { total: 0, moves: 0, deliveries: 0, projects: 0 };
        heat[dk].projects++;
        heat[dk].total++;
      }

      return NextResponse.json({ heat });
    }

    if (!start || !end) {
      return NextResponse.json({ error: "start and end required" }, { status: 400 });
    }

    const startDate = String(start).slice(0, 10);
    const endDate = String(end).slice(0, 10);

    const [movesResult, deliveriesResult, phasesResult, blocksResult, crewsResult, recurringResult, benchmarksResult, durationDefaultsResult] = await Promise.allSettled([
      db
        .from("moves")
        .select("id, move_code, client_name, move_type, move_size, est_hours, status, scheduled_date, scheduled_start, scheduled_end, crew_id, from_address, to_address, event_group_id, event_phase, event_name")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .neq("status", "cancelled"),
      db
        .from("deliveries")
        .select("id, delivery_number, client_name, customer_name, delivery_type, category, status, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_hours, crew_id, pickup_address, delivery_address, items")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .not("status", "eq", "cancelled"),
      db.from("project_phases")
        .select("id, project_id, phase_name, phase_order, status, scheduled_date, projects!inner(project_number, start_date)")
        .gte("scheduled_date", startDate).lte("scheduled_date", endDate)
        .not("status", "eq", "skipped"),
      db.from("crew_schedule_blocks")
        .select("*")
        .gte("block_date", startDate).lte("block_date", endDate),
      db.from("crews").select("id, name, members"),
      db
        .from("recurring_delivery_schedules")
        .select("id, organization_id, schedule_name, frequency, days_of_week, booking_type, vehicle_type, crew_id, organizations(name)")
        .eq("is_active", true)
        .eq("is_paused", false),
      db.from("volume_benchmarks").select("move_size, baseline_hours"),
      db.from("duration_defaults").select("job_type, sub_type, default_hours").eq("job_type", "delivery"),
    ]);

    const moves = movesResult.status === "fulfilled" && !movesResult.value.error ? movesResult.value.data : null;
    const deliveries = deliveriesResult.status === "fulfilled" && !deliveriesResult.value.error ? deliveriesResult.value.data : null;

    const baselineBySize = new Map<string, number>();
    const benchmarks = benchmarksResult.status === "fulfilled" && !(benchmarksResult.value as { error?: unknown })?.error ? (benchmarksResult.value as { data?: { move_size?: string; baseline_hours?: number }[] }).data : null;
    for (const b of benchmarks || []) {
      if (b.move_size != null && b.baseline_hours != null) {
        baselineBySize.set(String(b.move_size), Number(b.baseline_hours));
      }
    }

    const deliveryDurationByType = new Map<string, number>();
    const durationDefaults = durationDefaultsResult.status === "fulfilled" && !(durationDefaultsResult.value as { error?: unknown })?.error ? (durationDefaultsResult.value as { data?: { sub_type?: string; default_hours?: number }[] }).data : null;
    for (const dd of durationDefaults || []) {
      if (dd.sub_type != null && dd.default_hours != null) {
        deliveryDurationByType.set(String(dd.sub_type), Number(dd.default_hours));
      }
    }
    const phases = phasesResult.status === "fulfilled" && !phasesResult.value.error ? phasesResult.value.data : null;
    const blocks = blocksResult.status === "fulfilled" && !blocksResult.value.error ? blocksResult.value.data : null;
    const crews = crewsResult.status === "fulfilled" && !crewsResult.value.error ? crewsResult.value.data : null;
    const recurringSchedules = recurringResult.status === "fulfilled" && !recurringResult.value.error ? recurringResult.value.data : null;

    const diagnostics: { movesError?: string; deliveriesError?: string } = {};
    if (movesResult.status === "rejected") {
      diagnostics.movesError = String(movesResult.reason);
      console.error("[admin/calendar] moves query rejected:", movesResult.reason);
    } else if (movesResult.status === "fulfilled" && movesResult.value?.error) {
      diagnostics.movesError = (movesResult.value.error as { message?: string })?.message ?? JSON.stringify(movesResult.value.error);
      console.error("[admin/calendar] moves query error:", movesResult.value.error);
    }
    if (deliveriesResult.status === "rejected") {
      diagnostics.deliveriesError = String(deliveriesResult.reason);
      console.error("[admin/calendar] deliveries query rejected:", deliveriesResult.reason);
    } else if (deliveriesResult.status === "fulfilled" && deliveriesResult.value?.error) {
      diagnostics.deliveriesError = (deliveriesResult.value.error as { message?: string })?.message ?? JSON.stringify(deliveriesResult.value.error);
      console.error("[admin/calendar] deliveries query error:", deliveriesResult.value.error);
    }

    const events: CalendarEvent[] = [];
    const crewListForLookup = (crews || []) as { id: string; name: string }[];

    function toDateKey(d: string | Date | null | undefined): string | null {
      if (d == null) return null;
      if (typeof d === "string") return d.slice(0, 10);
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return null;
    }

    for (const m of moves || []) {
      const dk = toDateKey(m.scheduled_date as string | Date | null);
      if (!dk) continue;
      if (crewFilter && m.crew_id !== crewFilter) continue;
      if (typeFilter && typeFilter !== "move") continue;
      if (statusFilter && (m.status || "scheduled") !== statusFilter) continue;

      const crew = m.crew_id ? crewListForLookup.find((c) => c.id === m.crew_id) : null;
      const moveStart = (m.scheduled_start as string | null) || null;
      const moveEnd = (m.scheduled_end as string | null) || null;
      const moveSize = (m.move_size as string | null)?.toLowerCase() || null;
      const moveDuration =
        moveStart && moveEnd
          ? null
          : (m.est_hours != null ? Number(m.est_hours) : null) ?? baselineBySize.get(moveSize || "") ?? baselineBySize.get("2br") ?? 4;
      const eventPhase = (m.event_phase as "delivery" | "setup" | "return" | "single_day" | null) || null;
      const eventName = (m.event_name as string | null) || null;
      const eventGroupId = (m.event_group_id as string | null) || null;
      // Build display name: event moves prefix with event name + phase
      const moveName = eventName
        ? `${eventName} — ${eventPhase === "delivery" ? "Delivery" : eventPhase === "return" ? "Return" : eventPhase === "setup" ? "Setup" : "Event"}`
        : (m.client_name || "Move");
      events.push({
        id: m.id,
        type: "move",
        blockType: "move",
        name: moveName,
        description: eventName
          ? `${toTitleCase(eventPhase || "event")} · ${m.client_name || ""}`
          : `${toTitleCase(m.move_type || "")} Move`.trim(),
        date: dk,
        start: moveStart,
        end: moveEnd,
        durationHours: moveDuration,
        crewId: m.crew_id || null,
        crewName: crew?.name || null,
        truckId: null,
        truckName: null,
        status: m.status || "scheduled",
        calendarStatus: (m.status || "scheduled") as CalendarStatus,
        color: eventGroupId ? "#7C3AED" : JOB_COLORS.move,
        href: getMoveDetailPath(m),
        clientName: m.client_name || null,
        fromAddress: m.from_address || null,
        toAddress: m.to_address || null,
        deliveryAddress: null,
        category: m.move_type || "residential",
        moveSize: moveSize || null,
        itemCount: null,
        scheduleBlockId: null,
        eventGroupId,
        eventPhase,
        eventName,
      });
    }

    for (const d of deliveries || []) {
      const dk = toDateKey(d.scheduled_date as string | Date | null);
      if (!dk) continue;
      if (crewFilter && d.crew_id !== crewFilter) continue;
      if (typeFilter && typeFilter !== "delivery") continue;
      if (statusFilter && (d.status || "scheduled") !== statusFilter) continue;

      const crewD = d.crew_id ? crewListForLookup.find((c) => c.id === d.crew_id) : null;
      const itemCount = Array.isArray(d.items) ? d.items.length : null;
      const delStart = (d.scheduled_start as string | null) || (d.time_slot as string | null) || null;
      const delEnd = (d.scheduled_end as string | null) || null;
      const delTypeRaw = ((d.delivery_type || d.category) as string | null)?.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "standard";
      const DELIVERY_TYPE_MAP: Record<string, string> = {
        single_item: "standard",
        assembly: "assembly_req",
        assembly_required: "assembly_req",
        art: "art_specialty",
        medical: "medical",
        multi_piece: "multi_piece",
        multipiece: "multi_piece",
      };
      const delType = DELIVERY_TYPE_MAP[delTypeRaw] ?? delTypeRaw;
      const delDuration =
        delStart && delEnd
          ? null
          : (d.estimated_duration_hours != null ? Number(d.estimated_duration_hours) : null) ??
            deliveryDurationByType.get(delType) ??
            deliveryDurationByType.get("standard") ??
            1.5;
      events.push({
        id: d.id,
        type: "delivery",
        blockType: "delivery",
        name: d.client_name || d.customer_name || d.delivery_number || "Delivery",
        description: `${itemCount ? itemCount + "pc " : ""}${toTitleCase(d.delivery_type || d.category || "")} Delivery`.trim(),
        date: dk,
        start: delStart,
        end: delEnd,
        durationHours: delDuration,
        crewId: d.crew_id || null,
        crewName: crewD?.name || null,
        truckId: null,
        truckName: null,
        status: d.status || "pending",
        calendarStatus: (d.status || "scheduled") as CalendarStatus,
        color: JOB_COLORS.delivery,
        href: getDeliveryDetailPath(d),
        clientName: d.client_name || d.customer_name || null,
        fromAddress: d.pickup_address || null,
        toAddress: null,
        deliveryAddress: d.delivery_address || null,
        category: (d.category || d.delivery_type) ? toTitleCase(String(d.category || d.delivery_type)) : null,
        moveSize: null,
        itemCount: itemCount || null,
        scheduleBlockId: null,
      });
    }

    for (const p of phases || []) {
      const dk = toDateKey(p.scheduled_date as string | Date | null);
      if (!dk) continue;
      if (typeFilter && typeFilter !== "project_phase") continue;

      const projRaw = p.projects as unknown;
      const proj = Array.isArray(projRaw) ? (projRaw[0] as { project_number: string; start_date: string } | undefined) ?? null : (projRaw as { project_number: string; start_date: string } | null);
      events.push({
        id: p.id,
        type: "project_phase",
        blockType: "project_phase",
        name: proj?.project_number || "Project",
        description: p.phase_name || "Phase",
        date: dk,
        start: null,
        end: null,
        durationHours: null,
        crewId: null,
        crewName: null,
        truckId: null,
        truckName: null,
        status: p.status || "pending",
        calendarStatus: p.status === "completed" ? "completed" : "scheduled",
        color: JOB_COLORS.project_phase,
        href: `/admin/projects/${p.project_id}`,
        clientName: null,
        fromAddress: null,
        toAddress: null,
        deliveryAddress: null,
        category: "project",
        moveSize: null,
        itemCount: null,
        scheduleBlockId: null,
      });
    }

    for (const b of blocks || []) {
      if (b.reference_type === "move" || b.reference_type === "delivery" || b.reference_type === "project_phase") continue;
      if (crewFilter && b.crew_id !== crewFilter) continue;
      if (typeFilter && typeFilter !== "blocked") continue;

      const crew = (crews || []).find((c) => c.id === b.crew_id);
      events.push({
        id: b.id,
        type: "blocked",
        blockType: b.block_type,
        name: b.notes || b.block_type.replace(/_/g, " "),
        description: b.block_type.replace(/_/g, " "),
        date: b.block_date,
        start: b.block_start,
        end: b.block_end,
        durationHours: null,
        crewId: b.crew_id,
        crewName: crew?.name || null,
        truckId: null,
        truckName: null,
        status: "blocked",
        calendarStatus: "scheduled",
        color: JOB_COLORS.blocked,
        href: "",
        clientName: null,
        fromAddress: null,
        toAddress: null,
        deliveryAddress: null,
        category: toTitleCase(b.block_type),
        moveSize: null,
        itemCount: null,
        scheduleBlockId: b.id,
      });
    }

    // Recurring delivery schedules — expand to dates in range
    function getRecurringDatesInRange(
      start: string,
      end: string,
      daysOfWeek: number[],
      frequency: string
    ): string[] {
      const out: string[] = [];
      const startD = new Date(start + "T12:00:00");
      const endD = new Date(end + "T12:00:00");
      const d = new Date(startD);
      while (d <= endD) {
        const isoDow = d.getDay() === 0 ? 7 : d.getDay();
        if (daysOfWeek.includes(isoDow)) {
          const dateKey = d.toISOString().slice(0, 10);
          if (frequency === "monthly") {
            const monthKey = dateKey.slice(0, 7);
            if (!out.some((x) => x.startsWith(monthKey))) out.push(dateKey);
          } else if (frequency === "biweekly") {
            const weekNum = Math.floor((d.getTime() - startD.getTime()) / (7 * 24 * 60 * 60 * 1000));
            if (weekNum % 2 === 0) out.push(dateKey);
          } else {
            out.push(dateKey);
          }
        }
        d.setDate(d.getDate() + 1);
      }
      return out;
    }

    for (const r of recurringSchedules || []) {
      if (typeFilter && typeFilter !== "delivery") continue;
      const daysOfWeek = Array.isArray(r.days_of_week) ? r.days_of_week : [];
      if (daysOfWeek.length === 0) continue;
      const orgName = (r.organizations as { name?: string } | null)?.name || "Partner";
      const crew = r.crew_id ? crewListForLookup.find((c) => c.id === r.crew_id) : null;
      if (crewFilter && r.crew_id !== crewFilter) continue;

      const dates = getRecurringDatesInRange(startDate, endDate, daysOfWeek, r.frequency || "weekly");
      const isDayRate = r.booking_type === "day_rate";
      const recurringStart = "08:00";
      const recurringEnd = isDayRate ? "14:00" : "10:00";
      const recurringHours = isDayRate ? 6 : 2;
      for (const dk of dates) {
        const desc =
          isDayRate
            ? `Day Rate · ${toTitleCase(r.vehicle_type || "")}`
            : toTitleCase((r.booking_type || "").replace(/_/g, " "));
        events.push({
          id: `recurring-${r.id}-${dk}`,
          type: "delivery",
          blockType: "delivery",
          name: orgName,
          description: `${r.schedule_name} · ${desc}`.trim(),
          date: dk,
          start: recurringStart,
          end: recurringEnd,
          durationHours: recurringHours,
          crewId: r.crew_id || null,
          crewName: crew?.name || null,
          truckId: null,
          truckName: null,
          status: "recurring",
          calendarStatus: "scheduled",
          color: JOB_COLORS.recurring,
          href: `/admin/deliveries?view=recurring&schedule=${r.id}`,
          clientName: orgName,
          fromAddress: null,
          toAddress: null,
          deliveryAddress: null,
          category: "Recurring",
          moveSize: null,
          itemCount: null,
          scheduleBlockId: null,
          isRecurring: true,
          scheduleName: r.schedule_name,
        });
      }
    }

    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start || "99:99").localeCompare(b.start || "99:99");
    });

    const crewList = (crews || []).map((c) => ({
      id: c.id,
      name: c.name,
      memberCount: Array.isArray(c.members) ? c.members.length : 0,
    }));

    const movesCount = (moves || []).length;
    const deliveriesCount = (deliveries || []).length;
    if (movesCount === 0 && deliveriesCount === 0 && (phases || []).length === 0) {
      console.warn("[admin/calendar] No jobs in range", { startDate, endDate });
    }

    return NextResponse.json({
      events,
      crews: crewList,
      blocks: blocks || [],
      _counts: { moves: movesCount, deliveries: deliveriesCount, phases: (phases || []).length },
      _diagnostics: Object.keys(diagnostics).length ? diagnostics : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
