import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: delivery } = await supabase
    .from("deliveries")
    .select("id, organization_id, status")
    .eq("id", id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (delivery.organization_id !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const locked = ["delivered", "completed", "cancelled"].includes((delivery.status || "").toLowerCase());
  if (locked) return NextResponse.json({ error: "Cannot edit a delivery that is already " + delivery.status }, { status: 400 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  const allowed = [
    "customer_name", "customer_email", "customer_phone",
    "pickup_address", "delivery_address", "scheduled_date",
    "time_slot", "delivery_window", "items", "instructions",
    "special_handling",
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

  return NextResponse.json({ ok: true });
}
