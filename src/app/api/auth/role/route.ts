import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { NextResponse } from "next/server";

/** Login history is recorded from POST /api/auth/audit-login and /auth/callback, not here. */

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ role: null });
    }

    const email = (user.email || "").trim().toLowerCase();
    const admin = createAdminClient();

    if (isSuperAdminEmail(user.email)) {
      return NextResponse.json({ role: "admin" });
    }

    // platform_users: role = access (client → client portal; admin/manager/dispatcher → admin)
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (platformUser) {
      const role = platformUser.role || "";

      if (role === "client") return NextResponse.json({ role: "client" });
      if (["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales"].includes(role)) {
        return NextResponse.json({ role: "admin" });
      }
    }

    // No staff role — check if partner
    const { data: partnerRows } = await admin
      .from("partner_users")
      .select("user_id")
      .eq("user_id", user.id)
      .limit(1);
    if (partnerRows && partnerRows.length > 0) return NextResponse.json({ role: "partner" });

    // Last resort — check if move client by email
    const { data: move } = await supabase
      .from("moves")
      .select("id")
      .ilike("client_email", email)
      .limit(1)
      .maybeSingle();
    if (move) return NextResponse.json({ role: "client" });

    return NextResponse.json({ role: null });
  } catch {
    // Never let an unexpected error surface as 404 — degrade gracefully
    return NextResponse.json({ role: null });
  }
}
