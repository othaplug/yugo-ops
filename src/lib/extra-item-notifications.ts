import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { formatJobId } from "@/lib/move-code";
import { emailLayout } from "@/lib/email-templates";

interface ExtraItemNotifyPayload {
  jobId: string;
  jobType: "move" | "delivery";
  requestedBy: "crew" | "client";
  description: string;
  quantity: number;
}

export async function notifyExtraItemRequest(payload: ExtraItemNotifyPayload): Promise<void> {
  const { jobId, jobType, requestedBy, description, quantity } = payload;
  const admin = createAdminClient();

  const byLabel = requestedBy === "crew" ? "Crew" : "Client";
  const qtyLabel = quantity > 1 ? ` (x${quantity})` : "";
  const eventDescription = `${byLabel} requested extra item: "${description}"${qtyLabel}, pending approval`;

  let entityCode = jobId;
  if (jobType === "move") {
    const { data } = await admin.from("moves").select("move_code").eq("id", jobId).maybeSingle();
    entityCode = data?.move_code || jobId;
  } else {
    const { data } = await admin.from("deliveries").select("delivery_number").eq("id", jobId).maybeSingle();
    entityCode = data?.delivery_number || jobId;
  }

  await admin.from("status_events").insert({
    entity_type: jobType,
    entity_id: entityCode,
    event_type: "extra_item_requested",
    description: eventDescription,
    icon: "clipboard",
  }).then(() => {}, () => {});

  if (!process.env.RESEND_API_KEY) return;

  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_YUGO_EMAIL || "").trim();
  if (!adminEmail) return;

  try {
    const resend = getResend();
    const jobLabel = formatJobId(entityCode, jobType);

    const inner = `
      <div style="font-size:9px;font-weight:700;color:#B8962E;letter-spacing:1.5px;text-transform:none;margin-bottom:8px;">Extra Item Request</div>
      <div style="font-size:20px;font-weight:700;margin:0 0 12px;color:#F5F5F3;">Extra Item Request</div>
      <p style="font-size:14px;color:#B0ADA8;margin:0 0 20px;">A new extra item request needs your approval.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:8px 0;color:#666;font-size:13px;width:110px;">Job</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px;font-weight:600;">${jobLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Requested by</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px;">${byLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Item</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px;">${description}${qtyLabel}</td></tr>
        <tr><td style="padding:8px 0;color:#666;font-size:13px;">Status</td><td style="padding:8px 0;color:#B8962E;font-size:13px;font-weight:600;">Pending Approval</td></tr>
      </table>
      <p style="font-size:12px;color:#666;margin-top:20px;">Review and approve or reject this request in the admin portal.</p>
    `;
    const emailFrom = await getEmailFrom();
    await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: `Extra Item Request ${jobLabel}`,
      html: emailLayout(inner),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
  } catch {}
}
