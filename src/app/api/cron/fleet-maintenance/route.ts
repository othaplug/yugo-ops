import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { adminNotificationLayout } from "@/lib/email/admin-templates";
import { getTodayString } from "@/lib/business-timezone";

type FleetRow = Record<string, unknown>;

function addDaysToYyyyMmDd(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function needsAttention(row: FleetRow, today: string, weekAhead: string): { reason: string } | null {
  const nextRaw = row.next_maintenance_date;
  const lastRaw = row.last_maintenance_date;

  if (typeof nextRaw === "string" && nextRaw.trim()) {
    const d = nextRaw.slice(0, 10);
    if (d <= weekAhead) {
      const label = d < today ? "Overdue" : "Due within 7 days";
      return { reason: `${label} (next: ${d})` };
    }
    return null;
  }

  if (typeof lastRaw === "string" && lastRaw.trim()) {
    const d = lastRaw.slice(0, 10);
    const threshold = addDaysToYyyyMmDd(d, 90);
    if (threshold < today) {
      return { reason: `No upcoming date; last service ${d} (>90 days ago)` };
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = getTodayString();
  const weekAhead = addDaysToYyyyMmDd(today, 7);

  const { data: rows, error } = await supabase.from("fleet_vehicles").select("*");

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("relation") || msg.includes("does not exist")) {
      return NextResponse.json({ ok: true, vehicles: [], skipped: "fleet_vehicles unavailable" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = (rows ?? []) as FleetRow[];
  const flagged: { label: string; reason: string }[] = [];

  for (const row of list) {
    const attn = needsAttention(row, today, weekAhead);
    if (!attn) continue;
    const name =
      (typeof row.display_name === "string" && row.display_name) ||
      (typeof row.license_plate === "string" && row.license_plate) ||
      String(row.id ?? "unknown");
    flagged.push({ label: name, reason: attn.reason });
  }

  const adminTo = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_YUGO_EMAIL || "").trim();
  if (flagged.length > 0 && adminTo) {
    const rowsHtml = flagged
      .map(
        (f) =>
          `<tr><td style="padding:8px 14px;font-size:13px;color:#1C1917;border-bottom:1px solid rgba(44,62,45,0.08);">${escapeHtml(f.label)}</td><td style="padding:8px 14px;font-size:13px;color:#6B635C;border-bottom:1px solid rgba(44,62,45,0.08);">${escapeHtml(f.reason)}</td></tr>`,
      )
      .join("");
    const html = adminNotificationLayout(
      `<p style="font-size:14px;color:#6B635C;line-height:1.6;margin:0 0 20px;">${flagged.length} vehicle${flagged.length !== 1 ? "s" : ""} need attention as of ${today}.</p>
      <div style="background:rgba(44,62,45,0.06);border:1px solid rgba(44,62,45,0.10);padding:0;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr>
            <th align="left" style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B635C;border-bottom:1px solid rgba(44,62,45,0.10);">Vehicle</th>
            <th align="left" style="padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B635C;border-bottom:1px solid rgba(44,62,45,0.10);">Reason</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`,
      `Fleet — ${flagged.length} vehicle${flagged.length !== 1 ? "s" : ""} need attention`
    );
    await sendEmail({
      to: adminTo,
      subject: `[Fleet] ${flagged.length} vehicle(s) need maintenance attention`,
      html,
    });
  }

  return NextResponse.json({
    ok: true,
    checked: list.length,
    flagged: flagged.length,
    emailed: flagged.length > 0 && !!adminTo,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
