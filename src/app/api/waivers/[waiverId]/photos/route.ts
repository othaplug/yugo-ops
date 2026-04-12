import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVerifiedCrewFromRequest } from "@/lib/crew-token";

const BUCKET = "job-photos";

/** POST: Append one photo to an existing waiver (crew session). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ waiverId: string }> },
) {
  const payload = getVerifiedCrewFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { waiverId } = await params;
    if (!waiverId?.trim()) {
      return NextResponse.json({ error: "Invalid waiver" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: waiver, error: wErr } = await admin
      .from("move_waivers")
      .select("id, move_id, photo_urls")
      .eq("id", waiverId.trim())
      .single();
    if (wErr || !waiver) {
      return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
    }

    const { data: move } = await admin
      .from("moves")
      .select("id, crew_id")
      .eq("id", waiver.move_id)
      .single();
    if (!move || move.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const prev = Array.isArray(waiver.photo_urls) ? waiver.photo_urls : [];
    const next = [...prev, storagePath].slice(0, 16);
    const { error: upErr } = await admin
      .from("move_waivers")
      .update({ photo_urls: next })
      .eq("id", waiver.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ path: storagePath });
  } catch (e) {
    console.error("[waiver photos append]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
