import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Require authenticated partner; returns all linked org IDs and a primary (first) for writes. */
export async function requirePartner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { orgIds: [], primaryOrgId: null, userId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: partnerRows, error: partnerError } = await supabase
    .from("partner_users")
    .select("org_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (partnerError) {
    console.error("requirePartner partner_users query failed", partnerError);
    return {
      orgIds: [],
      primaryOrgId: null,
      userId: null,
      error: NextResponse.json(
        { error: "Partner lookup failed", detail: partnerError.message, code: partnerError.code },
        { status: 403 }
      ),
    };
  }

  const orgIds = (partnerRows ?? []).map((r) => r.org_id).filter(Boolean);

  if (orgIds.length === 0) {
    return {
      orgIds: [],
      primaryOrgId: null,
      userId: null,
      error: NextResponse.json(
        { error: "Not a partner", detail: "No organization linked to this account. Contact support." },
        { status: 403 }
      ),
    };
  }

  return { orgIds, primaryOrgId: orgIds[0], userId: user.id, error: null };
}
