import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

const PDF_DOC_TYPES = ["summary", "invoice", "receipt"] as const;

/**
 * GET: Short-URL proxy when docId is "summary" | "invoice" | "receipt" — redirect to signed PDF.
 * Requires ?token= for track auth. Client never sees Supabase URL.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const { id: moveId, docId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  if (!PDF_DOC_TYPES.includes(docId as (typeof PDF_DOC_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
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
