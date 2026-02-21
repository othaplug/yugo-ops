import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const BUCKET = "job-photos";
const VALID_CATEGORIES = [
  "pre_move_condition",
  "loading",
  "in_transit",
  "delivery_placement",
  "post_move_condition",
  "damage_documentation",
  "other",
] as const;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const jobId = (formData.get("jobId") as string)?.trim();
    const jobType = (formData.get("jobType") as string)?.trim();
    const sessionId = (formData.get("sessionId") as string)?.trim() || null;
    const checkpoint = (formData.get("checkpoint") as string)?.trim() || null;
    const category = (formData.get("category") as string)?.trim() || "other";
    const note = (formData.get("note") as string)?.trim() || null;

    if (!file || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!jobId || !jobType || !["move", "delivery"].includes(jobType)) {
      return NextResponse.json({ error: "jobId and jobType (move|delivery) required" }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const admin = createAdminClient();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
    let entityId: string;

    if (jobType === "move") {
      const { data: move } = isUuid
        ? await admin.from("moves").select("id, move_code, crew_id").eq("id", jobId).single()
        : await admin.from("moves").select("id, move_code, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
      if (!move) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      if (move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
      entityId = move.id;
    } else {
      const { data: delivery } = isUuid
        ? await admin.from("deliveries").select("id, delivery_number, crew_id").eq("id", jobId).single()
        : await admin.from("deliveries").select("id, delivery_number, crew_id").ilike("delivery_number", jobId).single();
      if (!delivery) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      if (delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
      entityId = delivery.id;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const storagePath = `${jobType}/${entityId}/${safeName}`;

    const buf = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: file.type || "image/jpeg", upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    const { data: photo, error } = await admin
      .from("job_photos")
      .insert({
        job_id: entityId,
        job_type: jobType,
        session_id: sessionId || null,
        checkpoint,
        category: category as (typeof VALID_CATEGORIES)[number],
        storage_path: storagePath,
        thumbnail_path: null,
        taken_by: payload.crewMemberId,
        is_client_visible: true,
        note,
      })
      .select("id, storage_path, category, checkpoint, taken_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ photo });
  } catch (e) {
    console.error("[crew/photos/upload] error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
