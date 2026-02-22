import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Require authenticated partner; returns org_id for filtering. */
export async function requirePartner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { orgId: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!partnerUser) {
    return { orgId: null, error: NextResponse.json({ error: "Not a partner" }, { status: 403 }) };
  }

  return { orgId: partnerUser.org_id, error: null };
}
