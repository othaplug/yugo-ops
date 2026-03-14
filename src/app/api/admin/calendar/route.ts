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

    const [movesResult, deliveriesResult, phasesResult, blocksResult, crewsResult] = await Promise.allSettled([
      db
        .from("moves")
        .select("id, move_code, client_name, move_type, status, scheduled_date, crew_id, from_address, to_address")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .neq("status", "cancelled"),
      db
        .from("deliveries")
        .select("id, delivery_number, client_name, customer_name, delivery_type, category, status, scheduled_date, time_slot, crew_id, pickup_address, delivery_address, items")
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
    ]);

    const moves = movesResult.status === "fulfilled" && !movesResult.value.error ? movesResult.value.data : null;
    const deliveries = deliveriesResult.status === "fulfilled" && !deliveriesResult.value.error ? deliveriesResult.value.data : null;
    const phases = phasesResult.status === "fulfilled" && !phasesResult.value.error ? phasesResult.value.data : null;
    const blocks = blocksResult.status === "fulfilled" && !blocksResult.value.error ? blocksResult.value.data : null;
    const crews = crewsResult.status === "fulfilled" && !crewsResult.value.error ? crewsResult.value.data : null;

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
      events.push({
        id: m.id,
        type: "move",
        blockType: "move",
        name: m.client_name || "Move",
        description: `${toTitleCase(m.move_type || "")} Move`.trim(),
        date: dk,
        start: null,
        end: null,
        durationHours: null,
        crewId: m.crew_id || null,
        crewName: crew?.name || null,
        truckId: null,
        truckName: null,
        status: m.status || "scheduled",
        calendarStatus: (m.status || "scheduled") as CalendarStatus,
        color: JOB_COLORS.move,
        href: getMoveDetailPath(m),
        clientName: m.client_name || null,
        fromAddress: m.from_address || null,
        toAddress: m.to_address || null,
        deliveryAddress: null,
        category: m.move_type || "residential",
        moveSize: null,
        itemCount: null,
        scheduleBlockId: null,
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
      events.push({
        id: d.id,
        type: "delivery",
        blockType: "delivery",
        name: d.client_name || d.customer_name || d.delivery_number || "Delivery",
        description: `${itemCount ? itemCount + "pc " : ""}${toTitleCase(d.delivery_type || d.category || "")} Delivery`.trim(),
        date: dk,
        start: d.time_slot || null,
        end: null,
        durationHours: null,
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
