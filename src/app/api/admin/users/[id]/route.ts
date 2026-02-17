import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

async function requireSuperAdmin() {
  const { user, error } = await requireAdmin();
  if (error) {
    const body = await error.json();
    return { error: body.error || "Forbidden", status: error.status as 401 | 403 };
  }
  return { user: user!, admin: createAdminClient() };
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
    if (typeof body.role === "string" && ["admin", "manager", "dispatcher", "coordinator", "viewer", "client"].includes(body.role)) updates.role = body.role;

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

    const { data: existingRow } = await admin.from("platform_users").select("user_id, email").eq("user_id", id).maybeSingle();

    // Role can only be changed for users from User management; move clients and partners are locked.
    if (typeof body.role === "string") {
      let email: string | null = existingRow?.email ? (existingRow.email as string).trim().toLowerCase() : null;
      if (!email) {
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(id);
        if (!authErr && authUser?.user?.email) email = (authUser.user.email || "").trim().toLowerCase();
      }
      if (email) {
        const { data: move } = await admin.from("moves").select("id").ilike("client_email", email).limit(1).maybeSingle();
        if (move) {
          return NextResponse.json({ error: "Role cannot be changed for move clients. Manage them from the move or Clients page." }, { status: 400 });
        }
      }
    }

    const updatedAt = new Date().toISOString();

    const finalRole = typeof updates.role === "string" ? updates.role : undefined;

    if (existingRow) {
      const { error } = await admin.from("platform_users").update({ ...updates, updated_at: updatedAt }).eq("user_id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(id);
      if (authErr || !authUser?.user?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const email = (authUser.user.email || "").trim().toLowerCase();
      const name = (updates.name as string) ?? (authUser.user.user_metadata?.full_name as string) ?? null;
      const role = (updates.role as string) ?? "dispatcher";
      const { error: insertErr } = await admin.from("platform_users").insert({
        user_id: id,
        email,
        name,
        role,
      });
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    if (typeof body.name === "string") {
      await admin.auth.admin.updateUserById(id, { user_metadata: { full_name: body.name.trim() } });
    }

    return NextResponse.json({ ok: true, ...(finalRole && { role: finalRole }) });
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

    await admin.from("platform_users").delete().eq("user_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
