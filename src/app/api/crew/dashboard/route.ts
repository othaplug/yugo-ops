import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { crewMemberMatchesSessionToken } from "@/lib/crew-session-validate";
import { getTodayString, getLocalDateDisplay, getAppTimezone } from "@/lib/business-timezone";
import { countActiveBinTasks } from "@/lib/bin-orders-active-tasks";
import { isMoveWeatherBrief, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOk = await crewMemberMatchesSessionToken(payload);
  if (!sessionOk) {
    return NextResponse.json(
      { error: "Session no longer valid. Please log in again.", code: "CREW_SESSION_STALE" },
      { status: 401 }
    );
  }

  const today = getTodayString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const supabase = createAdminClient();

  const moveSelect =
    "id, move_code, client_name, from_address, to_address, from_postal_code, scheduled_date, scheduled_time, status, move_type, crew_id, event_group_id, event_phase, event_name, weather_brief, weather_alert";
  const deliverySelect =
    "id, delivery_number, customer_name, client_name, pickup_address, delivery_address, scheduled_date, time_slot, status, items, crew_id, recurring_schedule_id, booking_type";

  const [movesRes, carryMovesRes, deliveriesRes, carryDeliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select(moveSelect)
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_time"),
    supabase
      .from("moves")
      .select(moveSelect)
      .eq("crew_id", payload.teamId)
      .lt("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_time"),
    supabase
      .from("deliveries")
      .select(deliverySelect)
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("time_slot"),
    supabase
      .from("deliveries")
      .select(deliverySelect)
      .eq("crew_id", payload.teamId)
      .lt("scheduled_date", today)
      .order("scheduled_date")
      .order("time_slot"),
  ]);

  const movesToday = movesRes.data || [];
  const movesCarryover = (carryMovesRes.data || []).filter((m) => !isTerminalMoveStatus(m.status));
  const deliveriesToday = deliveriesRes.data || [];
  const deliveriesCarryover = (carryDeliveriesRes.data || []).filter((d) => !isTerminalDeliveryStatus(d.status));

  const seenMove = new Set<string>();
  const moves: typeof movesToday = [];
  for (const m of [...movesCarryover, ...movesToday]) {
    if (seenMove.has(m.id)) continue;
    seenMove.add(m.id);
    moves.push(m);
  }

  const seenDel = new Set<string>();
  const deliveries: typeof deliveriesToday = [];
  for (const d of [...deliveriesCarryover, ...deliveriesToday]) {
    if (seenDel.has(d.id)) continue;
    seenDel.add(d.id);
    deliveries.push(d);
  }

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
    const items = normalizeDeliveryItemsList(d.items);
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

  const [{ data: readinessCheck }, { data: crewRow }, { data: endOfDayReport }, { data: binOrdersRaw }] = await Promise.all([
    supabase.from("readiness_checks").select("id").eq("team_id", payload.teamId).eq("check_date", today).maybeSingle(),
    supabase.from("crews").select("name").eq("id", payload.teamId).single(),
    supabase.from("end_of_day_reports").select("id").eq("team_id", payload.teamId).eq("report_date", today).maybeSingle(),
    supabase
      .from("bin_orders")
      .select("id, drop_off_date, pickup_date, status, drop_off_completed_at, pickup_completed_at")
      .neq("status", "cancelled")
      .neq("status", "completed")
      .or(
        `drop_off_date.eq.${today},drop_off_date.eq.${tomorrowStr},pickup_date.eq.${today},pickup_date.eq.${tomorrowStr},status.eq.overdue`,
      ),
  ]);

  const readinessCompleted = !!readinessCheck?.id;
  const endOfDaySubmitted = !!endOfDayReport?.id;
  const isCrewLead = payload.role === "lead";
  const readinessRequired = !readinessCompleted && (isCrewLead || jobs.length > 0);
  const teamName = crewRow?.name || "Team";

  const dateStr = getLocalDateDisplay(new Date(), getAppTimezone());
  const activeBinTaskCount = countActiveBinTasks(binOrdersRaw || [], today, tomorrowStr);
  const hasActiveBinTasks = activeBinTaskCount > 0;

  return NextResponse.json({
    crewMember: { ...payload, teamName, dateStr },
    jobs,
    readinessCompleted,
    readinessRequired,
    isCrewLead,
    endOfDaySubmitted,
    hasActiveBinTasks,
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

function isTerminalMoveStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "cancelled";
}

function isTerminalDeliveryStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "delivered" || s === "cancelled";
}

/** Count list items for labels; tolerate JSONB shapes that are not a plain array. */
function normalizeDeliveryItemsList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}
