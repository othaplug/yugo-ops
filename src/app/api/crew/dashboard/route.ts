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
  ymdPartsInTimeZone,
} from "@/lib/business-timezone";
import { isMoveStatusCompleted } from "@/lib/move-status";
import { countActiveBinTasks } from "@/lib/bin-orders-active-tasks";
import { isMoveWeatherBrief, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import {
  shouldIncludeCrewDashboardSampleMove,
  buildCrewSampleDashboardMoveJob,
  isCrewSampleDashboardJobId,
} from "@/lib/crew/sample-dashboard-job";
import {
  accessLineText,
  resolveMoveAccessLines,
} from "@/lib/crew-move-access";
import {
  computeCrewTipReportNeeded,
  type TipReportTipRow,
} from "@/lib/crew/tip-report-eligibility";
import { getCrewEodPrerequisites } from "@/lib/crew/eod-prerequisites";

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
    "id, move_code, client_name, from_address, to_address, scheduled_date, scheduled_time, arrival_window, preferred_time, status, move_type, crew_id, event_group_id, event_phase, event_name, weather_brief, weather_alert, completed_at, from_access, to_access, access_notes, quote_id";
  const deliverySelect =
    "id, delivery_number, customer_name, client_name, pickup_address, delivery_address, scheduled_date, time_slot, delivery_window, scheduled_start, preferred_time, status, items, crew_id, booking_type, created_by_source, pickup_access, delivery_access";

  const [movesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select(moveSelect)
      .eq("crew_id", payload.teamId)
      .eq("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_time"),
    supabase
      .from("deliveries")
      .select(deliverySelect)
      .eq("crew_id", payload.teamId)
      .eq("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_start", { nullsFirst: true }),
  ]);

  const queryErrors = [movesRes.error, deliveriesRes.error].filter(Boolean);
  if (queryErrors.length > 0) {
    console.error("[crew/dashboard] Supabase job queries failed:", queryErrors);
    return NextResponse.json(
      { error: "Could not load jobs. Try again or contact dispatch.", code: "CREW_DASHBOARD_QUERY" },
      { status: 500 },
    );
  }

  const moves = movesRes.data || [];
  const deliveries = deliveriesRes.data || [];

  // Multi-day office/project moves keep a single scheduled_date on the move row
  // (day 1), but the crew works the job on every move_project_days date. Without
  // this, the job drops off the dashboard on day 2+. Pull the move_ids that have
  // a project day dated today and merge in any that the scheduled_date query
  // didn't already return (crew-scoped). projectDayTodaySet also lets the
  // stale-completion filter below treat these like a "today" job.
  const projectDayTodaySet = new Set<string>();
  {
    const { data: todayProjectDays } = await supabase
      .from("move_project_days")
      .select("move_id")
      .eq("date", today);
    for (const r of todayProjectDays || []) {
      const id = (r as { move_id?: string | null }).move_id;
      if (typeof id === "string" && id) projectDayTodaySet.add(id);
    }
    const haveIds = new Set(moves.map((m) => m.id));
    const missingIds = [...projectDayTodaySet].filter((id) => !haveIds.has(id));
    if (missingIds.length > 0) {
      const { data: extraMoves, error: extraErr } = await supabase
        .from("moves")
        .select(moveSelect)
        .eq("crew_id", payload.teamId)
        .in("id", missingIds);
      if (extraErr) {
        console.error("[crew/dashboard] project-day move fetch failed:", extraErr);
      } else if (extraMoves) {
        moves.push(...extraMoves);
      }
    }
  }

  const quoteIds = [
    ...new Set(
      moves
        .map((m) => (m as { quote_id?: string | null }).quote_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const quoteAccessById = new Map<
    string,
    { from: string | null; to: string | null }
  >();
  // Extra pickups/drop-offs live in the quote's factors_applied (the move row
  // keeps a single from/to), so resolve the full ordered stop list here.
  const quoteStopsById = new Map<string, { pickups: string[]; dropoffs: string[] }>();
  const stopAddrs = (locs: unknown): string[] =>
    Array.isArray(locs)
      ? (locs as { address?: unknown }[])
          .map((l) => String(l?.address ?? "").trim())
          .filter((a) => a.length > 0)
      : [];
  if (quoteIds.length > 0) {
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("id, from_access, to_access, factors_applied")
      .in("id", quoteIds);
    for (const q of quoteRows || []) {
      const id = String((q as { id: string }).id);
      quoteAccessById.set(id, {
        from: (q as { from_access?: string | null }).from_access?.trim() || null,
        to: (q as { to_access?: string | null }).to_access?.trim() || null,
      });
      const fa = (q as { factors_applied?: unknown }).factors_applied;
      const f = fa && typeof fa === "object" && !Array.isArray(fa) ? (fa as Record<string, unknown>) : {};
      quoteStopsById.set(id, {
        pickups: stopAddrs(f.pickup_locations),
        dropoffs: stopAddrs(f.dropoff_locations),
      });
    }
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
    sortMinutes?: number;
    pickups?: string[];
    dropoffs?: string[];
    status: string;
    completedAt?: string | null;
    isRecurring?: boolean;
    bookingType?: string | null;
    eventPhase?: string | null;
    eventName?: string | null;
    weatherBrief?: MoveWeatherBrief | null;
    weatherAlert?: string | null;
    /** Single-line access label under pickup (resolved on server). */
    fromAccessLine?: string | null;
    toAccessLine?: string | null;
    /** false = finished job still needs post-job truck equipment check on crew flow */
    postJobEquipmentComplete?: boolean;
    /** true = finished job still needs cash/interac/none tip report */
    tipReportPending?: boolean;
  };

  const isCrewWorkDoneStatus = (status: string | undefined) => {
    const s = (status || "").toLowerCase();
    return s === "completed" || s === "delivered" || s === "done";
  };

  const jobs: Job[] = [];

  for (const m of moves) {
    // arrival_window is the authoritative customer-facing window (shown on the
    // move detail page); scheduled_time can be stale (e.g. MV-30315: arrival
    // window "Early Morning (6:00 AM – 8:00 AM)" but scheduled_time "8 AM to
    // 10 AM"). Prefer it for both the displayed time and the sort key so the
    // crew sees the correct window and jobs order by real start time.
    const moveTimeSource =
      m.arrival_window || m.scheduled_time || m.preferred_time;
    const time = moveTimeSource || "Time TBD";
    const moveSortMinutes = parseTimeLoose(moveTimeSource) ?? NO_TIME_SORT;
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

    const schedYmd = String(m.scheduled_date || "").trim();
    const completionForStaleCheck = isMoveClosedForStaleListFilter(effectiveStatus, completedAtFromRow)
      ? completedAtFromRow ?? sessionSnap?.completed_at ?? null
      : null;
    if ((schedYmd === today || projectDayTodaySet.has(m.id)) && completionForStaleCheck) {
      const doneMs = Date.parse(completionForStaleCheck);
      if (!Number.isNaN(doneMs) && ymdPartsInTimeZone(doneMs, tz) < today) {
        continue;
      }
    }

    const qid = (m as { quote_id?: string | null }).quote_id;
    const qAcc = qid ? quoteAccessById.get(qid) : undefined;
    const { from: fromA, to: toA } = resolveMoveAccessLines({
      fromAccess: (m as { from_access?: string | null }).from_access,
      toAccess: (m as { to_access?: string | null }).to_access,
      accessNotes: (m as { access_notes?: string | null }).access_notes,
      fromAccessFromQuote: qAcc?.from,
      toAccessFromQuote: qAcc?.to,
    });

    // Ordered stop lists — quote factors carry the full pickup/drop-off order
    // (the move row only keeps the primary pair). Fall back to the primary.
    const qStops = qid ? quoteStopsById.get(qid) : undefined;
    const pickups = (qStops && qStops.pickups.length > 1)
      ? qStops.pickups
      : [String(m.from_address || "").trim()].filter(Boolean);
    const dropoffs = (qStops && qStops.dropoffs.length > 1)
      ? qStops.dropoffs
      : [String(m.to_address || "").trim()].filter(Boolean);

    jobs.push({
      id: m.id,
      jobId: m.move_code || m.id,
      jobType: "move",
      clientName: m.client_name || "-",
      fromAddress: m.from_address || "-",
      toAddress: m.to_address || "-",
      pickups,
      dropoffs,
      jobTypeLabel: eventJobTypeLabel ?? (m.move_type === "office" ? "Office · Commercial" : "Residential"),
      scheduledTime: time,
      sortMinutes: moveSortMinutes,
      status: effectiveStatus,
      completedAt: effectiveCompletedAt,
      eventPhase,
      eventName,
      weatherBrief,
      weatherAlert,
      fromAccessLine: accessLineText(fromA),
      toAccessLine: accessLineText(toA),
    });
  }

  for (const d of deliveries) {
    const items = normalizeDeliveryItemsList(d.items);
    // The real delivery time lives in scheduled_start / delivery_window — most
    // deliveries have a null time_slot. Reading only time_slot (and defaulting
    // to "2:00 PM") mis-displayed AND mis-ordered every morning delivery.
    const dWin = (d as { delivery_window?: string | null }).delivery_window;
    const dStart = (d as { scheduled_start?: string | null }).scheduled_start;
    const dPref = (d as { preferred_time?: string | null }).preferred_time;
    const time =
      d.time_slot || dWin || formatClock(dStart) || dPref || "Time TBD";
    const deliverySortMinutes =
      clockToMinutes(dStart) ??
      parseTimeLoose(d.time_slot || dWin || dPref) ??
      NO_TIME_SORT;
    const createdSrc = String((d as { created_by_source?: string | null }).created_by_source || "").toLowerCase();
    const isRec = createdSrc === "recurring_schedule";
    const bType = (d.booking_type as string | null) || null;
    const typeLabel = bType === "day_rate" ? "Day Rate" : "Delivery";
    const pu = (d as { pickup_access?: string | null }).pickup_access;
    const del = (d as { delivery_access?: string | null }).delivery_access;
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
      sortMinutes: deliverySortMinutes,
      status: d.status || "scheduled",
      completedAt: null,
      isRecurring: isRec,
      bookingType: bType,
      weatherBrief: null,
      weatherAlert: null,
      fromAccessLine: accessLineText(pu),
      toAccessLine: accessLineText(del),
    });
  }

  // Sort by the structured time key (scheduled_start / scheduled_time), not by
  // re-parsing the display string. Ties break by job id for a stable order.
  jobs.sort((a, b) => {
    const tA = typeof a.sortMinutes === "number" ? a.sortMinutes : NO_TIME_SORT;
    const tB = typeof b.sortMinutes === "number" ? b.sortMinutes : NO_TIME_SORT;
    if (tA !== tB) return tA - tB;
    return String(a.id).localeCompare(String(b.id));
  });

  const realPreSample = jobs.filter((j) => !isCrewSampleDashboardJobId(j.id));
  const moveIdsDone = realPreSample
    .filter((j) => j.jobType === "move" && isCrewWorkDoneStatus(j.status))
    .map((j) => j.id);
  const delIdsDone = realPreSample
    .filter((j) => j.jobType === "delivery" && isCrewWorkDoneStatus(j.status))
    .map((j) => j.id);

  const [eqMRes, eqDRes, tipsMRes, tipsDRes] = await Promise.all([
    moveIdsDone.length
      ? supabase.from("equipment_checks").select("job_id").eq("job_type", "move").in("job_id", moveIdsDone)
      : { data: [] as { job_id: string }[] },
    delIdsDone.length
      ? supabase
          .from("equipment_checks")
          .select("job_id")
          .eq("job_type", "delivery")
          .in("job_id", delIdsDone)
      : { data: [] as { job_id: string }[] },
    moveIdsDone.length
      ? supabase
          .from("tips")
          .select("move_id, square_payment_id, amount, method, reported_by, delivery_id")
          .in("move_id", moveIdsDone)
      : { data: [] as Record<string, unknown>[] },
    delIdsDone.length
      ? supabase
          .from("tips")
          .select("move_id, square_payment_id, amount, method, reported_by, delivery_id")
          .in("delivery_id", delIdsDone)
      : { data: [] as Record<string, unknown>[] },
  ]);

  const eqOk = new Set<string>();
  for (const r of eqMRes.data || []) eqOk.add(`move:${r.job_id}`);
  for (const r of eqDRes.data || []) eqOk.add(`delivery:${r.job_id}`);

  const tipPendingMove = new Map<string, boolean>(
    moveIdsDone.map((id) => [id, true] as [string, boolean]),
  );
  for (const t of tipsMRes.data || []) {
    const id = t.move_id as string | undefined;
    if (id) {
      tipPendingMove.set(
        id,
        computeCrewTipReportNeeded(t as TipReportTipRow),
      );
    }
  }
  const tipPendingDel = new Map<string, boolean>(
    delIdsDone.map((id) => [id, true] as [string, boolean]),
  );
  for (const t of tipsDRes.data || []) {
    const id = t.delivery_id as string | undefined;
    if (id) {
      tipPendingDel.set(
        id,
        computeCrewTipReportNeeded(t as TipReportTipRow),
      );
    }
  }

  for (const j of jobs) {
    if (isCrewSampleDashboardJobId(j.id)) continue;
    if (!isCrewWorkDoneStatus(j.status)) {
      j.postJobEquipmentComplete = true;
      j.tipReportPending = false;
      continue;
    }
    j.postJobEquipmentComplete = eqOk.has(`${j.jobType}:${j.id}`);
    j.tipReportPending =
      (j.jobType === "move" ? tipPendingMove.get(j.id) : tipPendingDel.get(j.id)) ?? true;
  }

  if (shouldIncludeCrewDashboardSampleMove()) {
    jobs.push(buildCrewSampleDashboardMoveJob());
  }

  const realJobCount = jobs.filter((j) => !isCrewSampleDashboardJobId(j.id)).length;

  const [
    { data: readinessCheck },
    { data: crewRow },
    { data: endOfDayReport },
    { data: binOrdersRaw },
    eodPrerequisites,
  ] = await Promise.all([
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
    getCrewEodPrerequisites(supabase, payload.teamId, today),
  ]);

  const readinessCompleted = !!readinessCheck?.id;
  const endOfDaySubmitted = !!endOfDayReport?.id;
  const isCrewLead = payload.role === "lead";
  const readinessRequired =
    !readinessCompleted && (isCrewLead || realJobCount > 0);
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
    eodPrerequisites,
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

/** Jobs with no resolvable time sort to the end (never to a fabricated 2 PM). */
const NO_TIME_SORT = 99 * 60;

/** Minutes-since-midnight from a 24h DB clock value like "09:00:00". */
function clockToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Pretty 12h time ("9:00 AM") from a 24h DB clock value. */
function formatClock(hhmm: string | null | undefined): string | null {
  const mins = clockToMinutes(hhmm);
  if (mins == null) return null;
  let h = Math.floor(mins / 60);
  const min = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(min).padStart(2, "0")} ${ampm}`;
}

/** parseTime, but null (not 0/midnight) when the string carries no time. */
function parseTimeLoose(s: string | null | undefined): number | null {
  if (!s) return null;
  if (!/\d/.test(s)) return null;
  return parseTime(s);
}

/**
 * If a move is still booked for "today" but was completed on a prior calendar day, hide it
 * (avoids a stuck row when `scheduled_date` was not updated in dispatch).
 * Uses the same "closed" rules the old carryover bucket used, applied to the effective status.
 */
function isMoveClosedForStaleListFilter(
  status: string | null | undefined,
  completedAtFromRow: string | null | undefined = null,
): boolean {
  const s = (status || "").toLowerCase().trim();
  if (s === "cancelled") return true;
  if (isMoveStatusCompleted(status)) return true;
  if (s === "done") return true;
  if ((s === "paid" || s === "final_payment_received") && completedAtFromRow) return true;
  return false;
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
