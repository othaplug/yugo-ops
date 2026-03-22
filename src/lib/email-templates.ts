import { getEmailBaseUrl } from "./email-base-url";
import { formatCurrency } from "./format-currency";
import { formatPhone } from "./phone";

/* ═══ Premium email design: full-width black, table-based, editorial Equinox-style. No flexbox/grid/CSS variables. ═══ */
const EMAIL_BG = "#000000";
const EMAIL_GOLD = "#B8962E";
const EMAIL_WINE = "#5C1A33";
const EMAIL_BRD = "#222222";
const EMAIL_TX = "#FFFFFF";
const EMAIL_TX2 = "#B0ADA8";
const EMAIL_TX3 = "#666";

/** Official Yugo logo URL for emails (gold version on dark background). */
export function getEmailLogoUrl(): string {
  const base = getEmailBaseUrl();
  return `${base}/images/yugo-logo-gold.png`;
}

/** Company footer line for all emails (claim, admin, lifecycle). */
export const EMAIL_FOOTER_COMPANY = "Yugo Inc. 507 King Street E. Toronto, ON.";

function emailLogoRow(): string {
  const logoUrl = getEmailLogoUrl();
  return `
    <tr>
      <td align="center" style="padding:32px 24px 0;">
        <img src="${logoUrl}" alt="Yugo" width="100" height="27" style="display:block;border:0;max-width:100px;height:auto;margin:0 auto;" />
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:20px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:linear-gradient(to right,transparent,${EMAIL_GOLD},transparent);font-size:0;line-height:0;">&nbsp;</td></tr></table>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>
  `;
}

/** Link color in footer for visibility on dark background (blue). */
const EMAIL_FOOTER_LINK = "#2563eb";
/** Subtle highlight for company name in copyright. */
const EMAIL_FOOTER_HIGHLIGHT_BG = "rgba(201,169,98,0.2)";

/** Client contact email and phone for footer (no app URLs — mailto/tel only). */
function getContactEmail(): string {
  return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YUGO_EMAIL) || "notifications@opsplus.co";
}
function getContactPhone(): string {
  return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YUGO_PHONE) || "(647) 370-4525";
}

function emailFooterRow(_loginUrl?: string): string {
  const base = getEmailBaseUrl();
  const privacyUrl = `${base}/privacy`;
  const contactEmail = getContactEmail();
  const contactPhone = getContactPhone();
  const mailto = `mailto:${contactEmail}`;
  const tel = `tel:${contactPhone.replace(/\s/g, "").replace(/[()]/g, "")}`;
  return `
    <tr>
      <td style="padding:24px 24px 0;border-top:1px solid ${EMAIL_BRD};font-family:'DM Sans',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:560px;margin:0 auto;">
          <tr>
            <td align="center" style="padding-bottom:20px;font-size:12px;color:${EMAIL_TX2};">
              <a href="${mailto}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Email us</a>
              <span style="color:${EMAIL_BRD};margin:0 10px">|</span>
              <a href="${tel}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Call us</a>
              <span style="color:${EMAIL_BRD};margin:0 10px">|</span>
              <a href="${privacyUrl}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Privacy</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:11px;color:${EMAIL_TX2};line-height:1.6;padding-bottom:12px;">
              This is a servicing communication from <span style="background:${EMAIL_FOOTER_HIGHLIGHT_BG};padding:1px 4px;border-radius:2px;">Yugo</span>. For support, <a href="${mailto}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">email us</a> or <a href="${tel}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">call ${contactPhone}</a> This address is not monitored and we cannot respond to messages sent here.
            </td>
          </tr>
          <tr>
            <td style="font-size:11px;color:${EMAIL_TX2};line-height:1.6;padding-bottom:12px;">
              You received this email because you are the contact for a move or quote with Yugo.
            </td>
          </tr>
          <tr>
            <td style="font-size:11px;color:${EMAIL_TX2};line-height:1.6;padding-bottom:16px;">
              Learn how we collect, use and safeguard your information at <a href="${privacyUrl}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">${base.replace(/^https?:\/\//, "")}/privacy</a>
            </td>
          </tr>
          <tr>
            <td style="font-size:11px;color:${EMAIL_TX3};padding-bottom:32px;">
              &copy; 2026 Yugo Inc. All rights reserved.<br/>
              <span style="font-size:10px;color:${EMAIL_TX3};margin-top:4px;display:inline-block;">507 King Street E, Toronto, ON</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/** Table-based email wrapper: full-width dark background, logo, content (max 560px centered), footer. */
export function emailLayout(innerHtml: string, footerLoginUrl?: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BG};font-family:'DM Sans',sans-serif;">
  ${emailLogoRow()}
  <tr>
    <td align="center" style="padding:0 24px 32px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;">
        <tr>
          <td style="color:#FFFFFF;">
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${emailFooterRow(footerLoginUrl)}
</table>
  `;
}

