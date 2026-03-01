import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function POST(req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data: org } = await supabase
      .from("organizations")
      .select("name, type")
      .eq("id", orgId!)
      .single();

    const customerName = (body.customer_name || "").trim();
    const deliveryAddress = (body.delivery_address || "").trim();
    const scheduledDate = (body.scheduled_date || "").trim();

    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!deliveryAddress) return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
    if (!scheduledDate) return NextResponse.json({ error: "Date is required" }, { status: 400 });

    const deliveryNumber = `PJ${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;
    const itemsRaw = (body.items || "").trim();
    const items = itemsRaw ? itemsRaw.split("\n").filter((i: string) => i.trim()) : [];

    const { data: created, error: dbError } = await supabase
      .from("deliveries")
      .insert({
        delivery_number: deliveryNumber,
        organization_id: orgId,
        client_name: org?.name || "",
        customer_name: customerName,
        customer_email: (body.customer_email || "").trim() || null,
        pickup_address: (body.pickup_address || "").trim() || null,
        delivery_address: deliveryAddress,
        scheduled_date: scheduledDate,
        time_slot: (body.time_slot || "").trim() || null,
        items,
        instructions: (body.instructions || "").trim() || null,
        special_handling: !!body.special_handling,
        status: "scheduled",
        category: org?.type || "retail",
      })
      .select("id, delivery_number")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ ok: true, delivery: created });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create delivery" },
      { status: 500 }
    );
  }
}
