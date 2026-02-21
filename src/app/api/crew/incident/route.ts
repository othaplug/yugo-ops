import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const ISSUE_TYPES = ["damage", "delay", "missing_item", "access_problem", "other"] as const;

/** POST: Report an incident from crew portal */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { jobId, jobType, sessionId, issueType, description } = body;
  if (!jobId || !jobType || !issueType) {
    return NextResponse.json({ error: "jobId, jobType, issueType required" }, { status: 400 });
  }
  if (!ISSUE_TYPES.includes(issueType)) {
    return NextResponse.json({ error: "Invalid issueType" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  let entityId: string;
  if (jobType === "delivery") {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!d || d.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = d.id;
  } else {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m || m.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = m.id;
  }

  const { data: incident, error } = await admin
    .from("incidents")
    .insert({
      job_id: entityId,
      job_type: jobType,
      session_id: sessionId || null,
      crew_member_id: payload.crewMemberId,
      issue_type: issueType,
      description: (description || "").trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: incident.id });
}
