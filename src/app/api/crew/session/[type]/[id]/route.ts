import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { normalizeDeliveryStatus } from "@/lib/crew-tracking-status";
import { getAppTimezone, ymdPartsInTimeZone } from "@/lib/business-timezone";

/** GET tracking session for crew portal (uses crew auth). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const jobType = type === "delivery" ? "delivery" : "move";

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let entityId: string;
  if (jobType === "delivery") {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", id).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", id).single();
    if (!d || d.crew_id !== payload.teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    entityId = d.id;
  } else {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", id).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", id.replace(/^#/, "").toUpperCase()).single();
    if (!m || m.crew_id !== payload.teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    entityId = m.id;
  }

  const { data: session } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, status, is_active, started_at, completed_at, last_location, checkpoints, crew_lead_id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ session: null, checkpoints: [], lastLocation: null });
  }

  // Multi-day guard: a project day (e.g. pack day) closes its own tracking
  // session, but the move stays in_progress for the next day. Without this the
  // crew app would load a PRIOR day's completed session — showing its elapsed
  // and, worse, reading the move as finished so the next day never appears.
  // A completed session yields to a new track when EITHER (a) the move still
  // has a non-terminal project day pending (day 2 is coming — regardless of
  // when the prior day closed), or (b) it simply finished on an earlier day.
  if (!session.is_active && session.completed_at && jobType === "move") {
    let remainingDay = false;
    const { data: pdays } = await admin
      .from("move_project_days")
      .select("status")
      .eq("move_id", entityId);
    if (pdays && pdays.length > 0) {
      remainingDay = pdays.some(
        (d) =>
          !["completed", "cancelled"].includes(String(d.status || "").toLowerCase()),
      );
    }
    let priorDay = false;
    const doneMs = new Date(session.completed_at).getTime();
    if (Number.isFinite(doneMs)) {
      const tz = getAppTimezone();
      priorDay =
        ymdPartsInTimeZone(doneMs, tz) !== ymdPartsInTimeZone(Date.now(), tz);
    }
    if (remainingDay || priorDay) {
      return NextResponse.json({ session: null, checkpoints: [], lastLocation: null });
    }
  }

  const normalize = jobType === "delivery"
    ? (s: string) => normalizeDeliveryStatus(s)
    : (s: string) => s;

  const rawCheckpoints: { status: string; timestamp: string; note: string | null }[] = session.checkpoints || [];

  return NextResponse.json({
    session: {
      id: session.id,
      status: normalize(session.status),
      isActive: session.is_active,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      lastLocation: session.last_location,
    },
    checkpoints: rawCheckpoints.map((c) => ({ ...c, status: normalize(c.status) })),
    lastLocation: session.last_location,
  });
}
