import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** DELETE: Remove referral from database. Clears referral_id on any quotes that used it (FK ON DELETE SET NULL). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Referral ID required" }, { status: 400 });

  const db = createAdminClient();

  const { error } = await db.from("client_referrals").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
