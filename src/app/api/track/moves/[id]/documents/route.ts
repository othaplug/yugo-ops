import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { generateMovePDFs } from "@/lib/documents/generateMovePDFs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: move } = await admin
      .from("moves")
      .select("id, status, move_code, summary_pdf_url, invoice_pdf_url, receipt_pdf_url, square_receipt_url")
      .eq("id", moveId)
      .single();
    const isCompleted = move?.status === "completed" || move?.status === "delivered";
    const moveCode = (move as { move_code?: string } | null)?.move_code || moveId.slice(0, 8).toUpperCase();

    const [invRes, docRes] = await Promise.all([
      admin.from("invoices").select("id, invoice_number, amount, status, due_date, created_at, client_name").eq("move_id", moveId).order("created_at", { ascending: false }),
      admin.from("move_documents").select("id, type, title, storage_path, external_url, created_at").eq("move_id", moveId).order("created_at", { ascending: false }),
    ]);

    let invoices = invRes.data ?? [];
    let documents = docRes.data ?? [];
    // If move is completed but the three PDFs (summary, invoice, receipt) were never generated, generate them now
    const missingPdfs = isCompleted && !(move as { summary_pdf_url?: string } | null)?.summary_pdf_url;
    if (missingPdfs) {
      try {
        await generateMovePDFs(moveId);
        const { data: moveRetry } = await admin.from("moves").select("summary_pdf_url, invoice_pdf_url, receipt_pdf_url").eq("id", moveId).single();
        if (moveRetry) Object.assign(move, moveRetry);
      } catch {
        // Non-blocking; client still sees whatever docs exist
      }
    }
    const bucket = "move-documents";

    const docsWithUrls = await Promise.all(
      documents.map(async (d) => {
        let viewUrl = d.external_url ?? null;
        if (!viewUrl && d.storage_path) {
          const { data: signed } = await admin.storage.from(bucket).createSignedUrl(d.storage_path, 3600);
          viewUrl = signed?.signedUrl ?? null;
        }
        return {
          id: d.id,
          type: d.type,
          title: d.title,
          view_url: viewUrl,
          external_url: d.external_url,
          created_at: d.created_at,
        };
      })
    );

    const movePdfUrls = move as { move_code?: string | null; summary_pdf_url?: string | null; invoice_pdf_url?: string | null; receipt_pdf_url?: string | null } | null;
    const displayId = movePdfUrls?.move_code || `MV-${moveId.slice(0, 8).toUpperCase()}`;
    function pdfPath(type: "summary" | "invoice" | "receipt"): string {
      const name = type === "summary" ? "move-summary" : type;
      return `moves/${moveId}/${name}-${displayId}.pdf`;
    }
    function pathOrDerived(stored: string | null | undefined, type: "summary" | "invoice" | "receipt"): string {
      if (stored && !stored.startsWith("http")) return stored;
      return pdfPath(type);
    }

    const hasSummary = !!movePdfUrls?.summary_pdf_url;
    const hasInvoice = !!movePdfUrls?.invoice_pdf_url;
    const hasReceipt = !!movePdfUrls?.receipt_pdf_url;
    const [summarySigned, invoiceSigned, receiptSigned] = await Promise.all([
      hasSummary ? admin.storage.from(bucket).createSignedUrl(pathOrDerived(movePdfUrls?.summary_pdf_url, "summary"), 3600) : Promise.resolve({ data: null }),
      hasInvoice ? admin.storage.from(bucket).createSignedUrl(pathOrDerived(movePdfUrls?.invoice_pdf_url, "invoice"), 3600) : Promise.resolve({ data: null }),
      hasReceipt ? admin.storage.from(bucket).createSignedUrl(pathOrDerived(movePdfUrls?.receipt_pdf_url, "receipt"), 3600) : Promise.resolve({ data: null }),
    ]);
    // Short app URLs (proxy to signed URL); client never sees Supabase URL
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const autoDocs: { id: string; type: string; title: string; view_url: string; external_url: null; created_at: string }[] = [];
    if (summarySigned.data?.signedUrl) {
      autoDocs.push({ id: "summary-pdf", type: "document", title: `Move Summary, ${moveCode}.pdf`, view_url: `/api/track/moves/${moveId}/documents/summary${tokenParam}`, external_url: null, created_at: new Date().toISOString() });
    }
    if (invoiceSigned.data?.signedUrl) {
      autoDocs.push({ id: "invoice-pdf", type: "invoice", title: `Invoice, ${moveCode}.pdf`, view_url: `/api/track/moves/${moveId}/documents/invoice${tokenParam}`, external_url: null, created_at: new Date().toISOString() });
    }
    if (receiptSigned.data?.signedUrl) {
      autoDocs.push({ id: "receipt-pdf", type: "document", title: `Payment Receipt, ${moveCode}.pdf`, view_url: `/api/track/moves/${moveId}/documents/receipt${tokenParam}`, external_url: null, created_at: new Date().toISOString() });
    }
    const allDocuments = [...autoDocs, ...docsWithUrls];

    const squareReceiptUrl = (move as { square_receipt_url?: string | null } | null)?.square_receipt_url ?? null;

    return NextResponse.json({
      square_receipt_url: squareReceiptUrl,
      invoices: invoices.map((i) => ({
        id: i.id,
        type: "invoice",
        title: `Invoice ${i.invoice_number}`,
        amount: i.amount,
        status: i.status,
        due_date: i.due_date,
        created_at: i.created_at,
      })),
      documents: allDocuments,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
