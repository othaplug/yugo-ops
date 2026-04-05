import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { sendMoveReminderSms } from "@/lib/quote-sms";
import { moveMatchesBalanceReminder48hWindow } from "@/lib/quotes/estate-schedule";
import { statusUpdateEmailHtml } from "@/lib/email-templates";
import {
  accessMentionsElevator,
  parkingReminderLikelyNeeded,
} from "@/lib/moves/pre-move-heuristics";

/**
 * Vercel Cron: runs daily at 10 AM EST.
 * Sends T-72hr checklist + balance reminder, T-48hr balance payment email,
 * and T-24hr crew detail emails.
 * Estate: the 48hr balance email uses two calendar days before packing day (when
 * the plan has a separate pack day, that is the day before move); single-day Estate
 * stays tied to move day.
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
  const fiveDaysOut = toDateStr(5);

  const results = {
    sent72hr: 0,
    sentBalance72hr: 0,
    sentBalance48hr: 0,
    sent24hr: 0,
    sentElevator5d: 0,
    sentParking5d: 0,
    sentChecklist3d: 0,
    errors: [] as string[],
  };

  /* ── T-72 Hour Emails ── */
  const { data: moves72 } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, client_phone, scheduled_date, scheduled_time, from_address, to_address, from_access, to_access, balance_amount, balance_paid_at, deposit_paid_at, tier_selected",
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", threeDaysOut)
    .is("pre_move_72hr_sent", null);

  if (moves72 && moves72.length > 0) {
    for (const move of moves72) {
      if (!move.client_email) continue;

      const isEstate =
        String(move.tier_selected || "").toLowerCase().trim() === "estate";
      const trackToken = signTrackToken("move", move.id);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

      try {
        const result = await sendEmail({
          to: move.client_email,
          subject: isEstate
            ? `Your Estate move is in 3 days - ${move.move_code || "Checklist"}`
            : `Your move is in 3 days - ${move.move_code || "Checklist"}`,
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
              estateBalanceChargeBeforePacking: isEstate,
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
      "id, move_code, client_name, client_email, scheduled_date, balance_amount, balance_paid_at, deposit_paid_at, tier_selected, service_tier, move_size, inventory_score",
    )
    .in("status", ["confirmed", "scheduled"])
    .in("scheduled_date", [twoDaysOut, threeDaysOut])
    .is("balance_reminder_48hr_sent", null)
    .is("balance_paid_at", null)
    .not("deposit_paid_at", "is", null);

  if (moves48 && moves48.length > 0) {
    for (const move of moves48) {
      if (!move.client_email) continue;
      if (
        !moveMatchesBalanceReminder48hWindow({
          scheduledDate: move.scheduled_date,
          twoDaysOutIso: twoDaysOut,
          tierSelected: move.tier_selected,
          serviceTier: move.service_tier,
          moveSize: move.move_size,
          inventoryScore:
            move.inventory_score != null ? Number(move.inventory_score) : null,
        })
      ) {
        continue;
      }
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

  /* ── T-5 Day: elevator + parking reminders ── */
  const { data: coordRows5 } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", ["coordinator_phone", "coordinator_name"]);
  const coordPhone5 =
    coordRows5?.find((r) => r.key === "coordinator_phone")?.value?.trim() || "";

  const { data: moves5 } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, scheduled_date, arrival_window, from_access, to_access, from_postal, to_postal, from_parking, to_parking, elevator_reminder_sent_at, parking_reminder_sent_at",
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", fiveDaysOut);

  for (const m of moves5 || []) {
    if (!m.client_email) continue;
    const trackTok = signTrackToken("move", m.id);
    const trackUrl = `${baseUrl}/track/move/${m.move_code ?? m.id}?token=${trackTok}`;

    if (
      !m.elevator_reminder_sent_at &&
      accessMentionsElevator(m.from_access, m.to_access)
    ) {
      const first = (m.client_name || "").trim().split(/\s+/)[0] || "there";
      const win = m.arrival_window || "your scheduled window";
      const html = statusUpdateEmailHtml({
        eyebrow: "Before your move",
        headline: "Reminder: book your elevator",
        body: `Hi ${first},<br/><br/>Your move is in five days. If you have not already, please book the freight or move elevator with your building. Many buildings need 48–72 hours notice.<br/><br/>Plan for your <strong>${win}</strong> arrival on <strong>${m.scheduled_date}</strong>.<br/><br/>Tips: ask for the freight elevator if available; pad extra time; confirm padding rules with building management.${coordPhone5 ? `<br/><br/>Questions? Call <strong>${coordPhone5}</strong>.` : ""}<br/><br/>Track your move anytime:`,
        ctaUrl: trackUrl,
        ctaLabel: "VIEW MOVE DETAILS",
        includeFooter: true,
        tone: "premium",
      });
      try {
        const r = await sendEmail({
          to: m.client_email,
          subject: "Reminder: book your elevator for move day",
          html,
        });
        if (r.success) {
          await supabase
            .from("moves")
            .update({ elevator_reminder_sent_at: new Date().toISOString() })
            .eq("id", m.id);
          results.sentElevator5d++;
        } else {
          results.errors.push(`el5:${m.move_code}:${r.error}`);
        }
      } catch (e) {
        results.errors.push(
          `el5:${m.move_code}:${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (!m.parking_reminder_sent_at && parkingReminderLikelyNeeded(m)) {
      const first = (m.client_name || "").trim().split(/\s+/)[0] || "there";
      const torontoParkingUrl =
        "https://www.toronto.ca/services-payments/streets-parking-transportation/";
      const html = statusUpdateEmailHtml({
        eyebrow: "Before your move",
        headline: "Parking for your move",
        body: `Hi ${first},<br/><br/>If our truck needs street space at either address, you may need a temporary parking permit from the City of Toronto. Apply several business days before your move: <a href="${torontoParkingUrl}" style="color:#2C3E2D;font-weight:600;">City of Toronto — streets and parking</a>.<br/><br/>If you have a loading dock or dedicated parking, you may already be set.${coordPhone5 ? `<br/><br/>Questions? Call <strong>${coordPhone5}</strong>.` : ""}`,
        ctaUrl: trackUrl,
        ctaLabel: "VIEW MOVE DETAILS",
        includeFooter: true,
        tone: "premium",
      });
      try {
        const r = await sendEmail({
          to: m.client_email,
          subject: "Parking for your move — quick heads up",
          html,
        });
        if (r.success) {
          await supabase
            .from("moves")
            .update({ parking_reminder_sent_at: new Date().toISOString() })
            .eq("id", m.id);
          results.sentParking5d++;
        } else {
          results.errors.push(`pk5:${m.move_code}:${r.error}`);
        }
      } catch (e) {
        results.errors.push(
          `pk5:${m.move_code}:${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  /* ── T-3 Day: move-day checklist link (separate from 72hr bundle) ── */
  const { data: movesCheck3 } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, client_email, checklist_token, move_prep_checklist_email_sent_at",
    )
    .in("status", ["confirmed", "scheduled"])
    .eq("scheduled_date", threeDaysOut)
    .is("move_prep_checklist_email_sent_at", null);

  for (const m of movesCheck3 || []) {
    if (!m.client_email) continue;
    const tok = String((m as { checklist_token?: string }).checklist_token || "").trim();
    if (!tok) continue;
    const checklistUrl = `${baseUrl}/checklist/${tok}`;
    const first = (m.client_name || "").trim().split(/\s+/)[0] || "there";
    const html = statusUpdateEmailHtml({
      eyebrow: "Prep",
      headline: "Your move is in 3 days",
      body: `Hi ${first},<br/><br/>Here is a quick checklist to help you prepare for move day. Check items off on your phone as you go.`,
      ctaUrl: checklistUrl,
      ctaLabel: "VIEW CHECKLIST",
      includeFooter: true,
      tone: "premium",
    });
    try {
      const r = await sendEmail({
        to: m.client_email,
        subject: "Your move is in 3 days — quick prep checklist",
        html,
      });
      if (r.success) {
        await supabase
          .from("moves")
          .update({ move_prep_checklist_email_sent_at: new Date().toISOString() })
          .eq("id", m.id);
        results.sentChecklist3d++;
      } else {
        results.errors.push(`chk3:${m.move_code}:${r.error}`);
      }
    } catch (e) {
      results.errors.push(
        `chk3:${m.move_code}:${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /* ── T-24 Hour Emails ── */
  const { data: moves24 } = await supabase
    .from("moves")
    .select(
      `
      id, move_code, client_name, client_email, client_phone,
      scheduled_date, scheduled_time, from_address, to_address,
      crew_id, crew_size, truck_info, arrival_window, tier_selected,
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
        const isEstate24 =
          String(move.tier_selected || "").toLowerCase().trim() === "estate";
        const result = await sendEmail({
          to: move.client_email,
          subject: isEstate24
            ? `Your Estate crew is confirmed for tomorrow - ${move.move_code || "Details"}`
            : `Your crew is confirmed for tomorrow - ${move.move_code || "Details"}`,
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
    sentElevator5d: results.sentElevator5d,
    sentParking5d: results.sentParking5d,
    sentChecklist3d: results.sentChecklist3d,
    errors: results.errors.length,
  });
}
