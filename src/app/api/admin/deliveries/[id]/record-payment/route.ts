import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { resolveDeliveryUuidFromApiPathSegment } from "@/lib/delivery-resolve-id";
import { runB2BOneOffPaymentRecordedFlow } from "@/lib/b2b-delivery-payment";

/**
 * Marks B2B one-off delivery as paid and issues tracking links (idempotent).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const rawSegment = (await params).id?.trim() || "";
  const admin = createAdminClient();
  const id = await resolveDeliveryUuidFromApiPathSegment(admin, rawSegment);

  if (!id) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

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

  try {
    await runB2BOneOffPaymentRecordedFlow(id, { notifyMode: "always" });
  } catch (e) {
    console.error("[record-payment] tracking tokens:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to issue tracking" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
