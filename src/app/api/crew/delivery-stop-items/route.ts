import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyAllAdmins } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const ITEM_STATUSES = new Set([
  "pending",
  "picked_up",
  "loaded",
  "delivered",
  "damaged",
  "missing",
]);

/** PATCH — update checklist item on a delivery stop (crew-owned job). */
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    item_id,
    delivery_id,
    status,
    notes,
    photo_url,
  } = body as {
    item_id?: string;
    delivery_id?: string;
    status?: string;
    notes?: string;
    photo_url?: string | null;
  };

  if (!item_id || !delivery_id || !status) {
    return NextResponse.json(
      { error: "item_id, delivery_id, and status are required" },
      { status: 400 },
    );
  }
  if (!ITEM_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, crew_id, delivery_number, client_name")
    .eq("id", delivery_id)
    .single();

  if (!delivery || delivery.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: itemRow } = await admin
    .from("delivery_stop_items")
    .select("id, stop_id, description")
    .eq("id", item_id)
    .single();

  if (!itemRow) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { data: stopRow } = await admin
    .from("delivery_stops")
    .select("id, delivery_id")
    .eq("id", itemRow.stop_id)
    .single();

  if (!stopRow || stopRow.delivery_id !== delivery_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status,
    notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    photo_url:
      typeof photo_url === "string" && photo_url.trim() ? photo_url.trim() : null,
    checked_by: payload.name || null,
    checked_at: now,
  };

  if (status === "damaged" || status === "missing") {
    if (!updates.notes) {
      return NextResponse.json(
        { error: "Note is required for damaged or missing items" },
        { status: 400 },
      );
    }
    if (!updates.photo_url) {
      return NextResponse.json(
        { error: "Photo is required for damaged or missing items" },
        { status: 400 },
      );
    }
  }

  const { error } = await admin
    .from("delivery_stop_items")
    .update(updates)
    .eq("id", item_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "damaged" || status === "missing") {
    const label = status === "damaged" ? "Damaged" : "Missing";
    const desc = String(updates.notes || "");
    void notifyAllAdmins({
      title: `B2B item ${label}: ${String(itemRow.description || "Item")}`,
      body: `${label} at stop · ${desc.slice(0, 280)}`,
      icon: "warning",
      sourceType: "delivery",
      sourceId: delivery_id,
      link: `/admin/deliveries/${(delivery as { delivery_number?: string | null }).delivery_number ?? delivery_id}`,
      eventSlug: "b2b_stop_item_issue",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
