import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { resolveDeliveryUuidFromApiPathSegment } from "@/lib/delivery-resolve-id";
import { runAdminMarkDeliveryPaidFlow } from "@/lib/b2b-delivery-payment";

/**
 * Marks B2B-style delivery as prepaid (offline / before creation) and issues tracking links (idempotent).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const rawSegment = (await params).id?.trim() || "";
  const fallbackNumber = req.nextUrl.searchParams.get("number")?.trim() || "";
  const admin = createAdminClient();
  let id = await resolveDeliveryUuidFromApiPathSegment(admin, rawSegment);
  if (!id && fallbackNumber) {
    id = await resolveDeliveryUuidFromApiPathSegment(admin, fallbackNumber);
  }

  if (!id) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const { data: d, error: fetchErr } = await admin.from("deliveries").select("id").eq("id", id).single();

  if (fetchErr || !d) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  try {
    await runAdminMarkDeliveryPaidFlow(id, { notifyMode: "always" });
  } catch (e) {
    console.error("[record-payment] tracking tokens:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to issue tracking" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
