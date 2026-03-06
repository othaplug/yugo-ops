import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

const MAX_CLIENT_PHOTOS = 10;
const RETENTION_DAYS = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: photos, error } = await admin
      .from("move_photos")
      .select("id, storage_path, caption, sort_order, source, created_at")
      .eq("move_id", moveId)
      .order("sort_order")
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-photos";
    const urls: { id: string; url: string; caption: string | null; source: string; created_at?: string }[] = [];
    for (const p of photos ?? []) {
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(p.storage_path, 3600);
      urls.push({
        id: p.id,
        url: signed?.signedUrl ?? "",
        caption: p.caption,
        source: p.source || "admin",
        created_at: p.created_at,
      });
    }
    return NextResponse.json({ photos: urls });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch photos" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-track-token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: move } = await admin.from("moves").select("id, status").eq("id", moveId).single();
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
  if (move.status === "completed" || move.status === "delivered" || move.status === "done") {
    return NextResponse.json({ error: "Cannot upload photos after move is completed" }, { status: 400 });
  }

  const { count } = await admin
    .from("move_photos")
    .select("id", { count: "exact", head: true })
    .eq("move_id", moveId)
    .eq("source", "client");
  if ((count ?? 0) >= MAX_CLIENT_PHOTOS) {
    return NextResponse.json({ error: `Maximum ${MAX_CLIENT_PHOTOS} photos allowed` }, { status: 400 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    const single = formData.get("file") as File | null;
    if (single) files.push(single);
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const remaining = MAX_CLIENT_PHOTOS - (count ?? 0);
  const toUpload = files.slice(0, remaining);
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 86400000).toISOString();

  const uploaded: string[] = [];
  for (const file of toUpload) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${moveId}/client/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from("move-photos").upload(path, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (upErr) continue;

    await admin.from("move_photos").insert({
      move_id: moveId,
      storage_path: path,
      caption: null,
      sort_order: 0,
      source: "client",
      expires_at: expiresAt,
    });
    uploaded.push(path);
  }

  return NextResponse.json({ uploaded: uploaded.length, remaining: remaining - uploaded.length });
}
