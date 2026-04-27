import { getClientEmailFooterTrs, type ClientEmailFooterOptions } from "@/lib/email/client-email-footer"
import {
  EMAIL_PREMIUM_ISLAND,
  EMAIL_PREMIUM_PAGE,
  EMAIL_SANS_STACK,
  EMAIL_WINE,
} from "@/lib/email/email-brand-tokens"
import { getEmailLogoWineUrl } from "@/lib/email-templates"
import { escapeHtmlEmail } from "@/lib/email/email-link-utils"

const RULE = "rgba(44,62,45,0.14)"

const COORD_PHONE_DISPLAY = "(647) 370-4525"

export function buildLeadAcknowledgmentEmail(params: {
  firstName: string
  baseUrl: string
  moveSize?: string | null
  serviceType?: string | null
  preferredDateLabel: string
  fromAddress?: string | null
  toAddress?: string | null
}): { subject: string; html: string } {
  const first = (params.firstName || "there").trim() || "there"
  const safe = escapeHtmlEmail(first)
  const subject = "We received your Yugo move inquiry"
  const rows: string[] = []
  if (params.moveSize) {
    rows.push(
      `<tr><td style="color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding:0 0 4px;vertical-align:top;width:36%;">Move size</td><td style="color:#1a1a1a;padding:0 0 8px;">${escapeHtmlEmail(params.moveSize)}</td></tr>`,
    )
  }
  if (params.serviceType) {
    rows.push(
      `<tr><td style="color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding:0 0 4px;vertical-align:top;">Service</td><td style="color:#1a1a1a;padding:0 0 8px;">${escapeHtmlEmail(params.serviceType.replace(/_/g, " "))}</td></tr>`,
    )
  }
  if (params.preferredDateLabel && params.preferredDateLabel !== "—") {
    rows.push(
      `<tr><td style="color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding:0 0 4px;vertical-align:top;">Preferred date</td><td style="color:#1a1a1a;padding:0 0 8px;">${escapeHtmlEmail(params.preferredDateLabel)}</td></tr>`,
    )
  }
  if (params.fromAddress) {
    rows.push(
      `<tr><td style="color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding:0 0 4px;vertical-align:top;">From</td><td style="color:#1a1a1a;padding:0 0 8px;line-height:1.5;">${escapeHtmlEmail(params.fromAddress)}</td></tr>`,
    )
  }
  if (params.toAddress) {
    rows.push(
      `<tr><td style="color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;padding:0 0 4px;vertical-align:top;">To</td><td style="color:#1a1a1a;padding:0 0 8px;line-height:1.5;">${escapeHtmlEmail(params.toAddress)}</td></tr>`,
    )
  }
  const detailsTable =
    rows.length > 0
      ? `<div style="background:${EMAIL_PREMIUM_ISLAND};border:1px solid ${RULE};padding:16px 18px;margin:0 0 18px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B635C;margin:0 0 10px;font-family:${EMAIL_SANS_STACK};">What you sent</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;font-family:${EMAIL_SANS_STACK};">${rows.join("")}</table>
      </div>`
      : ""

  const footerOpt: ClientEmailFooterOptions = {
    whyReceiving: "quote",
    variant: "transactional",
    spacerBackground: EMAIL_PREMIUM_PAGE,
  }
  const baseDisplay = (params.baseUrl || "").replace(/^https?:\/\//, "")

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:28px 0 0;">
        <img src="${getEmailLogoWineUrl()}" width="120" height="32" alt="Yugo" style="display:block;border:0;height:auto;max-width:120px;" />
      </td>
    </tr>
    <tr>
      <td style="padding:40px 0 14px;">
        <p style="font-size:24px;color:${EMAIL_WINE};margin:0;font-family:Georgia,serif;line-height:1.3;">Hi ${safe},</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.65;font-family:${EMAIL_SANS_STACK};">
          Thank you for reaching out. We have your moving inquiry and are preparing a personalized quote. A member of our team will follow up soon, most often within the hour during business hours.
        </p>
      </td>
    </tr>
    ${detailsTable}
    <tr>
      <td style="padding:0 0 12px;">
        <p style="font-size:14px;color:#3A3532;margin:0;line-height:1.6;font-family:${EMAIL_SANS_STACK};">
          If you need help right away, call us at <strong style="color:#1a1a1a;">${COORD_PHONE_DISPLAY}</strong> and mention this inquiry.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 0;">
        <p style="font-size:14px;color:#3A3532;margin:0;font-family:${EMAIL_SANS_STACK};">The Yugo Team</p>
        <p style="font-size:12px;color:#6B635C;margin:12px 0 0;font-family:${EMAIL_SANS_STACK};"><a href="${escapeHtmlEmail(params.baseUrl)}" style="color:${EMAIL_WINE};text-decoration:underline;">${escapeHtmlEmail(baseDisplay)}</a></p>
      </td>
    </tr>
    ${getClientEmailFooterTrs(footerOpt)}
  </table>`

  return { subject, html }
}
