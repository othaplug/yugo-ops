import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

const BUCKET = "job-photos";

/**
 * POST /api/partner/projects/[id]/inventory/[itemId]/photos
 * Upload a reference photo for a project inventory item.
 * Stores in Supabase Storage and appends the public URL to photo_urls[].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  // Verify partner owns project
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify item belongs to project
  const { data: item } = await db
    .from("project_inventory")
    .select("id, item_name, photo_urls")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .single();
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const storagePath = `project-items/${projectId}/${itemId}/${safeName}`;

    const buf = await file.arrayBuffer();
    const { error: uploadErr } = await db.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: file.type || "image/jpeg", upsert: false });

    if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 });

    const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(storagePath);

    // Append to photo_urls array
    const existing: string[] = Array.isArray(item.photo_urls) ? item.photo_urls : [];
    const updated = [...existing, publicUrl];

    const { error: updateErr } = await db
      .from("project_inventory")
      .update({ photo_urls: updated })
      .eq("id", itemId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({ url: publicUrl, photo_urls: updated }, { status: 201 });
  } catch (e) {
    console.error("[project-item-photos] upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
