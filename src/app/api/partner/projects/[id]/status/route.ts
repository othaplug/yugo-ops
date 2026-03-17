import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { notifyAllAdmins } from "@/lib/notifications";

const VALID_STATUSES = [
  "spec_selected",
  "ordered",
  "in_production",
  "ready_for_pickup",
  "shipped",
  "in_transit",
  "received_warehouse",
  "inspected",
  "stored",
  "scheduled_delivery",
  "delivered",
  "installed",
  "issue_reported",
];

const STATUS_LABELS: Record<string, string> = {
  spec_selected: "Spec'd",
  ordered: "Ordered",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  shipped: "Shipped",
  in_transit: "In Transit",
  received_warehouse: "Received at Warehouse",
  inspected: "Inspected",
  stored: "Stored",
  scheduled_delivery: "Delivery Scheduled",
  delivered: "Delivered",
  installed: "Installed",
  issue_reported: "Issue Reported",
};

/**
 * POST /api/partner/projects/[id]/status
 * Update an item's item_status, log to project_status_log, and notify admins.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  // Verify partner owns this project
  const { data: project } = await db
    .from("projects")
    .select("id, project_name, site_address")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { item_id, item_status, notes } = body;

  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!item_status || !VALID_STATUSES.includes(item_status)) {
    return NextResponse.json({ error: "Invalid item_status" }, { status: 400 });
  }

  // Fetch current item
  const { data: item, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name, item_status, phase_id, vendor_name, vendor, vendor_delivery_method, vendor_pickup_address, handled_by")
    .eq("id", item_id)
    .eq("project_id", projectId)
    .single();

  if (fetchErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const oldStatus = item.item_status || "ordered";

  // Update item
  const legacyStatusMap: Record<string, string> = {
    received_warehouse: "received",
    inspected: "inspected",
    stored: "stored",
    scheduled_delivery: "scheduled_for_delivery",
    delivered: "delivered",
    installed: "installed",
  };

  const updatePayload: Record<string, unknown> = {
    item_status,
    status_updated_at: new Date().toISOString(),
    status_notes: notes || null,
  };
  if (legacyStatusMap[item_status]) {
    updatePayload.status = legacyStatusMap[item_status];
  }
  if (item_status === "received_warehouse") {
    updatePayload.received_date = new Date().toISOString().slice(0, 10);
  }
  if (item_status === "delivered") {
    updatePayload.delivered_date = new Date().toISOString().slice(0, 10);
  }

  const { data: updated, error: updateErr } = await db
    .from("project_inventory")
    .update(updatePayload)
    .eq("id", item_id)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Log to project_status_log
  await db.from("project_status_log").insert({
    project_id: projectId,
    item_id,
    old_status: oldStatus,
    new_status: item_status,
    changed_by: "partner",
    notes: notes || null,
  });

  // Timeline event
  const timelineEvents: Record<string, string> = {
    received_warehouse: "item_received",
    delivered: "item_delivered",
    issue_reported: "issue_flagged",
    ready_for_pickup: "item_ready",
    installed: "item_installed",
  };
  const eventType = timelineEvents[item_status] || "item_status_changed";
  await db.from("project_timeline").insert({
    project_id: projectId,
    event_type: eventType,
    event_description: `${item.item_name} → ${STATUS_LABELS[item_status]}${notes ? `: ${notes}` : ""}`,
    phase_id: item.phase_id,
  });

  // Notify admins on key status changes
  const notifyAdminStatuses = ["ready_for_pickup", "issue_reported", "received_warehouse"];
  if (notifyAdminStatuses.includes(item_status)) {
    const vendorLabel = item.vendor_name || item.vendor || "vendor";
    await notifyAllAdmins({
      title: `Project item: ${STATUS_LABELS[item_status]}`,
      body: `${item.item_name} (${vendorLabel}) — ${project.project_name}`,
      icon: item_status === "issue_reported" ? "alert" : "projects",
      link: `/admin/projects/${projectId}`,
      sourceType: "project",
      sourceId: projectId,
      eventSlug: "partner_project_created",
    });
  }

  return NextResponse.json({
    ...updated,
    should_schedule:
      item_status === "ready_for_pickup" &&
      (item.vendor_delivery_method === "yugo_pickup" ||
        (!item.vendor_delivery_method && (item.handled_by || "yugo") === "yugo")),
  });
}
