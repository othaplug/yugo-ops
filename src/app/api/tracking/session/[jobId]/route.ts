import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";

/** GET tracking session for a job. Used by client tracking page (with token) or admin. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const jobTypeParam = req.nextUrl.searchParams.get("jobType") || "";

  const admin = createAdminClient();

  // Resolve jobId to move or delivery
  const byUuid = isUuid(jobId);
  let entity: { id: string; jobType: "move" | "delivery" } | null = null;

  if (jobTypeParam === "delivery" || jobId.startsWith("PJ")) {
    const { data: d } = byUuid
      ? await admin.from("deliveries").select("id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id").ilike("delivery_number", jobId).single();
    if (d) entity = { id: d.id, jobType: "delivery" };
  }
  if (!entity) {
    const { data: m } = byUuid
      ? await admin.from("moves").select("id").eq("id", jobId).single()
      : await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (m) entity = { id: m.id, jobType: "move" };
  }
  if (!entity) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Auth: client uses token, admin uses platform auth
  const isClient = !!token;
  if (isClient) {
    const valid = verifyTrackToken(entity.jobType === "move" ? "move" : "delivery", entity.id, token);
    if (!valid) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: session } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, status, is_active, started_at, completed_at, last_location, checkpoints, crew_lead_id")
    .eq("job_id", entity.id)
    .eq("job_type", entity.jobType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ session: null, checkpoints: [], lastLocation: null });
  }

  let crewLeadName = "";
  if (session.crew_lead_id) {
    const { data: cm } = await admin.from("crew_members").select("name").eq("id", session.crew_lead_id).single();
    crewLeadName = cm?.name || "";
  }

  return NextResponse.json({
    session: {
      id: session.id,
      jobId: session.job_id,
      jobType: session.job_type,
      status: session.status,
      isActive: session.is_active,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      lastLocation: session.last_location,
      crewLeadName,
    },
    checkpoints: session.checkpoints || [],
    lastLocation: session.last_location,
  });
}
