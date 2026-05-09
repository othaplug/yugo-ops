import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGCalConfigured, setGCalIdOverride } from "@/lib/google-calendar/client";
import { syncJobToGCal, type GCalJobInput } from "@/lib/google-calendar/sync-job";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { buildReferenceBlockTimeMap, type BlockTimes } from "@/lib/calendar/event-time-resolution";
import {
  fetchBaselineHoursBySize,
  fetchDeliveryDurationByType,
  resolveDeliveryJobTimes,
  resolveMoveJobTimes,
} from "@/lib/google-calendar/resolve-job-times";

/** Load the calendar ID override from platform_config (set by /create-calendar). */
async function applyConfiguredCalendarOverride(): Promise<void> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("platform_config")
      .select("value")
      .eq("key", "gcal_calendar_id")
      .maybeSingle();
    setGCalIdOverride(data?.value?.trim() || null);
  } catch {
    /* fall back to env var */
  }
}

const BOOKABLE_MOVE_STATUSES = ["confirmed", "booked", "scheduled", "deposit_paid", "paid", "in_progress", "completed", "no_show"];
const BOOKABLE_DELIVERY_STATUSES = ["confirmed", "booked", "scheduled", "deposit_paid", "paid", "in_progress", "pending", "completed", "no_show"];

