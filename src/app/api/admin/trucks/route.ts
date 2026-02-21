import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { getSuperAdminEmail } from "@/lib/super-admin";

/** GET: List trucks (admin only) */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail() || platformUser?.role === "admin" || platformUser?.role === "manager";
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin.from("trucks").select("id, name, created_at").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

/** POST: Create truck (admin only) */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail() || platformUser?.role === "admin" || platformUser?.role === "manager";
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const name = (body.name || "").toString().trim();
    if (!name) return NextResponse.json({ error: "Truck name required" }, { status: 400 });

    const admin = createAdminClient();
    const { data: inserted, error } = await admin
      .from("trucks")
      .insert({ name })
      .select("id, name, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(inserted);
  } catch (e) {
    console.error("[trucks] error:", e);
    return NextResponse.json({ error: "Failed to create truck" }, { status: 500 });
  }
}
