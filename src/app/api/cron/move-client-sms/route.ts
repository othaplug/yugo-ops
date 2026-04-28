import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { isTerminalMoveStatus } from "@/lib/moves/job-terminal";

/**
 * Vercel Cron: send due mid-move client check-in texts (DB-scheduled, no timers).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cfg = await getFeatureConfig(["sms_eta_enabled"]);
  const smsEnabled = cfg.sms_eta_enabled === "true";
  const now = new Date().toISOString();

  const { data: due, error: qErr } = await admin
    .from("scheduled_move_client_sms")
    .select("id, move_id, kind")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(40);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  for (const row of due || []) {
    results.processed++;
    const { data: move } = await admin
      .from("moves")
      .select("id, client_name, client_phone, status")
      .eq("id", row.move_id)
      .maybeSingle();

    if (!move?.client_phone?.trim()) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "no_phone" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    if (isTerminalMoveStatus(move.status as string)) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "move_finished" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    const firstName = (move.client_name || "there").trim().split(/\s+/)[0] || "there";
    const body =
      row.kind === "en_route_checkin"
        ? `Hi ${firstName}, just checking in. Your belongings are on the way to your new home and your crew is making great progress. If you need anything at all, call or text us at (647) 370-4525. We are here for you.`
        : `Hi ${firstName}, your crew has arrived at your new home and is beginning to unload. Almost there! If you need anything, please let us know. We want everything just right.`;

    if (!smsEnabled) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "sms_eta_disabled" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    try {
      const sms = await sendSMS(move.client_phone.replace(/\s/g, ""), body);
      await admin
        .from("scheduled_move_client_sms")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: sms.success ? null : (sms.error ?? "send_failed"),
        })
        .eq("id", row.id);
      if (sms.success) results.sent++;
      else results.errors.push(`${row.id}: ${sms.error}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_error";
      results.errors.push(`${row.id}: ${msg}`);
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: msg.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
