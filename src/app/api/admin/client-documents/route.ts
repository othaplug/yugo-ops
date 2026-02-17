import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

const BUCKET = "client-documents";

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const moveId = searchParams.get("move_id");
    const orgId = searchParams.get("organization_id");

    const supabase = await createClient();
    let query = supabase
      .from("client_documents")
      .select("id, title, type, storage_path, created_at")
      .order("created_at", { ascending: false });

    if (moveId) query = query.eq("move_id", moveId);
    else if (orgId) query = query.eq("organization_id", orgId);
    else return NextResponse.json({ error: "move_id or organization_id required" }, { status: 400 });

    const { data: docs, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const withUrls = await Promise.all(
      (docs ?? []).map(async (d) => {
        let viewUrl: string | null = null;
        if (d.storage_path) {
          const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600);
          viewUrl = signed?.signedUrl ?? null;
        }
        return { ...d, view_url: viewUrl };
      })
    );

    return NextResponse.json({ documents: withUrls });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const contentType = req.headers.get("content-type") ?? "";
    let moveId: string | null = null;
    let orgId: string | null = null;
    let title = "";
    let type = "other";
    let file: File | null = null;

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      moveId = (formData.get("move_id") as string)?.trim() || null;
      orgId = (formData.get("organization_id") as string)?.trim() || null;
      title = (formData.get("title") as string)?.trim() || "Document";
      type = ["contract", "estimate", "invoice", "other"].includes((formData.get("type") as string) || "")
        ? (formData.get("type") as string)
        : "other";
      file = formData.get("file") as File | null;
    }

    if ((!moveId && !orgId) || (moveId && orgId)) {
      return NextResponse.json({ error: "Provide exactly one of move_id or organization_id" }, { status: 400 });
    }
    if (!file?.size) return NextResponse.json({ error: "File is required" }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const storagePath = moveId ? `${moveId}/${safeName}` : `${orgId}/${safeName}`;

    const buf = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buf, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

    const { data: doc, error: insertError } = await supabase
      .from("client_documents")
      .insert({
        move_id: moveId,
        organization_id: orgId,
        title: title || file.name.replace(/\.[^/.]+$/, ""),
        type,
        storage_path: storagePath,
      })
      .select("id, title, type, storage_path, created_at")
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
    return NextResponse.json({
      document: { ...doc, view_url: signed?.signedUrl ?? null },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload" },
      { status: 500 }
    );
  }
}
