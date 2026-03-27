import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getTodayString } from "@/lib/business-timezone";
import { sendSMS } from "@/lib/sms/sendSMS";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";

const MISSING_BIN_FEE = 20;

export const dynamic = "force-dynamic";

async function getCrewPayload() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  return token ? verifyCrewToken(token) : null;
}

// ── GET /api/crew/bin-orders — today's and tomorrow's bin tasks ──

export async function GET(_req: NextRequest) {
  const payload = await getCrewPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const today = getTodayString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  // Fetch bin orders due today or tomorrow (drop-off or pickup) OR overdue
  const { data: orders } = await supabase
    .from("bin_orders")
    .select("*")
    .neq("status", "cancelled")
    .neq("status", "completed")
    .or(
      `drop_off_date.eq.${today},drop_off_date.eq.${tomorrowStr},pickup_date.eq.${today},pickup_date.eq.${tomorrowStr},status.eq.overdue`,
    )
    .order("drop_off_date");

  return NextResponse.json({ orders: orders || [] });
}

// ── PATCH /api/crew/bin-orders/[id] — complete drop-off or pickup ──
// Note: PATCH is on /api/crew/bin-orders with id in body for simplicity

export async function PATCH(req: NextRequest) {
  const payload = await getCrewPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const body = await req.json();
  const { id, action, crewName, binsReturned } = body as {
    id: string;
    action: "complete_dropoff" | "complete_pickup";
    crewName?: string;
    binsReturned?: number;
  };

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const { data: order, error: fetchErr } = await supabase
    .from("bin_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (action === "complete_dropoff") {
    await supabase.from("bin_orders").update({
      status: "bins_delivered",
      drop_off_completed_at: new Date().toISOString(),
      drop_off_crew: crewName || `Crew team ${payload.teamId}`,
    }).eq("id", id);

    if (order.client_phone) {
      const pickupDate = new Date(order.pickup_date + "T12:00:00")
        .toLocaleDateString("en-CA", { month: "short", day: "numeric" });
      sendSMS(
        order.client_phone,
        [
          `Hi,`,
          `Your Yugo bins have been delivered. Start packing.`,
          `We pick up on ${pickupDate}.`,
          `Questions? Call (647) 370-4525`,
        ].join("\n\n"),
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, status: "bins_delivered" });
  }

  if (action === "complete_pickup") {
    const binCount = order.bin_count ?? 0;
    const returned = binsReturned ?? binCount;
    const binsMissing = Math.max(0, binCount - returned);
    const missingCharge = binsMissing * MISSING_BIN_FEE;

    await supabase.from("bin_orders").update({
      status: "completed",
      pickup_completed_at: new Date().toISOString(),
      pickup_crew: crewName || `Crew team ${payload.teamId}`,
      bins_returned: returned,
      bins_missing: binsMissing,
      missing_bin_charge: missingCharge,
    }).eq("id", id);

    if (missingCharge > 0 && order.square_card_id) {
      try {
        const { locationId } = await getSquarePaymentConfig();
        if (locationId) {
          await squareClient.payments.create({
            sourceId: order.square_card_id,
            amountMoney: { amount: BigInt(Math.round(missingCharge * 100)), currency: "CAD" },
            customerId: order.square_customer_id || undefined,
            referenceId: order.order_number,
            note: `Missing bins, ${binsMissing} × $${MISSING_BIN_FEE}`,
            idempotencyKey: `bin-missing-crew-${id}-${Date.now()}`,
            locationId,
          });
        }
      } catch (e) {
        console.error("[crew/bin-orders] missing bin charge failed:", e);
      }

      if (order.client_phone) {
        sendSMS(
          order.client_phone,
          `${binsMissing} bin(s) were not returned from order ${order.order_number}. ` +
          `A charge of $${missingCharge.toFixed(2)} ($${MISSING_BIN_FEE}/bin) has been applied to your card on file. ` +
          `Questions? Call (647) 370-4525`,
        ).catch(() => {});
      }
    } else if (order.client_phone) {
      sendSMS(
        order.client_phone,
        [
          `Hi,`,
          `Your bins have been collected. Thanks for going green with Yugo.`,
          `Need movers? https://helloyugo.com`,
        ].join("\n\n"),
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, status: "completed", binsMissing, missingCharge });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
