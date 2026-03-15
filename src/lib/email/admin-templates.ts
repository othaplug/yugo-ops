/**
 * Styled HTML templates for admin/coordinator notification emails.
 * All use light background and dark text for readability (no bare plain-text emails).
 */
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { EMAIL_FOOTER_COMPANY } from "@/lib/email-templates";

const WINE = "#722F37";
const GOLD = "#B8962E";
const CARD_BG = "#ffffff";
const PAGE_BG = "#FAF7F2";
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#555";
const BORDER = "rgba(0,0,0,0.08)";

/** Full document wrapper for admin notifications: light bg, YUGO+ header, white card. */
export function adminNotificationLayout(innerHtml: string, title?: string): string {
  const heading = title
    ? `<h1 style="font-size:18px;font-weight:700;color:${TEXT};margin:0 0 16px;">${escapeHtml(title)}</h1>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:28px;">
    <span style="font-size:20px;font-weight:700;color:${WINE};letter-spacing:1px;">YUGO+</span>
  </div>
  <div style="background:${CARD_BG};border-radius:16px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid ${BORDER};">
    ${heading}
    <div style="font-size:14px;color:${TEXT};line-height:1.6;">
      ${innerHtml}
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:24px;">${EMAIL_FOOTER_COMPANY}</p>
</div>
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
  const source = params.adminCreated ? "created by your team" : "submitted by the client";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${GOLD};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;">New Damage Claim</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.claimNumber)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 20px;">A damage claim was ${source}.</p>
    <div style="background:${PAGE_BG};border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="color:${TEXT_MUTED};padding:4px 0;">Client</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${escapeHtml(params.clientName)}</td></tr>
        <tr><td style="color:${TEXT_MUTED};padding:4px 0;">Items</td><td style="color:${TEXT};padding:4px 0;">${params.itemCount} item${params.itemCount !== 1 ? "s" : ""}</td></tr>
        <tr><td style="color:${TEXT_MUTED};padding:4px 0;">Total claimed</td><td style="color:${WINE};font-weight:700;padding:4px 0;">$${params.totalClaimed.toLocaleString()}</td></tr>
        <tr><td style="color:${TEXT_MUTED};padding:4px 0;">Valuation</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.valuationTier || "released")}</td></tr>
      </table>
    </div>
    <a href="${viewUrl}" style="display:inline-block;background:${GOLD};color:#0D0D0D;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;">View claim</a>
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
    <div style="font-size:10px;font-weight:700;color:${GOLD};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;">New Widget Lead</div>
    <h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 4px;">${escapeHtml(params.name)}</h1>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 16px;">Quote request from the instant quote widget.</p>
    <div style="background:${PAGE_BG};border-radius:12px;padding:16px 20px;margin-bottom:20px;border:1px solid ${BORDER};">
      <table style="width:100%;font-size:13px;border-collapse:collapse;">
        <tr><td style="color:${TEXT_MUTED};padding:4px 0 6px;">Type</td><td style="color:${TEXT};font-weight:500;padding:4px 0 6px;">${escapeHtml(params.typeLabel)} · ${escapeHtml(params.sizeLabel)}</td></tr>
        <tr><td style="color:${TEXT_MUTED};padding:4px 0 6px;">Estimate</td><td style="color:${WINE};font-weight:600;padding:4px 0 6px;">${escapeHtml(params.priceStr)}</td></tr>
        <tr><td style="color:${TEXT_MUTED};padding:4px 0 6px;">Route</td><td style="color:${TEXT};padding:4px 0 6px;">${routeLine}</td></tr>
        ${params.extras ? `<tr><td style="color:${TEXT_MUTED};padding:4px 0 0;vertical-align:top;">Details</td><td style="color:${TEXT};font-size:12px;padding:4px 0 0;line-height:1.5;">${escapeHtml(params.extras).replace(/\|/g, " · ")}</td></tr>` : ""}
      </table>
    </div>
    <a href="${viewUrl}" style="display:inline-block;background:${GOLD};color:#0D0D0D;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;">View widget leads</a>
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
    <div style="font-size:10px;font-weight:700;color:${GOLD};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;">Estate Booking</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.clientName)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 16px;">${escapeHtml(params.dateLabel)} · ${escapeHtml(params.totalFormatted)}</p>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px;">Assign coordinator and schedule walkthrough.</p>
    <a href="${viewUrl}" style="display:inline-block;background:${GOLD};color:#0D0D0D;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;">View move</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

/** Tip received — admin notification. */
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
    <div style="font-size:10px;font-weight:700;color:${GOLD};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px;">Tip Received</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 8px;">${escapeHtml(params.amount)} from ${escapeHtml(params.clientName)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 16px;">For <strong>${escapeHtml(params.crewName)}</strong></p>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px;">Move: ${escapeHtml(params.moveCode)} · Net after processing: ${escapeHtml(params.netAmount)}</p>
    <a href="${viewUrl}" style="display:inline-block;background:${GOLD};color:#0D0D0D;padding:12px 24px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;">View tips</a>
  `;
  return adminNotificationLayout(inner, undefined);
}
