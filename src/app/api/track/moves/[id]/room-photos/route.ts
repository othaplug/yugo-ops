import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { notifyAllAdmins } from "@/lib/notifications";
import { SURVEY_ROOM_KEYS } from "@/lib/photo-survey/rooms";

/**
 * Client room photos from the /track portal.
 *
 * This writes to the SAME store as the post-payment "Help us prepare" survey
 * (`/api/survey/[token]`): the `move-assets` bucket under `survey/{moveId}/`
 * and the `move_survey_photos` table. That way the admin move-detail gallery
 * ("Pre-move photos") and the Files section light up automatically — there is
 * exactly one source of truth for a move's pre-move photos, no parallel JSONB.
 */

function extFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic")) return "heic";
  if (m.includes("heif")) return "heif";
  if (m.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moveId } = await params;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const room = String(formData.get("room") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!file || !room) {
    return NextResponse.json({ error: "file and room required" }, { status: 400 });
  }
  if (!SURVEY_ROOM_KEYS.includes(room)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: "Photo too large (max 12 MB)" }, { status: 413 });
  }

  const supabase = createAdminClient();

  const { data: move } = await supabase
    .from("moves")
    .select("id, move_code, client_name")
    .eq("id", moveId)
    .single();
  if (!move) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Did this move have any pre-move photos before now? Drives the one-time
  // admin heads-up (fire once on the first photo, not once per upload).
  const { count: priorCount } = await supabase
    .from("move_survey_photos")
    .select("id", { count: "exact", head: true })
    .eq("move_id", moveId);

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `survey/${moveId}/${room}_${Date.now()}.${extFor(file.type || "")}`;

  const { error: uploadError } = await supabase.storage
    .from("move-assets")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    const detail =
      (uploadError as { message?: string }).message ?? String(uploadError);
    console.error("[track room-photos] storage upload failed", { path: storagePath, detail });
    return NextResponse.json({ error: "Upload failed", detail: detail.slice(0, 200) }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("move-assets").getPublicUrl(storagePath);

  const { error: insErr } = await supabase.from("move_survey_photos").insert({
    move_id: moveId,
    room,
    photo_url: publicUrl,
    notes,
  });
  if (insErr) {
    console.error("[track room-photos] db insert failed", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // First photo for this move → one hot alert so the coordinator reviews it
  // before move day. Fire-and-forget; never fail the client's upload on it.
  if ((priorCount ?? 0) === 0) {
    const clientName = ((move.client_name as string | null) ?? "").trim();
    const moveCode = (move.move_code as string | null) ?? "";
    notifyAllAdmins({
      eventSlug: "client_survey_photos_submitted",
      title: `Pre-move photos started${moveCode ? `, ${moveCode}` : ""}`,
      body:
        (clientName ? `${clientName} ` : "Client ") +
        "began uploading room photos from the tracking page. " +
        "Review before move day to flag anything the inventory missed.",
      icon: "camera",
      link: `/admin/moves/${moveId}`,
      sourceType: "move",
      sourceId: String(moveId),
    }).catch((e) => console.warn("[track room-photos] admin alert failed:", e));
  }

  return NextResponse.json({ url: publicUrl, room });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("move_survey_photos")
    .select("room, photo_url, created_at")
    .eq("move_id", moveId)
    .order("created_at", { ascending: true });

  // Collapse to the latest photo per room for the client card's one-tile-per-room
  // view (the admin gallery still shows every photo).
  const photos: Record<string, { url: string; uploadedAt: string }> = {};
  for (const row of data ?? []) {
    const r = (row as { room: string | null }).room || "other";
    photos[r] = {
      url: (row as { photo_url: string }).photo_url,
      uploadedAt: (row as { created_at: string | null }).created_at || "",
    };
  }

  return NextResponse.json({ photos });
}
