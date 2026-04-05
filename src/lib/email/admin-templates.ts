/**
 * Styled HTML templates for admin/coordinator notification emails.
 * All use light background and dark text for readability (no bare plain-text emails).
 * Typography: forest kickers 12px uppercase; primary buttons match transactional forest CTA.
 */
import { getEmailFooterStandaloneFragment } from "@/lib/email/client-email-footer";
import {
  EMAIL_DM_SANS_STACK,
  EMAIL_FOREST,
  EMAIL_PREMIUM_ISLAND,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_PAGE,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import {
  EMAIL_LOGO_BLACK_H,
  EMAIL_LOGO_BLACK_W,
  getEmailLogoWineUrl,
} from "@/lib/email-templates";
import { EMAIL_FLUID_MAX_WIDTH_PX } from "@/lib/email/email-responsive-css";

const ACCENT_ROSE = "#9E4A5C";
/** Warm island — matches client quote email card face. */
const CARD_BG = EMAIL_PREMIUM_ISLAND;
const PAGE_BG = EMAIL_PREMIUM_PAGE;
const DETAIL_BAND_BG = EMAIL_PREMIUM_MUTED_FILL;
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#555";
const BORDER = "rgba(0,0,0,0.08)";
const BTN_FONT = EMAIL_DM_SANS_STACK;
/** Structured row labels (quote parity). */
const ADMIN_LABEL_TD = `color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding:5px 12px 5px 0;vertical-align:top;width:38%;font-family:${BTN_FONT}`;
const ADMIN_KICKER = `font-size:12px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;font-family:${BTN_FONT}`;

/** Full document wrapper for admin notifications: light bg, white card with logo inside card. */
export function adminNotificationLayout(
  innerHtml: string,
  title?: string,
): string {
  const heading = title
    ? `<h1 style="font-size:18px;font-weight:700;color:${TEXT};margin:0 0 16px;">${escapeHtml(title)}</h1>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body class="yugo-light-email-doc" style="margin:0;padding:0;background:${PAGE_BG};font-family:${BTN_FONT};">
<div class="email-outer-gutter" style="width:100%;max-width:${EMAIL_FLUID_MAX_WIDTH_PX}px;margin:0 auto;padding:40px 24px;box-sizing:border-box;">
  <div style="background:${CARD_BG};border-radius:0;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid ${BORDER};">
    <div style="text-align:center;margin-bottom:22px;">
      <img src="${getEmailLogoWineUrl()}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" style="display:inline-block;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;border:0;" />
    </div>
    ${heading}
    <div style="font-size:14px;color:${TEXT};line-height:1.6;">
      ${innerHtml}
    </div>
  </div>
  <p style="margin:20px 0 0;font-size:11px;color:${TEXT_MUTED};text-align:center;max-width:${EMAIL_FLUID_MAX_WIDTH_PX}px;margin-left:auto;margin-right:auto;line-height:1.5;">
    Do not forward this notification outside authorized channels. It may contain sensitive operational information.
  </p>
</div>
${getEmailFooterStandaloneFragment()}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** New damage claim — admin notification (client-submitted or admin-created). */
export function newClaimAdminEmailHtml(params: {
  claimNumber: string;
  clientName: string;
  itemCount: number;
  totalClaimed: number;
  valuationTier: string;
  claimId: string;
  adminCreated?: boolean;
}): string {
  const baseUrl = getEmailBaseUrl();
  const viewUrl = `${baseUrl}/admin/claims/${params.claimId}`;
  const source = params.adminCreated
    ? "created by your team"
    : "submitted by the client";
  const inner = `
    <div style="${ADMIN_KICKER}">New damage claim</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.claimNumber)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 20px;">A damage claim was ${source}.</p>
    <div style="background:${DETAIL_BAND_BG};border-radius:0;padding:20px;margin-bottom:24px;border:1px solid ${BORDER};">
      <table style="width:100%;font-size:14px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD}">Client</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${escapeHtml(params.clientName)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Items</td><td style="color:${TEXT};padding:4px 0;">${params.itemCount} item${params.itemCount !== 1 ? "s" : ""}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Total claimed</td><td style="color:${EMAIL_FOREST};font-weight:700;padding:4px 0;">$${params.totalClaimed.toLocaleString()}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Valuation</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.valuationTier || "released")}</td></tr>
      </table>
    </div>
    <a href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW CLAIM</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

