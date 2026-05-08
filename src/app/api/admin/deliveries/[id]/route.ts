import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createPartnerNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";
import { collectB2BDeliveryCalibrationData } from "@/lib/learning/engine";
import { syncDealStageByDeliveryId } from "@/lib/hubspot/sync-deal-stage";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import { triggerDeliveryGCalSync } from "@/lib/google-calendar/sync-utils";

const STATUS_NOTIFICATIONS: Record<string, { title: (label: string) => string; icon: string }> = {
  confirmed: { title: (l) => `Delivery confirmed: ${l}`, icon: "check" },
  dispatched: { title: (l) => `Crew dispatched for: ${l}`, icon: "truck" },
  in_transit: { title: (l) => `Delivery in transit: ${l}`, icon: "truck" },
  completed: { title: (l) => `Delivery completed: ${l}`, icon: "check" },
  delivered: { title: (l) => `Delivery completed: ${l}`, icon: "check" },
  cancelled: { title: (l) => `Delivery cancelled: ${l}`, icon: "x" },
};

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

  const { data: existing } = await admin
    .from("deliveries")
    .select("status, stage, crew_id, organization_id, delivery_number, customer_name")
    .eq("id", id)
    .single();

  const IN_PROGRESS = [
    "en_route",
    "en_route_to_pickup",
    "arrived_at_pickup",
    "loading",
    "en_route_to_destination",
    "arrived_at_destination",
    "unloading",
    "in_progress",
    "dispatched",
    "in_transit",
  ];
  const norm = (s: string | null) => (s || "").toLowerCase().replace(/-/g, "_");
  const isInProgress =
    IN_PROGRESS.includes(norm(existing?.status)) || IN_PROGRESS.includes(norm(existing?.stage));

  if (isInProgress && "crew_id" in body && body.crew_id !== existing?.crew_id) {
    return NextResponse.json(
      { error: "Cannot reassign: job is in progress. Reassignment is only allowed before the crew has started." },
      { status: 400 }
    );
  }

  const allowedFields = [
    "customer_name", "customer_email", "customer_phone",
    "delivery_address", "pickup_address",
    "scheduled_date", "time_slot", "delivery_window",
    "instructions", "items", "quoted_price", "total_price", "status",
    "special_handling", "organization_id", "client_name",
    "crew_id", "updated_at", "pickup_access", "delivery_access", "item_weight_category",
    "admin_adjusted_price", "notes",
    "project_id", "phase_id",
    "vertical_code", "b2b_line_items", "b2b_assembly_required", "b2b_debris_removal",
    "calculated_price", "override_price", "override_reason",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if ("override_price" in body && body.override_price != null && Number(body.override_price) !== 0) {
    const r = typeof body.override_reason === "string" ? body.override_reason.trim() : "";
    if (!r) {
      return NextResponse.json(
        { error: "override_reason is required when override_price is set" },
        { status: 400 },
      );
    }
    updates.override_reason = r;
  }

  if ("crew_id" in body) {
    const raw = body.crew_id;
    const cid =
      raw === null || raw === undefined || (typeof raw === "string" && !raw.trim())
        ? null
        : String(raw).trim();
    if (cid) {
      const snap = await fetchCrewAssignmentSnapshot(admin, cid);
      const roster = new Set(snap.assigned_members);
      updates.crew_id = cid;
      updates.assigned_crew_name = snap.assigned_crew_name;
      if (Array.isArray(body.assigned_members) && body.assigned_members.length > 0) {
        const picked = body.assigned_members
          .filter(
            (m: unknown): m is string =>
              typeof m === "string" && m.trim().length > 0 && roster.has(m.trim()),
          )
          .map((m: string) => m.trim());
        const deduped = [...new Set(picked)];
        if (deduped.length === 0) {
          return NextResponse.json(
            { error: "Select at least one crew member from this team" },
            { status: 400 },
          );
        }
        updates.assigned_members = deduped;
      } else {
        updates.assigned_members = snap.assigned_members;
      }
    } else {
      updates.crew_id = null;
      updates.assigned_members = [];
      updates.assigned_crew_name = null;
    }
  } else if ("assigned_members" in body) {
    const cidExisting = existing?.crew_id;
    if (!cidExisting) {
      return NextResponse.json(
        { error: "Assign a crew before selecting members" },
        { status: 400 },
      );
    }
    const snap = await fetchCrewAssignmentSnapshot(admin, cidExisting);
    const roster = new Set(snap.assigned_members);
    const raw = body.assigned_members;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "assigned_members must be an array" },
        { status: 400 },
      );
    }
    const picked = raw
      .filter(
        (m: unknown): m is string =>
          typeof m === "string" && m.trim().length > 0 && roster.has(m.trim()),
      )
      .map((m: string) => m.trim());
    const deduped = [...new Set(picked)];
    if (deduped.length === 0) {
      return NextResponse.json(
        { error: "Select at least one crew member from this team" },
        { status: 400 },
      );
    }
    updates.assigned_members = deduped;
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

  if ("status" in updates && data?.status && data.status !== existing?.status) {
    syncDealStageByDeliveryId(id, String(data.status)).catch(() => {});
  }

  if ("override_price" in updates && updates.override_price != null) {
    const label = data?.delivery_number || existing?.delivery_number || id;
    logActivity({
      entity_type: "delivery",
      entity_id: id,
      event_type: "price_override",
      description: `Price override set to $${updates.override_price} for delivery ${label}. Reason: ${updates.override_reason || "—"}`,
      icon: "dollar",
    }).catch(() => {});
  }

  // Send partner notification if status changed
  const newStatus = (body.status || "").toLowerCase();
  const oldStatus = (existing?.status || "").toLowerCase();
  const orgId = data?.organization_id || existing?.organization_id;
  if (newStatus && newStatus !== oldStatus && orgId && STATUS_NOTIFICATIONS[newStatus]) {
    const notifConfig = STATUS_NOTIFICATIONS[newStatus];
    const label = data?.customer_name || data?.delivery_number || existing?.customer_name || existing?.delivery_number || "your delivery";
    createPartnerNotification({
      orgId,
      title: notifConfig.title(label),
      icon: notifConfig.icon,
      link: `/partner`,
      deliveryId: id,
    }).catch(() => {});
  }

  // Auto-update project inventory items when delivery is completed
  if (
    (newStatus === "completed" || newStatus === "delivered") &&
    newStatus !== oldStatus &&
    data?.project_id
  ) {
    const projectId = data.project_id;
    const phaseId = data.phase_id;

    // Find yugo-handled items in this project that are scheduled for delivery
    const { data: scheduledItems } = await admin
      .from("project_inventory")
      .select("id, item_name, phase_id")
      .eq("project_id", projectId)
      .eq("handled_by", "yugo")
      .in("item_status", ["scheduled_delivery", "stored", "inspected"]);

    const itemsToUpdate = (scheduledItems || []).filter(
      (item) => !phaseId || item.phase_id === phaseId || item.phase_id === null
    );

    if (itemsToUpdate.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      await admin
        .from("project_inventory")
        .update({
          item_status: "delivered",
          status: "delivered",
          delivered_date: today,
          status_updated_at: new Date().toISOString(),
          status_notes: `Auto-updated: delivery ${data.delivery_number || id} completed`,
        })
        .in("id", itemsToUpdate.map((i) => i.id));

      // Log to project_status_log
      const logRows = itemsToUpdate.map((item) => ({
        project_id: projectId,
        item_id: item.id,
        old_status: "scheduled_delivery",
        new_status: "delivered",
        changed_by: "system",
        notes: `Delivery ${data.delivery_number || id} completed`,
      }));
      try { await admin.from("project_status_log").insert(logRows); } catch { /* non-fatal */ }

      // Timeline entry
      try {
        await admin
          .from("project_timeline")
          .insert({
            project_id: projectId,
            event_type: "item_delivered",
            event_description: `${itemsToUpdate.length} item${itemsToUpdate.length > 1 ? "s" : ""} delivered, delivery ${data.delivery_number || id} completed`,
            phase_id: phaseId || null,
          });
      } catch { /* non-fatal */ }
    }
  }

  if (
    (newStatus === "completed" || newStatus === "delivered") &&
    newStatus !== oldStatus
  ) {
    collectB2BDeliveryCalibrationData(id).catch((e) =>
      console.error("[deliveries/patch] B2B calibration collect failed:", e),
    );
    notifyJobCompletedForCrewProfiles(admin, { jobType: "delivery", jobId: id }).catch((e) =>
      console.error("[crew-profile] admin delivery complete:", e),
    );
  }

  await ensureB2bDeliverySchedule(admin, id).catch((e) =>
    console.error("[deliveries/patch] ensureB2bDeliverySchedule:", e),
  );

  // GCal sync whenever scheduling-relevant fields change
  const schedulingKeys = ["scheduled_date", "time_slot", "status", "crew_id", "from_address", "to_address", "pickup_address", "delivery_address"];
  if (schedulingKeys.some((k) => k in updates)) {
    triggerDeliveryGCalSync(id);
  }

  const { data: refreshed } = await admin.from("deliveries").select("*").eq("id", id).single();

  return NextResponse.json({ ok: true, delivery: refreshed ?? data });
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

  await admin.from("proof_of_delivery").delete().eq("delivery_id", id);
  await admin.from("invoices").update({ delivery_id: null }).eq("delivery_id", id);

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
