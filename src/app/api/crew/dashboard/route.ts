import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getTodayString, getLocalDateDisplay, getAppTimezone } from "@/lib/business-timezone";
import { isMoveWeatherBrief, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayString();
  const supabase = createAdminClient();

  const [movesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select(
        "id, move_code, client_name, from_address, to_address, from_postal_code, scheduled_date, scheduled_time, status, move_type, crew_id, event_group_id, event_phase, event_name, weather_brief, weather_alert",
      )
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_time"),
    supabase
      .from("deliveries")
      .select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address, scheduled_date, time_slot, status, items, crew_id, recurring_schedule_id, booking_type")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("time_slot"),
  ]);

  const moves = movesRes.data || [];
  const deliveries = deliveriesRes.data || [];

  type Job = {
    id: string;
    jobId: string;
    jobType: "move" | "delivery";
    clientName: string;
    fromAddress: string;
    toAddress: string;
    jobTypeLabel: string;
    itemCount?: number;
    scheduledTime: string;
    status: string;
    completedAt?: string | null;
    isRecurring?: boolean;
    bookingType?: string | null;
    eventPhase?: string | null;
    eventName?: string | null;
    weatherBrief?: MoveWeatherBrief | null;
    weatherAlert?: string | null;
  };

  const jobs: Job[] = [];

  for (const m of moves) {
    const time = m.scheduled_time || "9:00 AM";
    const eventPhase = (m.event_phase as string | null) || null;
    const eventName = (m.event_name as string | null) || null;
    const eventJobTypeLabel = eventName
      ? `${eventName} ${eventPhase === "delivery" ? "Delivery & Setup" : eventPhase === "return" ? "Teardown & Return" : eventPhase === "setup" ? "Setup" : "Event"}`
      : null;
    const wbRaw = (m as { weather_brief?: unknown }).weather_brief;
    const weatherBrief = isMoveWeatherBrief(wbRaw) ? wbRaw : null;
    const wa = (m as { weather_alert?: string | null }).weather_alert;
    const weatherAlert = wa != null && String(wa).trim() !== "" ? String(wa) : null;

    jobs.push({
      id: m.id,
      jobId: m.move_code || m.id,
      jobType: "move",
      clientName: m.client_name || "-",
      fromAddress: m.from_address || "-",
      toAddress: m.to_address || "-",
      jobTypeLabel: eventJobTypeLabel ?? (m.move_type === "office" ? "Office · Commercial" : "Residential"),
      scheduledTime: time,
      status: m.status || "scheduled",
      completedAt: null,
      eventPhase,
      eventName,
      weatherBrief,
      weatherAlert,
    });
  }

  for (const d of deliveries) {
    const items = Array.isArray(d.items) ? d.items : [];
    const time = d.time_slot || "2:00 PM";
    const isRec = !!(d.recurring_schedule_id);
    const bType = (d.booking_type as string | null) || null;
    const typeLabel = bType === "day_rate" ? "Day Rate" : "Delivery";
    jobs.push({
      id: d.id,
      jobId: d.delivery_number || d.id,
      jobType: "delivery",
      clientName: `${d.customer_name || "-"}${d.client_name ? ` (${d.client_name})` : ""}`,
      fromAddress: d.pickup_address || "Warehouse",
      toAddress: d.delivery_address || "-",
      jobTypeLabel: `${typeLabel}${items.length > 0 ? ` · ${items.length} items` : ""}`,
      itemCount: items.length,
      scheduledTime: time,
      status: d.status || "scheduled",
      completedAt: null,
      isRecurring: isRec,
      bookingType: bType,
      weatherBrief: null,
      weatherAlert: null,
    });
  }

  jobs.sort((a, b) => {
    const tA = parseTime(a.scheduledTime);
    const tB = parseTime(b.scheduledTime);
    return tA - tB;
  });

  const [{ data: readinessCheck }, { data: crewRow }, { data: endOfDayReport }] = await Promise.all([
    supabase.from("readiness_checks").select("id").eq("team_id", payload.teamId).eq("check_date", today).maybeSingle(),
    supabase.from("crews").select("name").eq("id", payload.teamId).single(),
    supabase.from("end_of_day_reports").select("id").eq("team_id", payload.teamId).eq("report_date", today).maybeSingle(),
  ]);

  const readinessCompleted = !!readinessCheck?.id;
  const endOfDaySubmitted = !!endOfDayReport?.id;
  const isCrewLead = payload.role === "lead";
  const readinessRequired = !readinessCompleted && (isCrewLead || jobs.length > 0);
  const teamName = crewRow?.name || "Team";

  const dateStr = getLocalDateDisplay(new Date(), getAppTimezone());

  return NextResponse.json({
    crewMember: { ...payload, teamName, dateStr },
    jobs,
    readinessCompleted,
    readinessRequired,
    isCrewLead,
    endOfDaySubmitted,
  });
}

function parseTime(s: string): number {
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10) || 0;
  const min = parseInt(m[2], 10) || 0;
  const ampm = (m[3] || "").toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}
