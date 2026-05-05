import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import { syncJobToGCal, type GCalJobInput } from "@/lib/google-calendar/sync-job";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";

const BOOKABLE_MOVE_STATUSES = ["confirmed", "booked", "scheduled", "deposit_paid", "paid", "in_progress"];
const BOOKABLE_DELIVERY_STATUSES = ["confirmed", "booked", "scheduled", "deposit_paid", "paid", "in_progress", "pending"];

/**
 * POST /api/admin/gcal/sync
 * Body (optional): { jobType?: "move"|"delivery", jobId?: string }
 *   - With jobId: sync that single record
 *   - Without: bulk sync all confirmed/booked moves + deliveries
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

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
      .select("id, move_code, client_name, service_type, move_type, status, scheduled_date, scheduled_start, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_MOVE_STATUSES),
    db
      .from("deliveries")
      .select("id, delivery_number, client_name, service_type, status, scheduled_date, time_slot, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
      .in("status", BOOKABLE_DELIVERY_STATUSES)
      .not("service_type", "eq", "bin_rental"),
    db.from("crews").select("id, name"),
  ]);

  const crewMap: Record<string, string> = {};
  for (const c of crewsResp.data ?? []) crewMap[c.id] = c.name;

  const results: { id: string; code: string; action: string; error?: string }[] = [];

  const moveJobs = (movesResp.data ?? []).map((m) => ({
    id: m.id as string,
    code: String(m.move_code || ""),
    input: buildMoveInput(m as Record<string, unknown>, crewMap),
  }));

  const deliveryJobs = (deliveriesResp.data ?? []).map((d) => ({
    id: d.id as string,
    code: String(d.delivery_number || ""),
    input: buildDeliveryInput(d as Record<string, unknown>, crewMap),
  }));

  for (const job of [...moveJobs, ...deliveryJobs]) {
    const result = await syncJobToGCal(job.input);
    results.push({ id: job.id, code: job.code, action: result.action, error: result.error });

    if (result.eventId !== undefined) {
      const table = job.input.jobType === "move" ? "moves" : "deliveries";
      await db.from(table).update({ gcal_event_id: result.eventId }).eq("id", job.id);
    }
  }

  const counts = results.reduce(
    (a, r) => ({ ...a, [r.action]: (a[r.action as keyof typeof a] ?? 0) + 1 }),
    { created: 0, updated: 0, deleted: 0, skipped: 0, error: 0 },
  );

  return NextResponse.json({ success: true, counts, results });
}

/** GET — configuration status check */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  return NextResponse.json({
    configured: isGCalConfigured(),
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? null,
    clientEmail: process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ?? null,
  });
}

/* ── Row → GCalJobInput ───────────────────────────────────────────────────── */

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
    startTime: m.scheduled_start ? String(m.scheduled_start).slice(0, 5) : null,
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
    startTime: d.time_slot ? String(d.time_slot).slice(0, 5) : null,
    estimatedDurationMinutes: d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null,
    fromAddress: d.from_address ? String(d.from_address) : null,
    toAddress: d.to_address ? String(d.to_address) : null,
    crewName: crewMap && crewId ? (crewMap[crewId] ?? null) : null,
    notes: d.notes ? String(d.notes) : null,
    existingEventId: d.gcal_event_id ? String(d.gcal_event_id) : null,
  };
}
