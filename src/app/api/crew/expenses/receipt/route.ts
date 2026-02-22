import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const BUCKET = "expense-receipts";

/** Upload receipt image for an expense. Returns storage path for use in expense POST. */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Image required" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const storagePath = `${payload.teamId}/${safeName}`;

    const admin = createAdminClient();
    const buf = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: file.type || "image/jpeg", upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
    return NextResponse.json({ storagePath });
  } catch (e) {
    console.error("[crew/expenses/receipt] error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
