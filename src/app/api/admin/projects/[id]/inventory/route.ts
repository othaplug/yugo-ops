import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createPartnerNotification } from "@/lib/notifications";
import {
  deriveHandledByFromDeliveryMethod,
  getLegacyStatusFromProjectItemStatus,
  getProjectItemStatus,
  getProjectItemStatusFromLegacy,
  getProjectItemStatusLabel,
  isValidProjectItemStatus,
  type ProjectItemStatus,
} from "@/lib/project-item-status";

function trimOrNull(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEventTypeForStatus(status: ProjectItemStatus) {
  const eventTypes: Partial<Record<ProjectItemStatus, string>> = {
    ready_for_pickup: "item_ready",
    received_warehouse: "item_received",
    delivered: "item_delivered",
    installed: "item_installed",
    issue_reported: "issue_flagged",
  };
  return eventTypes[status] || "item_status_changed";
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();
  const itemName = typeof body.item_name === "string" ? body.item_name.trim() : "";
  if (!itemName) {
    return NextResponse.json({ error: "item_name is required" }, { status: 400 });
  }

  const itemStatus = isValidProjectItemStatus(body.item_status)
    ? body.item_status
    : getProjectItemStatusFromLegacy(body.status);
  const vendorName = trimOrNull(body.vendor_name ?? body.vendor);
  const vendorDeliveryMethod = trimOrNull(body.vendor_delivery_method) || "yugo_pickup";
  const handledBy =
    typeof body.handled_by === "string" && body.handled_by
      ? body.handled_by
      : deriveHandledByFromDeliveryMethod(vendorDeliveryMethod);

  const { data, error } = await db
    .from("project_inventory")
    .insert({
      project_id: id,
      phase_id: body.phase_id || null,
      item_name: itemName,
      description: trimOrNull(body.description),
      vendor: vendorName,
      vendor_name: vendorName,
      vendor_contact_name: trimOrNull(body.vendor_contact_name),
      vendor_contact_phone: trimOrNull(body.vendor_contact_phone),
      vendor_contact_email: trimOrNull(body.vendor_contact_email),
      vendor_order_number: trimOrNull(body.vendor_order_number),
      vendor_pickup_address: trimOrNull(body.vendor_pickup_address),
      vendor_pickup_window: trimOrNull(body.vendor_pickup_window),
      vendor_delivery_method: vendorDeliveryMethod,
      quantity: numberOrNull(body.quantity) || 1,
      item_status: itemStatus,
      status: getLegacyStatusFromProjectItemStatus(itemStatus),
      status_updated_at: new Date().toISOString(),
      status_notes: trimOrNull(body.status_notes),
      room_destination: trimOrNull(body.room_destination),
      item_value: numberOrNull(body.item_value),
      item_dimensions: trimOrNull(body.item_dimensions),
      requires_crating: body.requires_crating ?? false,
      requires_assembly: body.requires_assembly ?? false,
      special_handling_notes: trimOrNull(body.special_handling_notes),
      storage_location: trimOrNull(body.storage_location),
      handled_by: handledBy,
      vendor_carrier: trimOrNull(body.vendor_carrier),
      vendor_tracking_number: trimOrNull(body.vendor_tracking_number),
      expected_delivery_date: body.expected_delivery_date || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("project_timeline").insert({
    project_id: id,
    event_type: "item_added",
    event_description: `${itemName} added${vendorName ? ` (${vendorName})` : ""}${data.room_destination ? ` - ${data.room_destination}` : ""}`,
    phase_id: data.phase_id,
  });

  // Notify partner/designer that admin added an item
  try {
    const { data: proj } = await db.from("projects").select("partner_id, project_name, project_number").eq("id", id).single();
    if (proj?.partner_id) {
      const projectRef = proj.project_number ? `${proj.project_number} · ${proj.project_name}` : proj.project_name;
      await createPartnerNotification({
        orgId: proj.partner_id,
        title: `Item added to your project`,
        body: `${itemName}${vendorName ? ` (${vendorName})` : ""} was added to ${projectRef}`,
        icon: "package",
        link: `/partner/projects/${id}`,
      });
    }
  } catch {
    // Non-fatal
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  if (!body.item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const { data: existing, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name, phase_id, item_status, status, handled_by")
    .eq("id", body.item_id)
    .eq("project_id", id)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const textFields = [
    "description",
    "vendor_contact_name",
    "vendor_contact_phone",
    "vendor_contact_email",
    "vendor_order_number",
    "vendor_pickup_address",
    "vendor_pickup_window",
    "status_notes",
    "room_destination",
    "item_dimensions",
    "special_handling_notes",
    "received_by",
    "condition_on_receipt",
    "inspection_notes",
    "storage_location",
    "vendor_tracking_number",
    "vendor_carrier",
  ] as const;
  for (const key of textFields) {
    if (key in body) updates[key] = trimOrNull(body[key]);
  }

  if ("item_name" in body && typeof body.item_name === "string" && body.item_name.trim()) {
    updates.item_name = body.item_name.trim();
  }
  if ("phase_id" in body) updates.phase_id = body.phase_id || null;
  if ("photo_urls" in body) updates.photo_urls = body.photo_urls || null;
  if ("expected_delivery_date" in body) updates.expected_delivery_date = body.expected_delivery_date || null;
  if ("received_date" in body) updates.received_date = body.received_date || null;
  if ("delivered_date" in body) updates.delivered_date = body.delivered_date || null;
  if ("quantity" in body) updates.quantity = numberOrNull(body.quantity) || 1;
  if ("item_value" in body) updates.item_value = numberOrNull(body.item_value);
  if ("requires_crating" in body) updates.requires_crating = Boolean(body.requires_crating);
  if ("requires_assembly" in body) updates.requires_assembly = Boolean(body.requires_assembly);

  if ("vendor_delivery_method" in body) {
    const deliveryMethod = trimOrNull(body.vendor_delivery_method);
    updates.vendor_delivery_method = deliveryMethod;
    if (!("handled_by" in body)) {
      updates.handled_by = deliveryMethod
        ? deriveHandledByFromDeliveryMethod(deliveryMethod)
        : existing.handled_by || "yugo";
    }
  }
  if ("handled_by" in body) {
    updates.handled_by = body.handled_by || null;
  }

  if ("vendor_name" in body || "vendor" in body) {
    const vendorName = trimOrNull(body.vendor_name ?? body.vendor);
    updates.vendor_name = vendorName;
    updates.vendor = vendorName;
  }

  let nextStatus: ProjectItemStatus | null = null;
  if ("item_status" in body) {
    if (!isValidProjectItemStatus(body.item_status)) {
      return NextResponse.json({ error: "Invalid item_status" }, { status: 400 });
    }
    nextStatus = body.item_status;
  } else if ("status" in body) {
    nextStatus = getProjectItemStatusFromLegacy(body.status);
  }

  if (nextStatus) {
    updates.item_status = nextStatus;
    updates.status = getLegacyStatusFromProjectItemStatus(nextStatus);
    updates.status_updated_at = new Date().toISOString();
    if (!("received_date" in body) && nextStatus === "received_warehouse") {
      updates.received_date = new Date().toISOString().slice(0, 10);
    }
    if (!("delivered_date" in body) && nextStatus === "delivered") {
      updates.delivered_date = new Date().toISOString().slice(0, 10);
    }
  }

  const { data, error } = await db.from("project_inventory").update(updates).eq("id", body.item_id).eq("project_id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const previousStatus = getProjectItemStatus(existing);
  if (nextStatus && nextStatus !== previousStatus) {
    try {
      await db.from("project_status_log").insert({
        project_id: id,
        item_id: body.item_id,
        old_status: previousStatus,
        new_status: nextStatus,
        changed_by: user?.email || "admin",
        notes: data.status_notes || null,
      });
    } catch {
      // Non-fatal history write.
    }

    try {
      await db.from("project_timeline").insert({
        project_id: id,
        event_type: getEventTypeForStatus(nextStatus),
        event_description: `${data.item_name} - ${getProjectItemStatusLabel(nextStatus)}${data.status_notes ? `: ${data.status_notes}` : ""}`,
        phase_id: data.phase_id,
      });
    } catch {
      // Non-fatal timeline write.
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();
  if (!body.item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const { data: existing, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name")
    .eq("id", body.item_id)
    .eq("project_id", id)
    .single();
  if (fetchErr || !existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const { error: deleteErr } = await db
    .from("project_inventory")
    .delete()
    .eq("id", body.item_id)
    .eq("project_id", id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  await db.from("project_timeline").insert({
    project_id: id,
    event_type: "item_removed",
    event_description: `${existing.item_name} removed`,
  });

  return NextResponse.json({ ok: true });
}
