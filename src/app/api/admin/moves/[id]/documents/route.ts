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
      admin.from("moves").select("move_code, summary_pdf_url, invoice_pdf_url, receipt_pdf_url, square_receipt_url").eq("id", moveId).single(),
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
    const displayId = moveRow?.move_code || `MV-${moveId.slice(0, 8).toUpperCase()}`;
    const code = moveRow?.move_code || moveId.slice(0, 8).toUpperCase();

    function pdfPath(type: "summary" | "invoice" | "receipt"): string {
      const name = type === "summary" ? "move-summary" : type;
      return `moves/${moveId}/${name}-${displayId}.pdf`;
    }
    function pathOrDerived(stored: string | null | undefined, type: "summary" | "invoice" | "receipt"): string {
      if (stored && !stored.startsWith("http")) return stored;
      return pdfPath(type);
    }

    const autoDocs: { id: string; type: string; title: string; view_url: string; external_url: null; created_at: string }[] = [];
    const summaryPath = pathOrDerived(moveRow?.summary_pdf_url, "summary");
    const invoicePath = pathOrDerived(moveRow?.invoice_pdf_url, "invoice");
    const receiptPath = pathOrDerived(moveRow?.receipt_pdf_url, "receipt");
    const hasSummary = !!moveRow?.summary_pdf_url;
    const hasInvoice = !!moveRow?.invoice_pdf_url;
    const hasReceipt = !!moveRow?.receipt_pdf_url;
    const [summarySigned, invoiceSigned, receiptSigned] = await Promise.all([
      hasSummary ? admin.storage.from(bucket).createSignedUrl(summaryPath, 3600) : Promise.resolve({ data: null }),
      hasInvoice ? admin.storage.from(bucket).createSignedUrl(invoicePath, 3600) : Promise.resolve({ data: null }),
      hasReceipt ? admin.storage.from(bucket).createSignedUrl(receiptPath, 3600) : Promise.resolve({ data: null }),
    ]);
    // Short app URLs (proxy to signed URL); client never sees Supabase URL
    if (summarySigned.data?.signedUrl) {
      autoDocs.push({ id: "summary-pdf", type: "document", title: `Move Summary — ${code}.pdf`, view_url: `/api/admin/moves/${moveId}/documents/summary`, external_url: null, created_at: new Date().toISOString() });
    }
    if (invoiceSigned.data?.signedUrl) {
      autoDocs.push({ id: "invoice-pdf", type: "invoice", title: `Invoice — ${code}.pdf`, view_url: `/api/admin/moves/${moveId}/documents/invoice`, external_url: null, created_at: new Date().toISOString() });
    }
    if (receiptSigned.data?.signedUrl) {
      autoDocs.push({ id: "receipt-pdf", type: "document", title: `Payment Receipt — ${code}.pdf`, view_url: `/api/admin/moves/${moveId}/documents/receipt`, external_url: null, created_at: new Date().toISOString() });
    }
    const allDocuments = [...autoDocs, ...withUrls];
    const squareReceiptUrl = (move as { square_receipt_url?: string | null } | null)?.square_receipt_url ?? null;

    return NextResponse.json({ documents: allDocuments, square_receipt_url: squareReceiptUrl });
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
