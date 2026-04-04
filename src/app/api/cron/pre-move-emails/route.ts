import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { sendMoveReminderSms } from "@/lib/quote-sms";

/**
 * Vercel Cron: runs daily at 10 AM EST.
 * Sends T-72hr checklist + balance reminder, T-48hr balance payment email,
 * and T-24hr crew detail emails.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();

  const toDateStr = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };

  const threeDaysOut = toDateStr(3);
  const twoDaysOut = toDateStr(2);
  const oneDayOut = toDateStr(1);

  const results = {
    sent72hr: 0,
    sentBalance72hr: 0,
    sentBalance48hr: 0,
    sent24hr: 0,
    errors: [] as string[],
  };

  /* ── T-72 Hour Emails ── */
  const { data: moves72 } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, client_phone, scheduled_date, scheduled_time, from_address, to_address, from_access, to_access, balance_amount, balance_paid_at, deposit_paid_at",
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", threeDaysOut)
    .is("pre_move_72hr_sent", null);

  if (moves72 && moves72.length > 0) {
    for (const move of moves72) {
      if (!move.client_email) continue;

      const trackToken = signTrackToken("move", move.id);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

      try {
        const result = await sendEmail({
          to: move.client_email,
          subject: `Your move is in 3 days - ${move.move_code || "Checklist"}`,
          template: "pre-move-72hr",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            moveDate: move.scheduled_date,
            fromAddress: move.from_address || "",
            toAddress: move.to_address || "",
            fromAccess: move.from_access,
            toAccess: move.to_access,
            trackingUrl,
          },
        });

        if (result.success) {
          await supabase
            .from("moves")
            .update({ pre_move_72hr_sent: new Date().toISOString() })
            .eq("id", move.id);
          results.sent72hr++;

          // SMS 72hr reminder
          if (move.client_phone) {
            sendMoveReminderSms({
              phone: move.client_phone,
              moveCode: move.move_code || move.id,
              clientName: move.client_name || undefined,
              moveDate: move.scheduled_date,
              scheduledTime: move.scheduled_time ?? null,
              trackingUrl,
              reminderType: "72hr",
            }).catch(() => {});
          }
        } else {
          results.errors.push(`72hr:${move.move_code}:${result.error}`);
        }
      } catch (err) {
        results.errors.push(
          `72hr:${move.move_code}:${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // T-72hr Balance Reminder (piggy-backs on same date window)
      const bal = Number(move.balance_amount || 0);
      if (bal > 0 && !move.balance_paid_at && move.deposit_paid_at) {
        try {
          const balResult = await sendEmail({
            to: move.client_email,
            subject: `Your balance of $${bal.toFixed(2)} is due ${move.move_code || "Payment"}`,
            template: "balance-reminder-72hr",
            data: {
              clientName: move.client_name || "",
              moveCode: move.move_code || move.id,
              moveDate: move.scheduled_date,
              balanceAmount: bal,
              trackingUrl,
            },
          });
          if (balResult.success) {
            await supabase
              .from("moves")
              .update({ balance_reminder_72hr_sent: new Date().toISOString() })
              .eq("id", move.id);
            results.sentBalance72hr++;
          } else {
            results.errors.push(`bal72:${move.move_code}:${balResult.error}`);
          }
        } catch (err) {
          results.errors.push(
            `bal72:${move.move_code}:${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  /* ── T-48 Hour Balance Payment Email ── */
  const { data: moves48 } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, scheduled_date, balance_amount, balance_paid_at, deposit_paid_at",
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", twoDaysOut)
    .is("balance_reminder_48hr_sent", null)
    .is("balance_paid_at", null)
    .not("deposit_paid_at", "is", null);

  if (moves48 && moves48.length > 0) {
    for (const move of moves48) {
      if (!move.client_email) continue;
      const bal = Number(move.balance_amount || 0);
      if (bal <= 0) continue;

      const ccTotal = bal * 1.033 + 0.15;
      const autoChargeDate = toDateStr(1);
      const trackToken = signTrackToken("move", move.id);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;
      const paymentPageUrl = `${baseUrl}/pay/${move.id}`;

      try {
        const result = await sendEmail({
          to: move.client_email,
          subject: `Your balance of $${bal.toFixed(2)} is due - choose how to pay`,
          template: "balance-reminder-48hr",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            moveDate: move.scheduled_date,
            balanceAmount: bal,
            ccTotal,
            autoChargeDate,
            paymentPageUrl,
            trackingUrl,
          },
        });

        if (result.success) {
          await supabase
            .from("moves")
            .update({ balance_reminder_48hr_sent: new Date().toISOString() })
            .eq("id", move.id);
          results.sentBalance48hr++;
        } else {
          results.errors.push(`bal48:${move.move_code}:${result.error}`);
        }
      } catch (err) {
        results.errors.push(
          `bal48:${move.move_code}:${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /* ── T-24 Hour Emails ── */
  const { data: moves24 } = await supabase
    .from("moves")
    .select(
      `
      id, move_code, client_name, client_email, client_phone,
      scheduled_date, scheduled_time, from_address, to_address,
      crew_id, crew_size, truck_info, arrival_window,
      crews:crew_id(name, members)
    `,
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", oneDayOut)
    .is("pre_move_24hr_sent", null);

  if (moves24 && moves24.length > 0) {
    const { data: coordConfig } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["coordinator_name", "coordinator_phone"]);

    const coordinatorName =
      coordConfig?.find((c) => c.key === "coordinator_name")?.value || null;
    const coordinatorPhone =
      coordConfig?.find((c) => c.key === "coordinator_phone")?.value || null;

    for (const move of moves24) {
      if (!move.client_email) continue;

      const trackToken = signTrackToken("move", move.id);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

      const crewRaw = move.crews as
        | { name: string; members: string[] }
        | { name: string; members: string[] }[]
        | null;
      const crew = Array.isArray(crewRaw) ? (crewRaw[0] ?? null) : crewRaw;
      const crewLeadName = crew?.name || null;
      const crewSize = move.crew_size ?? (crew?.members?.length || null);

      try {
        const result = await sendEmail({
          to: move.client_email,
          subject: `Your crew is confirmed for tomorrow - ${move.move_code || "Details"}`,
          template: "pre-move-24hr",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            moveDate: move.scheduled_date,
            fromAddress: move.from_address || "",
            toAddress: move.to_address || "",
            crewLeadName,
            crewSize,
            truckInfo: move.truck_info || null,
            arrivalWindow: move.arrival_window || move.scheduled_time || null,
            coordinatorName,
            coordinatorPhone,
            trackingUrl,
          },
        });

        if (result.success) {
          await supabase
            .from("moves")
            .update({ pre_move_24hr_sent: new Date().toISOString() })
            .eq("id", move.id);
          results.sent24hr++;

          // SMS day-before reminder
          if (move.client_phone) {
            sendMoveReminderSms({
              phone: move.client_phone,
              moveCode: move.move_code || move.id,
              clientName: move.client_name || undefined,
              moveDate: move.scheduled_date,
              scheduledTime: move.arrival_window || move.scheduled_time || null,
              crewSize: crewSize ?? null,
              trackingUrl,
              reminderType: "24hr",
            }).catch(() => {});
          }
        } else {
          results.errors.push(`24hr:${move.move_code}:${result.error}`);
        }
      } catch (err) {
        results.errors.push(
          `24hr:${move.move_code}:${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  if (results.errors.length > 0) {
    await supabase
      .from("webhook_logs")
      .insert({
        source: "cron_pre_move_emails",
        event_type: "partial_failure",
        payload: results,
        status: "error",
        error: results.errors.join("; ").slice(0, 500),
      })
      .then(() => {});
  }

  return NextResponse.json({
    ok: true,
    sent72hr: results.sent72hr,
    sentBalance72hr: results.sentBalance72hr,
    sentBalance48hr: results.sentBalance48hr,
    sent24hr: results.sent24hr,
    errors: results.errors.length,
  });
}
