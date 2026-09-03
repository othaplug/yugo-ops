import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/sendSMS";

/**
 * Vercel Cron: runs daily at 10 AM EST.
 * Sends day-before SMS reminders for bin drop-offs and pickups.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const results = { dropoffReminders: 0, pickupReminders: 0, errors: [] as string[] };

  // ── Drop-off reminders ──
  const { data: dropoffs } = await supabase
    .from("bin_orders")
    .select("id, order_number, client_name, client_phone, pickup_date")
    .eq("drop_off_date", tomorrowStr)
    .in("status", ["confirmed", "drop_off_scheduled"])
    .not("client_phone", "is", null);

  // Sentinel (status_events) so a double cron invocation the same day doesn't
  // double-text: each reminder is recorded and skipped if already sent.
  const dropoffIds = (dropoffs ?? []).map((o) => o.id);
  const { data: sentDropoff } = dropoffIds.length
    ? await supabase
        .from("status_events")
        .select("entity_id")
        .eq("entity_type", "bin_order")
        .eq("event_type", "bin_dropoff_reminder")
        .in("entity_id", dropoffIds)
    : { data: [] as { entity_id: string }[] };
  const dropoffSent = new Set((sentDropoff ?? []).map((e) => String(e.entity_id)));

  for (const order of dropoffs || []) {
    if (dropoffSent.has(String(order.id))) continue;
    try {
      const pickupDate = new Date(order.pickup_date + "T12:00:00")
        .toLocaleDateString("en-CA", { month: "short", day: "numeric" });

      const fn = order.client_name?.split(" ")[0] || "there";
      await sendSMS(
        order.client_phone,
        [
          `Hi ${fn},`,
          `Your Yugo bins arrive tomorrow between 9 AM-5 PM.`,
          `Please ensure access to your unit or lobby.`,
          `Bins will be picked up on ${pickupDate}.`,
          `Questions? (647) 370-4525`,
        ].join("\n\n"),
      );
      await supabase.from("status_events").insert({
        entity_type: "bin_order",
        entity_id: order.id,
        event_type: "bin_dropoff_reminder",
        description: "Bin drop-off reminder SMS sent.",
        icon: "sms",
      });
      results.dropoffReminders++;
    } catch (e) {
      results.errors.push(`dropoff-${order.order_number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Pickup reminders ──
  const { data: pickups } = await supabase
    .from("bin_orders")
    .select("id, order_number, client_name, client_phone")
    .eq("pickup_date", tomorrowStr)
    .in("status", ["bins_delivered", "in_use", "pickup_scheduled"])
    .not("client_phone", "is", null);

  const pickupIds = (pickups ?? []).map((o) => o.id);
  const { data: sentPickup } = pickupIds.length
    ? await supabase
        .from("status_events")
        .select("entity_id")
        .eq("entity_type", "bin_order")
        .eq("event_type", "bin_pickup_reminder")
        .in("entity_id", pickupIds)
    : { data: [] as { entity_id: string }[] };
  const pickupSent = new Set((sentPickup ?? []).map((e) => String(e.entity_id)));

  for (const order of pickups || []) {
    if (pickupSent.has(String(order.id))) continue;
    try {
      const fn2 = order.client_name?.split(" ")[0] || "there";
      await sendSMS(
        order.client_phone,
        [
          `Hi ${fn2},`,
          `We're picking up your Yugo bins tomorrow between 9 AM-5 PM.`,
          `Please stack bins by the door.`,
          `Questions? (647) 370-4525`,
        ].join("\n\n"),
      );
      await supabase.from("status_events").insert({
        entity_type: "bin_order",
        entity_id: order.id,
        event_type: "bin_pickup_reminder",
        description: "Bin pickup reminder SMS sent.",
        icon: "sms",
      });
      results.pickupReminders++;
    } catch (e) {
      results.errors.push(`pickup-${order.order_number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
