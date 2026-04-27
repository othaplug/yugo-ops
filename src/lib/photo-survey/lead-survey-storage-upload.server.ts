import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const LEAD_PHOTO_MAX_BYTES = 12 * 1024 * 1024

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
])

function extForMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  if (mime === "image/gif") return "gif"
  if (mime === "image/heic" || mime === "image/heif") return "heic"
  return "jpg"
}

/** Some browsers report `image/jpg`; normalize for storage `contentType`. */
function effectiveContentType(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg"
  return mime
}

/**
 * Public lead room-photo flow: `photo_surveys` row + `photo-surveys` storage bucket.
 */
export async function uploadLeadPhotoSurveyRoom(
  token: string,
  roomId: string,
  file: Blob,
): Promise<NextResponse> {
  const sb = createAdminClient()
  const { data: survey, error: sErr } = await sb
    .from("photo_surveys")
    .select("id, status")
    .eq("token", token)
    .maybeSingle()
  if (sErr || !survey || survey.status !== "pending") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const mime = (file.type || "image/jpeg").toLowerCase()
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 })
  }
  if (file.size > LEAD_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 })
  }

  const contentType = effectiveContentType(mime)
  const buf = Buffer.from(await file.arrayBuffer())
  const name = `${randomUUID()}.${extForMime(contentType)}`
  const path = `surveys/${token}/${roomId}/${name}`

  const { error: upErr } = await sb.storage
    .from("photo-surveys")
    .upload(path, buf, { contentType, upsert: false })
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ path })
}
