import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Delivery ID required" }, { status: 400 });
  }

  const body = await req.json();
  const admin = createAdminClient();

  const allowedFields = [
    "customer_name", "customer_email", "customer_phone",
    "delivery_address", "pickup_address",
    "scheduled_date", "time_slot", "delivery_window",
    "instructions", "items", "quoted_price", "total_price", "status",
    "special_handling", "organization_id", "client_name",
    "crew_id", "updated_at", "pickup_access", "delivery_access",
    "admin_adjusted_price", "notes",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("deliveries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update delivery" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, delivery: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Delivery ID required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: delivery, error: fetchErr } = await admin
    .from("deliveries")
    .select("id, status, delivery_number")
    .eq("id", id)
    .single();

  if (fetchErr || !delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const status = ((delivery.status as string) || "").toLowerCase();
  if (status === "delivered" || status === "completed") {
    return NextResponse.json(
      { error: "Completed deliveries cannot be deleted." },
      { status: 400 },
    );
  }

  const { error: deleteErr } = await admin
    .from("deliveries")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message || "Failed to delete delivery" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
