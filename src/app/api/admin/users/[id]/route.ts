import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const isSuperAdmin = (user.email || "").toLowerCase() === "othaplug@gmail.com";
  if (!isSuperAdmin) return { error: "Superadmin only", status: 403 as const };
  return { user, admin: createAdminClient() };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const check = await requireSuperAdmin();
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    const { admin } = check;
    const { id } = await params;

    if (id === check.user!.id) {
      return NextResponse.json({ error: "Cannot edit your own user" }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.role === "string" && ["admin", "manager", "dispatcher"].includes(body.role)) updates.role = body.role;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (id.startsWith("inv-")) {
      const invId = id.replace("inv-", "");
      const { error } = await admin.from("invitations").update(updates).eq("id", invId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (id.startsWith("partner-")) {
      return NextResponse.json({ error: "Edit partners from Clients page" }, { status: 400 });
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
    const check = await requireSuperAdmin();
    if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });
    const { admin } = check;
    const { id } = await params;

    if (id === check.user!.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    if (id.startsWith("inv-")) {
      const invId = id.replace("inv-", "");
      const { error } = await admin.from("invitations").delete().eq("id", invId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (id.startsWith("partner-")) {
      return NextResponse.json({ error: "Delete partners from Clients page" }, { status: 400 });
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
