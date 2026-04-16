import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** Resolve auth profile for partner portal user ids. Avoids listUsers() (single page + fragile destructuring). */
async function buildAuthMapForUserIds(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
): Promise<Map<string, { email: string; name: string; last_sign_in_at: string | null }>> {
  const authMap = new Map<string, { email: string; name: string; last_sign_in_at: string | null }>();
  const chunkSize = 30;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (uid) => {
        const { data, error } = await admin.auth.admin.getUserById(uid);
        if (error || !data?.user) return null;
        const u = data.user;
        return {
          uid,
          info: {
            email: u.email ?? "",
            name: (u.user_metadata?.full_name as string) || "",
            last_sign_in_at: u.last_sign_in_at ?? null,
          },
        };
      })
    );
    for (const r of results) {
      if (r) authMap.set(r.uid, r.info);
    }
  }
  return authMap;
}

export async function GET() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const admin = createAdminClient();

    // Use admin client so RLS doesn't hide B2B orgs from staff (session client would return 0 rows)
    const { data: orgs, error: orgsError } = await admin
      .from("organizations")
      .select("id, name, type, vertical, contact_name, email, phone, created_at, user_id")
      .not("type", "eq", "b2c")
      .order("name");

    if (orgsError) return NextResponse.json({ error: orgsError.message }, { status: 400 });
    const visibleOrgs = (orgs || []).filter((o) => !(o.name || "").startsWith("_"));
    if (visibleOrgs.length === 0) return NextResponse.json({ partners: [] });

    const orgIds = visibleOrgs.map((o) => o.id);
    const { data: allPartnerUsers } = await admin
      .from("partner_users")
      .select("user_id, org_id")
      .in("org_id", orgIds);

    const userIds = [...new Set((allPartnerUsers ?? []).map((p) => p.user_id).filter(Boolean))];

    const authMap =
      userIds.length > 0 ? await buildAuthMapForUserIds(admin, userIds) : new Map();

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
      admin.from("deliveries").select("organization_id", { count: "exact", head: true }).in("organization_id", orgIds),
      admin.from("moves").select("organization_id", { count: "exact", head: true }).in("organization_id", orgIds),
    ]);

    const partners = visibleOrgs.map((org) => ({
      id: org.id,
      name: org.name,
      type: org.vertical || org.type,
      contact_name: org.contact_name,
      email: org.email,
      phone: org.phone,
      status: "active",
      created_at: org.created_at,
      portal_users: puByOrg[org.id] || [],
      has_portal_access: (puByOrg[org.id] || []).length > 0,
    }));

    return NextResponse.json({
      partners,
      totalOrgs: visibleOrgs.length,
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
