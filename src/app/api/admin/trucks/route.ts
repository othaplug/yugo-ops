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

/** PATCH: Update truck (admin only) */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail() || platformUser?.role === "admin" || platformUser?.role === "manager";
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const id = (body.id || body.truckId || "").toString().trim();
    const name = (body.name || "").toString().trim();
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Truck name required" }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.from("trucks").update({ name }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[trucks] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update truck" }, { status: 500 });
  }
}

/** DELETE: Remove truck (admin only) */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail() || platformUser?.role === "admin" || platformUser?.role === "manager";
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });

    const admin = createAdminClient();
    const { error } = await admin.from("trucks").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[trucks] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete truck" }, { status: 500 });
  }
}
