import { NextRequest, NextResponse } from "next/server";
import { uploadLeadPhotoSurveyRoom } from "@/lib/photo-survey/lead-survey-storage-upload.server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  if (!token) {
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

  return uploadLeadPhotoSurveyRoom(token, roomId, file);
}
