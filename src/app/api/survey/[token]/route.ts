import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROOMS = [
  "living_room",
  "kitchen",
  "primary_bedroom",
  "bedroom_2",
  "bedroom_3",
  "basement",
  "other",
] as const;

/** POST multipart: file, room, notes — upload pre-move survey photo */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = String(token || "").trim();
  if (!t) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 });

  const file = form.get("file") as File | null;
  const room = String(form.get("room") || "").trim();
  const notes = String(form.get("notes") || "").trim() || null;

  if (!file || !room) {
    return NextResponse.json({ error: "file and room required" }, { status: 400 });
  }
  if (!ROOMS.includes(room as (typeof ROOMS)[number])) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const sb = createAdminClient();
  const { data: move, error: mErr } = await sb
    .from("moves")
    .select("id, survey_completed")
    .eq("survey_token", t)
    .maybeSingle();

  if (mErr || !move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.includes("png") ? "png" : "jpg";
  const storagePath = `survey/${move.id}/${room}_${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage.from("move-assets").upload(storagePath, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (upErr) {
    console.error("[survey] upload", upErr);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = sb.storage.from("move-assets").getPublicUrl(storagePath);

  const { error: insErr } = await sb.from("move_survey_photos").insert({
    move_id: move.id,
    room,
    photo_url: publicUrl,
    notes,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, url: publicUrl });
}

/** POST JSON { complete: true } — mark survey completed */
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = String(token || "").trim();
  if (!t) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const sb = createAdminClient();
  const { data: move } = await sb.from("moves").select("id").eq("survey_token", t).maybeSingle();
  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await sb.from("moves").update({ survey_completed: true }).eq("id", move.id);
  return NextResponse.json({ ok: true });
}
