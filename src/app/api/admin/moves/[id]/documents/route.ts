import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

const DOC_TYPES = ["contract", "estimate", "invoice", "other"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const admin = createAdminClient();
    const [{ data: docs, error }, { data: move }] = await Promise.all([
      admin
        .from("move_documents")
        .select("id, type, title, storage_path, external_url, created_at")
        .eq("move_id", moveId)
        .order("created_at", { ascending: false }),
      admin.from("moves").select("move_code, summary_pdf_url, invoice_pdf_url, receipt_pdf_url").eq("id", moveId).single(),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-documents";
    const withUrls = await Promise.all(
      (docs ?? []).map(async (d) => {
        let viewUrl = d.external_url ?? null;
        if (!viewUrl && d.storage_path) {
          const { data: signed } = await admin.storage.from(bucket).createSignedUrl(d.storage_path, 3600);
          viewUrl = signed?.signedUrl ?? null;
        }
        return { ...d, view_url: viewUrl };
      })
    );

    const moveRow = move as { move_code?: string | null; summary_pdf_url?: string | null; invoice_pdf_url?: string | null; receipt_pdf_url?: string | null } | null;
    const code = moveRow?.move_code || moveId.slice(0, 8).toUpperCase();
    const autoDocs: { id: string; type: string; title: string; view_url: string; external_url: null; created_at: string }[] = [];
    if (moveRow?.summary_pdf_url) {
      autoDocs.push({ id: "summary-pdf", type: "document", title: `Move Summary — ${code}.pdf`, view_url: moveRow.summary_pdf_url, external_url: null, created_at: new Date().toISOString() });
    }
    if (moveRow?.invoice_pdf_url) {
      autoDocs.push({ id: "invoice-pdf", type: "invoice", title: `Invoice — ${code}.pdf`, view_url: moveRow.invoice_pdf_url, external_url: null, created_at: new Date().toISOString() });
    }
    if (moveRow?.receipt_pdf_url) {
      autoDocs.push({ id: "receipt-pdf", type: "document", title: `Payment Receipt — ${code}.pdf`, view_url: moveRow.receipt_pdf_url, external_url: null, created_at: new Date().toISOString() });
    }
    const allDocuments = [...autoDocs, ...withUrls];

    return NextResponse.json({ documents: allDocuments });
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
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
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
        const admin = createAdminClient();
        const { error: uploadError } = await admin.storage
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

    const admin = createAdminClient();
    const { data: doc, error } = await admin
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