/**
 * POST /api/admin/gcal/sync
 * Body (optional): { jobType?: "move"|"delivery", jobId?: string }
 *   - With jobId: sync that single record
 *   - Without: bulk sync all confirmed/booked moves + deliveries
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  await applyConfiguredCalendarOverride();

  if (!isGCalConfigured()) {
    return NextResponse.json(
      { success: false, error: "Google Calendar not configured. Add GOOGLE_CALENDAR_CLIENT_EMAIL, GOOGLE_CALENDAR_PRIVATE_KEY, and GOOGLE_CALENDAR_ID to environment." },
      { status: 503 },
    );
  }

  let body: { jobType?: string; jobId?: string; force?: boolean } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const db = createAdminClient();

  if (body.jobId) {
    const isMov = !body.jobType || body.jobType === "move";
    const table = isMov ? "moves" : "deliveries";
    const { data: row } = await db.from(table).select("*").eq("id", body.jobId).single();
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Single-job path needs the same time resolution + crew block lookup.
    const refType = isMov ? "move" : "delivery";
    const { data: blockRow } = await db
      .from("crew_schedule_blocks")
      .select("block_start, block_end")
      .eq("reference_type", refType)
      .eq("reference_id", body.jobId)
      .limit(1)
      .maybeSingle();
    const block = blockRow ? buildReferenceBlockTimeMap([{
      reference_type: refType,
      reference_id: body.jobId,
      block_start: blockRow.block_start,
      block_end: blockRow.block_end,
    }]).get(`${refType}:${body.jobId}`) ?? null : null;

    const [singleBaselineMap, singleDelMap] = await Promise.all([
      isMov ? fetchBaselineHoursBySize() : Promise.resolve(new Map<string, number>()),
      isMov ? Promise.resolve(new Map<string, number>()) : fetchDeliveryDurationByType(),
    ]);

    const input = isMov
      ? buildMoveInput(row as Record<string, unknown>, null, block, singleBaselineMap)
      : buildDeliveryInput(row as Record<string, unknown>, null, block, singleDelMap);
    const result = await syncJobToGCal(input);

    if (result.eventId !== undefined) {
      await db.from(table).update({ gcal_event_id: result.eventId }).eq("id", body.jobId);
    }
    return NextResponse.json({ success: result.action !== "error", result });
  }

  // Bulk sync
  // If force=true in body, clear existing event IDs so all events are recreated fresh.
  // Wipes EVERY row (not filtered by status) — old events from the previous calendar
  // can have IDs that fail to PUT cleanly, and we want a totally fresh state.
  if (body && (body as { force?: boolean }).force === true) {
    await Promise.all([
      db.from("moves").update({ gcal_event_id: null }).not("gcal_event_id", "is", null),
      db.from("deliveries").update({ gcal_event_id: null }).not("gcal_event_id", "is", null),
    ]);
  }

  const [movesResp, deliveriesResp, crewsResp, blocksResp, baselineMap, deliveryDurMap] = await Promise.all([
    db
      .from("moves")
      // Pull every field used by resolveMoveDisplayTimes() in the OPS+ internal calendar.
      .select("id, move_code, move_size, est_hours, client_name, service_type, move_type, status, scheduled_date, scheduled_start, scheduled_end, scheduled_time, preferred_time, arrival_window, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_MOVE_STATUSES),
    db
      .from("deliveries")
      // Pull every field used by resolveDeliveryDisplayTimes().
      .select("id, delivery_number, client_name, service_type, delivery_type, category, status, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_minutes, estimated_duration_hours, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_DELIVERY_STATUSES)
      .not("service_type", "eq", "bin_rental"),
    db.from("crews").select("id, name"),
    db.from("crew_schedule_blocks").select("reference_type, reference_id, block_start, block_end"),
    fetchBaselineHoursBySize(),
    fetchDeliveryDurationByType(),
  ]);

  // Map of "move:<id>" / "delivery:<id>" → BlockTimes — the same source the
  // OPS+ internal calendar uses to display times when scheduled_start is null.
  const refBlockTimes = buildReferenceBlockTimeMap(blocksResp.data || []);

  const crewMap: Record<string, string> = {};
  for (const c of crewsResp.data ?? []) crewMap[c.id] = c.name;

  const results: { id: string; code: string; action: string; scheduledDate?: string; startTime?: string; eventId?: string; error?: string }[] = [];

  const moveJobs = (movesResp.data ?? []).map((m) => {
    const block = refBlockTimes.get(`move:${m.id}`) ?? null;
    return {
      id: m.id as string,
      code: String(m.move_code || ""),
      scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : undefined,
      input: buildMoveInput(m as Record<string, unknown>, crewMap, block, baselineMap),
    };
  });

  const deliveryJobs = (deliveriesResp.data ?? []).map((d) => {
    const block = refBlockTimes.get(`delivery:${d.id}`) ?? null;
    return {
      id: d.id as string,
      code: String(d.delivery_number || ""),
      scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : undefined,
      input: buildDeliveryInput(d as Record<string, unknown>, crewMap, block, deliveryDurMap),
    };
  });

  for (const job of [...moveJobs, ...deliveryJobs]) {
    const result = await syncJobToGCal(job.input);
    const friendlyError = result.error
      ? translateGCalError(result.error)
      : undefined;
    results.push({
      id: job.id,
      code: job.code,
      action: result.action,
      scheduledDate: job.scheduledDate,
      startTime: job.input.startTime ?? undefined,
      eventId: result.eventId ?? undefined,
      error: friendlyError,
    });

    if (result.eventId !== undefined) {
      const table = job.input.jobType === "move" ? "moves" : "deliveries";
      await db.from(table).update({ gcal_event_id: result.eventId }).eq("id", job.id);
    }
  }

  const counts = results.reduce(
    (a, r) => ({ ...a, [r.action]: (a[r.action as keyof typeof a] ?? 0) + 1 }),
    { created: 0, updated: 0, deleted: 0, skipped: 0, error: 0 },
  );

  // If every job failed with the same "writer access" error, surface a top-level
  // remediation message so the UI can show one clear banner instead of N rows.
  const allErrors = results.filter((r) => r.action === "error");
  const writerAccessFailures = allErrors.filter((r) =>
    /writer access/i.test(r.error || ""),
  );
  const sharedFix =
    allErrors.length > 0 && writerAccessFailures.length === allErrors.length
      ? buildWriterAccessFixHint()
      : null;

  // Capture which calendar the events were actually written to so the UI can
  // show a direct link and the user can verify they're looking at the right calendar.
  let activeCalendarId: string | null = null;
  try {
    const { getGCalId } = await import("@/lib/google-calendar/client");
    activeCalendarId = getGCalId();
  } catch {
    /* not configured */
  }

  return NextResponse.json({
    success: counts.error === 0 || counts.created + counts.updated > 0,
    counts,
    results,
    fix: sharedFix,
    calendarId: activeCalendarId,
    calendarLink: activeCalendarId ? "https://calendar.google.com/calendar/r" : null,
  });
}

