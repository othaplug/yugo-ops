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
    }> = [];

    for (const p of platformUsers ?? []) {
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

    const { data: partnerUsers } = await admin.from("partner_users").select("user_id");
    const partnerUserIds = new Set((partnerUsers ?? []).map((p) => p.user_id));

    for (const [authId, authData] of authMap) {
      if (platformMap.has(authId)) continue;
      if (pendingList.some((inv) => inv.email?.toLowerCase() === authData.email?.toLowerCase())) continue;
      const isSuperAdminUser = isSuperAdminEmail(authData.email);
      const isPartner = !isSuperAdminUser && partnerUserIds.has(authId);
      list.push({
        id: authId,
        user_id: authId,
        email: authData.email,
        name: null,
        role: isSuperAdminUser ? "superadmin" : isPartner ? "partner" : "dispatcher",
        created_at: null,
        last_sign_in_at: authData.last_sign_in_at,
        status: authData.last_sign_in_at ? "activated" : "inactive",
      });
    }

    const existingEmails = new Set(list.map((u) => u.email?.toLowerCase()));
    for (const inv of pendingList) {
      if (!existingEmails.has(inv.email?.toLowerCase())) {
        list.push(inv);
      }
    }

    const { data: partnerOrgs } = await admin.from("organizations").select("id, name, contact_name, email, user_id, created_at").not("user_id", "is", null);
    for (const org of partnerOrgs ?? []) {
      const authData = authMap.get(org.user_id);
      if (isSuperAdminEmail(authData?.email)) continue;
      if (list.some((u) => u.user_id === org.user_id || u.email?.toLowerCase() === (org.email || "").toLowerCase())) continue;
      list.push({
        id: `partner-${org.id}`,
        user_id: org.user_id,
        email: org.email || "",
        name: org.contact_name || org.name,
        role: "partner",
        created_at: org.created_at,
        last_sign_in_at: authData?.last_sign_in_at ?? null,
        status: authData?.last_sign_in_at ? "activated" : "pending",
      });
    }

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
