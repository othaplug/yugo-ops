import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!platformUser || platformUser.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Use platform_users as source of truth — includes admin, invited, and activated users
    const { data: platformUsers } = await admin.from("platform_users").select("user_id, email, name, role, created_at");
    if (!platformUsers?.length) {
      return NextResponse.json([]);
    }

    // Fetch auth users for last_sign_in_at
    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authMap = new Map<string, { last_sign_in_at: string | null }>();
    for (const u of authUsers ?? []) {
      authMap.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null });
    }

    const list = platformUsers
      .map((p) => {
        const auth = authMap.get(p.user_id);
        const lastSignIn = auth?.last_sign_in_at ?? null;
        return {
          id: p.user_id,
          user_id: p.user_id,
          email: p.email,
          name: p.name,
          role: p.role,
          created_at: p.created_at,
          last_sign_in_at: lastSignIn,
          status: lastSignIn ? "activated" : "pending",
        };
      })
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    return NextResponse.json(list);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list users" },
      { status: 500 }
    );
  }
}
