import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { createPartnerNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data: delivery } = await db
    .from("deliveries")
    .select("id, organization_id, delivery_number, customer_name")
    .eq("id", id)
    .single();

  const { error } = await db
    .from("deliveries")
    .update({
      status: "cancelled",
      admin_notes: body.reason || "Rejected by admin",
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (delivery?.organization_id) {
    const label = delivery.customer_name || delivery.delivery_number || "your delivery";
    const reason = body.reason ? ` Reason: ${body.reason}` : "";
    await createPartnerNotification({
      orgId: delivery.organization_id,
      title: `Delivery declined: ${label}`,
      body: `Your delivery request was not approved.${reason}`,
      icon: "x",
      link: `/partner`,
      deliveryId: delivery.id,
    });
  }

  return NextResponse.json({ ok: true });
}
