import { sendSMS } from "@/lib/sms/sendSMS"
import { buildLeadAcknowledgmentEmail } from "@/lib/email/lead-acknowledgment-client"
import { sendEmail } from "@/lib/email/send"
import { getEmailBaseUrl } from "@/lib/email-base-url"

const COORD_PHONE_DISPLAY = "(647) 370-4525"

export async function sendLeadAcknowledgment(lead: {
  first_name?: string | null
  email?: string | null
  phone?: string | null
  move_size?: string | null
  preferred_date?: string | null
  from_address?: string | null
  to_address?: string | null
  service_type?: string | null
}): Promise<void> {
  const first = (lead.first_name || "there").trim() || "there"

  if (lead.phone && lead.phone.replace(/\D/g, "").length >= 10) {
    const sms =
      `Hi ${first}, thanks for reaching out to Yugo!\n` +
      `We have received your inquiry and a member of our team will be in touch shortly with your personalized quote.\n` +
      `The Yugo Team`
    await sendSMS(lead.phone, sms).catch((e) => console.warn("[leads] ack SMS:", e))
  }

  if (lead.email && lead.email.includes("@")) {
    const base = getEmailBaseUrl()
    const dateStr = lead.preferred_date
      ? new Date(lead.preferred_date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "—"
    const { subject, html } = buildLeadAcknowledgmentEmail({
      firstName: first,
      baseUrl: base,
      moveSize: lead.move_size,
      serviceType: lead.service_type,
      preferredDateLabel: dateStr,
      fromAddress: lead.from_address,
      toAddress: lead.to_address,
    })

    await sendEmail({
      to: lead.email.trim(),
      subject,
      html,
    }).catch((e) => console.warn("[leads] ack email:", e))
  }
}

export async function sendMissedCallSms(toPhone: string): Promise<void> {
  const body =
    "Hi, we noticed we missed your call. We would love to help! " +
    "Reply with your name and move details, or we will call you back within 15 minutes. " +
    `The Yugo Team, ${COORD_PHONE_DISPLAY}`
  await sendSMS(toPhone, body).catch((e) => console.warn("[leads] missed call SMS:", e))
}
