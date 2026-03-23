import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const db = createAdminClient();
    const { data: platformUser } = await db
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = isSuperAdminEmail(user!.email);
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const [{ data: items, error }, { data: moveRow }] = await Promise.all([
      db
        .from("move_inventory")
        .select("id, room, item_name, box_number, sort_order")
        .eq("move_id", moveId)
        .order("room")
        .order("sort_order")
        .order("item_name"),
      db.from("moves").select("client_box_count").eq("id", moveId).single(),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: items ?? [], boxCount: moveRow?.client_box_count ?? 0 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const db = createAdminClient();
    const { data: platformUser } = await db
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = isSuperAdminEmail(user!.email);
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json();
    const room = (body.room || "").trim() || "Other";
    const itemName = (body.item_name || "").trim();
    const boxNumber = (body.box_number || "").trim() || null;
    const sortOrder = typeof body.sort_order === "number" ? body.sort_order : 0;

    if (!itemName) return NextResponse.json({ error: "Item name required" }, { status: 400 });

    const { data: item, error } = await db
      .from("move_inventory")
      .insert({
        move_id: moveId,
        room,
        item_name: itemName,
        box_number: boxNumber,
        sort_order: sortOrder,
      })
      .select("id, room, item_name, box_number")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add item" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const db = createAdminClient();
    const { data: platformUser } = await db
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = isSuperAdminEmail(user!.email);
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    if (typeof body.box_count === "number") {
      const boxCount = Math.max(0, Math.round(body.box_count));
      const { error } = await db
        .from("moves")
        .update({ client_box_count: boxCount, updated_at: new Date().toISOString() })
        .eq("id", moveId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ boxCount });
    }

    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update inventory" },
      { status: 500 }
    );
  }
}
