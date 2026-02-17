import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

const DOC_TYPES = ["contract", "estimate", "invoice", "other"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const { data: docs, error } = await supabase
      .from("move_documents")
      .select("id, type, title, storage_path, external_url, created_at")
      .eq("move_id", moveId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-documents";
    const withUrls = await Promise.all(
      (docs ?? []).map(async (d) => {
        let viewUrl = d.external_url ?? null;
        if (!viewUrl && d.storage_path) {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(d.storage_path, 3600);
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const contentType = req.headers.get("content-type") ?? "";
    let title = "";
    let type = "other";
    let externalUrl: string | null = null;
    let storagePath: string | null = null;

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      title = (formData.get("title") as string)?.trim() || "Document";
      type = DOC_TYPES.includes((formData.get("type") as any) || "") ? (formData.get("type") as any) : "other";

      if (file?.size) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        storagePath = `${moveId}/${safeName}`;
        const buf = await file.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from("move-documents")
          .upload(storagePath, buf, { contentType: file.type, upsert: false });
        if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });
      } else {
        externalUrl = (formData.get("external_url") as string)?.trim() || null;
      }
    } else {
      const body = await req.json();
      title = (body.title || "").trim() || "Document";
      type = DOC_TYPES.includes(body.type) ? body.type : "other";
      externalUrl = (body.external_url || "").trim() || null;
    }

    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!storagePath && !externalUrl) return NextResponse.json({ error: "Upload a file or provide a link" }, { status: 400 });

    const { data: doc, error } = await supabase
      .from("move_documents")
      .insert({
        move_id: moveId,
        type,
        title,
        storage_path: storagePath,
        external_url: externalUrl,
      })
      .select("id, type, title, storage_path, external_url")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ document: doc });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add" },
      { status: 500 }
    );
  }
}
