import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Revoke partner portal access: remove from partner_users, clear org primary if needed, delete auth user.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const { id: orgId } = await params;
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id required" }, { status: 400 });

    const admin = createAdminClient();

    const { error: deleteLinkError } = await admin
      .from("partner_users")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", user_id);
    if (deleteLinkError) return NextResponse.json({ error: deleteLinkError.message }, { status: 500 });

    await admin
      .from("organizations")
      .update({ user_id: null })
      .eq("id", orgId)
      .eq("user_id", user_id);

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(user_id);
    if (deleteAuthError) {
      return NextResponse.json(
        { error: deleteAuthError.message || "Failed to delete auth user" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to revoke" },
      { status: 500 }
    );
  }
}
