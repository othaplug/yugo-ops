import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

import { getSuperAdminEmail } from "@/lib/super-admin";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = (user!.email || "").toLowerCase() === getSuperAdminEmail();
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = isSuperAdmin ? createAdminClient() : supabase;
    const { data: items, error } = await db
      .from("move_inventory")
      .select("id, room, item_name, box_number, sort_order")
      .eq("move_id", moveId)
      .order("room")
      .order("sort_order")
      .order("item_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: items ?? [] });
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
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    const isSuperAdmin = (user!.email || "").toLowerCase() === getSuperAdminEmail();
    if (!platformUser && !isSuperAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = isSuperAdmin ? createAdminClient() : supabase;
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