/** New widget lead — admin notification. Uses shared admin layout; content in a clear info block. */
export function widgetLeadAdminEmailHtml(params: {
  name: string;
  typeLabel: string;
  sizeLabel: string;
  priceStr: string;
  fromPostal: string;
  toPostal: string;
  extras?: string;
}): string {
  const baseUrl = getEmailBaseUrl();
  const viewUrl = `${baseUrl}/admin/widget-leads`;
  const routeLine = `${escapeHtml(params.fromPostal.toUpperCase())} → ${escapeHtml(params.toPostal.toUpperCase())}`;
  const inner = `
    <div style="${ADMIN_KICKER}">New widget lead</div>
    <h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 4px;">${escapeHtml(params.name)}</h1>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 16px;">Quote request from the instant quote widget.</p>
    <div style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 20px;margin-bottom:20px;border:1px solid ${BORDER};">
      <table style="width:100%;font-size:13px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Type</td><td style="color:${TEXT};font-weight:500;padding:4px 0 6px;">${escapeHtml(params.typeLabel)} · ${escapeHtml(params.sizeLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Estimate</td><td style="color:${EMAIL_FOREST};font-weight:600;padding:4px 0 6px;">${escapeHtml(params.priceStr)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Route</td><td style="color:${TEXT};padding:4px 0 6px;">${routeLine}</td></tr>
        ${params.extras ? `<tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 0 0;vertical-align:top;">Details</td><td style="color:${TEXT};font-size:12px;padding:4px 0 0;line-height:1.5;">${escapeHtml(params.extras).replace(/\|/g, " · ")}</td></tr>` : ""}
      </table>
    </div>
    <a href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW WIDGET LEADS</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

/** Estate booking — admin notification. */
export function estateBookingAdminEmailHtml(params: {
  clientName: string;
  dateLabel: string;
  totalFormatted: string;
  moveId: string;
}): string {
  const baseUrl = getEmailBaseUrl();
  const viewUrl = `${baseUrl}/admin/moves/${params.moveId}`;
  const inner = `
    <div style="${ADMIN_KICKER}">Estate booking</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.clientName)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 16px;">${escapeHtml(params.dateLabel)} · ${escapeHtml(params.totalFormatted)}</p>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px;">Assign coordinator and schedule walkthrough.</p>
    <a href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW MOVE</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

/** Tip received — admin notification. */
/** Client completed full pre-move checklist from live tracking — admin/coordinator heads-up. */
export function preMoveChecklistCompleteAdminEmailHtml(params: {
  clientName: string;
  moveCode: string;
  scheduledDateLabel: string | null;
  adminMoveUrl: string;
}): string {
  const inner = `
    <div style="${ADMIN_KICKER}">Client prep checklist</div>
    <h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 8px;">All items complete</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 16px;">
      The client finished every item on the pre-move checklist in their tracking link.
    </p>
    <div style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 20px;margin-bottom:20px;border:1px solid ${BORDER};">
      <table style="width:100%;font-size:13px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD}">Move</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${escapeHtml(params.moveCode)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Client</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.clientName)}</td></tr>
        ${
          params.scheduledDateLabel
            ? `<tr><td style="${ADMIN_LABEL_TD}">Scheduled</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.scheduledDateLabel)}</td></tr>`
            : ""
        }
      </table>
    </div>
    <a href="${params.adminMoveUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW MOVE</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

export function tipReceivedAdminEmailHtml(params: {
  clientName: string;
  amount: string;
  crewName: string;
  moveCode: string;
  netAmount: string;
}): string {
  const baseUrl = getEmailBaseUrl();
  const viewUrl = `${baseUrl}/admin/tips`;
  const inner = `
    <div style="${ADMIN_KICKER}">Tip received</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.amount)} from ${escapeHtml(params.clientName)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 16px;">For <strong>${escapeHtml(params.crewName)}</strong></p>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px;">Move: ${escapeHtml(params.moveCode)} · Net after processing: ${escapeHtml(params.netAmount)}</p>
    <a href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW TIPS</a>
  `;
  return adminNotificationLayout(inner, undefined);
}
