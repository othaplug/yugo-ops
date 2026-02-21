import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

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

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      isActive: session.is_active,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      lastLocation: session.last_location,
    },
    checkpoints: session.checkpoints || [],
    lastLocation: session.last_location,
  });
}
