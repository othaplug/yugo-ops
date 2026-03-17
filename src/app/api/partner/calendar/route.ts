import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getDeliveryDetailPath } from "@/lib/move-code";
import type { CalendarEvent, CalendarStatus, YearHeatData } from "@/lib/calendar/types";
import { JOB_COLORS } from "@/lib/calendar/types";
import { toTitleCase } from "@/lib/format-text";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();
  const params = req.nextUrl.searchParams;
  const start = params.get("start");
  const end = params.get("end");
  const view = params.get("view");

  if (view === "year") {
    const year = params.get("year") || new Date().getFullYear().toString();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data: dels } = await db
      .from("deliveries")
      .select("scheduled_date")
      .in("organization_id", orgIds)
      .gte("scheduled_date", yearStart)
      .lte("scheduled_date", yearEnd)
      .not("scheduled_date", "is", null);

    const heat: YearHeatData = {};
    for (const d of dels || []) {
      const dk = (d.scheduled_date as string)?.slice(0, 10);
      if (!dk) continue;
      if (!heat[dk]) heat[dk] = { total: 0, moves: 0, deliveries: 0, projects: 0 };
      heat[dk].deliveries++;
      heat[dk].total++;
    }

    return NextResponse.json({ heat });
  }

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const [{ data: deliveries }, { data: phases }, { data: recurringSchedules }] = await Promise.all([
    db.from("deliveries")
      .select("id, delivery_number, client_name, customer_name, delivery_type, category, status, calendar_status, calendar_color, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_hours, crew_id, pickup_address, delivery_address, item_count, items, vehicle_type, recurring_schedule_id, crews(name)")
      .in("organization_id", orgIds)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end),
    db.from("project_phases")
      .select("id, project_id, phase_name, status, scheduled_date, projects!inner(project_number, partner_id)")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .not("status", "eq", "skipped")
      .in("projects.partner_id", orgIds),
    db.from("recurring_delivery_schedules")
      .select("id, schedule_name, frequency, days_of_week, booking_type, vehicle_type, crew_id, organizations(name)")
      .in("organization_id", orgIds)
      .eq("is_active", true)
      .eq("is_paused", false),
  ]);

  const events: CalendarEvent[] = [];

  // Track which dates already have a confirmed/draft recurring delivery to avoid duplicates
  const confirmedRecurringDates = new Set<string>();

  for (const d of deliveries || []) {
    const dk = (d.scheduled_date as string)?.slice(0, 10);
    if (!dk) continue;

    const crewRaw = d.crews as unknown;
    const crewData = Array.isArray(crewRaw) ? (crewRaw[0] as { name: string } | undefined) ?? null : (crewRaw as { name: string } | null);
    const itemCount = d.item_count || (Array.isArray(d.items) ? d.items.length : null);
    const isRec = !!(d as { recurring_schedule_id?: string | null }).recurring_schedule_id;
    if (isRec) confirmedRecurringDates.add(`${(d as { recurring_schedule_id?: string }).recurring_schedule_id}-${dk}`);

    events.push({
      id: d.id,
      type: "delivery",
      blockType: "delivery",
      name: d.customer_name || d.client_name || d.delivery_number || "Delivery",
      description: `${itemCount ? itemCount + "pc " : ""}${toTitleCase(d.delivery_type || d.category || "")} Delivery`.trim(),
      date: dk,
      start: d.scheduled_start || d.time_slot || null,
      end: d.scheduled_end || null,
      durationHours: d.estimated_duration_hours || null,
      crewId: d.crew_id || null,
      crewName: crewData?.name || null,
      truckId: null,
      truckName: d.vehicle_type || null,
      status: d.status || "pending",
      calendarStatus: (d.calendar_status || "scheduled") as CalendarStatus,
      color: isRec ? JOB_COLORS.recurring : (d.calendar_color || JOB_COLORS.delivery),
      href: `/partner?delivery=${d.id}`,
      clientName: d.client_name || d.customer_name || null,
      fromAddress: d.pickup_address || null,
      toAddress: null,
      deliveryAddress: d.delivery_address || null,
      category: (d.category || d.delivery_type) ? toTitleCase(String(d.category || d.delivery_type)) : null,
      moveSize: null,
      itemCount: itemCount || null,
      scheduleBlockId: null,
      isRecurring: isRec,
    });
  }

  // Add recurring schedule template events for dates without confirmed deliveries
  function getRecurringDatesInRange(s: string, e: string, daysOfWeek: number[], frequency: string): string[] {
    const out: string[] = [];
    const sd = new Date(s + "T12:00:00");
    const ed = new Date(e + "T12:00:00");
    const d = new Date(sd);
    while (d <= ed) {
      const isoDow = d.getDay() === 0 ? 7 : d.getDay();
      if (daysOfWeek.includes(isoDow)) {
        const dk = d.toISOString().slice(0, 10);
        if (frequency === "monthly") {
          const mk = dk.slice(0, 7);
          if (!out.some((x) => x.startsWith(mk))) out.push(dk);
        } else if (frequency === "biweekly") {
          const wn = Math.floor((d.getTime() - sd.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (wn % 2 === 0) out.push(dk);
        } else {
          out.push(dk);
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  for (const r of recurringSchedules || []) {
    const daysOfWeek = Array.isArray(r.days_of_week) ? r.days_of_week : [];
    if (daysOfWeek.length === 0) continue;
    const orgName = (r.organizations as { name?: string } | null)?.name || "Your schedule";
    const dates = getRecurringDatesInRange(start, end, daysOfWeek, r.frequency || "weekly");
    for (const dk of dates) {
      const key = `${r.id}-${dk}`;
      if (confirmedRecurringDates.has(key)) continue;
      const desc = r.booking_type === "day_rate"
        ? `Day Rate · ${toTitleCase(r.vehicle_type || "")}`
        : toTitleCase((r.booking_type || "").replace(/_/g, " "));
      events.push({
        id: `recurring-${r.id}-${dk}`,
        type: "delivery",
        blockType: "delivery",
        name: r.schedule_name || orgName,
        description: desc,
        date: dk,
        start: "08:00",
        end: null,
        durationHours: null,
        crewId: r.crew_id || null,
        crewName: null,
        truckId: null,
        truckName: r.vehicle_type || null,
        status: "recurring",
        calendarStatus: "scheduled",
        color: JOB_COLORS.recurring,
        href: `/partner?tab=recurring`,
        clientName: null,
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

  for (const p of phases || []) {
    const dk = (p.scheduled_date as string)?.slice(0, 10);
    if (!dk) continue;
    const projRaw = p.projects as unknown;
    const proj = Array.isArray(projRaw) ? (projRaw[0] as { project_number: string; partner_id: string } | undefined) ?? null : (projRaw as { project_number: string; partner_id: string } | null);
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
      href: "",
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

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.start || "99:99").localeCompare(b.start || "99:99");
  });

  return NextResponse.json({ events });
}
