import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data, error } = await db
    .from("project_inventory")
    .insert({
      project_id: id,
      phase_id: body.phase_id || null,
      item_name: body.item_name,
      description: body.description || null,
      vendor: body.vendor || null,
      quantity: body.quantity || 1,
      status: body.status || "expected",
      storage_location: body.storage_location || null,
      handled_by: body.handled_by || "yugo",
      vendor_carrier: body.vendor_carrier || null,
      vendor_tracking_number: body.vendor_tracking_number || null,
      expected_delivery_date: body.expected_delivery_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  if (!body.item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ["item_name", "description", "vendor", "quantity", "phase_id", "received_date", "received_by", "condition_on_receipt", "inspection_notes", "photo_urls", "storage_location", "status", "delivered_date", "handled_by", "vendor_tracking_number", "vendor_carrier", "expected_delivery_date"]) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db.from("project_inventory").update(updates).eq("id", body.item_id).eq("project_id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Timeline entry for status changes
  const handledBy = data.handled_by || "yugo";
  const isVendorItem = handledBy !== "yugo";
  if (body.status === "received" || body.status === "inspected") {
    await db.from("project_timeline").insert({
      project_id: id,
      event_type: body.status === "received" ? "item_received" : "item_inspected",
      event_description: `${data.item_name} — ${body.status}${body.condition_on_receipt ? ` (${body.condition_on_receipt})` : ""}`,
      phase_id: data.phase_id,
    });
  }
  if (isVendorItem && body.status === "delivered") {
    await db.from("project_timeline").insert({
      project_id: id,
      event_type: "item_delivered",
      event_description: `${data.item_name} — delivered`,
      phase_id: data.phase_id,
    });
  }

  return NextResponse.json(data);
}
