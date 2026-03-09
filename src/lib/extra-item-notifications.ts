import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { formatJobId } from "@/lib/move-code";

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
  const eventDescription = `${byLabel} requested extra item: "${description}"${qtyLabel} — pending approval`;

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
    icon: "package",
  }).then(() => {}, () => {});

  if (!process.env.RESEND_API_KEY) return;

  const adminEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NEXT_PUBLIC_YUGO_EMAIL || "").trim();
  if (!adminEmail) return;

  try {
    const resend = getResend();
    const jobLabel = formatJobId(entityCode, jobType);

    const emailFrom = await getEmailFrom();
    await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: `Extra Item Request — ${jobLabel}`,
      html: `
        <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="display:inline-flex;align-items:center;padding:8px 20px;border-radius:9999px;background:#0F0F0F;border:1px solid rgba(201,169,98,0.35);font-family:'Instrument Serif',Georgia,serif;font-size:14px;font-weight:600;letter-spacing:1.5px;color:#C9A962">YUGO+</div>
          </div>
          <h1 style="font-size:20px;font-weight:700;margin:0 0 12px;color:#F5F5F3">Extra Item Request</h1>
          <p style="font-size:14px;color:#B0ADA8;margin:0 0 20px">A new extra item request needs your approval.</p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:8px 0;color:#888;font-size:13px;width:110px">Job</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px;font-weight:600">${jobLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px">Requested by</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px">${byLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px">Item</td><td style="padding:8px 0;color:#F5F5F3;font-size:13px">${description}${qtyLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#888;font-size:13px">Status</td><td style="padding:8px 0;color:#C9A962;font-size:13px;font-weight:600">Pending Approval</td></tr>
          </table>
          <p style="font-size:12px;color:#666;margin-top:20px">Review and approve or reject this request in the admin portal.</p>
        </div>
      `,
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
  } catch {}
}
