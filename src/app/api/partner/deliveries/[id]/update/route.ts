import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const supabase = await createClient();

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, organization_id, status")
    .eq("id", id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!delivery.organization_id || !orgIds.includes(delivery.organization_id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const locked = ["delivered", "completed", "cancelled"].includes((delivery.status || "").toLowerCase());
  if (locked) return NextResponse.json({ error: "Cannot edit a delivery that is already " + delivery.status }, { status: 400 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  const allowed = [
    "customer_name", "customer_email", "customer_phone",
    "pickup_address", "delivery_address", "scheduled_date",
    "time_slot", "delivery_window", "scheduled_start", "scheduled_end",
    "items", "instructions", "special_handling",
  ];

  for (const f of allowed) {
    if (f in body) updates[f] = body[f];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error: dbError } = await supabase
    .from("deliveries")
    .update(updates)
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const serviceAdmin = createAdminClient();
  await ensureB2bDeliverySchedule(serviceAdmin, id).catch((e) =>
    console.error("[partner/deliveries/update] ensureB2bDeliverySchedule:", e),
  );

  return NextResponse.json({ ok: true });
}
