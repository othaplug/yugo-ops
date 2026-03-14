import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const moveId = req.nextUrl.searchParams.get("move_id");
  if (!moveId) return NextResponse.json({ error: "move_id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("move_files")
    .select("*")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ files: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const moveId = formData.get("move_id") as string | null;

    if (!file || !moveId) {
      return NextResponse.json({ error: "file and move_id are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const ext = file.name.split(".").pop() || "bin";
    const timestamp = Date.now();
    const storagePath = `moves/${moveId}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const buf = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage
      .from("move-files")
      .upload(storagePath, buf, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("move-files").getPublicUrl(storagePath);

    const { data: record, error: insertError } = await admin
      .from("move_files")
      .insert({
        move_id: moveId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_type: file.type || `application/${ext}`,
        category: file.type?.startsWith("image/") ? "photo" : "document",
        source: "admin_upload",
        uploaded_by: (user as { id?: string } | null)?.id ?? null,
      })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json({ file: record });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
