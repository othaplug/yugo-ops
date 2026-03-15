import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { generatePostMoveDocuments } from "@/lib/post-move-documents";

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
      .select("id, status, move_code, summary_pdf_url, invoice_pdf_url, receipt_pdf_url")
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
    if (isCompleted && documents.length === 0) {
      await generatePostMoveDocuments(moveId);
      const [invRetry, docRetry] = await Promise.all([
        admin.from("invoices").select("id, invoice_number, amount, status, due_date, created_at, client_name").eq("move_id", moveId).order("created_at", { ascending: false }),
        admin.from("move_documents").select("id, type, title, storage_path, external_url, created_at").eq("move_id", moveId).order("created_at", { ascending: false }),
      ]);
      invoices = invRetry.data ?? [];
      documents = docRetry.data ?? [];
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

    const movePdfUrls = move as { summary_pdf_url?: string | null; invoice_pdf_url?: string | null; receipt_pdf_url?: string | null } | null;
    const autoDocs: { id: string; type: string; title: string; view_url: string; external_url: null; created_at: string }[] = [];
    if (movePdfUrls?.summary_pdf_url) {
      autoDocs.push({
        id: "summary-pdf",
        type: "document",
        title: `Move Summary — ${moveCode}.pdf`,
        view_url: movePdfUrls.summary_pdf_url,
        external_url: null,
        created_at: new Date().toISOString(),
      });
    }
    if (movePdfUrls?.invoice_pdf_url) {
      autoDocs.push({
        id: "invoice-pdf",
        type: "invoice",
        title: `Invoice — ${moveCode}.pdf`,
        view_url: movePdfUrls.invoice_pdf_url,
        external_url: null,
        created_at: new Date().toISOString(),
      });
    }
    if (movePdfUrls?.receipt_pdf_url) {
      autoDocs.push({
        id: "receipt-pdf",
        type: "document",
        title: `Payment Receipt — ${moveCode}.pdf`,
        view_url: movePdfUrls.receipt_pdf_url,
        external_url: null,
        created_at: new Date().toISOString(),
      });
    }
    const allDocuments = [...autoDocs, ...docsWithUrls];

    return NextResponse.json({
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
