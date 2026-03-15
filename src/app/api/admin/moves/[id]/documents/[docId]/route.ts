import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireStaff } from "@/lib/api-auth";

const PDF_DOC_TYPES = ["summary", "invoice", "receipt"] as const;

/**
 * GET: Short-URL proxy when docId is "summary" | "invoice" | "receipt" — redirect to signed PDF.
 * Other docIds are not used for GET (documents list is from the parent route).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId, docId } = await params;
  if (!PDF_DOC_TYPES.includes(docId as (typeof PDF_DOC_TYPES)[number])) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: move, error } = await admin
    .from("moves")
    .select("move_code, summary_pdf_url, invoice_pdf_url, receipt_pdf_url")
    .eq("id", moveId)
    .single();

  if (error || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const displayId = (move as { move_code?: string | null }).move_code || `MV-${moveId.slice(0, 8).toUpperCase()}`;
  const row = move as { summary_pdf_url?: string | null; invoice_pdf_url?: string | null; receipt_pdf_url?: string | null };
  const name = docId === "summary" ? "move-summary" : docId;
  const stored = docId === "summary" ? row.summary_pdf_url : docId === "invoice" ? row.invoice_pdf_url : row.receipt_pdf_url;
  const path = stored && !stored.startsWith("http") ? stored : `moves/${moveId}/${name}-${displayId}.pdf`;

  const { data: signed } = await admin.storage.from("move-documents").createSignedUrl(path, 3600);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });

  // Stream PDF so the browser URL stays on our domain (no redirect to Supabase)
  const pdfRes = await fetch(signed.signedUrl);
  if (!pdfRes.ok) return NextResponse.json({ error: "Document unavailable" }, { status: 404 });
  const blob = await pdfRes.arrayBuffer();
  const filename = docId === "summary" ? `move-summary-${displayId}.pdf` : `${docId}-${displayId}.pdf`;
  return new NextResponse(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, docId } = await params;
    const admin = createAdminClient();
    const { data: doc } = await admin
      .from("move_documents")
      .select("storage_path")
      .eq("id", docId)
      .eq("move_id", moveId)
      .single();

    if (doc?.storage_path) {
      await admin.storage.from("move-documents").remove([doc.storage_path]);
    }

    await admin.from("move_documents").delete().eq("id", docId).eq("move_id", moveId);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}

/** PATCH: Replace document file (multipart/form-data with "file"). Only for move_documents rows with storage_path. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId, docId } = await params;
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload a file (multipart/form-data)" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const admin = createAdminClient();
  const { data: doc, error: fetchErr } = await admin
    .from("move_documents")
    .select("id, storage_path")
    .eq("id", docId)
    .eq("move_id", moveId)
    .single();

  if (fetchErr || !doc?.storage_path) {
    return NextResponse.json({ error: "Document not found or cannot be replaced" }, { status: 404 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const newPath = `${moveId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buf = await file.arrayBuffer();

  const { error: uploadErr } = await admin.storage
    .from("move-documents")
    .upload(newPath, buf, { contentType: file.type, upsert: false });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 400 });

  const { error: updateErr } = await admin
    .from("move_documents")
    .update({ storage_path: newPath })
    .eq("id", docId)
    .eq("move_id", moveId);

  if (updateErr) {
    await admin.storage.from("move-documents").remove([newPath]);
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  await admin.storage.from("move-documents").remove([doc.storage_path]);

  return NextResponse.json({ ok: true, storage_path: newPath });
}
