import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { crewMemberMatchesSessionToken } from "@/lib/crew-session-validate";
import {
  getTodayString,
  getLocalDateDisplay,
  getAppTimezone,
  addCalendarDaysYmd,
  getLocalHourInAppTimezone,
  getTimeZoneShortLabel,
} from "@/lib/business-timezone";
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

  const tz = getAppTimezone();
  if (process.env.NODE_ENV === "production") {
    const a = (process.env.APP_TIMEZONE || "").trim();
    const pub = (process.env.NEXT_PUBLIC_APP_TIMEZONE || "").trim();
    if (a && pub && a !== pub) {
      console.warn(
        "[crew/dashboard] APP_TIMEZONE and NEXT_PUBLIC_APP_TIMEZONE differ; set both to the same IANA zone (e.g. America/Toronto).",
      );
    }
  }
  const today = getTodayString(tz);
  const tomorrowStr = addCalendarDaysYmd(today, 1, tz);
  const supabase = createAdminClient();

  /** Avoid columns missing on some prod DBs (`from_postal_code`, `recurring_schedule_id`, `notes`). */
  const moveSelect =
    "id, move_code, client_name, from_address, to_address, scheduled_date, scheduled_time, status, move_type, crew_id, event_group_id, event_phase, event_name, weather_brief, weather_alert, completed_at";
  const deliverySelect =
    "id, delivery_number, customer_name, client_name, pickup_address, delivery_address, scheduled_date, time_slot, status, items, crew_id, booking_type, created_by_source";

  const [movesRes, carryMovesRes, deliveriesRes, carryDeliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select(moveSelect)
      .eq("crew_id", payload.teamId)
      .eq("scheduled_date", today)
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
      .eq("scheduled_date", today)
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

  const queryErrors = [movesRes.error, carryMovesRes.error, deliveriesRes.error, carryDeliveriesRes.error].filter(
    Boolean,
  );
  if (queryErrors.length > 0) {
    console.error("[crew/dashboard] Supabase job queries failed:", queryErrors);
    return NextResponse.json(
      { error: "Could not load jobs. Try again or contact dispatch.", code: "CREW_DASHBOARD_QUERY" },
      { status: 500 },
    );
  }

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

  const moveIdsForSession = moves.map((m) => m.id);
  const latestSessionByMoveId = new Map<
    string,
    { status: string; completed_at: string | null }
  >();
  if (moveIdsForSession.length > 0) {
    const { data: sessionRows } = await supabase
      .from("tracking_sessions")
      .select("job_id, status, completed_at, created_at")
      .eq("job_type", "move")
      .in("job_id", moveIdsForSession);
    const bestByJob = new Map<
      string,
      { status: string; completed_at: string | null; created_at: string }
    >();
    for (const row of sessionRows || []) {
      const jid = row.job_id as string;
      const created = String((row as { created_at?: string }).created_at || "");
      const cur = bestByJob.get(jid);
      if (!cur || created > cur.created_at) {
        bestByJob.set(jid, {
          status: String(row.status || ""),
          completed_at: (row.completed_at as string | null) ?? null,
          created_at: created,
        });
      }
    }
    for (const [jid, v] of bestByJob) {
      latestSessionByMoveId.set(jid, {
        status: v.status,
        completed_at: v.completed_at,
      });
    }
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

    const rawStatus = (m.status || "scheduled").toLowerCase();
    const sessionSnap = latestSessionByMoveId.get(m.id);
    const sessionSaysDone =
      (sessionSnap?.status || "").toLowerCase() === "completed";
    const moveRowSaysDone =
      rawStatus === "completed" || rawStatus === "cancelled";
    const effectiveStatus =
      sessionSaysDone && !moveRowSaysDone ? "completed" : m.status || "scheduled";
    const completedAtFromRow = (m as { completed_at?: string | null }).completed_at;
    const effectiveCompletedAt =
      effectiveStatus.toLowerCase() === "completed"
        ? completedAtFromRow ?? sessionSnap?.completed_at ?? null
        : null;

    jobs.push({
      id: m.id,
      jobId: m.move_code || m.id,
      jobType: "move",
      clientName: m.client_name || "-",
      fromAddress: m.from_address || "-",
      toAddress: m.to_address || "-",
      jobTypeLabel: eventJobTypeLabel ?? (m.move_type === "office" ? "Office · Commercial" : "Residential"),
      scheduledTime: time,
      status: effectiveStatus,
      completedAt: effectiveCompletedAt,
      eventPhase,
      eventName,
      weatherBrief,
      weatherAlert,
    });
  }

  for (const d of deliveries) {
    const items = normalizeDeliveryItemsList(d.items);
    const time = d.time_slot || "2:00 PM";
    const createdSrc = String((d as { created_by_source?: string | null }).created_by_source || "").toLowerCase();
    const isRec = createdSrc === "recurring_schedule";
    const bType = (d.booking_type as string | null) || null;
    const typeLabel = bType === "day_rate" ? "Day Rate" : "Delivery";
    jobs.push({
      id: d.id,
      jobId: d.delivery_number || d.id,
      jobType: "delivery",
      clientName: `${d.customer_name || "-"}${d.client_name ? ` (${d.client_name})` : ""}`,
      fromAddress: d.pickup_address || "Warehouse",
      toAddress: d.delivery_address || "-",
      jobTypeLabel: typeLabel,
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

  const now = new Date();
  const dateStr = getLocalDateDisplay(now, tz);
  const activeBinTaskCount = countActiveBinTasks(binOrdersRaw || [], today, tomorrowStr);
  const hasActiveBinTasks = activeBinTaskCount > 0;

  return NextResponse.json({
    crewMember: { ...payload, teamName, dateStr },
    jobs,
    /** Calendar date used for job queries (YYYY-MM-DD in business TZ). */
    scheduleDateYmd: today,
    /** IANA zone used for `scheduleDateYmd` and readiness/bin date filters — must match admin booking dates. */
    scheduleTimezone: tz,
    /** Short label, e.g. EST, for crew UI copy. */
    scheduleTimezoneShort: getTimeZoneShortLabel(now, tz),
    /** Hour 0–23 in business TZ (for greetings; avoids client/server TZ env skew). */
    businessLocalHour: getLocalHourInAppTimezone(now, tz),
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
