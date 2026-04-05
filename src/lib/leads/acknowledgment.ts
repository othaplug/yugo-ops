import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const COORD_PHONE_DISPLAY = "(647) 370-4525";

export async function sendLeadAcknowledgment(lead: {
  first_name?: string | null;
  email?: string | null;
  phone?: string | null;
  move_size?: string | null;
  preferred_date?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  service_type?: string | null;
}): Promise<void> {
  const first = (lead.first_name || "there").trim() || "there";

  if (lead.phone && lead.phone.replace(/\D/g, "").length >= 10) {
    const sms =
      `Hi ${first}, thanks for reaching out to Yugo!\n` +
      `We've received your inquiry and a member of our team will be in touch shortly with your personalized quote.\n` +
      `— The Yugo Team`;
    await sendSMS(lead.phone, sms).catch((e) => console.warn("[leads] ack SMS:", e));
  }

  if (lead.email && lead.email.includes("@")) {
    const base = getEmailBaseUrl();
    const dateStr = lead.preferred_date
      ? new Date(lead.preferred_date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—";
    const details = [
      lead.move_size ? `Move size: ${lead.move_size}` : null,
      lead.service_type ? `Service: ${lead.service_type}` : null,
      dateStr !== "—" ? `Preferred date: ${dateStr}` : null,
      lead.from_address ? `From: ${lead.from_address}` : null,
      lead.to_address ? `To: ${lead.to_address}` : null,
    ]
      .filter(Boolean)
      .join("<br/>");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body class="email-outer-gutter yugo-light-email-doc" style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:16px 20px;">
  <p>Hi ${first.replace(/</g, "&lt;")},</p>
  <p>Thank you for reaching out. We've received your moving inquiry and are preparing your personalized quote.</p>
  <p>A member of our team will be in touch within the hour.<br/>
  If you need immediate assistance, call ${COORD_PHONE_DISPLAY}.</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;"/>
  <p style="font-size:14px;color:#444;">${details || "We'll confirm details when we reach out."}</p>
  <p style="margin-top:24px;">— The Yugo Team</p>
  <p style="font-size:12px;color:#888;"><a href="${base}">${base.replace(/^https?:\/\//, "")}</a></p>
</body></html>`;

    await sendEmail({
      to: lead.email.trim(),
      subject: "We've received your inquiry — Yugo",
      html,
    }).catch((e) => console.warn("[leads] ack email:", e));
  }
}

export async function sendMissedCallSms(toPhone: string): Promise<void> {
  const body =
    "Hi, we noticed we missed your call. We'd love to help! " +
    "Reply with your name and move details, or we'll call you back within 15 minutes. " +
    `— Yugo, ${COORD_PHONE_DISPLAY}`;
  await sendSMS(toPhone, body).catch((e) => console.warn("[leads] missed call SMS:", e));
}
