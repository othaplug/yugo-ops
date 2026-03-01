import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, type, contact_name, email, phone, created_at, user_id")
      .not("type", "eq", "b2c")
      .order("name");

    if (!orgs || orgs.length === 0) return NextResponse.json({ partners: [] });

    const orgIds = orgs.map((o) => o.id);
    const { data: allPartnerUsers } = await admin
      .from("partner_users")
      .select("user_id, org_id")
      .in("org_id", orgIds);

    const userIds = [...new Set((allPartnerUsers ?? []).map((p) => p.user_id).filter(Boolean))];

    let authMap = new Map<string, { email: string; name: string; last_sign_in_at: string | null }>();
    if (userIds.length > 0) {
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers();
      authMap = new Map(
        (authUsers ?? []).map((u) => [
          u.id,
          {
            email: u.email ?? "",
            name: (u.user_metadata?.full_name as string) || "",
            last_sign_in_at: u.last_sign_in_at ?? null,
          },
        ])
      );
    }

    const puByOrg: Record<string, { user_id: string; email: string; name: string; status: string; last_sign_in_at: string | null }[]> = {};
    (allPartnerUsers ?? []).forEach((pu) => {
      if (!puByOrg[pu.org_id]) puByOrg[pu.org_id] = [];
      const auth = authMap.get(pu.user_id);
      puByOrg[pu.org_id].push({
        user_id: pu.user_id,
        email: auth?.email ?? "",
        name: auth?.name ?? "",
        status: auth?.last_sign_in_at ? "activated" : "pending",
        last_sign_in_at: auth?.last_sign_in_at ?? null,
      });
    });

    const [{ count: deliveriesCount }, { count: movesCount }] = await Promise.all([
      supabase.from("deliveries").select("organization_id", { count: "exact", head: true }).in("organization_id", orgIds),
      supabase.from("moves").select("organization_id", { count: "exact", head: true }).in("organization_id", orgIds),
    ]);

    const partners = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      type: org.type,
      contact_name: org.contact_name,
      email: org.email,
      phone: org.phone,
      created_at: org.created_at,
      portal_users: puByOrg[org.id] || [],
      has_portal_access: (puByOrg[org.id] || []).length > 0,
    }));

    return NextResponse.json({
      partners,
      totalOrgs: orgs.length,
      totalPortalUsers: userIds.length,
      totalDeliveries: deliveriesCount ?? 0,
      totalMoves: movesCount ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list partners" },
      { status: 500 }
    );
  }
}
