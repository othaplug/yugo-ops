import { getClientEmailFooterTrs, type ClientEmailFooterOptions } from "@/lib/email/client-email-footer";
import {
  EMAIL_PREMIUM_PAGE,
  EMAIL_SANS_STACK,
  EMAIL_WINE,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import { getEmailLogoWineUrl } from "@/lib/email-templates";
import { escapeHtmlEmail } from "@/lib/email/email-link-utils";
import { formatPhone } from "@/lib/phone";

export type PhotoRequestEmailData = {
  firstName: string
  coordinatorName: string
  coordinatorPhone: string
  surveyUrl: string
  moveDate?: string | null
  fromAddress?: string | null
}

/**
 * Client-facing “share room photos” request. Matches Yugo cream transactional shell; forest CTA.
 */
export function buildPhotoRequestEmail(
  data: PhotoRequestEmailData,
): { subject: string; html: string } {
  const name = (data.firstName || "there").trim() || "there";
  const coord = (data.coordinatorName || "your coordinator").trim();
  const phoneRaw = (data.coordinatorPhone || "").trim();
  const phone = phoneRaw ? formatPhone(phoneRaw) : "";
  const subject = `${name}, help us prepare your move`;
  const safeName = escapeHtmlEmail(name);
  const safeCoord = escapeHtmlEmail(coord);
  const safePhone = phone ? escapeHtmlEmail(phone) : "";
  const moveDate = (data.moveDate || "").trim();
  const fromAddr = (data.fromAddress || "").trim();
  const metaRow =
    moveDate || fromAddr
      ? `<tr>
      <td style="padding:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${
            fromAddr
              ? `<tr>
            <td style="font-size:11px;font-weight:700;color:#6B635C;letter-spacing:0.08em;text-transform:uppercase;font-family:${EMAIL_SANS_STACK};padding:0 0 6px;">From</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#3A3532;font-family:${EMAIL_SANS_STACK};line-height:1.5;">${escapeHtmlEmail(fromAddr)}</td>
          </tr>`
              : ""
          }
          ${
            moveDate
              ? `<tr>
            <td style="font-size:11px;font-weight:700;color:#6B635C;letter-spacing:0.08em;text-transform:uppercase;font-family:${EMAIL_SANS_STACK};padding:12px 0 6px;">Preferred date</td>
          </tr>
          <tr>
            <td style="font-size:14px;color:#3A3532;font-family:${EMAIL_SANS_STACK};line-height:1.5;">${escapeHtmlEmail(moveDate)}</td>
          </tr>`
              : ""
          }
        </table>
      </td>
    </tr>`
      : "";

  const footerOpt: ClientEmailFooterOptions = {
    whyReceiving: "quote",
    variant: "transactional",
    spacerBackground: EMAIL_PREMIUM_PAGE,
  };

  const cta = emailPrimaryCtaStyle(EMAIL_SANS_STACK, "inline-block");

  const html = `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:560px;margin:0 auto;border-collapse:collapse;">
    <tr>
      <td style="padding:28px 0 0;">
        <img src="${getEmailLogoWineUrl()}" width="120" height="32" alt="Yugo" style="display:block;border:0;height:auto;max-width:120px;" />
      </td>
    </tr>
    <tr>
      <td style="padding:48px 0 16px;">
        <p style="font-size:24px;color:${EMAIL_WINE};margin:0;font-family:Georgia,serif;line-height:1.3;">
          Hi ${safeName},
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.7;font-family:${EMAIL_SANS_STACK};">
          Thank you for reaching out to Yugo. I am ${safeCoord}, and I will be personally handling your move.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 16px;">
        <p style="font-size:15px;color:#3A3532;margin:0;line-height:1.7;font-family:${EMAIL_SANS_STACK};">
          To prepare an accurate quote for you, I would love to see your space. A few quick photos of each room help me plan
          the right crew, truck, and timeline so there are no surprises on move day.
        </p>
      </td>
    </tr>
    ${metaRow}
    <tr>
      <td style="padding:0 0 20px;text-align:center;">
        <p style="font-size:12px;color:#6B635C;margin:0 0 8px;font-family:${EMAIL_SANS_STACK};">
          It takes about five minutes on your phone.
        </p>
        <a href="${escapeHtmlAttr(data.surveyUrl)}" style="${cta}">
          Share room photos
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 20px;">
        <p style="font-size:13px;color:#6B635C;margin:0;line-height:1.6;font-family:${EMAIL_SANS_STACK};">
          Prefer a video call instead? Reply to this email${
            phone
              ? ` or call me at <a href="tel:${escapeHtmlAttr(phoneRaw.replace(/\D/g, ""))}" style="color:${EMAIL_WINE};text-decoration:underline;">${safePhone}</a>`
              : ""
          }, and I can walk through your home with you virtually.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 0 0;border-top:1px solid rgba(44,62,45,0.14);">
        <p style="font-size:14px;color:#3A3532;margin:0;font-family:${EMAIL_SANS_STACK};font-weight:600;">${safeCoord}</p>
        ${
          phone
            ? `<p style="font-size:12px;color:#6B635C;margin:6px 0 0;font-family:${EMAIL_SANS_STACK};">
          Move coordinator · ${safePhone}
        </p>`
            : `<p style="font-size:12px;color:#6B635C;margin:6px 0 0;font-family:${EMAIL_SANS_STACK};">
          Move coordinator
        </p>`
        }
      </td>
    </tr>
    ${getClientEmailFooterTrs(footerOpt)}
  </table>`;

  return { subject, html };
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
