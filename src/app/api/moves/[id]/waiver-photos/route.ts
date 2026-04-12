import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedCrewFromRequest } from "@/lib/crew-token";

const BUCKET = "job-photos";

/** POST: Upload one waiver documentation photo (crew session). Returns storage path for move_waivers.photo_urls. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = getVerifiedCrewFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: moveId } = await params;
    const slug = moveId?.trim() || "";
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const admin = createAdminClient();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        slug,
      );
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", slug).single()
      : await admin
          .from("moves")
          .select("id, crew_id")
          .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
          .single();
    if (!move || move.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const storagePath = `move/${move.id}/waivers/${safeName}`;

    const buf = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    return NextResponse.json({ path: storagePath });
  } catch (e) {
    console.error("[waiver-photos] error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
