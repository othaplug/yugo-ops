import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const BUCKET = "job-photos";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const jobType = req.nextUrl.searchParams.get("jobType") || "move";
  if (!["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!move) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (move.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = move.id;
  } else {
    const { data: delivery } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!delivery) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = delivery.id;
  }

  const { data: photos, error } = await admin
    .from("job_photos")
    .select("id, storage_path, thumbnail_path, category, checkpoint, taken_at, note")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .order("taken_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const urls: { id: string; url: string; category: string; checkpoint: string | null; takenAt: string; note: string | null }[] = [];
  for (const p of photos ?? []) {
    const path = p.thumbnail_path || p.storage_path;
    const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    urls.push({
      id: p.id,
      url: signed?.signedUrl ?? "",
      category: p.category,
      checkpoint: p.checkpoint,
      takenAt: p.taken_at,
      note: p.note,
    });
  }

  return NextResponse.json({ photos: urls });
}
