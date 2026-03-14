import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const claimId = formData.get("claimId") as string | null;
    const photoType = (formData.get("photoType") as string) || "damage";
    const uploadedBy = (formData.get("uploadedBy") as string) || "client";
    const caption = formData.get("caption") as string | null;

    if (!file || !claimId) {
      return NextResponse.json({ error: "file and claimId are required" }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "pdf"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: `File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}` }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    const VALID_PHOTO_TYPES = ["damage", "item_before", "item_after", "receipt", "other"];
    if (!VALID_PHOTO_TYPES.includes(photoType)) {
      return NextResponse.json({ error: `Invalid photoType. Accepted: ${VALID_PHOTO_TYPES.join(", ")}` }, { status: 400 });
    }

    const VALID_UPLOADED_BY = ["client", "admin", "crew"];
    if (!VALID_UPLOADED_BY.includes(uploadedBy)) {
      return NextResponse.json({ error: `Invalid uploadedBy. Accepted: ${VALID_UPLOADED_BY.join(", ")}` }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: claim } = await supabase.from("claims").select("id").eq("id", claimId).maybeSingle();
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    const buf = Buffer.from(await file.arrayBuffer());
    const storagePath = `${claimId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("claim-photos")
      .upload(storagePath, buf, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Photo upload failed:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("claim-photos").getPublicUrl(storagePath);
    const photoUrl = urlData.publicUrl;

    const { data: photo, error } = await supabase
      .from("claim_photos")
      .insert({
        claim_id: claimId,
        photo_url: photoUrl,
        photo_type: photoType,
        uploaded_by: uploadedBy,
        caption: caption || null,
      })
      .select("id, photo_url")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to save photo record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, photo });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