/** Minimal status email (crew on the way, arrived, etc.): headline, body, optional CTA. Table-based, full-width dark. */
export function statusUpdateEmailHtml(params: {
  headline: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const { headline, body, ctaUrl, ctaLabel } = params;
  const ctaHtml = ctaUrl && ctaLabel
    ? `
    <tr>
      <td align="center" style="padding:8px 0 32px;">
        <a href="${ctaUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#0A0806;padding:13px 32px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;">${ctaLabel}</a>
      </td>
    </tr>
  `
    : "";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_BG};font-family:'DM Sans',sans-serif;">
  ${emailLogoRow()}
  <tr>
    <td align="center" style="padding:0 24px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;">
        <tr>
          <td style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;letter-spacing:-0.3px;color:${EMAIL_TX};padding-bottom:16px;line-height:1.25;">${headline}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:${EMAIL_TX2};line-height:1.5;">${body}</td>
        </tr>
        ${ctaHtml}
      </table>
    </td>
  </tr>
  ${emailFooterRow()}
</table>
  `;
}

/** Legacy: logo block for templates that embed their own wrapper (deprecated; use emailLayout). */
function emailLogo() {
  const logoUrl = getEmailLogoUrl();
  return `
    <div style="text-align:center;margin-bottom:28px">
      <img src="${logoUrl}" alt="Yugo" width="120" height="32" style="display:inline-block;max-width:120px;height:auto;border:0" />
    </div>
  `;
}

function emailFooter(_loginUrl?: string) {
  const base = getEmailBaseUrl();
  const privacyUrl = `${base}/privacy`;
  const contactEmail = getContactEmail();
  const contactPhone = getContactPhone();
  const mailto = `mailto:${contactEmail}`;
  const tel = `tel:${contactPhone.replace(/\s/g, "").replace(/[()]/g, "")}`;
  return `
    <div style="font-size:11px;color:${EMAIL_TX2};line-height:1.6;margin-top:32px;padding-top:24px;border-top:1px solid ${EMAIL_BRD};font-family:'DM Sans',sans-serif;">
      <p style="text-align:center;margin:0 0 12px;">
        <a href="${mailto}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Email us</a>
        <span style="color:${EMAIL_BRD};margin:0 10px">|</span>
        <a href="${tel}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Call us</a>
        <span style="color:${EMAIL_BRD};margin:0 10px">|</span>
        <a href="${privacyUrl}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Privacy</a>
      </p>
      <p style="margin:0 0 8px;">This is a servicing communication from <span style="background:${EMAIL_FOOTER_HIGHLIGHT_BG};padding:1px 4px;border-radius:2px;">Yugo</span>. This address is not monitored. For support, <a href="${mailto}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">email us</a> or <a href="${tel}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">call ${contactPhone}</a>.</p>
      <p style="margin:0 0 8px;"><a href="${privacyUrl}" style="color:${EMAIL_FOOTER_LINK};text-decoration:none;">Privacy policy</a> — how we collect, use and safeguard your information.</p>
      <p style="font-size:10px;color:${EMAIL_TX3};margin:16px 0 0;">&copy; 2025 <span style="background:${EMAIL_FOOTER_HIGHLIGHT_BG};padding:1px 4px;border-radius:2px;">Yugo Inc.</span> All rights reserved. 507 King Street E, Toronto, ON.</p>
    </div>
  `;
}

function notifyEmailLogo() {
  return emailLogo();
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#D48A29",
  confirmed: "#2D9F5A",
  scheduled: "#4A7CE5",
  "in-transit": "#C9A962",
  dispatched: "#C9A962",
  delivered: "#2D9F5A",
  cancelled: "#D14343",
};

function statusBadge(status: string) {
  const s = (status || "").replace("-", " ");
  const c = STATUS_COLORS[status] || "#C9A962";
  return `<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${c}22;color:${c}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

export function deliveryNotificationEmail(delivery: {
  delivery_number: string;
  customer_name: string;
  client_name?: string;
  delivery_address: string;
  pickup_address?: string;
  scheduled_date: string;
  delivery_window: string;
  status: string;
  items_count?: number;
  trackUrl?: string;
}) {
  const trackUrl = delivery.trackUrl || `${getEmailBaseUrl()}/track/delivery/${delivery.delivery_number}`;
  const items = delivery.items_count ?? 0;
  const inner = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;padding-bottom:8px;">Project Update</td></tr>
      <tr><td style="font-size:26px;font-weight:700;letter-spacing:0.3px;color:${EMAIL_TX};padding-bottom:20px;">${delivery.delivery_number} — ${delivery.customer_name}</td></tr>
      <tr>
        <td style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:20px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:9px;color:${EMAIL_TX3};text-transform:uppercase;font-weight:700;letter-spacing:0.5px;padding-bottom:8px;">Current Status</td></tr>
            <tr><td style="padding-bottom:16px;">${statusBadge(delivery.status)}</td></tr>
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" style="font-size:12px;color:${EMAIL_TX3};padding:4px 8px 4px 0;vertical-align:top;">Delivery to:</td>
                    <td width="50%" style="font-size:12px;font-weight:600;color:#FFFFFF;padding:4px 0;vertical-align:top;">${delivery.delivery_address || "—"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${EMAIL_TX3};padding:4px 8px 4px 0;vertical-align:top;">Pickup from:</td>
                    <td style="font-size:12px;font-weight:600;color:#FFFFFF;padding:4px 0;vertical-align:top;">${delivery.pickup_address || "—"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${EMAIL_TX3};padding:4px 8px 4px 0;vertical-align:top;">Date &amp; window:</td>
                    <td style="font-size:12px;font-weight:600;color:#FFFFFF;padding:4px 0;vertical-align:top;">${delivery.scheduled_date || "—"} &middot; ${delivery.delivery_window || "—"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${EMAIL_TX3};padding:4px 8px 4px 0;vertical-align:top;">Items:</td>
                    <td style="font-size:12px;font-weight:600;color:#FFFFFF;padding:4px 0;vertical-align:top;">${items} items</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <a href="${trackUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track this project</a>
        </td>
      </tr>
    </table>
  `;
  return emailLayout(inner);
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    scheduled: "Scheduled",
    paid: "Paid",
    final_payment_received: "Paid",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    delivered: "Completed",
    pending: "Confirmed",
    "in-transit": "In Progress",
    dispatched: "In Progress",
  };
  return labels[status] || (status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const LIVE_STAGE_LABELS: Record<string, string> = {
  pending: "Pending",
  on_route: "En Route",
  arrived_on_site: "Arrived On-Site",
  loading: "Loading",
  in_transit: "In Transit",
  unloading: "Unloading",
  job_complete: "Job Complete",
};

/** Timeline: status index 0–4, live stages 0–5 when in_progress */
const STATUS_INDEX: Record<string, number> = {
  confirmed: 0,
  scheduled: 1,
  paid: 2,
  final_payment_received: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -1,
  delivered: 4,
  pending: 0,
  "in-transit": 3,
  dispatched: 3,
};

const STAGE_INDEX: Record<string, number> = {
  pending: -1,
  on_route: 0,
  arrived_on_site: 1,
  loading: 2,
  in_transit: 3,
  unloading: 4,
  job_complete: 5,
};

function moveStatusBarHtml(status: string, stage?: string | null): string {
  const isCancelled = (status || "").toLowerCase() === "cancelled";
  const isCompleted = (status || "").toLowerCase() === "completed" || (status || "").toLowerCase() === "delivered";
  const statusIdx = STATUS_INDEX[(status || "").toLowerCase()] ?? 0;
  const stageKey = stage ?? "";
  const stageIdx = stageKey ? (STAGE_INDEX[stageKey] ?? -1) : -1;

  let pct = 0;
  let currentLabel = formatStatusLabel(status);
  let labelColor = "#2D9F5A";

  if (isCancelled) {
    pct = 0;
    currentLabel = "Cancelled";
    labelColor = "#D14343";
  } else if (isCompleted) {
    pct = 100;
    currentLabel = "Completed";
  } else if (statusIdx === 3 && stageIdx >= 0) {
    const stageLabel = LIVE_STAGE_LABELS[stageKey] || stageKey.replace(/_/g, " ");
    currentLabel = stageLabel;
    pct = 60 + Math.round(((stageIdx + 1) / 6) * 40);
  } else {
    pct = Math.round(((statusIdx + 1) / 5) * 100);
  }

  return `
    <style>
      @keyframes moveBarShimmer {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      .move-bar-fill {
        animation: moveBarShimmer 2.5s ease-in-out infinite;
        -webkit-animation: moveBarShimmer 2.5s ease-in-out infinite;
      }
    </style>
    <div style="margin:20px 0 24px">
      <div style="font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Current Stage</div>
      <div style="height:10px;background:#1E1E1E;border-radius:999px;overflow:hidden;border:1px solid #2A2A2A">
        <div class="move-bar-fill" style="height:100%;width:${pct}%;min-width:${pct > 0 ? 4 : 0}px;background:linear-gradient(90deg,#ECDEC4,#C9A962);border-radius:999px"></div>
      </div>
      <div style="font-size:12px;font-weight:600;color:${labelColor};margin-top:8px;letter-spacing:0.3px">${currentLabel}</div>
    </div>
  `;
}

export function moveNotificationEmail(move: {
  move_id: string;
  move_number: string;
  client_name: string;
  move_type: string;
  status: string;
  stage?: string;
  next_action?: string;
  from_address: string;
  to_address: string;
  scheduled_date: string;
  estimate?: number;
  deposit_paid?: number;
  balance_due?: number;
  trackUrl?: string;
  changes_made?: string;
}) {
  const trackUrl = move.trackUrl || `${getEmailBaseUrl()}/track/move/${move.move_id}`;
  const statusBarHtml = moveStatusBarHtml(move.status, move.stage);
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Your Move Was Updated</div>
    <div style="font-size:20px;font-weight:700;margin:0 0 8px;color:${EMAIL_TX};">Your Move Was Updated</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 4px;">We&apos;ve made changes to your move recently.</p>
    ${statusBarHtml}
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 24px;">Click below to view your full dashboard and see what changed.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${trackUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track your move</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.</p>
  `;
  return emailLayout(inner);
}

export function trackingLinkEmail(params: {
  clientName: string;
  trackUrl: string;
  moveNumber: string;
}) {
  const { clientName, trackUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Track your move</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Hi${clientName ? `, ${clientName}` : ""}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Use the link below to track your move, view documents, and message your coordinator. No account or login required.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${trackUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track your move</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.</p>
  `;
  return emailLayout(inner);
}

export function invoiceEmail(invoice: {
  invoice_number: string;
  client_name: string;
  amount: number;
  due_date: string;
}) {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;">Invoice</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;">${invoice.invoice_number}</div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;text-align:center;margin-bottom:16px;">
      <div style="font-size:9px;color:${EMAIL_TX3};text-transform:uppercase;font-weight:700;margin-bottom:8px;">Amount Due</div>
      <div style="font-family:'Instrument Serif',serif;font-size:28px;font-weight:700;color:${EMAIL_GOLD};">${formatCurrency(invoice.amount)}</div>
      <div style="font-size:10px;color:${EMAIL_TX3};margin-top:4px;">Due: ${invoice.due_date}</div>
    </div>
  `;
  return emailLayout(inner);
}

export function changeRequestNotificationEmail(params: {
  client_name: string;
  status: "approved" | "rejected";
  type: string;
  description: string;
  portalUrl: string;
  feeCents?: number;
}) {
  const { client_name, status, type, description, portalUrl, feeCents = 0 } = params;
  const isApproved = status === "approved";
  const feeDollars = feeCents > 0 ? (feeCents / 100).toFixed(2) : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Change Request Update</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Your change request has been ${isApproved ? "approved" : "declined"}</div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:20px;">
      <div style="font-size:11px;color:${EMAIL_TX3};margin-bottom:8px;"><strong>Request type:</strong> ${type}</div>
      <p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:0;">${description}</p>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid ${EMAIL_BRD};">
        <span style="display:inline-block;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;background:${isApproved ? "#2D9F5A22" : "#D1434322"};color:${isApproved ? "#2D9F5A" : "#D14343"};">${isApproved ? "Approved" : "Declined"}</span>
      </div>
      ${isApproved && feeDollars ? `<p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:16px 0 0;">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>` : ""}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track your move</a>
    </td></tr></table>
  `;
  return emailLayout(inner);
}

export function inventoryChangeRequestAdminEmail(params: {
  moveCode: string;
  clientName: string;
  addedCount: number;
  removedCount: number;
  netDelta: number;
  adminUrl: string;
}) {
  const { moveCode, clientName, addedCount, removedCount, netDelta, adminUrl } = params;
  const deltaStr = `${netDelta >= 0 ? "+" : ""}$${netDelta}`;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Inventory Change Request</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">New request — ${moveCode}</div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="font-size:13px;color:#FFFFFF;line-height:1.5;margin:0 0 12px;"><strong>Client:</strong> ${clientName}</p>
      <p style="font-size:12px;color:${EMAIL_TX2};line-height:1.5;margin:0 0 8px;">Adding <strong>${addedCount}</strong> line(s), removing <strong>${removedCount}</strong> line(s).</p>
      <p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:0;">Auto-calculated net: <strong>${deltaStr}</strong></p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${adminUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Review in admin</a>
    </td></tr></table>
  `;
  return emailLayout(inner);
}

export function inventoryChangeRequestClientEmail(params: {
  clientName: string;
  status: "approved" | "declined" | "adjusted";
  netDelta: number;
  newTotal: number;
  portalUrl: string;
  declineReason?: string | null;
  adminNote?: string | null;
  additionalDeposit?: number;
}) {
  const { clientName, status, netDelta, newTotal, portalUrl, declineReason, adminNote, additionalDeposit } = params;
  const isOk = status !== "declined";
  const headline =
    status === "declined"
      ? "Your inventory change request needs attention"
      : "Your inventory change request was approved";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Inventory Update</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">${headline}</div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="font-size:13px;color:#FFFFFF;line-height:1.5;margin:0 0 12px;">Hi ${clientName},</p>
      ${
        isOk
          ? `<p style="font-size:12px;color:${EMAIL_TX2};line-height:1.5;margin:0 0 12px;">Net price change: <strong>${netDelta >= 0 ? "+" : ""}$${netDelta}</strong></p>
             <p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:0 0 12px;">Updated move total: <strong>$${newTotal}</strong></p>
             ${adminNote ? `<p style="font-size:12px;color:${EMAIL_TX2};line-height:1.5;margin:0 0 12px;">Note from your coordinator: ${adminNote}</p>` : ""}
             ${additionalDeposit && additionalDeposit > 0 ? `<p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:0;">Additional amount due: <strong>$${additionalDeposit}</strong> — you can pay from your move portal.</p>` : ""}`
          : `<p style="font-size:12px;color:${EMAIL_TX2};line-height:1.5;margin:0 0 12px;">${declineReason || "Please review the details in your portal or contact your coordinator."}</p>`
      }
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">View your move</a>
    </td></tr></table>
  `;
  return emailLayout(inner);
}

export function extraItemApprovalEmail(params: {
  client_name: string;
  description: string;
  portalUrl: string;
  feeCents?: number;
}) {
  const { description, portalUrl, feeCents = 0 } = params;
  const feeDollars = feeCents > 0 ? (feeCents / 100).toFixed(2) : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Extra Item Approved</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Your extra item has been approved</div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:0;">${description}</p>
      ${feeDollars ? `<p style="font-size:12px;color:#FFFFFF;line-height:1.5;margin:16px 0 0;">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>` : ""}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track your move</a>
    </td></tr></table>
  `;
  return emailLayout(inner);
}

export function inviteUserEmail(params: {
  name: string;
  email: string;
  roleLabel: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">You&apos;re Invited</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Welcome to Yugo${name ? `, ${name}` : ""}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">You&apos;ve been invited to join Yugo as a <strong style="color:${EMAIL_GOLD}">${roleLabel}</strong>. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.</p>
    <div style="width:100%;height:1px;background:linear-gradient(to right,transparent,${EMAIL_GOLD}55,transparent);margin:0 0 20px"></div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:8px;">Your credentials</div>
      <div style="font-size:12px;color:#FFFFFF;margin-bottom:4px;"><strong>Email:</strong> ${email}</div>
      <div style="font-size:12px;color:#FFFFFF;"><strong>Temporary password:</strong> <code style="background:${EMAIL_BG};padding:2px 8px;border-radius:4px;font-family:monospace;">${tempPassword}</code></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to continue setup</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl);
}

export function inviteUserEmailText(params: { name: string; email: string; roleLabel: string; tempPassword: string; loginUrl: string }) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited

Welcome to Yugo${name ? `, ${name}` : ""}

You've been invited to join Yugo as a ${roleLabel}. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by Yugo | Learn more: ${baseUrl}/about`;
}

export function invitePartnerEmail(params: {
  contactName: string;
  companyName: string;
  email: string;
  typeLabel: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">You&apos;re Invited as a Partner</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Welcome to Yugo${contactName ? `, ${contactName}` : ""}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;"><strong style="color:${EMAIL_GOLD}">${companyName}</strong> has been invited as a <strong style="color:${EMAIL_GOLD}">${typeLabel}</strong> partner with Yugo. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.</p>
    <div style="width:100%;height:1px;background:linear-gradient(to right,transparent,${EMAIL_GOLD}55,transparent);margin:0 0 20px"></div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:8px;">Your credentials</div>
      <div style="font-size:12px;color:#FFFFFF;margin-bottom:4px;"><strong>Email:</strong> ${email}</div>
      <div style="font-size:12px;color:#FFFFFF;"><strong>Temporary password:</strong> <code style="background:${EMAIL_BG};padding:2px 8px;border-radius:4px;font-family:monospace;">${tempPassword}</code></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to continue setup</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl);
}

export function invitePartnerEmailText(params: { contactName: string; companyName: string; email: string; typeLabel: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited as a Partner

Welcome to Yugo${contactName ? `, ${contactName}` : ""}

${companyName} has been invited as a ${typeLabel} partner with Yugo. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by Yugo | Learn more: ${baseUrl}/about`;
}

/** Email when an existing Yugo user is added to a partner (no new account, no temp password). */
export function addedToPartnerEmail(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { companyName, loginUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Portal access added</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">You&apos;ve been added to ${companyName}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Your account now has access to <strong style="color:${EMAIL_GOLD}">${companyName}</strong> on the Yugo+ Partner Portal. Log in with your existing password to view deliveries and manage requests.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to Partner Portal</a>
    </td></tr></table>
  `;
  return emailLayout(inner, loginUrl);
}

export function addedToPartnerEmailText(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { companyName, loginUrl } = params;
  return `Portal access added

You've been added to ${companyName} on the Yugo+ Partner Portal. Log in with your existing password to view deliveries and manage requests.

Log in: ${loginUrl}`;
}

export function partnerPasswordResetEmail(params: {
  contactName: string;
  companyName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Password Reset</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">New password for your Yugo+ partner account</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">A new temporary password has been set for your <strong style="color:${EMAIL_GOLD}">${companyName}</strong> partner portal access${contactName ? ` (${contactName})` : ""}. Sign in with the credentials below and you&apos;ll be prompted to set a new password.</p>
    <div style="width:100%;height:1px;background:linear-gradient(to right,transparent,${EMAIL_GOLD}55,transparent);margin:0 0 20px"></div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:8px;">Your credentials</div>
      <div style="font-size:12px;color:#FFFFFF;margin-bottom:4px;"><strong>Email:</strong> ${email}</div>
      <div style="font-size:12px;color:#FFFFFF;"><strong>New temporary password:</strong> <code style="background:${EMAIL_BG};padding:2px 8px;border-radius:4px;font-family:monospace;">${tempPassword}</code></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to partner portal</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">For security, we recommend changing this password after you sign in. If you didn&apos;t request this, contact your admin.</p>
  `;
  return emailLayout(inner, loginUrl);
}

export function partnerPasswordResetEmailText(params: { contactName: string; companyName: string; email: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `Password Reset – Yugo+ Partner Portal

A new temporary password has been set for your ${companyName} partner portal access. Sign in with the credentials below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
New temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, we recommend changing this password after you sign in. If you didn't request this, contact your admin.

Powered by Yugo | Learn more: ${baseUrl}/about`;
}

function darkEmailWrapper(html: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#000000;min-height:100%">
      <tr><td style="padding:24px 16px">
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#000000;color:#FFFFFF;padding:36px;border:1px solid #222222">
    ${html}
    </div>
      </td></tr>
    </table>
  `;
}

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  const displayName = client.name || "Partner";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Partner Portal Access</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Welcome to Yugo${displayName !== "Partner" ? `, ${displayName}` : ""}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;">Your partner portal is ready. Sign in anytime to:</p>
    <ul style="font-size:14px;color:${EMAIL_TX2};line-height:1.7;margin:0 0 24px;padding-left:20px;">
      <li>Track deliveries and see real-time status</li>
      <li>View and download invoices</li>
      <li>Message our team and get support</li>
    </ul>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${client.portalUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Access Your Portal</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">If you didn&apos;t request this, you can safely ignore this email.</p>
  `;
  return emailLayout(inner);
}

export function referralReceivedEmail(params: { agentName: string; clientName: string; property: string }) {
  const { agentName, clientName, property } = params;
  const ref = clientName || property || "this property";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Referral Received</div>
    <div style="font-size:20px;font-weight:600;margin:0 0 16px;color:${EMAIL_TX};">Hi ${agentName},</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Your referral for <strong style="color:${EMAIL_GOLD}">${ref}</strong> has been received and added to our pipeline.</p>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:10px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:10px">
        <div>
          <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:6px;">Status</div>
          <div style="font-size:13px;color:#FFFFFF;font-weight:600;">In Pipeline &mdash; Your team is on it</div>
          <div style="font-size:12px;color:${EMAIL_TX2};margin-top:4px;line-height:1.5;">We&apos;ll be in touch as we process the lead and coordinate the move.</div>
        </div>
      </div>
    </div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 24px;">Thank you for continuing to trust Yugo with your clients. We take every referral seriously and will keep you updated.</p>
  `;
  return emailLayout(inner);
}

export function crewPortalInviteEmail(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Crew Portal Access</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.3px;margin:0 0 20px;color:${EMAIL_TX};">Welcome to the Crew Portal${name ? `, ${name}` : ""}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">You&apos;ve been invited to log in to the Yugo+ Crew Portal to start jobs, update status, and share your location with dispatch.</p>
    <div style="width:100%;height:1px;background:linear-gradient(to right,transparent,${EMAIL_GOLD}55,transparent);margin:0 0 20px"></div>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:8px;">Your login</div>
      <div style="font-size:12px;color:#FFFFFF;margin-bottom:4px;"><strong>Phone:</strong> ${phoneDisplay}</div>
      <div style="font-size:12px;color:#FFFFFF;"><strong>PIN:</strong> <code style="background:${EMAIL_BG};padding:2px 8px;border-radius:4px;font-family:monospace;">${pin}</code></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to Crew Portal</a>
    </td></tr></table>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">Sessions expire after one shift (12h). Keep your PIN secure. If you didn&apos;t expect this invite, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl);
}

export function crewPortalInviteEmailText(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  return `Crew Portal Access

Welcome to the Crew Portal${name ? `, ${name}` : ""}

You've been invited to log in to the Yugo+ Crew Portal to start jobs, update status, and share your location with dispatch.

Your login:
Phone: ${phoneDisplay}
PIN: ${pin}

Log in: ${loginUrl}

Sessions expire after one shift (12h). Keep your PIN secure. If you didn't expect this invite, you can safely ignore this email.

Powered by Yugo`;
}

export function bookingConfirmationEmail(params: {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  tierLabel: string;
  serviceLabel: string;
  totalWithTax: number;
  depositPaid: number;
  balanceRemaining: number;
  trackingUrl: string;
}): string {
  const {
    clientName,
    moveCode,
    moveDate,
    fromAddress,
    toAddress,
    tierLabel,
    serviceLabel,
    totalWithTax,
    depositPaid,
    balanceRemaining,
    trackingUrl,
  } = params;

  const dateDisplay = moveDate
    ? new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Booking Confirmed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;margin:0 0 12px;color:#FFFFFF">You&apos;re All Set${clientName ? `, ${clientName}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your deposit has been received and your ${serviceLabel.toLowerCase()} is confirmed.
    </p>

    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(201,169,98,0.15);color:#C9A962;border:1px solid rgba(201,169,98,0.3)">
        ${moveCode}
      </span>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Move Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Service:</td><td style="color:#FFFFFF;font-weight:600;padding:3px 0;text-align:right">${serviceLabel}${tierLabel ? ` &mdash; ${tierLabel}` : ""}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Date:</td><td style="color:#FFFFFF;font-weight:600;padding:3px 0;text-align:right">${dateDisplay}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#FFFFFF;font-weight:600;padding:3px 0;text-align:right">${fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#FFFFFF;font-weight:600;padding:3px 0;text-align:right">${toAddress}</td></tr>
      </table>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Payment Summary</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Total (incl. HST):</td><td style="color:#FFFFFF;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(totalWithTax)}</td></tr>
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(depositPaid)}</td></tr>
        <tr><td colspan="2" style="border-top:1px solid #2A2A2A;padding:0;height:8px"></td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(balanceRemaining)}</td></tr>
      </table>
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">What Happens Next</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>1. Your coordinator will reach out within 24 hours</div>
        <div>2. We&apos;ll confirm your crew and timing details</div>
        <div>3. Track your move anytime using the link below</div>
      </div>
    </div>

    <a href="${trackingUrl}" style="display:block;background:#C9A962;color:#000000;padding:13px 32px;border-radius:0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;margin-bottom:16px;text-align:center">
      Track Your Move
    </a>

    <p style="font-size:11px;color:#666;margin-top:16px;text-align:center">
      Questions? Reply to this email or call us anytime.
    </p>
  `);
}

/* ═══════════════════════════════════════════════════════
   TIER-SPECIFIC BOOKING CONFIRMATION EMAILS (Prompt 80)
   ═══════════════════════════════════════════════════════ */

export interface TierConfirmationParams {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  timeWindow: string;
  fromAddress: string;
  toAddress: string;
  tierLabel: string;
  serviceLabel: string;
  crewSize: number;
  truckDisplayName: string;
  totalWithTax: number;
  depositPaid: number;
  balanceRemaining: number;
  trackingUrl: string;
  includes: string[];
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  coordinatorEmail?: string | null;
  crewNames?: string | null;
}

function confirmDateDisplay(dateStr: string | null): string {
  if (!dateStr) return "To be confirmed";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** @deprecated Use curatedConfirmationEmail */
export const essentialsConfirmationEmail = (p: TierConfirmationParams): string => curatedConfirmationEmail(p);

export function curatedConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Move Confirmed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;margin:0 0 12px;color:#FFFFFF">Your Yugo move is confirmed${p.clientName ? `, ${p.clientName}` : ""}.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move is confirmed. Here are your details:
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:10px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Move Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:#666;padding:4px 0">From:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">To:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Package:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">Curated</td></tr>
        <tr><td style="color:#666;padding:4px 0">Crew:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:#666;padding:4px 0">Vehicle:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed flat rate)</td></tr>
      </table>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">What to Expect</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; Our crew will arrive within your time window</div>
        <div>&middot; All moving blankets, equipment, and floor protection included</div>
        <div>&middot; You&apos;ll receive a reminder 48 hours before your move</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">What to Prepare</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; Have boxes packed and sealed</div>
        <div>&middot; Clear pathways for the crew</div>
        <div>&middot; Confirm elevator booking if applicable</div>
      </div>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:4px 0 20px;">
      <a href="${p.trackingUrl}" style="display:inline-block;background-color:#C9A962;color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">Track Your Move</a>
    </td></tr></table>

    <p style="font-size:11px;color:#666;margin:0 0 16px;text-align:center">
      Questions? Reply to this email or call us anytime.
    </p>
  `);
}

/** @deprecated Use signatureConfirmationEmail */
export const premierConfirmationEmail = (p: TierConfirmationParams): string => signatureConfirmationEmail(p);

export function signatureConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Booking Confirmed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;margin:0 0 12px;color:#FFFFFF">Great choice${p.clientName ? `, ${p.clientName}` : ""} &mdash; your Yugo Signature move is confirmed.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Everything is set. No surprises &mdash; just a smooth, professional move.
    </p>

    <div style="background:#1E1E1E;border:1px solid #C9A96233;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Your Signature Move</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:#666;padding:4px 0">From:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">To:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Package:</td><td style="color:#C9A962;font-weight:600;padding:4px 0;text-align:right">Signature</td></tr>
        <tr><td style="color:#666;padding:4px 0">Crew:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:#666;padding:4px 0">Vehicle:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed &mdash; no surprises)</td></tr>
      </table>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">What&apos;s Included</div>
      <div style="font-size:12px;color:#B8B5B0;line-height:2">
        ${(p.includes || []).map((inc) => `<div><span style="color:#C9A962">&#10003;</span> ${inc}</div>`).join("")}
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">Before Your Move</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; You&apos;ll receive a reminder 48 hours before</div>
        <div>&middot; A day-before SMS with your crew details and ETA window</div>
        <div>&middot; Our team will handle disassembly &mdash; just let us know which pieces need it</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:10px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:10px">Your Tracking Page</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.6">
        Follow your move in real-time on move day:
      </div>
    </div>

    <a href="${p.trackingUrl}" style="display:block;background:#C9A962;color:#000000;padding:13px 32px;border-radius:0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;margin-bottom:16px;text-align:center">
      Track Your Move
    </a>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:16px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <p style="font-size:12px;color:#B8B5B0;margin:0 0 16px;text-align:center">
      Looking forward to a smooth move.<br/>
      <strong style="color:#FFFFFF">&mdash; The Yugo Team</strong>
    </p>
  `);
}

export function estateConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  const coordName = p.coordinatorName || "Your coordinator";
  const DIV = `<div style="width:100%;height:1px;background:linear-gradient(to right,transparent,#C9A96244,transparent);margin:24px 0"></div>`;

  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:#5C1A33;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">Estate Experience</div>
    <h1 style="font-family:'Instrument Serif',serif;font-size:28px;font-weight:400;margin:0 0 12px;color:#FFFFFF;line-height:1.3">
      Welcome to your Yugo Estate experience${p.clientName ? `, ${p.clientName}` : ""}.
    </h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.7;margin:0 0 28px">
      Thank you for entrusting Yugo with your move. Your Estate experience has been confirmed, and every detail is being prepared with care.
    </p>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:10px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:3px;margin-bottom:14px">Your Estate Move</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr><td style="color:#666;padding:6px 0">Date:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${dateStr}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Time:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${p.timeWindow} &mdash; your crew will arrive promptly</td></tr>
        <tr><td style="color:#666;padding:6px 0">Origin:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Destination:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${p.toAddress}</td></tr>
        ${p.crewNames ? `<tr><td style="color:#666;padding:6px 0">Your Crew:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${p.crewNames}</td></tr>` : ""}
        <tr><td style="color:#666;padding:6px 0">Your Vehicle:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Your Coordinator:</td><td style="color:#FFFFFF;font-weight:600;padding:6px 0;text-align:right">${coordName}</td></tr>
      </table>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:10px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:3px;margin-bottom:14px">Your Estate Experience Includes</div>
      <div style="font-size:12px;color:#B8B5B0;line-height:2.2">
        ${(p.includes || []).map((inc) => `<div><span style="color:#C9A962">&#10022;</span> ${inc}</div>`).join("")}
      </div>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:10px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:3px;margin-bottom:14px">What Happens Next</div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:0 0 16px">
        Within the next 24 hours, your coordinator ${coordName} will reach out personally to:
      </p>
      <div style="font-size:13px;color:#B8B5B0;line-height:2">
        <div>&middot; Schedule your pre-move walkthrough (in-person or virtual)</div>
        <div>&middot; Confirm any items requiring special handling</div>
        <div>&middot; Review your timeline and any access requirements</div>
        <div>&middot; Answer every question you have</div>
      </div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:16px 0 0">
        72 hours before your move, you&apos;ll receive a detailed itinerary with crew names, vehicle details, and your move-day timeline.
      </p>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:8px 0 0">
        On move day, ${coordName} will be available by phone throughout the entire process.
      </p>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:10px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:3px;margin-bottom:14px">Your Move Tracker</div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.6;margin:0 0 12px">Follow every step in real-time:</p>
    </div>

    <a href="${p.trackingUrl}" style="display:block;background:#5C1A33;color:#FFFFFF;padding:13px 32px;border-radius:0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;margin-bottom:20px;text-align:center">
      Track Your Move
    </a>

    ${DIV}

    <div style="text-align:center;margin-bottom:4px">
      <div style="font-family:'Instrument Serif',serif;font-size:18px;color:#C9A962;margin-bottom:4px">Investment: ${formatCurrency(p.totalWithTax)}</div>
      <div style="font-size:11px;color:#666">This is your guaranteed rate. No hourly charges. No surprises. No hidden fees.</div>
      <div style="margin-top:8px;font-size:12px">
        <span style="color:#2D9F5A;font-weight:600">&#10003; Deposit paid: ${formatCurrency(p.depositPaid)}</span>
        <span style="color:#666;margin:0 8px">&middot;</span>
        <span style="color:#C9A962;font-weight:600">Balance: ${formatCurrency(p.balanceRemaining)}</span>
      </div>
    </div>

    ${DIV}

    <div style="text-align:center;margin-bottom:8px">
      <p style="font-size:14px;color:#B8B5B0;font-style:italic;margin:0 0 16px">It&apos;s our privilege to handle your move.</p>
      ${p.coordinatorName ? `
        <div style="font-size:13px;color:#FFFFFF;font-weight:600">${p.coordinatorName}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">Move Coordinator, Yugo</div>
        ${p.coordinatorPhone ? `<div style="font-size:11px;color:#C9A962;margin-top:4px">${formatPhone(p.coordinatorPhone)}</div>` : ""}
        ${p.coordinatorEmail ? `<div style="font-size:11px;color:#C9A962;margin-top:2px">${p.coordinatorEmail}</div>` : ""}
      ` : ""}
    </div>
  `);
}

export function internalBookingAlertEmail(params: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  serviceLabel: string;
  tierLabel: string;
  totalWithTax: number;
  depositPaid: number;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  paymentId: string;
}): string {
  const {
    clientName,
    clientEmail,
    clientPhone,
    moveCode,
    serviceLabel,
    tierLabel,
    totalWithTax,
    depositPaid,
    fromAddress,
    toAddress,
    moveDate,
    paymentId,
  } = params;

  const dateDisplay = moveDate
    ? new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "TBD";

  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:#2D9F5A;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">New Booking</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#FFFFFF">${clientName} &mdash; ${serviceLabel}${tierLabel ? ` (${tierLabel})` : ""}</h1>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:16px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0;width:100px">Move:</td><td style="color:#C9A962;font-weight:600;padding:4px 0">${moveCode}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Client:</td><td style="color:#FFFFFF;padding:4px 0">${clientName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email:</td><td style="color:#FFFFFF;padding:4px 0">${clientEmail}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#FFFFFF;padding:4px 0">${clientPhone ? formatPhone(clientPhone) : "—"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#FFFFFF;padding:4px 0">${dateDisplay}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Route:</td><td style="color:#FFFFFF;padding:4px 0">${fromAddress} &rarr; ${toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#FFFFFF;font-weight:600;padding:4px 0">${formatCurrency(totalWithTax)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Deposit:</td><td style="color:#2D9F5A;font-weight:600;padding:4px 0">${formatCurrency(depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Square:</td><td style="color:#FFFFFF;padding:4px 0;font-size:10px;font-family:monospace">${paymentId}</td></tr>
      </table>
    </div>

    <div style="background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
      <div style="font-size:11px;color:#C9A962;font-weight:600">Action needed:</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">Assign a crew and confirm timing with the client within 24 hours.</div>
    </div>
  `);
}

export function verificationCodeEmail(params: { code: string; purpose: "email_change" | "2fa" }) {
  const { code, purpose } = params;
  const title = purpose === "email_change" ? "Verify your email change" : "Your Yugo+ login code";
  const desc = purpose === "email_change"
    ? "You requested to change your email address. Enter this code to confirm:"
    : "Use this code to complete your sign-in. It expires in 15 minutes.";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Verification</div>
    <div style="font-size:20px;font-weight:600;margin:0 0 16px;color:${EMAIL_TX};">${title}</div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">${desc}</p>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
      <div style="font-size:10px;color:${EMAIL_GOLD};text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:16px;">Your Code</div>
      <div style="width:40px;height:1px;background:${EMAIL_GOLD};margin:0 auto 20px;opacity:0.5"></div>
      <code style="font-size:30px;font-weight:700;letter-spacing:10px;color:${EMAIL_GOLD};font-family:monospace;">${code}</code>
      <div style="font-size:10px;color:${EMAIL_TX3};margin-top:16px;letter-spacing:0.5px">Expires in 15 minutes</div>
    </div>
    <p style="font-size:11px;color:${EMAIL_TX3};line-height:1.5;">If you didn&apos;t request this, you can safely ignore this email. Your account remains secure.</p>
  `;
  return emailLayout(inner);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Claim submitted (client) — premium dark layout. */
export function claimConfirmationEmailHtml(claimNumber: string, clientName: string, itemCount: number, totalClaimed: number): string {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Claim Received</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been received.</p>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:13px;color:${EMAIL_TX3};margin:0 0 4px;">${itemCount} Item${itemCount !== 1 ? "s" : ""} Claimed</p>
      <p style="font-size:22px;font-weight:700;color:${EMAIL_WINE};margin:0;">$${totalClaimed.toLocaleString()} Total Declared Value</p>
    </div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;">We&apos;ll review your claim within <strong>3 Business Days</strong> and contact you with next steps.</p>
    <p style="font-size:12px;color:${EMAIL_TX3};margin:0;">Reference: ${escapeHtml(claimNumber)}</p>
  `;
  return emailLayout(inner);
}

/** Claim filed on client's behalf by admin — premium dark layout. */
export function claimCreatedByAdminEmailHtml(claimNumber: string, clientName: string, itemCount: number, totalClaimed: number): string {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Claim Filed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">A damage claim <strong>${escapeHtml(claimNumber)}</strong> has been filed on your behalf by our team.</p>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:13px;color:${EMAIL_TX3};margin:0 0 4px;">${itemCount} Item${itemCount !== 1 ? "s" : ""} Claimed</p>
      <p style="font-size:22px;font-weight:700;color:${EMAIL_WINE};margin:0;">$${totalClaimed.toLocaleString()} Total Declared Value</p>
    </div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;">Our team is already reviewing this claim. We&apos;ll contact you with updates and next steps.</p>
    <p style="font-size:12px;color:${EMAIL_TX3};margin:0;">Reference: ${escapeHtml(claimNumber)}</p>
  `;
  return emailLayout(inner);
}

/** Claim approved — premium dark layout. */
export function claimApprovalEmailHtml(claimNumber: string, clientName: string, approvedAmount: number, resolutionNotes: string): string {
  const notesBlock = resolutionNotes
    ? `<p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;"><strong>Resolution:</strong> ${escapeHtml(resolutionNotes)}</p>`
    : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Claim Review Complete</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been reviewed.</p>
    <div style="background:rgba(45,159,90,0.12);border:1px solid rgba(45,159,90,0.3);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:12px;color:${EMAIL_TX3};margin:0 0 4px;letter-spacing:0.5px;">Approved Amount</p>
      <p style="font-size:28px;font-weight:700;color:#2D9F5A;margin:0;">$${approvedAmount.toLocaleString()}</p>
    </div>
    ${notesBlock}
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0;">Payout will be processed via e-Transfer within 5 Business Days.</p>
  `;
  return emailLayout(inner);
}

/** Claim status update — premium dark layout. */
export function claimStatusUpdateEmailHtml(claimNumber: string, clientName: string, fromStatus: string, toStatus: string, notes: string | null): string {
  const fromLabel = fromStatus.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const toLabel = toStatus.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const notesBlock = notes ? `<p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Claim Status Update</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">There&apos;s an update on your claim <strong>${escapeHtml(claimNumber)}</strong>.</p>
    <div style="background:#1A1A1A;border:1px solid ${EMAIL_BRD};border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:12px;color:${EMAIL_TX3};margin:0 0 4px;">Status</p>
      <p style="font-size:14px;color:${EMAIL_TX2};margin:0;"><span style="text-decoration:line-through;color:${EMAIL_TX3};">${escapeHtml(fromLabel)}</span> &rarr; <strong style="color:${EMAIL_TX};">${escapeHtml(toLabel)}</strong></p>
    </div>
    ${notesBlock}
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0;">If you have any questions, reply to this email and our team will get back to you.</p>
  `;
  return emailLayout(inner);
}

/** Claim denied — premium dark layout. */
export function claimDenialEmailHtml(claimNumber: string, clientName: string, reason: string): string {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${EMAIL_GOLD};letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Claim Review Complete</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been reviewed.</p>
    <div style="background:rgba(153,27,27,0.15);border:1px solid rgba(153,27,27,0.3);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:14px;color:#FCA5A5;line-height:1.6;margin:0;">Unfortunately, we were unable to approve this claim.</p>
    </div>
    <p style="font-size:14px;color:${EMAIL_TX2};line-height:1.6;margin:0 0 16px;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p style="font-size:13px;color:${EMAIL_TX3};line-height:1.5;margin:0;">If you have additional information to support your claim, please reply to this email.</p>
  `;
  return emailLayout(inner);
}

/* ─── PROJECT ITEM STATUS UPDATE EMAIL (partner-facing) ─── */
const PROJECT_STATUS_ACCENT: Record<string, string> = {
  ready_for_pickup:    "#F59E0B",
  shipped:             "#3B82F6",
  in_transit:          "#3B82F6",
  received_warehouse:  "#10B981",
  inspected:           "#10B981",
  stored:              "#10B981",
  scheduled_delivery:  "#8B5CF6",
  delivered:           "#22C55E",
  installed:           "#22C55E",
  issue_reported:      "#EF4444",
};

export interface ProjectItemStatusEmailData {
  partnerName: string;
  projectName: string;
  projectNumber: string;
  itemName: string;
  statusLabel: string;
  statusKey: string;
  notes?: string | null;
  portalUrl: string;
}

export function projectItemStatusEmailHtml(d: ProjectItemStatusEmailData): string {
  const accent = PROJECT_STATUS_ACCENT[d.statusKey] || EMAIL_GOLD;
  const isIssue = d.statusKey === "issue_reported";
  const isDelivered = ["delivered", "installed"].includes(d.statusKey);

  const badge = `<span style="display:inline-block;background:${accent}22;color:${accent};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">${d.statusLabel}</span>`;

  const notesBlock = d.notes ? `
      <tr><td style="height:14px;"></td></tr>
      <tr>
        <td style="background:#1A1A1A;border-left:3px solid ${accent};border-radius:4px;padding:10px 14px;">
          <p style="font-size:13px;color:${EMAIL_TX2};line-height:1.5;margin:0;font-style:italic;">"${escapeHtml(d.notes)}"</p>
        </td>
      </tr>` : "";

  const closingLine = isIssue
    ? `Our team has been notified and will follow up with you shortly.`
    : isDelivered
    ? `This item has been successfully delivered to site.`
    : `Log in to your Yugo portal to view the full project breakdown.`;

  const inner = `
    <tr>
      <td style="padding-bottom:4px;">
        <p style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${EMAIL_TX3};margin:0 0 16px;">${escapeHtml(d.projectNumber)} &middot; ${escapeHtml(d.projectName)}</p>
        <h1 style="font-size:28px;font-weight:700;letter-spacing:0.5px;color:${EMAIL_TX};margin:0 0 12px;">Item Status Update</h1>
        <p style="font-size:14px;color:${EMAIL_TX2};margin:0 0 24px;">Hi ${escapeHtml(d.partnerName)}, here&rsquo;s the latest on one of your project items.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#161616;border:1px solid ${EMAIL_BRD};border-radius:12px;padding:20px 20px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-bottom:14px;border-bottom:1px solid ${EMAIL_BRD};">
              <p style="font-size:16px;font-weight:700;color:${EMAIL_TX};margin:0 0 8px;">${escapeHtml(d.itemName)}</p>
              ${badge}
            </td>
          </tr>
          ${notesBlock}
          <tr><td style="height:14px;"></td></tr>
          <tr>
            <td style="font-size:13px;color:${EMAIL_TX2};line-height:1.5;">${closingLine}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr><td style="height:24px;"></td></tr>
    <tr>
      <td align="center">
        <a href="${d.portalUrl}" style="display:inline-block;background-color:${EMAIL_GOLD};color:#000000;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;border-radius:0;">View Project</a>
      </td>
    </tr>
    <tr><td style="height:32px;"></td></tr>
  `;
  return emailLayout(inner);
}
