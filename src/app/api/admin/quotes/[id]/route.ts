import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * DELETE /api/admin/quotes/[id]
 * Soft-delete or hard-delete a quote by its UUID (quotes.id).
 * Only draft quotes should be deletable; sent/accepted may be restricted.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Quote ID required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error: fetchErr } = await admin
    .from("quotes")
    .select("id, status, quote_id")
    .eq("id", id)
    .single();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const status = (quote.status as string) || "";
  if (status !== "draft") {
    return NextResponse.json(
      { error: "Only draft quotes can be deleted. Sent or accepted quotes must be cancelled or superseded." },
      { status: 400 }
    );
  }

  const { error: deleteErr } = await admin.from("quotes").delete().eq("id", id);

  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message || "Failed to delete quote" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
