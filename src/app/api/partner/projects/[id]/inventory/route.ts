import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** POST: Add a new inventory item to the project */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (!body.item_name?.trim()) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const { data: item, error: insertErr } = await db
    .from("project_inventory")
    .insert({
      project_id: projectId,
      phase_id: body.phase_id || null,
      item_name: body.item_name.trim(),
      // Vendor info
      vendor: body.vendor_name?.trim() || body.vendor?.trim() || null,
      vendor_name: body.vendor_name?.trim() || body.vendor?.trim() || null,
      vendor_contact_name: body.vendor_contact_name?.trim() || null,
      vendor_contact_phone: body.vendor_contact_phone?.trim() || null,
      vendor_contact_email: body.vendor_contact_email?.trim() || null,
      vendor_order_number: body.vendor_order_number?.trim() || null,
      vendor_pickup_address: body.vendor_pickup_address?.trim() || null,
      vendor_pickup_window: body.vendor_pickup_window?.trim() || null,
      vendor_delivery_method: body.vendor_delivery_method || "yugo_pickup",
      // Delivery handler — derive from delivery method if not explicit
      handled_by:
        body.handled_by ||
        (body.vendor_delivery_method === "yugo_pickup" ? "yugo" : "vendor_direct"),
      // Item details
      quantity: Number(body.quantity) || 1,
      item_status: body.item_status || "ordered",
      status: "expected",
      status_updated_at: new Date().toISOString(),
      status_notes: body.status_notes || null,
      room_destination: body.room_destination?.trim() || null,
      item_value: body.item_value ? Number(body.item_value) : null,
      item_dimensions: body.item_dimensions?.trim() || null,
      requires_crating: body.requires_crating ?? false,
      requires_assembly: body.requires_assembly ?? false,
      special_handling_notes: body.special_handling_notes?.trim() || null,
      // Legacy fields
      description: body.description?.trim() || null,
      vendor_carrier: body.vendor_carrier?.trim() || null,
      vendor_tracking_number: body.vendor_tracking_number?.trim() || null,
      expected_delivery_date: body.expected_delivery_date || null,
    })
    .select()
    .single();

  if (insertErr || !item) {
    return NextResponse.json({ error: insertErr?.message || "Failed to add item" }, { status: 500 });
  }

  await db.from("project_timeline").insert({
    project_id: projectId,
    event_type: "item_added",
    event_description: `${body.item_name.trim()} added${body.vendor_name ? ` (${body.vendor_name})` : ""}${body.room_destination ? `, ${body.room_destination}` : ""}`,
    phase_id: body.phase_id || null,
  });

  return NextResponse.json(item, { status: 201 });
}

/** PATCH: Update an inventory item.
 *  Partners can update item_status for any item.
 *  Vendor-specific fields (tracking, carrier, etc.) can only be updated for
 *  non-Yugo items.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (!body.item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const { data: existing, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name, phase_id, handled_by, item_status")
    .eq("id", body.item_id)
    .eq("project_id", projectId)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};

  // Any item can have status + notes updated
  if ("item_status" in body) {
    updates.item_status = body.item_status;
    updates.status_updated_at = new Date().toISOString();
  }
  if ("status_notes" in body) updates.status_notes = body.status_notes;

  // Vendor-specific fields (non-Yugo items only)
  const handledBy = existing.handled_by || "yugo";
  if (handledBy !== "yugo") {
    const vendorKeys = [
      "vendor_tracking_number",
      "vendor_carrier",
      "expected_delivery_date",
      "received_date",
      "delivered_date",
      "inspection_notes",
      "condition_on_receipt",
    ];
    for (const key of vendorKeys) {
      if (key in body) updates[key] = body[key];
    }
    // Legacy status sync
    if ("item_status" in body) {
      const legacyMap: Record<string, string> = {
        received_warehouse: "received",
        inspected: "inspected",
        stored: "stored",
        scheduled_delivery: "scheduled_for_delivery",
        delivered: "delivered",
        installed: "installed",
      };
      if (legacyMap[body.item_status]) {
        updates.status = legacyMap[body.item_status];
      }
    }
  }

  const { data, error: updateErr } = await db
    .from("project_inventory")
    .update(updates)
    .eq("id", body.item_id)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Timeline event on key status changes
  if ("item_status" in body) {
    const timelineEvents: Record<string, string> = {
      received_warehouse: "item_received",
      delivered: "item_delivered",
      issue_reported: "issue_flagged",
    };
    const eventType = timelineEvents[body.item_status];
    if (eventType) {
      await db.from("project_timeline").insert({
        project_id: projectId,
        event_type: eventType,
        event_description: `${existing.item_name}, ${body.item_status.replace(/_/g, " ")}${body.status_notes ? `: ${body.status_notes}` : ""}`,
        phase_id: existing.phase_id,
      });
    }
  }

  return NextResponse.json(data);
}
