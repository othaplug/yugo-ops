import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const admin = createAdminClient();
    const { data: photos, error } = await admin
      .from("move_photos")
      .select("id, storage_path, caption, sort_order")
      .eq("move_id", moveId)
      .order("sort_order")
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-photos";
    const urls: { id: string; url: string; caption: string | null }[] = [];
    for (const p of photos ?? []) {
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(p.storage_path, 3600);
      urls.push({ id: p.id, url: signed?.signedUrl ?? "", caption: p.caption });
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
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caption = (formData.get("caption") as string)?.trim() || null;

    if (!file || !file.size) return NextResponse.json({ error: "No file" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = `${moveId}/${safeName}`;

    const buf = await file.arrayBuffer();
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("move-photos")
      .upload(storagePath, buf, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    const { data: photo, error } = await admin
      .from("move_photos")
      .insert({ move_id: moveId, storage_path: storagePath, caption })
      .select("id, storage_path, caption")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ photo });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload" },
      { status: 500 }
    );
  }
}
