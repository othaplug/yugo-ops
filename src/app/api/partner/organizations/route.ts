import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createAdminClient();

    const { data: partnerRows, error: partnerErr } = await db
      .from("partner_users")
      .select("org_id")
      .eq("user_id", user.id);

    if (partnerErr || !partnerRows?.length) {
      return NextResponse.json({ organizations: [] });
    }

    const orgIds = [...new Set(partnerRows.map((r) => r.org_id))];

    const { data: orgs } = await db
      .from("organizations")
      .select("id, name, type")
      .in("id", orgIds);

    return NextResponse.json({ organizations: orgs ?? [] });
  } catch (err: unknown) {
    console.error("partner/organizations error:", err);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}
