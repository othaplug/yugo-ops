import { getClientEmailFooterTrs, type ClientEmailFooterOptions } from "@/lib/email/client-email-footer"
import { EMAIL_PREMIUM_PAGE, EMAIL_SANS_STACK, EMAIL_WINE } from "@/lib/email/email-brand-tokens"
import { getEmailLogoWineUrl } from "@/lib/email-templates"
import { escapeHtmlEmail } from "@/lib/email/email-link-utils"

const COORD_PHONE_DISPLAY = "(647) 370-4525"

export function buildSmartFollowUpEmail(params: {
  firstName: string
  questions: string[]
}): { subject: string; html: string } {
  const first = (params.firstName || "there").trim() || "there"
  const safe = escapeHtmlEmail(first)
  const subject = "Quick questions for your Yugo quote"
  const listItems = params.questions
    .map(
      (q) =>
        `<li style="margin:0 0 10px;padding-left:4px;font-size:15px;color:#1a1a1a;line-height:1.6;font-family:${EMAIL_SANS_STACK};">${escapeHtmlEmail(q)}</li>`,
    )
    .join("")

  const footerOpt: ClientEmailFooterOptions = {
    whyReceiving: "quote",
    variant: "transactional",
    spacerBackground: EMAIL_PREMIUM_PAGE,
  }

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
        <p style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6B635C;margin:0 0 8px;font-family:${EMAIL_SANS_STACK};">Quote details</p>
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.65;font-family:${EMAIL_SANS_STACK};">
          Thanks for reaching out to Yugo. To give you the most accurate price, we need a few details:
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 20px;">
        <ol style="margin:0;padding:0 0 0 22px;font-family:${EMAIL_SANS_STACK};" start="1">
          ${listItems}
        </ol>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 0;">
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.6;font-family:${EMAIL_SANS_STACK};">
          Reply to this email or call <strong style="color:#1a1a1a;">${COORD_PHONE_DISPLAY}</strong> and we will get your quote back as soon as we can, usually within the hour.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 0 0;">
        <p style="font-size:14px;color:#3A3532;margin:0;font-family:${EMAIL_SANS_STACK};">The Yugo Team</p>
      </td>
    </tr>
    ${getClientEmailFooterTrs(footerOpt)}
  </table>`

  return { subject, html }
}
