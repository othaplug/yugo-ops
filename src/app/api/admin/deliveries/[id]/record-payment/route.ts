import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";

/**
 * Marks B2B one-off delivery as paid and issues tracking links (idempotent).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: d, error: fetchErr } = await admin
    .from("deliveries")
    .select("id, booking_type, organization_id, status, payment_received_at")
    .eq("id", id)
    .single();

  if (fetchErr || !d) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (d.booking_type !== "one_off" || d.organization_id) {
    return NextResponse.json({ error: "Only B2B one-off deliveries use this action" }, { status: 400 });
  }

  const now = new Date().toISOString();

  await admin
    .from("deliveries")
    .update({
      payment_received_at: d.payment_received_at || now,
      updated_at: now,
    })
    .eq("id", id);

  try {
    await issueDeliveryTrackingTokens(id);
    await sendB2BTrackingNotifications(id);
  } catch (e) {
    console.error("[record-payment] tracking tokens:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to issue tracking" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
