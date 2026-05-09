import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGCalConfigured, setGCalIdOverride } from "@/lib/google-calendar/client";
import { syncJobToGCal, type GCalJobInput } from "@/lib/google-calendar/sync-job";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { normalizeDbTimeToHHMM, parseFlexibleTimeToHHMM } from "@/lib/calendar/event-time-resolution";
import { parsePartnerWindowLabelStartHHMM } from "@/lib/time-windows";

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

  let body: { jobType?: string; jobId?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  const db = createAdminClient();

  if (body.jobId) {
    const isMov = !body.jobType || body.jobType === "move";
    const table = isMov ? "moves" : "deliveries";
    const { data: row } = await db.from(table).select("*").eq("id", body.jobId).single();
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const input = isMov ? buildMoveInput(row as Record<string, unknown>, null) : buildDeliveryInput(row as Record<string, unknown>, null);
    const result = await syncJobToGCal(input);

    if (result.eventId !== undefined) {
      await db.from(table).update({ gcal_event_id: result.eventId }).eq("id", body.jobId);
    }
    return NextResponse.json({ success: result.action !== "error", result });
  }

  // Bulk sync
  const [movesResp, deliveriesResp, crewsResp] = await Promise.all([
    db
      .from("moves")
      // Include scheduled_time / preferred_time / arrival_window as fallbacks for when
      // scheduled_start is null — matches the fallback chain in resolveMoveDisplayTimes()
      .select("id, move_code, client_name, service_type, move_type, status, scheduled_date, scheduled_start, scheduled_time, preferred_time, arrival_window, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_MOVE_STATUSES),
    db
      .from("deliveries")
      .select("id, delivery_number, client_name, service_type, status, scheduled_date, time_slot, scheduled_start, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_DELIVERY_STATUSES)
      .not("service_type", "eq", "bin_rental"),
    db.from("crews").select("id, name"),
  ]);

  const crewMap: Record<string, string> = {};
  for (const c of crewsResp.data ?? []) crewMap[c.id] = c.name;

  const results: { id: string; code: string; action: string; scheduledDate?: string; error?: string }[] = [];

  const moveJobs = (movesResp.data ?? []).map((m) => ({
    id: m.id as string,
    code: String(m.move_code || ""),
    scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : undefined,
    input: buildMoveInput(m as Record<string, unknown>, crewMap),
  }));

  const deliveryJobs = (deliveriesResp.data ?? []).map((d) => ({
    id: d.id as string,
    code: String(d.delivery_number || ""),
    scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : undefined,
    input: buildDeliveryInput(d as Record<string, unknown>, crewMap),
  }));

  for (const job of [...moveJobs, ...deliveryJobs]) {
    const result = await syncJobToGCal(job.input);
    const friendlyError = result.error
      ? translateGCalError(result.error)
      : undefined;
    results.push({ id: job.id, code: job.code, action: result.action, scheduledDate: job.scheduledDate, error: friendlyError });

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

  return NextResponse.json({
    success: counts.error === 0 || counts.created + counts.updated > 0,
    counts,
    results,
    fix: sharedFix,
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

/** Resolve the best start time for a move using the same fallback chain as the OPS+ internal calendar. */
function resolveMoveStartTime(m: Record<string, unknown>): string | null {
  return (
    normalizeDbTimeToHHMM(m.scheduled_start as string | null) ||
    parseFlexibleTimeToHHMM(m.scheduled_time as string | null) ||
    parseFlexibleTimeToHHMM(m.preferred_time as string | null) ||
    parsePartnerWindowLabelStartHHMM(m.arrival_window as string | null) ||
    null
  );
}

/** Resolve the best start time for a delivery using scheduled_start then time_slot. */
function resolveDeliveryStartTime(d: Record<string, unknown>): string | null {
  return (
    normalizeDbTimeToHHMM(d.scheduled_start as string | null) ||
    parseFlexibleTimeToHHMM(d.time_slot as string | null) ||
    parsePartnerWindowLabelStartHHMM(d.time_slot as string | null) ||
    null
  );
}

function buildMoveInput(m: Record<string, unknown>, crewMap: Record<string, string> | null): GCalJobInput {
  const crewId = String(m.crew_id ?? "");
  return {
    jobType: "move",
    jobId: String(m.id),
    jobCode: String(m.move_code || m.id),
    clientName: String(m.client_name || ""),
    serviceType: String(m.service_type || m.move_type || "residential"),
    status: String(m.status || ""),
    scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : null,
    startTime: resolveMoveStartTime(m),
    estimatedDurationMinutes: m.estimated_duration_minutes != null ? Number(m.estimated_duration_minutes) : null,
    fromAddress: m.from_address ? String(m.from_address) : null,
    toAddress: m.to_address ? String(m.to_address) : null,
    crewName: crewMap && crewId ? (crewMap[crewId] ?? null) : null,
    notes: m.notes ? String(m.notes) : null,
    existingEventId: m.gcal_event_id ? String(m.gcal_event_id) : null,
  };
}

function buildDeliveryInput(d: Record<string, unknown>, crewMap: Record<string, string> | null): GCalJobInput {
  const crewId = String(d.crew_id ?? "");
  return {
    jobType: "delivery",
    jobId: String(d.id),
    jobCode: String(d.delivery_number || d.id),
    clientName: String(d.client_name || ""),
    serviceType: String(d.service_type || "b2b_delivery"),
    status: String(d.status || ""),
    scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : null,
    startTime: resolveDeliveryStartTime(d),
    estimatedDurationMinutes: d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null,
    fromAddress: d.from_address ? String(d.from_address) : null,
    toAddress: d.to_address ? String(d.to_address) : null,
    crewName: crewMap && crewId ? (crewMap[crewId] ?? null) : null,
    notes: d.notes ? String(d.notes) : null,
    existingEventId: d.gcal_event_id ? String(d.gcal_event_id) : null,
  };
}
