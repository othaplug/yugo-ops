import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDeliveryNumber } from "@/lib/delivery-number";
import { getTodayString } from "@/lib/business-timezone";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";

/**
 * App table is `recurring_delivery_schedules` (not `recurring_schedules`).
 * Aligns with SQL `generate_recurring_deliveries()`: weekly, biweekly, monthly.
 */

function addDaysToYyyyMmDd(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** ISO weekday 1=Mon … 7=Sun, matching Postgres ISODOW */
function isoDowFromYyyyMmDd(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const w = dt.getUTCDay();
  return w === 0 ? 7 : w;
}

function getNextScheduleDate(daysOfWeek: number[], _frequency: string, fromDateYmd: string): string | null {
  let ymd = fromDateYmd;
  for (let i = 0; i < 400; i++) {
    ymd = addDaysToYyyyMmDd(ymd, 1);
    const dow = isoDowFromYyyyMmDd(ymd);
    if (daysOfWeek.includes(dow)) return ymd;
  }
  return null;
}

type OrgEmbed = { name: string | null; default_pickup_address: string | null; type: string | null };

type ScheduleRow = {
  id: string;
  organization_id: string;
  schedule_name: string | null;
  frequency: string | null;
  days_of_week: number[] | null;
  booking_type: string | null;
  vehicle_type: string | null;
  day_type: string | null;
  default_num_stops: number | null;
  default_services: unknown;
  time_window: string | null;
  default_pickup_address: string | null;
  next_generation_date: string | null;
  crew_id: string | null;
  organizations?: OrgEmbed | OrgEmbed[] | null;
};

function orgFromSchedule(schedule: ScheduleRow): OrgEmbed | null {
  const o = schedule.organizations;
  if (!o) return null;
  return Array.isArray(o) ? o[0] ?? null : o;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = getTodayString();
  const horizon = addDaysToYyyyMmDd(today, 7);

  const { data: schedules, error: listErr } = await supabase
    .from("recurring_delivery_schedules")
    .select(
      `
      id,
      organization_id,
      schedule_name,
      frequency,
      days_of_week,
      booking_type,
      vehicle_type,
      day_type,
      default_num_stops,
      default_services,
      time_window,
      default_pickup_address,
      next_generation_date,
      crew_id,
      organizations ( name, default_pickup_address, type )
    `,
    )
    .eq("is_active", true)
    .eq("is_paused", false)
    .not("next_generation_date", "is", null)
    .lte("next_generation_date", horizon);

  if (listErr) {
    const msg = listErr.message?.toLowerCase() ?? "";
    if (msg.includes("relation") || msg.includes("does not exist")) {
      return NextResponse.json({ ok: true, created: 0, skipped: "recurring_delivery_schedules unavailable" });
    }
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  let created = 0;
  const errors: { scheduleId: string; message: string }[] = [];

  for (const raw of schedules ?? []) {
    const schedule = raw as unknown as ScheduleRow;
    try {
      const days = Array.isArray(schedule.days_of_week) ? schedule.days_of_week : [];
      if (days.length === 0) continue;

      const targetDate = schedule.next_generation_date?.slice(0, 10);
      if (!targetDate) continue;

      const org = orgFromSchedule(schedule);
      const orgName = (org?.name || "").trim() || "Partner";
      const pickup =
        (schedule.default_pickup_address || "").trim() ||
        (org?.default_pickup_address || "").trim() ||
        null;

      const marker = `recurring_schedule_id:${schedule.id}`;
      const { data: dupRows } = await supabase
        .from("deliveries")
        .select("id")
        .eq("organization_id", schedule.organization_id)
        .eq("scheduled_date", targetDate)
        .eq("status", "draft")
        .or(
          `source_recurring_delivery_schedule_id.eq.${schedule.id},notes.ilike.%${marker}%`,
        )
        .limit(1);

      if (dupRows?.[0]?.id) {
        const freq = schedule.frequency || "weekly";
        let nextDate: string | null;
        if (freq === "weekly") {
          nextDate = getNextScheduleDate(days, freq, targetDate);
        } else if (freq === "biweekly") {
          nextDate = getNextScheduleDate(days, freq, addDaysToYyyyMmDd(targetDate, 7));
        } else if (freq === "monthly") {
          nextDate = getNextScheduleDate(days, freq, addDaysToYyyyMmDd(targetDate, 21));
        } else {
          nextDate = getNextScheduleDate(days, freq, targetDate);
        }
        if (nextDate) {
          await supabase.from("recurring_delivery_schedules").update({ next_generation_date: nextDate }).eq("id", schedule.id);
        }
        continue;
      }

      const servicesSelected = Array.isArray(schedule.default_services) ? schedule.default_services : [];

      const scheduleDeliveryNumber = await generateDeliveryNumber(supabase);
      const insertPayload: Record<string, unknown> = {
        delivery_number: scheduleDeliveryNumber,
        organization_id: schedule.organization_id,
        client_name: orgName,
        customer_name: orgName,
        status: "draft",
        booking_type: schedule.booking_type || "day_rate",
        vehicle_type: schedule.vehicle_type,
        day_type: schedule.day_type || "full_day",
        num_stops: schedule.default_num_stops,
        time_slot: schedule.time_window || "morning",
        scheduled_date: targetDate,
        pickup_address: pickup,
        delivery_address: null,
        items: [],
        category: (org?.type || "b2b").trim() || "b2b",
        notes: `Auto-generated from recurring schedule. ${marker}`,
        source_recurring_delivery_schedule_id: schedule.id,
        created_by_source: "recurring_schedule",
        crew_id: schedule.crew_id || null,
        services_selected: servicesSelected,
      };

      if (schedule.crew_id) {
        const snap = await fetchCrewAssignmentSnapshot(supabase, schedule.crew_id);
        insertPayload.assigned_members = snap.assigned_members;
        insertPayload.assigned_crew_name = snap.assigned_crew_name;
      }

      const { data: inserted, error: insErr } = await supabase
        .from("deliveries")
        .insert(insertPayload as never)
        .select("id")
        .single();
      if (insErr) throw new Error(insErr.message);

      if (inserted?.id) {
        await ensureB2bDeliverySchedule(supabase, inserted.id as string).catch((e) =>
          console.error("[recurring-deliveries] ensureB2bDeliverySchedule:", e),
        );
      }

      created += 1;

      const freq = schedule.frequency || "weekly";
      let nextDate: string | null;
      if (freq === "weekly") {
        nextDate = getNextScheduleDate(days, freq, targetDate);
      } else if (freq === "biweekly") {
        nextDate = getNextScheduleDate(days, freq, addDaysToYyyyMmDd(targetDate, 7));
      } else if (freq === "monthly") {
        nextDate = getNextScheduleDate(days, freq, addDaysToYyyyMmDd(targetDate, 21));
      } else {
        nextDate = getNextScheduleDate(days, freq, targetDate);
      }

      if (nextDate) {
        await supabase.from("recurring_delivery_schedules").update({ next_generation_date: nextDate }).eq("id", schedule.id);
      }
    } catch (e) {
      errors.push({
        scheduleId: schedule.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    errors: errors.length ? errors : undefined,
  });
}
