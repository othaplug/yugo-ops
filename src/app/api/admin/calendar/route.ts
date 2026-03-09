import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import type { CalendarEvent, YearHeatData, CalendarStatus } from "@/lib/calendar/types";
import { JOB_COLORS } from "@/lib/calendar/types";
import { requireStaff } from "@/lib/api-auth";

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

    const [
      { data: moves },
      { data: deliveries },
      { data: phases },
      { data: blocks },
      { data: crews },
    ] = await Promise.all([
      db.from("moves")
        .select("id, move_code, client_name, move_size, move_type, status, calendar_status, calendar_color, scheduled_date, scheduled_time, scheduled_start, scheduled_end, estimated_hours, crew_id, assigned_truck_id, from_address, to_address, crews(name), fleet_vehicles(display_name)")
        .gte("scheduled_date", start).lte("scheduled_date", end)
        .not("status", "eq", "cancelled"),
      db.from("deliveries")
        .select("id, delivery_number, client_name, customer_name, delivery_type, category, status, calendar_status, calendar_color, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_hours, crew_id, assigned_truck_id, pickup_address, delivery_address, item_count, items, crews(name), fleet_vehicles(display_name)")
        .gte("scheduled_date", start).lte("scheduled_date", end)
        .not("status", "eq", "cancelled"),
      db.from("project_phases")
        .select("id, project_id, phase_name, phase_order, status, scheduled_date, projects!inner(project_number, start_date)")
        .gte("scheduled_date", start).lte("scheduled_date", end)
        .not("status", "eq", "skipped"),
      db.from("crew_schedule_blocks")
        .select("*")
        .gte("block_date", start).lte("block_date", end),
      db.from("crews").select("id, name, members"),
    ]);

    const events: CalendarEvent[] = [];

    for (const m of moves || []) {
      const dk = (m.scheduled_date as string)?.slice(0, 10);
      if (!dk) continue;
      if (crewFilter && m.crew_id !== crewFilter) continue;
      if (typeFilter && typeFilter !== "move") continue;
      if (statusFilter && (m.calendar_status || m.status) !== statusFilter) continue;

      const crewRaw = m.crews as unknown;
      const crewData = Array.isArray(crewRaw) ? (crewRaw[0] as { name: string } | undefined) ?? null : (crewRaw as { name: string } | null);
      const truckRaw = m.fleet_vehicles as unknown;
      const truckData = Array.isArray(truckRaw) ? (truckRaw[0] as { display_name: string } | undefined) ?? null : (truckRaw as { display_name: string } | null);
      events.push({
        id: m.id,
        type: "move",
        blockType: "move",
        name: m.client_name || "Move",
        description: `${m.move_size || ""} ${m.move_type === "office" ? "Office" : ""} Move`.trim(),
        date: dk,
        start: m.scheduled_start || m.scheduled_time || null,
        end: m.scheduled_end || null,
        durationHours: m.estimated_hours || null,
        crewId: m.crew_id || null,
        crewName: crewData?.name || null,
        truckId: m.assigned_truck_id || null,
        truckName: truckData?.display_name || null,
        status: m.status || "scheduled",
        calendarStatus: (m.calendar_status || "scheduled") as CalendarStatus,
        color: m.calendar_color || JOB_COLORS.move,
        href: getMoveDetailPath(m),
        clientName: m.client_name || null,
        fromAddress: m.from_address || null,
        toAddress: m.to_address || null,
        deliveryAddress: null,
        category: m.move_type || "residential",
        moveSize: m.move_size || null,
        itemCount: null,
        scheduleBlockId: null,
      });
    }

    for (const d of deliveries || []) {
      const dk = (d.scheduled_date as string)?.slice(0, 10);
      if (!dk) continue;
      if (crewFilter && d.crew_id !== crewFilter) continue;
      if (typeFilter && typeFilter !== "delivery") continue;
      if (statusFilter && (d.calendar_status || d.status) !== statusFilter) continue;

      const crewRawD = d.crews as unknown;
      const crewData = Array.isArray(crewRawD) ? (crewRawD[0] as { name: string } | undefined) ?? null : (crewRawD as { name: string } | null);
      const truckRawD = d.fleet_vehicles as unknown;
      const truckData = Array.isArray(truckRawD) ? (truckRawD[0] as { display_name: string } | undefined) ?? null : (truckRawD as { display_name: string } | null);
      const itemCount = d.item_count || (Array.isArray(d.items) ? d.items.length : null);
      events.push({
        id: d.id,
        type: "delivery",
        blockType: "delivery",
        name: d.client_name || d.customer_name || d.delivery_number || "Delivery",
        description: `${itemCount ? itemCount + "pc " : ""}${d.delivery_type || d.category || ""} Delivery`.trim(),
        date: dk,
        start: d.scheduled_start || d.time_slot || null,
        end: d.scheduled_end || null,
        durationHours: d.estimated_duration_hours || null,
        crewId: d.crew_id || null,
        crewName: crewData?.name || null,
        truckId: d.assigned_truck_id || null,
        truckName: truckData?.display_name || null,
        status: d.status || "pending",
        calendarStatus: (d.calendar_status || "scheduled") as CalendarStatus,
        color: d.calendar_color || JOB_COLORS.delivery,
        href: getDeliveryDetailPath(d),
        clientName: d.client_name || d.customer_name || null,
        fromAddress: d.pickup_address || null,
        toAddress: null,
        deliveryAddress: d.delivery_address || null,
        category: d.category || d.delivery_type || null,
        moveSize: null,
        itemCount: itemCount || null,
        scheduleBlockId: null,
      });
    }

    for (const p of phases || []) {
      const dk = (p.scheduled_date as string)?.slice(0, 10);
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
        category: b.block_type,
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

    return NextResponse.json({ events, crews: crewList, blocks: blocks || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
