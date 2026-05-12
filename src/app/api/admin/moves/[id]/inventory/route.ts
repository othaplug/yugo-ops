import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { inferRoomFromItem, isDeliveryServiceType, DELIVERY_ROOM_LABEL } from "@/lib/inventory-room-inference";

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
      db
        .from("moves")
        .select("client_box_count, quote_id, inventory_items, service_type, items")
        .eq("id", moveId)
        .single(),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Fallback when move_inventory is empty: materialize rows from the snapshot
    // so edit/delete always work on real DB rows.
    let effectiveItems = items ?? [];
    if (effectiveItems.length === 0 && moveRow) {
      const serviceType = String((moveRow as { service_type?: unknown }).service_type ?? "");
      const isDelivery = isDeliveryServiceType(serviceType);
      let insertRows: { move_id: string; room: string; item_name: string; box_number: string | null; sort_order: number }[] = [];

      if (isDelivery) {
        // White glove / delivery: items are in moves.items
        const wgRaw = (moveRow as { items?: unknown }).items;
        if (Array.isArray(wgRaw)) {
          insertRows = (wgRaw as Array<Record<string, unknown>>)
            .filter((it) => it && typeof it.description === "string" && (it.description as string).trim())
            .map((it, idx) => ({
              move_id: moveId,
              room: DELIVERY_ROOM_LABEL,
              item_name: String(it.description).trim(),
              box_number: null as string | null,
              sort_order: idx,
            }));
        }
      } else {
        // Residential: items are in moves.inventory_items
        const snapshot = (moveRow as { inventory_items?: unknown }).inventory_items;
        if (Array.isArray(snapshot)) {
          insertRows = (snapshot as Array<Record<string, unknown>>)
            .filter((it) => it && typeof it.name === "string" && (it.name as string).trim())
            .map((it, idx) => {
              const name = String(it.name).trim();
              const qty = typeof it.quantity === "number" && (it.quantity as number) > 1 ? (it.quantity as number) : 1;
              return {
                move_id: moveId,
                room: inferRoomFromItem(
                  typeof it.slug === "string" ? it.slug : null,
                  name,
                ),
                item_name: qty > 1 ? `${name} x${qty}` : name,
                box_number: null as string | null,
                sort_order: idx,
              };
            });
        }
      }

      if (insertRows.length > 0) {
        const { data: inserted } = await db
          .from("move_inventory")
          .insert(insertRows)
          .select("id, room, item_name, box_number, sort_order");
        if (inserted && inserted.length > 0) {
          effectiveItems = inserted;
        } else {
          effectiveItems = insertRows.map((r, idx) => ({
            id: `snapshot-${idx}`,
            room: r.room,
            item_name: r.item_name,
            box_number: r.box_number,
            sort_order: r.sort_order,
          }));
        }
      }
    }

    let boxCount =
      moveRow?.client_box_count != null && Number.isFinite(Number(moveRow.client_box_count))
        ? Math.round(Number(moveRow.client_box_count))
        : 0;
    if (
      boxCount <= 0 &&
      moveRow?.quote_id &&
      typeof moveRow.quote_id === "string"
    ) {
      const { data: qRow } = await db
        .from("quotes")
        .select("client_box_count")
        .eq("id", moveRow.quote_id)
        .maybeSingle();
      const qb = qRow?.client_box_count;
      if (qb != null && Number.isFinite(Number(qb)) && Number(qb) > 0) {
        boxCount = Math.round(Number(qb));
      }
    }

    return NextResponse.json({ items: effectiveItems, boxCount });
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
