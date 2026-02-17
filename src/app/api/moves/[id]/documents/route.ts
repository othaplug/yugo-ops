import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    const { data: move } = await supabase
      .from("moves")
      .select("id, client_email, client_name")
      .eq("id", moveId)
      .ilike("client_email", email)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const [invByMove, invByClient, docRes] = await Promise.all([
      supabase.from("invoices").select("id, invoice_number, amount, status, due_date, created_at, client_name").eq("move_id", moveId).order("created_at", { ascending: false }),
      move.client_name
        ? supabase.from("invoices").select("id, invoice_number, amount, status, due_date, created_at, client_name").ilike("client_name", move.client_name).order("created_at", { ascending: false })
        : { data: [] as any[] },
      supabase.from("move_documents").select("id, type, title, storage_path, external_url, created_at").eq("move_id", moveId).order("created_at", { ascending: false }),
    ]);

    const seen = new Set<string>();
    const invoices = [...(invByMove.data ?? []), ...(invByClient.data ?? [])]
      .filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const documents = docRes.data ?? [];
    const bucket = "move-documents";

    const docsWithUrls = await Promise.all(
      documents.map(async (d) => {
        let viewUrl = d.external_url ?? null;
        if (!viewUrl && d.storage_path) {
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(d.storage_path, 3600);
          viewUrl = signed?.signedUrl ?? null;
        }
        return {
          id: d.id,
          type: d.type,
          title: d.title,
          view_url: viewUrl,
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
