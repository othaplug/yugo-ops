import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isSuperAdminEmail } from "@/lib/api-auth";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const admin = createAdminClient();

    const { data: platformUsers, error: puError } = await admin.from("platform_users").select("user_id, email, name, role, created_at");
    if (puError) console.error("[admin/users] platform_users:", puError);
    const platformMap = new Map<string, { email: string; name: string | null; role: string; created_at: string | null }>();
    for (const p of platformUsers ?? []) {
      platformMap.set(p.user_id, { email: p.email, name: p.name, role: p.role, created_at: p.created_at });
    }

    const { data: pendingInvs } = await admin.from("invitations").select("id, email, name, role, created_at").eq("status", "pending");
    const pendingList = (pendingInvs ?? []).map((inv) => ({
      id: `inv-${inv.id}`,
      user_id: null as string | null,
      email: inv.email,
      name: inv.name,
      role: inv.role || "dispatcher",
      created_at: inv.created_at,
      last_sign_in_at: null as string | null,
      status: "pending" as const,
    }));

    const { data: { users: authUsers }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) console.error("[admin/users] auth listUsers:", listErr);
    const authMap = new Map<string, { last_sign_in_at: string | null; email: string }>();
    for (const u of authUsers ?? []) {
      authMap.set(u.id, { last_sign_in_at: u.last_sign_in_at ?? null, email: u.email ?? "" });
    }

    const list: Array<{
      id: string;
      user_id: string | null;
      email: string;
      name: string | null;
      role: string;
      created_at: string | null;
      last_sign_in_at: string | null;
      status: "activated" | "pending" | "inactive";
      move_id?: string | null;
    }> = [];

    // Internal team only: exclude partner users and client role
    const { data: partnerUsers } = await admin.from("partner_users").select("user_id");
    const partnerUserIds = new Set((partnerUsers ?? []).map((p) => p.user_id));

    for (const p of platformUsers ?? []) {
      if (p.role === "client") continue; // Clients use magic-link tracking, not user management
      if (partnerUserIds.has(p.user_id)) continue; // Partner users managed per-partner, not here
      const auth = authMap.get(p.user_id);
      list.push({
        id: p.user_id,
        user_id: p.user_id,
        email: p.email,
        name: p.name,
        role: p.role,
        created_at: p.created_at,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        status: auth?.last_sign_in_at ? "activated" : "pending",
      });
    }

    // Auth users not in platform_users (e.g. partners) are excluded — managed per-partner

    const existingEmails = new Set(list.map((u) => u.email?.toLowerCase()));
    for (const inv of pendingList) {
      if (!existingEmails.has(inv.email?.toLowerCase())) {
        list.push(inv);
      }
    }

    // Partner org users are NOT included — they are managed per-partner on partner detail pages

    list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    // Exclude superadmin from the list — they are a fixed system account, not a manageable user
    const filtered = list.filter((u) => !isSuperAdminEmail(u.email));
    return NextResponse.json(filtered);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list users" },
      { status: 500 }
    );
  }
}
