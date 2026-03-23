import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

const ALLOWED_ROOMS = [
  "living_room", "kitchen", "primary_bedroom", "bedroom_2",
  "basement", "garage", "hallway", "other",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moveId } = await params;
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const isValid = verifyTrackToken("move", moveId, token);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const room = formData.get("room") as string | null;

  if (!file || !room) {
    return NextResponse.json({ error: "file and room required" }, { status: 400 });
  }

  if (!ALLOWED_ROOMS.includes(room)) {
    return NextResponse.json({ error: "Invalid room" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  const supabase = createAdminClient();

  // Fetch current photos
  const { data: move } = await supabase
    .from("moves")
    .select("client_room_photos")
    .eq("id", moveId)
    .single();

  const currentPhotos = (move?.client_room_photos as Record<string, unknown>) || {};

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.type.includes("png") ? "png" : "jpg";
  const storagePath = `room-photos/${moveId}/${room}_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("move-assets")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[room-photos] storage upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("move-assets")
    .getPublicUrl(storagePath);

  // Merge into JSONB
  const updatedPhotos = {
    ...currentPhotos,
    [room]: { url: publicUrl, uploadedAt: new Date().toISOString() },
  };

  await supabase
    .from("moves")
    .update({ client_room_photos: updatedPhotos })
    .eq("id", moveId);

  return NextResponse.json({ url: publicUrl, room });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";

  const isValid = verifyTrackToken("move", moveId, token);
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("moves")
    .select("client_room_photos")
    .eq("id", moveId)
    .single();

  return NextResponse.json({ photos: data?.client_room_photos || {} });
}
