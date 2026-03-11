import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";

/** GET: List trucks (admin only) */
export async function GET() {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const db = createAdminClient();
  const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user.id).maybeSingle();
  const isAdmin = isSuperAdminEmail(user.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await db.from("trucks").select("id, name, phone, created_at").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

/** POST: Create truck (admin only) */
export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const db = createAdminClient();
    const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user!.id).maybeSingle();
    const isAdmin = isSuperAdminEmail(user!.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const name = (body.name || "").toString().trim();
    if (!name) return NextResponse.json({ error: "Truck name required" }, { status: 400 });

    const { data: inserted, error } = await db
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
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const db = createAdminClient();
    const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user!.id).maybeSingle();
    const isAdmin = isSuperAdminEmail(user!.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const id = (body.id || body.truckId || "").toString().trim();
    const name = (body.name || "").toString().trim();
    const phone = typeof body.phone === "string" ? body.phone.trim() || null : undefined;
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });
    const updates: { name?: string; phone?: string | null } = {};
    if (name !== undefined && name !== "") updates.name = name;
    if (phone !== undefined) updates.phone = phone;
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No updates (name or phone)" }, { status: 400 });
    const { data, error } = await db.from("trucks").update(updates).eq("id", id).select().single();
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
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;

    const db = createAdminClient();
    const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user!.id).maybeSingle();
    const isAdmin = isSuperAdminEmail(user!.email) || ["owner", "admin", "manager"].includes(platformUser?.role || "");
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "Truck id required" }, { status: 400 });

    const { error } = await db.from("trucks").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[trucks] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete truck" }, { status: 500 });
  }
}
