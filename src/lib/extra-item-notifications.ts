import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { formatJobId } from "@/lib/move-code";
import { EMAIL_FOREST } from "@/lib/email/email-brand-tokens";
import { emailNestedKvRow } from "@/lib/email/email-kv-layout";
import { escapeHtmlEmail } from "@/lib/email/email-link-utils";
import { emailLayout, PREMIUM_FONT } from "@/lib/email-templates";
import { getAdminNotificationEmail } from "@/lib/config";

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

  const adminEmail = (await getAdminNotificationEmail()).trim();
  if (!adminEmail) return;

  try {
    const resend = getResend();
    const jobLabel = formatJobId(entityCode, jobType);

    const kicker = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px`;
    const rowLbl = `padding:6px 12px 6px 0;color:#6B635C;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;width:38%;vertical-align:top;font-family:${PREMIUM_FONT}`;
    const rowVal = `padding:6px 0;color:#3A3532;font-size:13px;text-align:right;vertical-align:top;font-family:${PREMIUM_FONT}`;
    const rowValStrong = `${rowVal};font-weight:600`;
    const rowValForest = `${rowVal};font-weight:600;color:${EMAIL_FOREST}`;
    const div = "1px solid rgba(44,62,45,0.12)";
    const inner = `
      <div style="${kicker}">Extra item request</div>
      <div style="font-size:20px;font-weight:700;margin:0 0 12px;color:#3A3532;font-family:'Instrument Serif',Georgia,serif;">Extra item request</div>
      <p style="font-size:14px;color:#6B635C;margin:0 0 20px;line-height:1.62;font-family:${PREMIUM_FONT};">A new extra item request needs your approval.</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:24px;font-family:${PREMIUM_FONT};">
        ${emailNestedKvRow({
          borderTop: "none",
          labelStyle: rowLbl,
          valueStyle: rowValStrong,
          label: "Job",
          valueHtml: escapeHtmlEmail(jobLabel),
        })}
        ${emailNestedKvRow({
          borderTop: div,
          labelStyle: rowLbl,
          valueStyle: rowVal,
          label: "Requested by",
          valueHtml: escapeHtmlEmail(byLabel),
        })}
        ${emailNestedKvRow({
          borderTop: div,
          labelStyle: rowLbl,
          valueStyle: rowVal,
          label: "Item",
          valueHtml: escapeHtmlEmail(`${description}${qtyLabel}`),
        })}
        ${emailNestedKvRow({
          borderTop: div,
          labelStyle: rowLbl,
          valueStyle: rowValForest,
          label: "Status",
          valueHtml: "Pending approval",
        })}
      </table>
      <p style="font-size:12px;color:#6B635C;margin-top:20px;line-height:1.6;font-family:${PREMIUM_FONT};">Review and approve or reject this request in the admin portal.</p>
    `;
    const emailFrom = await getEmailFrom();
    await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: `Extra Item Request ${jobLabel}`,
      html: emailLayout(inner, undefined, "generic"),
      headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
    });
  } catch {}
}
