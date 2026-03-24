import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const orgId = partnerRows?.[0]?.org_id;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("inbound_shipments")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shipments: rows || [] });
}
