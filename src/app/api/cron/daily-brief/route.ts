import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getTodayString } from "@/lib/business-timezone";

/**
 * Vercel Cron: runs daily at 7 AM EST.
 * Sends the coordinator a smart daily brief: jobs, revenue, alerts, expiring quotes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = getTodayString();

  // ── Platform config ──
  const { data: configRows } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", [
      "coordinator_email",
      "coordinator_phone",
      "coordinator_name",
      "daily_brief_enabled",
    ]);
  const cfg = Object.fromEntries((configRows ?? []).map((r) => [r.key, r.value]));
  if (cfg.daily_brief_enabled === "false") {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const coordinatorEmail = cfg.coordinator_email || process.env.COORDINATOR_EMAIL;
  const coordinatorPhone = cfg.coordinator_phone || process.env.COORDINATOR_PHONE;
  if (!coordinatorEmail) {
    return NextResponse.json({ error: "coordinator_email not configured" }, { status: 400 });
  }

  // ── Today's moves ──
  const { data: moves } = await supabase
    .from("moves")
    .select("id, move_code, client_name, tier, service_type, arrival_window, total_price, amount, crew_id, from_access, specialty_items, status")
    .in("status", ["confirmed", "scheduled", "in_progress", "confirmed_pending_schedule", "confirmed_unassigned"])
    .eq("scheduled_date", today);

  const jobs = moves ?? [];
  const revenue = jobs.reduce((s, j) => s + (Number(j.total_price) || Number((j as { amount?: number }).amount) || 0), 0);
  const unassigned = jobs.filter((j) => !j.crew_id);

  // ── Build alerts ──
  const alerts: string[] = [];
  for (const job of jobs) {
    const access = String(job.from_access || "").toLowerCase();
    if (access.includes("walk_up") || access.includes("walkup")) {
      const floors = access.match(/(\d+)th|(\d+)rd|(\d+)nd|(\d+)st/);
      const floorStr = floors ? floors[0] : "upper floor";
      alerts.push(`${job.move_code || job.id}: Walk-up ${floorStr} at pickup — allow extra time`);
    }
    const specialties = job.specialty_items as Record<string, unknown> | null;
    if (specialties?.piano_grand || specialties?.piano_upright) {
      alerts.push(`${job.move_code || job.id}: Piano — specialty crew required`);
    }
    if ((job.tier || "").toLowerCase() === "estate") {
      alerts.push(`${job.move_code || job.id}: Estate tier — white glove standard`);
    }
  }

  // ── Expiring quotes (today) ──
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { data: expiringQuotes } = await supabase
    .from("quotes")
    .select("id, quote_number, client_name, essential_price, expires_at")
    .in("status", ["sent", "viewed"])
    .gte("expires_at", today)
    .lt("expires_at", tomorrow.toISOString().slice(0, 10));

  const expiring = expiringQuotes ?? [];

  // ── Weather alerts on today's moves ──
  const weatherAlerts: string[] = [];
  const { data: weatherMoves } = await supabase
    .from("moves")
    .select("move_code, weather_alert")
    .eq("scheduled_date", today)
    .not("weather_alert", "is", null);
  for (const m of weatherMoves ?? []) {
    if (m.weather_alert) {
      weatherAlerts.push(`${m.move_code || ""}: ${m.weather_alert}`);
    }
  }

  // ── Format date ──
  const dateLabel = new Date(today + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Build HTML email ──
  const jobRows = jobs
    .map(
      (j) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2318;font-size:12px;color:#C9A962;font-weight:600;">${j.move_code || j.id}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2318;font-size:12px;color:#e8e0d0;">${j.client_name || "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2318;font-size:12px;color:#9c9489;">${j.tier || j.service_type || "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2318;font-size:12px;color:#9c9489;">${j.arrival_window || "—"}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #2a2318;font-size:12px;color:#9c9489;text-align:right;">${j.crew_id ? "" : '<span style="color:#ef4444;font-weight:700;">UNASSIGNED</span>'}</td>
        </tr>`
    )
    .join("");

  const alertRows = alerts.length
    ? alerts.map((a) => `<li style="margin-bottom:6px;font-size:12px;color:#f59e0b;">${a}</li>`).join("")
    : '<li style="font-size:12px;color:#22c55e;">No alerts — clean day ahead</li>';

  const quoteRows = expiring.length
    ? expiring
        .map(
          (q) =>
            `<li style="margin-bottom:4px;font-size:12px;color:#e8e0d0;">${q.quote_number || q.id} — ${q.client_name} ($${Number(q.essential_price || 0).toLocaleString()})</li>`
        )
        .join("")
    : '<li style="font-size:12px;color:#9c9489;">None expiring today</li>';

  const weatherRows = weatherAlerts.length
    ? weatherAlerts.map((w) => `<li style="margin-bottom:4px;font-size:12px;color:#60a5fa;">${w}</li>`).join("")
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#0d0b08;margin:0;padding:0;font-family:'Inter',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="border-bottom:1px solid #2a2318;padding-bottom:16px;margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#C9A962;margin:0 0 4px;">Yugo+</p>
      <h1 style="font-size:22px;font-weight:700;color:#e8e0d0;margin:0;">Daily Brief</h1>
      <p style="font-size:12px;color:#9c9489;margin:4px 0 0;">${dateLabel}</p>
    </div>

    <!-- KPI row -->
    <div style="display:flex;gap:12px;margin-bottom:20px;">
      <div style="flex:1;background:#1a1510;border:1px solid #2a2318;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#C9A962;">${jobs.length}</div>
        <div style="font-size:10px;color:#9c9489;text-transform:uppercase;letter-spacing:1px;">Jobs</div>
      </div>
      <div style="flex:1;background:#1a1510;border:1px solid #2a2318;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#C9A962;">$${revenue.toLocaleString()}</div>
        <div style="font-size:10px;color:#9c9489;text-transform:uppercase;letter-spacing:1px;">Revenue</div>
      </div>
      <div style="flex:1;background:#1a1510;border:1px solid #2a2318;border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:${unassigned.length > 0 ? "#ef4444" : "#22c55e"};">${unassigned.length}</div>
        <div style="font-size:10px;color:#9c9489;text-transform:uppercase;letter-spacing:1px;">Unassigned</div>
      </div>
    </div>

    <!-- Jobs table -->
    ${
      jobs.length > 0
        ? `<div style="margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9c9489;margin:0 0 10px;">Today's Schedule</p>
      <table style="width:100%;border-collapse:collapse;background:#1a1510;border:1px solid #2a2318;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#211d13;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9c9489;">Code</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9c9489;">Client</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9c9489;">Type</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9c9489;">Window</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9c9489;">Crew</th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>
    </div>`
        : `<p style="font-size:13px;color:#9c9489;margin-bottom:20px;">No jobs scheduled today.</p>`
    }

    <!-- Alerts -->
    <div style="margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9c9489;margin:0 0 10px;">Alerts</p>
      <div style="background:#1a1510;border:1px solid #2a2318;border-radius:10px;padding:14px;">
        <ul style="margin:0;padding-left:18px;">${alertRows}</ul>
      </div>
    </div>

    ${
      weatherAlerts.length
        ? `<div style="margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9c9489;margin:0 0 10px;">Weather</p>
      <div style="background:#0f1c2e;border:1px solid #1e3a5f;border-radius:10px;padding:14px;">
        <ul style="margin:0;padding-left:18px;">${weatherRows}</ul>
      </div>
    </div>`
        : ""
    }

    <!-- Expiring quotes -->
    <div style="margin-bottom:20px;">
      <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9c9489;margin:0 0 10px;">Quotes Expiring Today (${expiring.length})</p>
      <div style="background:#1a1510;border:1px solid #2a2318;border-radius:10px;padding:14px;">
        <ul style="margin:0;padding-left:18px;">${quoteRows}</ul>
      </div>
    </div>

    <p style="font-size:11px;color:#5c5650;text-align:center;margin-top:24px;">
      Yugo+ — Auto-generated at 7 AM EST
    </p>
  </div>
</body>
</html>`;

  // ── Send email ──
  await sendEmail({
    to: coordinatorEmail,
    subject: `Yugo Daily Brief — ${jobs.length} job${jobs.length !== 1 ? "s" : ""} today${alerts.length ? ` · ${alerts.length} alert${alerts.length !== 1 ? "s" : ""}` : ""}`,
    html,
  });

  // ── Send SMS ──
  if (coordinatorPhone) {
    const smsAlertPart = alerts.length > 0 ? ` ${alerts.length} alert${alerts.length > 1 ? "s" : ""}.` : "";
    const smsExpiring = expiring.length > 0 ? ` ${expiring.length} quote${expiring.length > 1 ? "s" : ""} expiring.` : "";
    const smsUnassigned = unassigned.length > 0 ? ` ${unassigned.length} unassigned.` : "";
    const smsBody = `Yugo Daily Brief: ${jobs.length} job${jobs.length !== 1 ? "s" : ""} today, $${revenue.toLocaleString()} revenue.${smsAlertPart}${smsUnassigned}${smsExpiring}`;
    await sendSMS(coordinatorPhone, smsBody).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    jobs: jobs.length,
    revenue,
    alerts: alerts.length,
    expiring: expiring.length,
  });
}
