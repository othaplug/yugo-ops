import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

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
    const [invRes, docRes] = await Promise.all([
      admin.from("invoices").select("id, invoice_number, amount, status, due_date, created_at, client_name").eq("move_id", moveId).order("created_at", { ascending: false }),
      admin.from("move_documents").select("id, type, title, storage_path, external_url, created_at").eq("move_id", moveId).order("created_at", { ascending: false }),
    ]);

    const invoices = invRes.data ?? [];
    const documents = docRes.data ?? [];
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
      documents: docsWithUrls,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
