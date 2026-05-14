import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAllAdmins } from "@/lib/notifications";

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
  // Pick a sensible extension from the MIME type so iPhone HEIC / WebP /
  // GIF uploads keep their format instead of being mis-tagged as .jpg.
  const mime = (file.type || "").toLowerCase();
  let ext = "jpg";
  if (mime.includes("png")) ext = "png";
  else if (mime.includes("webp")) ext = "webp";
  else if (mime.includes("heic")) ext = "heic";
  else if (mime.includes("heif")) ext = "heif";
  else if (mime.includes("gif")) ext = "gif";
  const storagePath = `survey/${move.id}/${room}_${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage
    .from("move-assets")
    .upload(storagePath, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (upErr) {
    // Surface the underlying cause so we don't repeat the "bucket-not-found"
    // silent failure that left the client staring at a generic error. Storage
    // SDK errors carry a `message` (and sometimes `statusCode`).
    const detail =
      (upErr as { message?: string; statusCode?: string | number }).message ??
      String(upErr);
    console.error("[survey] storage upload failed", {
      path: storagePath,
      detail,
      mime,
    });
    return NextResponse.json(
      {
        error: "Upload failed",
        // Safe to expose: this is a server-generated string, not user input.
        detail: detail.slice(0, 200),
      },
      { status: 500 },
    );
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

  if (insErr) {
    console.error("[survey] db insert failed", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}

/** PUT JSON { complete: true } — mark survey completed and notify admins */
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = String(token || "").trim();
  if (!t) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const sb = createAdminClient();
  const { data: move } = await sb
    .from("moves")
    .select("id, move_code, client_name, survey_completed")
    .eq("survey_token", t)
    .maybeSingle();
  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Skip duplicate notifications if the client re-submits a completed survey.
  const alreadyCompleted = !!move.survey_completed;

  await sb.from("moves").update({ survey_completed: true }).eq("id", move.id);

  // Hot alert for the coordinator. Fire-and-forget — don't fail the client's
  // submission if the notification system hiccups. Only fires on the first
  // completion so we don't spam admins with repeated submits.
  if (!alreadyCompleted) {
    (async () => {
      try {
        const { count } = await sb
          .from("move_survey_photos")
          .select("id", { count: "exact", head: true })
          .eq("move_id", move.id);
        const photoCount = count ?? 0;
        const clientName = ((move.client_name as string | null) ?? "").trim();
        const moveCode = (move.move_code as string | null) ?? "";
        await notifyAllAdmins({
          eventSlug: "client_survey_photos_submitted",
          title: `Pre-move photos submitted${moveCode ? ` — ${moveCode}` : ""}`,
          body:
            (clientName ? `${clientName} ` : "Client ") +
            `submitted ${photoCount} room photo${photoCount === 1 ? "" : "s"}. ` +
            `Review before move day to flag anything the inventory missed.`,
          icon: "camera",
          link: `/admin/moves/${move.id}`,
          sourceType: "move",
          sourceId: String(move.id),
        });
      } catch (e) {
        console.warn("[survey] hot alert dispatch failed:", e);
      }
    })();
  }

  return NextResponse.json({ ok: true });
}
