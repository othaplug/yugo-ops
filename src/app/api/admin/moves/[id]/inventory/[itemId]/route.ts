import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "othaplug@gmail.com";
const STATUSES = ["not_packed", "packed", "in_transit", "delivered"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, itemId } = await params;
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = (user!.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = isSuperAdmin ? createAdminClient() : supabase;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.room !== undefined) updates.room = (body.room || "").trim() || "Other";
    if (body.item_name !== undefined) updates.item_name = (body.item_name || "").trim();
    if (body.status !== undefined) updates.status = STATUSES.includes(body.status) ? body.status : "not_packed";
    if (body.box_number !== undefined) updates.box_number = (body.box_number || "").trim() || null;
    if (typeof body.sort_order === "number") updates.sort_order = body.sort_order;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: item, error } = await db
      .from("move_inventory")
      .update(updates)
      .eq("id", itemId)
      .eq("move_id", moveId)
      .select("id, room, item_name, status, box_number")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId, itemId } = await params;
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = (user!.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = isSuperAdmin ? createAdminClient() : supabase;
    const { error } = await db
      .from("move_inventory")
      .delete()
      .eq("id", itemId)
      .eq("move_id", moveId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete item" },
      { status: 500 }
    );
  }
}