/** Translate raw Google API errors into actionable copy for the admin UI. */
function translateGCalError(raw: string): string {
  if (/writer access/i.test(raw)) {
    return "Service account is missing writer access. Share the calendar with " +
      `${process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || "the service account"} and grant "Make changes to events" permission.`;
  }
  if (/forbidden/i.test(raw) && /403/.test(raw)) {
    return "Permission denied by Google Calendar. Verify the calendar is shared with the service account.";
  }
  if (/not found/i.test(raw) && /404/.test(raw)) {
    return "Calendar not found. Check that GOOGLE_CALENDAR_ID matches the shared calendar's ID.";
  }
  return raw;
}

function buildWriterAccessFixHint(): {
  title: string;
  steps: string[];
  shareEmail: string | null;
  calendarId: string | null;
} {
  return {
    title: "Service account needs writer access to the calendar",
    steps: [
      "Open Google Calendar in a browser (calendar.google.com).",
      "In the left sidebar, hover over the shared calendar and click ⋮ → Settings and sharing.",
      "Under \"Share with specific people or groups\", click + Add people and groups.",
      `Paste ${process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || "the service account email"} and set permissions to "Make changes to events".`,
      "Save, then click Sync all booked jobs now.",
    ],
    shareEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || null,
    calendarId: process.env.GOOGLE_CALENDAR_ID || null,
  };
}

/** GET — configuration status check. Add ?test=true to verify the connection against the real Google API. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  await applyConfiguredCalendarOverride();

  const configured = isGCalConfigured();
  // Reflect the runtime override (set by /create-calendar) when present,
  // so the UI shows the actively used calendar ID.
  let activeCalendarId: string | null = process.env.GOOGLE_CALENDAR_ID ?? null;
  try {
    const { getGCalId } = await import("@/lib/google-calendar/client");
    activeCalendarId = getGCalId();
  } catch {
    /* not configured — leave env value as-is */
  }
  // Direct link to Google Calendar (not cid= — that throws "access denied" for ACL-shared
  // group calendars even when the user already has the calendar subscribed).
  const calendarLink = activeCalendarId ? "https://calendar.google.com/calendar/r" : null;

  const base = {
    configured,
    calendarId: activeCalendarId,
    calendarLink,
    clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ?? null,
  };

  if (!configured || req.nextUrl.searchParams.get("test") !== "true") {
    return NextResponse.json(base);
  }

  // Live test: read the calendar (auth + read access) and create+delete a probe
  // event to verify writer access. This catches "Connected" but-can't-write
  // configs where the service account was added as Reader instead of Writer.
  try {
    const { callGCal, getGCalId } = await import("@/lib/google-calendar/client");
    const calId = encodeURIComponent(getGCalId());

    // Step 1: read the calendar (token + read access)
    const read = await callGCal<{ id: string; summary: string }>(`/calendars/${calId}`);
    if (!read.ok) {
      return NextResponse.json({
        ...base,
        testOk: false,
        testError: read.error ?? `HTTP ${read.status}`,
        hint: read.status === 404
          ? "Calendar not found. Check GOOGLE_CALENDAR_ID and that the service account has been shared on the calendar."
          : read.status === 401 || read.status === 403
          ? "Authentication failed. Check GOOGLE_CALENDAR_PRIVATE_KEY format and that the service account has permission on the calendar."
          : null,
      });
    }

    // Step 2: create a probe event in the past so it doesn't pollute the user's
    // visible calendar, then immediately delete it. This is the canonical way to
    // confirm writer access for a service account.
    const probeStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // -1 year
    const probeEnd = new Date(probeStart.getTime() + 60 * 1000);
    const probe = await callGCal<{ id: string }>(
      `/calendars/${calId}/events`,
      "POST",
      {
        summary: "Yugo OPS+ connection test (delete me)",
        description: "Auto-generated by Yugo OPS+ to verify writer access.",
        start: { dateTime: probeStart.toISOString() },
        end: { dateTime: probeEnd.toISOString() },
      },
    );

    if (!probe.ok) {
      const writerIssue =
        probe.status === 403 || /writer access|forbidden/i.test(probe.error || "");
      return NextResponse.json({
        ...base,
        testOk: false,
        testError: probe.error ?? `HTTP ${probe.status}`,
        calendarSummary: read.data?.summary ?? null,
        fix: writerIssue ? buildWriterAccessFixHint() : null,
        hint: writerIssue
          ? `Calendar shared as Reader. Re-share with "${process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || "the service account"}" set to "Make changes to events".`
          : null,
      });
    }

    // Cleanup the probe event (best-effort)
    if (probe.data?.id) {
      await callGCal(
        `/calendars/${calId}/events/${encodeURIComponent(probe.data.id)}`,
        "DELETE",
      ).catch(() => {});
    }

    return NextResponse.json({
      ...base,
      testOk: true,
      writeOk: true,
      calendarSummary: read.data?.summary ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      ...base,
      testOk: false,
      testError: msg,
      hint: msg.includes("private key") || msg.includes("PEM")
        ? "Private key format issue. Ensure GOOGLE_CALENDAR_PRIVATE_KEY is the full RSA key with \\n for newlines."
        : null,
    });
  }
}

