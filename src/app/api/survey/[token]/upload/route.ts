import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPhotoSurveyToken } from "@/lib/track-token";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const BUCKET = "survey-photos";

// POST /api/survey/[token]/upload
// Public — client uploads a room photo for the photo survey.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const quoteId = verifyPhotoSurveyToken(token);
  if (!quoteId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("photo") as File | null;
  const room = (formData.get("room") as string | null) ?? "General";

  if (!file) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    return NextResponse.json({ error: "Invalid file type. Please upload a photo." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Photo is too large. Maximum size is 20 MB." }, { status: 400 });
  }

  const admin = createAdminClient();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${quoteId}/${room.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[SurveyUpload] storage error:", uploadError);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }

  // Log the upload in the database
  const { error: dbError } = await admin.from("quote_survey_photos").insert({
    quote_id: quoteId,
    room,
    storage_path: storagePath,
    bucket: BUCKET,
    file_size: file.size,
  });

  if (dbError) {
    console.warn("[SurveyUpload] db insert error (non-fatal):", dbError.message);
  }

  return NextResponse.json({ ok: true, path: storagePath });
}
