import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function extForMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sb = createAdminClient();
  const { data: survey, error: sErr } = await sb
    .from("photo_surveys")
    .select("id, status")
    .eq("token", token)
    .maybeSingle();
  if (sErr || !survey || survey.status !== "pending") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form" }, { status: 400 });
  }

  const roomId = String(form.get("room_id") || "").trim();
  const file = form.get("file");
  if (!roomId || !file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "room_id and file required" }, { status: 400 });
  }

  const mime = (file.type || "image/jpeg").toLowerCase();
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${extForMime(mime)}`;
  const path = `surveys/${token}/${roomId}/${name}`;

  const { error: upErr } = await sb.storage
    .from("photo-surveys")
    .upload(path, buf, { contentType: mime, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
