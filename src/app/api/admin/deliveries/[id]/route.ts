import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createPartnerNotification } from "@/lib/notifications";

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
