import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

/** Log when crew skips mandatory photos (admin can see in status_events or similar). */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobId = (body.jobId || "").toString().trim();
  const jobType = (body.jobType || "").toString().trim();
  const checkpoint = (body.checkpoint || "").toString().trim();

  if (!jobId || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId = jobId;
  if (jobType === "move") {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m || m.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = m.id;
  } else {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!d || d.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = d.id;
  }

  try {
    await admin.from("status_events").insert({
      entity_type: jobType,
      entity_id: entityId,
      event_type: "photo_skipped",
      description: `Crew skipped mandatory photos at ${checkpoint || "arrived"}`,
      icon: "camera",
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
