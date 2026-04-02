import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { sendSMS } from "@/lib/sms/sendSMS";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MISSING_BIN_FEE = 20;

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off Scheduled",
  bins_delivered: "Bins Delivered",
  in_use: "In Use",
  pickup_scheduled: "Pickup Scheduled",
  bins_collected: "Bins Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

// ── GET /api/bin-orders/[id] ──

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bin_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// ── PATCH /api/bin-orders/[id] — update status, complete drop-off/pickup ──

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const body = await req.json();
  const { action, ...rest } = body as { action?: string; [key: string]: unknown };

  const { data: order, error: fetchErr } = await supabase
    .from("bin_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // ── Action: complete_dropoff ──
  if (action === "complete_dropoff") {
    const { crewName, photos } = rest as { crewName?: string; photos?: string[] };

    await supabase
      .from("bin_orders")
      .update({
        status: "bins_delivered",
        drop_off_completed_at: new Date().toISOString(),
        drop_off_crew: crewName || null,
        drop_off_photos: photos || [],
      })
      .eq("id", id);

    if (order.client_phone) {
      const pickupDate = new Date(order.pickup_date);
      const pickupLabel = pickupDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      sendSMS(
        order.client_phone,
        [
          `Hi,`,
          `Your Yugo bins have been delivered. Start packing.`,
          `We pick up on ${pickupLabel}.`,
          `Questions? (647) 370-4525`,
        ].join("\n\n"),
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, status: "bins_delivered" });
  }

  // ── Action: complete_pickup ──
  if (action === "complete_pickup") {
    const { crewName, photos, binsReturned } = rest as {
      crewName?: string; photos?: string[]; binsReturned: number;
    };

    const binsMissing = Math.max(0, order.bin_count - (binsReturned ?? order.bin_count));
    const missingCharge = binsMissing * MISSING_BIN_FEE;

    const updatePayload: Record<string, unknown> = {
      status: "completed",
      pickup_completed_at: new Date().toISOString(),
      pickup_crew: crewName || null,
      pickup_photos: photos || [],
      bins_returned: binsReturned ?? order.bin_count,
      bins_missing: binsMissing,
      missing_bin_charge: missingCharge,
    };

    // Charge card for missing bins
    if (missingCharge > 0 && order.square_card_id) {
      try {
        const { locationId } = await getSquarePaymentConfig();
        if (locationId) {
          await squareClient.payments.create({
            sourceId: order.square_card_id,
            amountMoney: { amount: BigInt(Math.round(missingCharge * 100)), currency: "CAD" },
            customerId: order.square_customer_id || undefined,
            referenceId: order.order_number,
            note: `Missing bins charge: ${binsMissing} bin(s) x $${MISSING_BIN_FEE}`,
            idempotencyKey: `bin-missing-${id}`,
            locationId,
          });
        }
      } catch (e) {
        console.error("[bin-orders] missing bin charge failed:", e);
      }

      if (order.client_phone) {
        sendSMS(
          order.client_phone,
          `A note on your Yugo order ${order.order_number}: ${binsMissing} bin(s) were not returned. ` +
          `A charge of $${missingCharge.toFixed(2)} ($${MISSING_BIN_FEE} per bin) has been applied to the card on file. ` +
          `Please reach us at (647) 370-4525 if you have any questions.`,
        ).catch(() => {});
      }
    } else if (order.client_phone) {
      sendSMS(
        order.client_phone,
        [
          `Hi,`,
          `Your bins have been collected. Thank you for choosing Yugo.`,
          `Planning your move? Get a quote any time at https://helloyugo.com`,
        ].join("\n\n"),
      ).catch(() => {});
    }

    await supabase.from("bin_orders").update(updatePayload).eq("id", id);
    return NextResponse.json({ success: true, status: "completed", binsMissing, missingCharge });
  }

  // ── Generic status/field update ──
  const allowed: (keyof typeof rest)[] = [
    "status", "delivery_notes", "drop_off_date", "pickup_date",
    "drop_off_crew", "pickup_crew",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (rest[key] !== undefined) update[key] = rest[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Validate status label mapping (never expose raw DB values to client in responses)
  if (update.status) {
    const statusStr = String(update.status);
    if (!STATUS_LABELS[statusStr]) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
  }

  const { error: updateErr } = await supabase
    .from("bin_orders")
    .update(update)
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
