import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";

const GRACE_DAYS = 2;
const WRITE_OFF_DAYS = 30;

/**
 * Vercel Cron: runs daily at 11 AM EST.
 * Handles overdue bin orders: sends notifications, applies late fees, charges cards.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: feeCfg } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", [
      "bin_late_fee_per_day",
      "bin_rental_late_fee_per_day",
      "bin_missing_bin_fee",
      "bin_rental_missing_bin_fee",
    ]);
  const feeMap = Object.fromEntries((feeCfg ?? []).map((r) => [r.key, r.value]));
  const lateFeePerDay =
    Number(feeMap.bin_late_fee_per_day ?? feeMap.bin_rental_late_fee_per_day ?? "15") || 15;
  const replacementFeePerBin =
    Number(feeMap.bin_missing_bin_fee ?? feeMap.bin_rental_missing_bin_fee ?? "12") || 12;

  const results = {
    flaggedOverdue: 0,
    day1Notified: 0,
    day2Notified: 0,
    lateFeeCharged: 0,
    writeOff: 0,
    errors: [] as string[],
  };

  // Find all orders where pickup_date has passed and bins not collected
  const graceCutoff = new Date(today);
  graceCutoff.setDate(graceCutoff.getDate() - GRACE_DAYS);
  const graceCutoffStr = graceCutoff.toISOString().split("T")[0];

  const { data: overdueOrders } = await supabase
    .from("bin_orders")
    .select("*")
    .lte("pickup_date", graceCutoffStr)
    .in("status", ["bins_delivered", "in_use", "pickup_scheduled", "overdue"])
    .is("pickup_completed_at", null)
    .neq("status", "cancelled");

  if (!overdueOrders || overdueOrders.length === 0) {
    return NextResponse.json({ ok: true, ...results, message: "No overdue orders" });
  }

  for (const order of overdueOrders) {
    try {
      const pickupDate = new Date(order.pickup_date + "T12:00:00");
      const daysOverdue = Math.floor((today.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));

      // Update status to overdue and increment overdue_days
      await supabase
        .from("bin_orders")
        .update({ status: "overdue", overdue_days: daysOverdue })
        .eq("id", order.id);

      results.flaggedOverdue++;

      const firstName = order.client_name?.split(" ")[0] || "there";
      const scheduledDateStr = new Date(order.pickup_date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });

      // Day 1–2 overdue (within grace): first reminder
      if (daysOverdue <= 2 && !order.overdue_notified_day1 && order.client_phone) {
        await sendSMS(
          order.client_phone,
          `Hi ${firstName}, your Yugo bin pickup was scheduled for ${scheduledDateStr}. ` +
          `Please have bins stacked by the door. We'll attempt pickup tomorrow. ` +
          `Questions? Call (647) 370-4525`,
        );
        await supabase.from("bin_orders").update({ overdue_notified_day1: true }).eq("id", order.id);
        results.day1Notified++;
      }

      // Day 3–5 overdue: second reminder + email + coordinator alert
      if (daysOverdue >= 3 && daysOverdue <= 5 && !order.overdue_notified_day2 && order.client_phone) {
        await sendSMS(
          order.client_phone,
          `Hi ${firstName}, your Yugo bins (order ${order.order_number}) are overdue since ${scheduledDateStr}. ` +
          `Late fees of $${lateFeePerDay}/day are now applying. ` +
          `Please call (647) 370-4525 to arrange pickup.`,
        );

        if (order.client_email) {
          await sendEmail({
            to: order.client_email,
            subject: `Action required: Yugo bins overdue, ${order.order_number}`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0a0a0a;color:#e5e0d8">
              <h2 style="color:#ef4444">Your bins are overdue</h2>
              <p>Hi ${firstName}, your bin pickup for order <strong>${order.order_number}</strong> was scheduled for ${scheduledDateStr}.</p>
              <p>Late fees of <strong>$${lateFeePerDay}/day</strong> are now accruing.</p>
              <p>Please stack your bins by the door and call us at <a href="tel:6473704525" style="color:#C9A962">(647) 370-4525</a> to arrange pickup.</p>
            </div>`,
          }).catch(() => {});
        }

        // Notify coordinator
        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
        if (adminEmail) {
          await sendEmail({
            to: adminEmail,
            subject: `Overdue bin order: ${order.order_number}, ${daysOverdue} days late`,
            html: `<p>Bin order <strong>${order.order_number}</strong> for ${order.client_name} is ${daysOverdue} days overdue.<br>Address: ${order.delivery_address}<br>Phone: ${order.client_phone}</p>`,
          }).catch(() => {});
        }

        await supabase.from("bin_orders").update({ overdue_notified_day2: true }).eq("id", order.id);
        results.day2Notified++;
      }

      // Day 1–14 overdue: charge one day’s late fee per cron run (idempotent per calendar day)
      if (daysOverdue >= 1 && daysOverdue <= 14 && order.square_card_id) {
        const feeAmount = lateFeePerDay;
        const feeCents = Math.round(feeAmount * 100);

        try {
          const { locationId } = await getSquarePaymentConfig();
          if (locationId) {
            await squareClient.payments.create({
              sourceId: order.square_card_id,
              amountMoney: { amount: BigInt(feeCents), currency: "CAD" },
              customerId: order.square_customer_id || undefined,
              referenceId: order.order_number,
              note: `Late bin return fee (day ${daysOverdue})`,
              idempotencyKey: `bin-late-${order.id}-${todayStr}`,
              locationId,
            });

            await supabase
              .from("bin_orders")
              .update({
                late_return_fees: (Number(order.late_return_fees) || 0) + feeAmount,
                overdue_last_charged_at: new Date().toISOString(),
              })
              .eq("id", order.id);

            if (order.client_phone && (daysOverdue === 1 || daysOverdue % 3 === 0)) {
              await sendSMS(
                order.client_phone,
                `Hi ${firstName}, your Yugo bin rental is ${daysOverdue} day(s) past pickup. Late fee: $${lateFeePerDay}/day. Schedule pickup: (647) 370-4525`,
              ).catch(() => {});
            }

            results.lateFeeCharged++;
          }
        } catch (chargeErr) {
          results.errors.push(`late-fee-${order.order_number}: ${chargeErr instanceof Error ? chargeErr.message : String(chargeErr)}`);
        }
      }

      if (daysOverdue >= 15 && (daysOverdue - 15) % 7 === 0) {
        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
        if (adminEmail) {
          const totalLate = (Number(order.late_return_fees) || 0) + daysOverdue * lateFeePerDay;
          await sendEmail({
            to: adminEmail,
            subject: `Escalation: ${order.order_number} ${daysOverdue} days late`,
            html: `<p><strong>${order.order_number}</strong> is ${daysOverdue} days past pickup. Estimated late fees: $${totalLate.toFixed(0)}. Client: ${order.client_name}. Phone: ${order.client_phone}</p>`,
          }).catch(() => {});
        }
      }

      // Day 30+: charge full replacement cost and close order
      if (daysOverdue >= WRITE_OFF_DAYS && order.square_card_id) {
        const replacementCost = order.bin_count * replacementFeePerBin;
        const replacementCents = Math.round(replacementCost * 100);

        try {
          const { locationId } = await getSquarePaymentConfig();
          if (locationId) {
            await squareClient.payments.create({
              sourceId: order.square_card_id,
              amountMoney: { amount: BigInt(replacementCents), currency: "CAD" },
              customerId: order.square_customer_id || undefined,
              referenceId: order.order_number,
              note: `Bin replacement, 30+ days overdue, ${order.bin_count} bins × $${replacementFeePerBin}`,
              idempotencyKey: `bin-replace-${order.id}`,
              locationId,
            });
          }
        } catch { /* non-critical */ }

        await supabase
          .from("bin_orders")
          .update({ status: "completed", bins_missing: order.bin_count, missing_bin_charge: replacementCost })
          .eq("id", order.id);

        if (order.client_phone) {
          await sendSMS(
            order.client_phone,
            `Your Yugo bin order ${order.order_number} has been closed after 30 days. ` +
            `Replacement cost of $${replacementCost.toFixed(2)} has been charged. ` +
            `Questions? (647) 370-4525`,
          ).catch(() => {});
        }

        results.writeOff++;
      }
    } catch (e) {
      results.errors.push(`${order.order_number}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
