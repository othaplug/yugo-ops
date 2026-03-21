import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { sendEmail } from "@/lib/email/send";
import { getTodayString } from "@/lib/business-timezone";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  accepted: "Accepted",
  approved: "Approved",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  "in-transit": "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  pending: "Pending",
  pending_approval: "Pending Acceptance",
  in_progress: "In Progress",
  en_route_to_pickup: "En Route to Pickup",
  cancelled: "Cancelled",
  booked: "Booked",
  new: "New",
};

function statusColor(status: string): string {
  const s = status.toLowerCase().replace(/-/g, "_");
  if (["delivered", "completed", "confirmed", "accepted", "approved", "booked"].includes(s))
    return "#22C55E";
  if (["dispatched", "in_transit", "in_progress", "en_route_to_pickup"].includes(s))
    return "#F59E0B";
  if (["cancelled"].includes(s)) return "#EF4444";
  return "#6B7280";
}

export async function POST() {
  const { orgIds, primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const admin = createAdminClient();
  const todayStr = getTodayString();

  // Fetch org info + contact
  const { data: org } = await admin
    .from("organizations")
    .select("name, type, vertical, email_daily_summary")
    .eq("id", primaryOrgId)
    .single();

  // Check if daily summary is enabled (if column exists)
  if (org?.email_daily_summary === false) {
    return NextResponse.json({ ok: false, reason: "Daily summary not enabled" }, { status: 200 });
  }

  // Fetch the partner user email
  const { data: partnerUser } = await admin
    .from("partner_users")
    .select("email, contact_name")
    .eq("org_id", primaryOrgId)
    .limit(1)
    .single();

  if (!partnerUser?.email) {
    return NextResponse.json({ error: "No partner user email found" }, { status: 404 });
  }

  // Fetch today's deliveries
  const { data: todayDeliveries } = await admin
    .from("deliveries")
    .select("id, delivery_number, customer_name, client_name, status, scheduled_date, time_slot, delivery_address, items")
    .in("organization_id", orgIds)
    .eq("scheduled_date", todayStr)
    .order("time_slot", { ascending: true });

  // Fetch upcoming (next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const { data: upcomingDeliveries } = await admin
    .from("deliveries")
    .select("id, delivery_number, customer_name, client_name, status, scheduled_date, time_slot, delivery_address")
    .in("organization_id", orgIds)
    .gt("scheduled_date", todayStr)
    .lte("scheduled_date", nextWeekStr)
    .not("status", "in", '("completed","delivered","cancelled")')
    .order("scheduled_date", { ascending: true })
    .limit(10);

  const orgName = org?.name || "Your Organization";
  const contactName = partnerUser.contact_name || "Partner";
  const today = new Date();
  const todayFormatted = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const deliveriesToday = todayDeliveries || [];
  const upcoming = upcomingDeliveries || [];

  const deliveryRows = deliveriesToday
    .map((d) => {
      const label = STATUS_LABELS[d.status?.toLowerCase() ?? ""] ?? d.status ?? "—";
      const color = statusColor(d.status ?? "");
      const recipient = d.customer_name || d.client_name || "—";
      const address = d.delivery_address || "—";
      const timeSlot = d.time_slot
        ? d.time_slot.replace(/morning/i, "Morning (8am–12pm)")
            .replace(/afternoon/i, "Afternoon (12pm–5pm)")
            .replace(/evening/i, "Evening (5pm–9pm)")
        : "Flexible";
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#E5E5E5;">${d.delivery_number || "—"}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#E5E5E5;">${recipient}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#aaa;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${address}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #2A2A2A;font-size:12px;white-space:nowrap;">
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${color}20;color:${color};font-weight:600;">${label}</span>
          </td>
          <td style="padding:12px 16px;border-bottom:1px solid #2A2A2A;font-size:12px;color:#aaa;white-space:nowrap;">${timeSlot}</td>
        </tr>`;
    })
    .join("");

  const upcomingRows = upcoming
    .map((d) => {
      const label = STATUS_LABELS[d.status?.toLowerCase() ?? ""] ?? d.status ?? "—";
      const color = statusColor(d.status ?? "");
      const recipient = d.customer_name || d.client_name || "—";
      const dateStr = d.scheduled_date
        ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
        : "—";
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#E5E5E5;">${dateStr}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#E5E5E5;">${d.delivery_number || "—"}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #2A2A2A;font-size:13px;color:#E5E5E5;">${recipient}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #2A2A2A;font-size:12px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${color}20;color:${color};font-weight:600;">${label}</span>
          </td>
        </tr>`;
    })
    .join("");

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;min-height:100vh;font-family:'DM Sans',Arial,sans-serif;">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding-bottom:32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Yugo<span style="color:#C9A962;">+</span></span>
            </td>
            <td align="right">
              <span style="font-size:11px;color:#666;letter-spacing:0.06em;text-transform:uppercase;">Daily Summary</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Hero -->
      <tr><td style="background:#141414;border:1px solid #222;border-radius:16px;padding:32px 32px 28px;">
        <p style="margin:0 0 4px;font-size:12px;color:#C9A962;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">${todayFormatted}</p>
        <h1 style="margin:0 0 8px;font-size:28px;font-weight:700;color:#fff;line-height:1.2;">Good morning, ${contactName}</h1>
        <p style="margin:0;font-size:14px;color:#888;">
          Here's your delivery summary for today from <strong style="color:#ddd;">${orgName}</strong>.
        </p>

        <!-- KPIs -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr>
            <td width="33%" style="padding-right:8px;">
              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#fff;">${deliveriesToday.length}</div>
                <div style="font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:0.08em;">Today</div>
              </div>
            </td>
            <td width="33%" style="padding-right:8px;">
              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#22C55E;">${deliveriesToday.filter((d) => ["delivered", "completed", "confirmed"].includes((d.status || "").toLowerCase())).length}</div>
                <div style="font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:0.08em;">Confirmed</div>
              </div>
            </td>
            <td width="33%">
              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:16px;text-align:center;">
                <div style="font-size:24px;font-weight:700;color:#C9A962;">${upcoming.length}</div>
                <div style="font-size:11px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:0.08em;">Upcoming</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      ${deliveriesToday.length > 0 ? `
      <!-- Today's Deliveries -->
      <tr><td style="padding-top:28px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.1em;">Today's Deliveries</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#1A1A1A;">
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Ref #</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Recipient</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Address</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Time</th>
            </tr>
          </thead>
          <tbody>${deliveryRows}</tbody>
        </table>
      </td></tr>
      ` : `
      <tr><td style="padding-top:28px;">
        <div style="background:#141414;border:1px solid #222;border-radius:12px;padding:32px;text-align:center;">
          <p style="margin:0;font-size:14px;color:#555;">No deliveries scheduled for today.</p>
        </div>
      </td></tr>
      `}

      ${upcoming.length > 0 ? `
      <!-- Upcoming -->
      <tr><td style="padding-top:28px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.1em;">Upcoming This Week</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #222;border-radius:12px;overflow:hidden;">
          <thead>
            <tr style="background:#1A1A1A;">
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Date</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Ref #</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Recipient</th>
              <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Status</th>
            </tr>
          </thead>
          <tbody>${upcomingRows}</tbody>
        </table>
      </td></tr>
      ` : ""}

      <!-- CTA -->
      <tr><td style="padding-top:28px;text-align:center;">
        <a href="https://partner.helloyugo.com/partner" style="display:inline-block;background:linear-gradient(135deg,#2D6A4F,#3a7d5a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:0.02em;">
          Open Partner Portal →
        </a>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding-top:32px;padding-bottom:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#444;">You're receiving this because daily summaries are enabled in your portal settings.</p>
        <p style="margin:4px 0 0;font-size:11px;color:#333;">Yugo+ · <a href="https://partner.helloyugo.com/partner" style="color:#555;text-decoration:none;">Manage preferences</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>`;

  const result = await sendEmail({
    to: partnerUser.email,
    subject: `Daily Summary – ${deliveriesToday.length} delivery${deliveriesToday.length !== 1 ? "ies" : ""} today · ${today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    html,
  });

  return NextResponse.json({ ok: result.success, email: partnerUser.email, count: deliveriesToday.length });
}
