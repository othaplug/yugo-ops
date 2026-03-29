import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail, requireStaff } from "@/lib/api-auth";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";

/**
 * DELETE /api/admin/quotes/[id]
 * Hard-delete by UUID (quotes.id). Staff: drafts only. Superadmin: also sent/viewed/expired/declined/superseded.
 * Never deletes accepted quotes or any quote linked to a move.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireStaff();
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
  const superAdmin = isSuperAdminEmail(user?.email);

  if (!quoteStatusAllowsHardDelete(status, superAdmin)) {
    const msg = superAdmin
      ? "This quote cannot be deleted (e.g. accepted or unknown status)."
      : "Only draft quotes can be deleted. Superadmin can remove sent quotes that are not accepted.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: moveRow } = await admin.from("moves").select("id").eq("quote_id", id).maybeSingle();
  if (moveRow) {
    return NextResponse.json(
      { error: "Cannot delete a quote that has a linked move. Remove or reassign the move first." },
      { status: 400 },
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
