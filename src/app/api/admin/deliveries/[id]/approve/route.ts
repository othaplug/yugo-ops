import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { createPartnerNotification } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { notifyPartnerDeliveryBooked } from "@/lib/partner-job-comms";
import { ensureB2bDeliverySchedule } from "@/lib/calendar/ensure-b2b-delivery-schedule";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr, user } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data: delivery } = await db
    .from("deliveries")
    .select("id, status, organization_id, delivery_number, customer_name")
    .eq("id", id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (delivery.status !== "pending_approval" && delivery.status !== "pending") {
    return NextResponse.json({ error: "Delivery is not pending approval" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    status: "confirmed",
    approved_by: user?.id,
    approved_at: new Date().toISOString(),
  };

  if (body.adjusted_price != null) {
    update.admin_adjusted_price = body.adjusted_price;
    update.total_price = body.adjusted_price;
  }
  if (body.admin_notes) update.admin_notes = body.admin_notes;
  if (body.vehicle_type) update.vehicle_type = body.vehicle_type;

  const { error } = await db.from("deliveries").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (delivery.organization_id) {
    const label = delivery.customer_name || delivery.delivery_number || "your delivery";
    await createPartnerNotification({
      orgId: delivery.organization_id,
      title: `Delivery approved: ${label}`,
      body: "Your delivery request has been confirmed by the Yugo team.",
      icon: "check",
      link: `/partner`,
      deliveryId: delivery.id,
    });
  }

  await logActivity({
    entity_type: "delivery",
    entity_id: id,
    event_type: "approved",
    description: `Delivery approved: ${delivery.customer_name || delivery.delivery_number}`,
    icon: "check",
  });

  notifyPartnerDeliveryBooked(id).catch(() => {});

  await ensureB2bDeliverySchedule(db, id).catch((e) =>
    console.error("[deliveries/approve] ensureB2bDeliverySchedule:", e),
  );

  return NextResponse.json({ ok: true });
}
