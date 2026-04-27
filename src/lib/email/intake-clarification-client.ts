import { getClientEmailFooterTrs, type ClientEmailFooterOptions } from "@/lib/email/client-email-footer"
import { getClientSupportEmail } from "@/lib/email/client-support-email"
import {
  EMAIL_FOREST,
  EMAIL_PREMIUM_ISLAND,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_PAGE,
  EMAIL_SANS_STACK,
  EMAIL_WINE,
} from "@/lib/email/email-brand-tokens"
import { getEmailLogoWineUrl, EMAIL_LOGO_BLACK_W, EMAIL_LOGO_BLACK_H } from "@/lib/email-templates"
import { escapeHtmlEmail } from "@/lib/email/email-link-utils"
import { formatPhone, normalizePhone } from "@/lib/phone"

const RULE = "rgba(44,62,45,0.14)"
const RULE_STRONG = "rgba(44,62,45,0.2)"

/**
 * Client email when a coordinator sends a follow-up from lead intake.
 * Full Yugo cream transactional: wordmark, forest accents, coordinator card, full footer.
 */
export function buildIntakeClarificationEmail(params: {
  firstName: string
  coordinatorName: string
  coordinatorPhone?: string | null
  message: string
}): { subject: string; html: string } {
  const first = (params.firstName || "there").trim() || "there"
  const coord = (params.coordinatorName || "Your Yugo coordinator").trim()
  const subject = "A quick question about your move"
  const safeName = escapeHtmlEmail(first)
  const safeCoord = escapeHtmlEmail(coord)
  const messageHtml = escapeHtmlEmail(params.message).replace(/\n/g, "<br/>")
  const phoneRaw = (params.coordinatorPhone || "").trim()
  const phoneDigits = phoneRaw ? normalizePhone(phoneRaw) : ""
  const phoneDisplay = phoneRaw ? formatPhone(phoneRaw) : ""
  const safePhone = phoneDisplay ? escapeHtmlEmail(phoneDisplay) : ""
  const telHref =
    phoneDigits.length >= 10
      ? `tel:+1${phoneDigits.length === 10 ? phoneDigits : phoneDigits.slice(-10)}`
      : phoneRaw
        ? `tel:${phoneRaw.replace(/\s/g, "").replace(/[()]/g, "")}`
        : ""
  const supportEmail = getClientSupportEmail()
  const safeSupport = escapeHtmlEmail(supportEmail)
  const supportMailto = `mailto:${encodeURIComponent(supportEmail)}`

  const footerOpt: ClientEmailFooterOptions = {
    whyReceiving: "quote",
    /** Social icons + full nav: matches premium client marketing footers. */
    variant: "full",
    spacerBackground: EMAIL_PREMIUM_PAGE,
  }

  const coordCard = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_PREMIUM_MUTED_FILL};border:1px solid ${RULE};border-left:3px solid ${EMAIL_FOREST};">
      <tr>
        <td style="padding:18px 20px;">
          <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B635C;margin:0 0 4px;font-family:${EMAIL_SANS_STACK};">Your coordinator</p>
          <p style="font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 4px;font-family:${EMAIL_SANS_STACK};line-height:1.3;">${safeCoord}</p>
          <p style="font-size:12px;color:#6B635C;margin:0 0 8px;font-family:${EMAIL_SANS_STACK};">Yugo move coordinator</p>
          ${
            phoneDisplay && telHref
              ? `<p style="font-size:14px;font-weight:600;margin:0;font-family:${EMAIL_SANS_STACK};">
              <a href="${telHref}" style="color:${EMAIL_WINE};text-decoration:underline;">${safePhone}</a>
            </p>
            <p style="font-size:12px;color:#6B635C;margin:8px 0 0;font-family:${EMAIL_SANS_STACK};line-height:1.5;">Call or text with your answer, or use reply on this email so everything stays in one thread.</p>`
              : `<p style="font-size:12px;color:#6B635C;margin:0;font-family:${EMAIL_SANS_STACK};line-height:1.5;">Reply to this message so we keep your quote details in one place.</p>`
          }
        </td>
      </tr>
    </table>`

  const howToList = phoneDisplay
    ? `<ul style="margin:0;padding:0 0 0 18px;font-family:${EMAIL_SANS_STACK};color:#3A3532;font-size:14px;line-height:1.65;">
      <li style="margin:0 0 6px;">Reply to this email with your answer (you can attach photos).</li>
      <li style="margin:0 0 6px;">Or call or text <a href="${telHref}" style="color:${EMAIL_WINE};font-weight:600;">${safePhone}</a> and mention your move inquiry.</li>
      <li style="margin:0;">For general help, contact <a href="${supportMailto}" style="color:${EMAIL_WINE};text-decoration:underline;">${safeSupport}</a> or the number in the footer below.</li>
    </ul>`
    : `<ul style="margin:0;padding:0 0 0 18px;font-family:${EMAIL_SANS_STACK};color:#3A3532;font-size:14px;line-height:1.65;">
      <li style="margin:0 0 6px;">Reply to this email with your answer (you can attach photos).</li>
      <li style="margin:0;">For general help, use <a href="${supportMailto}" style="color:${EMAIL_WINE};text-decoration:underline;">${safeSupport}</a> or the contact options in the footer.</li>
    </ul>`

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;margin:0 auto;border-collapse:collapse;background-color:${EMAIL_PREMIUM_PAGE};" bgcolor="${EMAIL_PREMIUM_PAGE}">
  <tr>
    <td style="padding:24px 20px 32px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin:0 auto;border-collapse:collapse;">

    <tr>
      <td style="text-align:left;padding:0 0 16px;">
        <img src="${getEmailLogoWineUrl()}" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" alt="Yugo" style="display:block;border:0;height:auto;max-width:${EMAIL_LOGO_BLACK_W}px;" />
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr><td style="height:1px;background:${RULE};line-height:0;font-size:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 6px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_FOREST};margin:0;font-family:${EMAIL_SANS_STACK};">Quote follow-up</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <p style="font-size:26px;color:${EMAIL_WINE};margin:0;font-family:Georgia,'Times New Roman',serif;line-height:1.25;">Hi ${safeName},</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 20px;">
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.7;font-family:${EMAIL_SANS_STACK};">
          I am <strong style="color:#1a1a1a;">${safeCoord}</strong>, your Yugo move coordinator. I have one more question to finish your personalized quote. Your answer here helps us get crew time, equipment, and pricing right the first time.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 8px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B635C;margin:0 0 10px;font-family:${EMAIL_SANS_STACK};">What we need from you</p>
        <div style="background:${EMAIL_PREMIUM_ISLAND};border:1px solid ${RULE_STRONG};border-left:4px solid ${EMAIL_FOREST};padding:18px 20px;">
          <p style="font-size:16px;color:#1a1a1a;margin:0;line-height:1.65;font-family:${EMAIL_SANS_STACK};font-weight:500;">${messageHtml}</p>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 0 8px;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B635C;margin:0 0 10px;font-family:${EMAIL_SANS_STACK};">How to respond</p>
        ${howToList}
      </td>
    </tr>
    <tr>
      <td style="padding:24px 0 0;">${coordCard}</td>
    </tr>
    <tr>
      <td style="padding:20px 0 0;border-top:1px solid ${RULE};">
        <p style="font-size:12px;color:#6B635C;margin:0;line-height:1.55;font-family:${EMAIL_SANS_STACK};">
          This message is about your Yugo move quote. We never ask for card numbers or banking details by email. If something looks off, contact us at <a href="${supportMailto}" style="color:${EMAIL_WINE};text-decoration:underline;">${safeSupport}</a> before you click unknown links.
        </p>
      </td>
    </tr>
    ${getClientEmailFooterTrs(footerOpt)}
      </table>
    </td>
  </tr>
  </table>`

  return { subject, html }
}
