import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const { id: orgId } = await params;
    const admin = createAdminClient();

    const { data: partnerUsers } = await admin
      .from("partner_users")
      .select("user_id")
      .eq("org_id", orgId);

    const userIds = (partnerUsers ?? []).map((p) => p.user_id).filter(Boolean);
    if (userIds.length === 0) return NextResponse.json([]);

    const { data: { users: authUsers } } = await admin.auth.admin.listUsers();
    const authMap = new Map(
      (authUsers ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? "",
          name: (u.user_metadata?.full_name as string) || (u.email?.split("@")[0] ?? ""),
          last_sign_in_at: u.last_sign_in_at ?? null,
        },
      ])
    );

    const list = Array.from(userIds).map((uid) => {
      const auth = authMap.get(uid);
      return {
        user_id: uid,
        email: auth?.email ?? "",
        name: auth?.name ?? "",
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        status: auth?.last_sign_in_at ? "activated" : "pending",
      };
    });

    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list portal users" },
      { status: 500 }
    );
  }
}
