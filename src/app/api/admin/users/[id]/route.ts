import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).single();
  if (!platformUser || platformUser.role !== "admin") return { error: "Admin only", status: 403 as const };
  return { user, admin: createAdminClient() };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const check = await requireAdmin();
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    const { admin } = check;
    const { id } = await params;

    if (id === check.user!.id) {
      return NextResponse.json({ error: "Cannot edit your own user" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.role === "string" && body.role === "dispatcher") updates.role = "dispatcher";

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await admin.from("platform_users").update({ ...updates, updated_at: new Date().toISOString() }).eq("user_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (typeof body.name === "string") {
      await admin.auth.admin.updateUserById(id, { user_metadata: { full_name: body.name.trim() } });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const check = await requireAdmin();
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    const { admin } = check;
    const { id } = await params;

    if (id === check.user!.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
