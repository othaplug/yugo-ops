import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { normalizeDeliveryItem } from "@/lib/delivery-items";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ items: [] });

  const { jobId } = await params;
  const jobType = req.nextUrl.searchParams.get("jobType") || "move";
  const admin = createAdminClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  if (jobType === "move") {
    let moveId = jobId;
    if (!isUuid) {
      const { data: move } = await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).maybeSingle();
      moveId = move?.id || jobId;
    }
    const { data: inventory } = await admin
      .from("move_inventory")
      .select("name, room, quantity")
      .eq("move_id", moveId);

    const items = (inventory || []).map((i) => {
      const qty = i.quantity > 1 ? ` (×${i.quantity})` : "";
      const room = i.room ? `, ${i.room}` : "";
      return `${i.name}${qty}${room}`;
    });

    return NextResponse.json({ items });
  }

  // Delivery — parse items from the deliveries table
  let deliveryId = jobId;
  if (!isUuid) {
    const { data: delivery } = await admin.from("deliveries").select("id").ilike("delivery_number", jobId).maybeSingle();
    deliveryId = delivery?.id || jobId;
  }

  const { data: delivery } = await admin
    .from("deliveries")
    .select("items, stops_detail")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!delivery) return NextResponse.json({ items: [] });

  const items: string[] = [];

  if (Array.isArray(delivery.items)) {
    for (const raw of delivery.items) {
      const { name, qty } = normalizeDeliveryItem(raw);
      if (!name) continue;
      items.push(qty > 1 ? `${name} (×${qty})` : name);
    }
  }

  if (Array.isArray(delivery.stops_detail)) {
    for (const stop of delivery.stops_detail) {
      if (stop && Array.isArray((stop as Record<string, unknown>).items)) {
        for (const item of (stop as { items: { name: string; quantity?: number }[] }).items) {
          const qty = item.quantity && item.quantity > 1 ? ` (×${item.quantity})` : "";
          items.push(`${item.name}${qty}`);
        }
      }
    }
  }

  return NextResponse.json({ items });
}