/* ── Row → GCalJobInput ───────────────────────────────────────────────────── */

function buildMoveInput(
  m: Record<string, unknown>,
  crewMap: Record<string, string> | null,
  block: BlockTimes | null,
  baselineMap: Map<string, number>,
): GCalJobInput {
  const crewId = String(m.crew_id ?? "");
  // Use the SAME time resolution as the OPS+ internal calendar — including
  // the crew schedule block fallback. This is the only way to guarantee
  // the calendar event time matches what's shown in /admin/calendar.
  const { startHHMM, durationMinutes } = resolveMoveJobTimes(m, block, baselineMap);
  return {
    jobType: "move",
    jobId: String(m.id),
    jobCode: String(m.move_code || m.id),
    clientName: String(m.client_name || ""),
    serviceType: String(m.service_type || m.move_type || "residential"),
    status: String(m.status || ""),
    scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : null,
    startTime: startHHMM,
    estimatedDurationMinutes:
      durationMinutes ??
      (m.estimated_duration_minutes != null ? Number(m.estimated_duration_minutes) : null),
    fromAddress: m.from_address ? String(m.from_address) : null,
    toAddress: m.to_address ? String(m.to_address) : null,
    crewName: crewMap && crewId ? (crewMap[crewId] ?? null) : null,
    notes: m.notes ? String(m.notes) : null,
    existingEventId: m.gcal_event_id ? String(m.gcal_event_id) : null,
  };
}

function buildDeliveryInput(
  d: Record<string, unknown>,
  crewMap: Record<string, string> | null,
  block: BlockTimes | null,
  deliveryDurMap: Map<string, number>,
): GCalJobInput {
  const crewId = String(d.crew_id ?? "");
  const { startHHMM, durationMinutes } = resolveDeliveryJobTimes(d, block, deliveryDurMap);
  return {
    jobType: "delivery",
    jobId: String(d.id),
    jobCode: String(d.delivery_number || d.id),
    clientName: String(d.client_name || ""),
    serviceType: String(d.service_type || "b2b_delivery"),
    status: String(d.status || ""),
    scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : null,
    startTime: startHHMM,
    estimatedDurationMinutes:
      durationMinutes ??
      (d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null),
    fromAddress: d.from_address ? String(d.from_address) : null,
    toAddress: d.to_address ? String(d.to_address) : null,
    crewName: crewMap && crewId ? (crewMap[crewId] ?? null) : null,
    notes: d.notes ? String(d.notes) : null,
    existingEventId: d.gcal_event_id ? String(d.gcal_event_id) : null,
  };
}
