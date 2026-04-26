/**
 * Styled HTML templates for admin/coordinator notification emails.
 * All use light background and dark text for readability (no bare plain-text emails).
 * Typography: forest kickers 12px uppercase; primary buttons match transactional forest CTA.
 */
import { getEmailFooterStandaloneFragment } from "@/lib/email/client-email-footer";
import {
  EMAIL_SANS_STACK,
  EMAIL_FOREST,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_PAGE,
  EMAIL_ROSE,
  EMAIL_WINE,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import {
  EMAIL_LOGO_BLACK_H,
  EMAIL_LOGO_BLACK_W,
  getEmailLogoWineUrl,
} from "@/lib/email-templates";
const ACCENT_ROSE = "#9E4A5C";
/** Full-bleed admin shell — same cream as client transactional mail. */
const SHELL_BG = EMAIL_PREMIUM_PAGE;
const DETAIL_BAND_BG = EMAIL_PREMIUM_MUTED_FILL;
const TEXT = "#1a1a1a";
const TEXT_MUTED = "#555";
const BTN_FONT = EMAIL_SANS_STACK;
/** Structured row labels (quote parity). */
const ADMIN_LABEL_TD = `color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding:5px 12px 5px 0;vertical-align:top;width:38%;font-family:${BTN_FONT}`;
const ADMIN_KICKER = `font-size:12px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;font-family:${BTN_FONT}`;

/** Full document wrapper for admin notifications: full-width cream shell (no outer gutter, no card border). */
export function adminNotificationLayout(
  innerHtml: string,
  title?: string,
): string {
  const heading = title
    ? `<h1 style="font-size:18px;font-weight:700;color:${TEXT};margin:0 0 16px;">${escapeHtml(title)}</h1>`
    : "";
  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:only light;">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="only light"><meta name="supported-color-schemes" content="light"></head>
<body class="yugo-light-email-doc" style="margin:0;padding:0;background:${SHELL_BG};font-family:${BTN_FONT};color:${TEXT};-webkit-text-fill-color:${TEXT};color-scheme:only light;" bgcolor="${SHELL_BG}" data-ogsb="${SHELL_BG}" data-ogsc="${TEXT}">
<div class="yugo-admin-email-shell" bgcolor="${SHELL_BG}" style="width:100%;max-width:100%;margin:0;padding:0;box-sizing:border-box;background-color:${SHELL_BG};">
  <div class="yugo-admin-email-card" bgcolor="${SHELL_BG}" style="background:${SHELL_BG};padding:16px;box-sizing:border-box;border:none;box-shadow:none;">
    <div style="text-align:center;margin-bottom:22px;">
      <img src="${getEmailLogoWineUrl()}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" style="display:inline-block;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;border:0;" />
    </div>
    ${heading}
    <div class="yugo-admin-email-body" style="font-size:14px;color:${TEXT};line-height:1.6;">
      ${innerHtml}
    </div>
  </div>
  <p class="yugo-admin-footer-note" style="margin:0;padding:12px 16px 0;font-size:11px;color:${TEXT_MUTED};text-align:center;width:100%;box-sizing:border-box;line-height:1.5;">
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border-radius:0;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD}">Client</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${escapeHtml(params.clientName)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Items</td><td style="color:${TEXT};padding:4px 0;">${params.itemCount} item${params.itemCount !== 1 ? "s" : ""}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Total claimed</td><td style="color:${EMAIL_FOREST};font-weight:700;padding:4px 0;">$${params.totalClaimed.toLocaleString()}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Valuation</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.valuationTier || "released")}</td></tr>
      </table>
    </div>
    <a class="yugo-admin-cta" href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW CLAIM</a>
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 20px;margin-bottom:20px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Type</td><td style="color:${TEXT};font-weight:500;padding:4px 0 6px;">${escapeHtml(params.typeLabel)} · ${escapeHtml(params.sizeLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Estimate</td><td style="color:${EMAIL_FOREST};font-weight:600;padding:4px 0 6px;">${escapeHtml(params.priceStr)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 6px 0;">Route</td><td style="color:${TEXT};padding:4px 0 6px;">${routeLine}</td></tr>
        ${params.extras ? `<tr><td style="${ADMIN_LABEL_TD};padding:4px 12px 0 0;vertical-align:top;">Details</td><td style="color:${TEXT};font-size:12px;padding:4px 0 0;line-height:1.5;">${escapeHtml(params.extras).replace(/\|/g, " · ")}</td></tr>` : ""}
      </table>
    </div>
    <a class="yugo-admin-cta" href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW WIDGET LEADS</a>
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
    <a class="yugo-admin-cta" href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW MOVE</a>
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 20px;margin-bottom:20px;">
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
    <a class="yugo-admin-cta" href="${params.adminMoveUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW MOVE</a>
  `;
  return adminNotificationLayout(inner, undefined);
}

/** Quote engagement — client is actively comparing tiers / returning to the quote (internal). */
export function quoteComparisonSignalAdminEmailHtml(params: {
  clientFirstName: string;
  clientFullName: string;
  clientEmail: string;
  clientPhone: string;
  publicQuoteId: string;
  moveDateLabel: string;
  moveSizeLabel: string;
  fromAddress: string;
  toAddress: string;
  tierPrices: { essential: number; signature: number; estate: number };
  viewCount: number;
  uniqueDays: number;
  tierClickCounts: Record<string, number>;
  maxSessionSeconds: number;
  lastEngagementLabel: string;
  adminQuoteUrl: string;
}): string {
  const fmtMoney = (n: number) =>
    Number.isFinite(n) && n > 0 ? `$${Math.round(n).toLocaleString()}` : "—";

  const seconds = Math.max(0, Math.floor(params.maxSessionSeconds));
  let timeLabel: string;
  if (seconds < 60) timeLabel = `${seconds}s`;
  else {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) timeLabel = `${minutes} min`;
    else {
      const h = Math.floor(minutes / 60);
      const rem = minutes % 60;
      timeLabel = rem > 0 ? `${h}h ${rem}m` : `${h}h`;
    }
  }

  const tierKeys = ["essential", "signature", "estate"] as const;
  const clicksMap = params.tierClickCounts || {};
  const maxClicks = Math.max(1, ...tierKeys.map((t) => clicksMap[t] ?? 0));
  const topTierEntry = Object.entries(clicksMap).sort((a, b) => b[1] - a[1])[0];
  const topTierLabel = topTierEntry?.[0]
    ? topTierEntry[0].charAt(0).toUpperCase() + topTierEntry[0].slice(1).toLowerCase()
    : "—";

  const urgency: "high" | "medium" | "low" =
    params.viewCount >= 4 ? "high" : params.uniqueDays >= 2 ? "medium" : "low";
  const urgencyLabel =
    urgency === "high"
      ? "High — call soon"
      : urgency === "medium"
        ? "Medium — follow up today"
        : "Low — monitor";

  const urgencyBg =
    urgency === "high" ? EMAIL_WINE : urgency === "medium" ? EMAIL_ROSE : EMAIL_FOREST;
  const urgencyColor = "#FFFBF7";
  const urgencyLevelClass =
    urgency === "high"
      ? "yugo-admin-urgency-high"
      : urgency === "medium"
        ? "yugo-admin-urgency-medium"
        : "yugo-admin-urgency-low";

  const barColor: Record<(typeof tierKeys)[number], string> = {
    essential: EMAIL_FOREST,
    signature: EMAIL_ROSE,
    estate: EMAIL_WINE,
  };

  const tierRows = tierKeys
    .map((tier) => {
      const clicks = clicksMap[tier] ?? 0;
      const pct = Math.round((clicks / maxClicks) * 100);
      const price = params.tierPrices[tier];
      const barClass =
        tier === "essential"
          ? "yugo-admin-bar-essential"
          : tier === "signature"
            ? "yugo-admin-bar-signature"
            : "yugo-admin-bar-estate";
      return `<tr>
        <td style="padding:6px 8px 6px 0;vertical-align:middle;width:88px;font-family:${BTN_FONT};">
          <span style="font-size:13px;font-weight:600;color:${TEXT};text-transform:capitalize;">${tier}</span>
        </td>
        <td style="padding:6px 8px;vertical-align:middle;font-family:${BTN_FONT};">
          <div class="yugo-admin-meter-track" style="background:${DETAIL_BAND_BG};border-radius:0;height:8px;overflow:hidden;">
            <div class="yugo-admin-tier-bar-fill ${barClass}" style="background:${barColor[tier]};height:8px;width:${pct}%;max-width:100%;"></div>
          </div>
        </td>
        <td style="padding:6px 0 6px 8px;vertical-align:middle;text-align:right;white-space:nowrap;font-size:12px;color:${TEXT};font-family:${BTN_FONT};">
          ${clicks} click${clicks === 1 ? "" : "s"} · ${fmtMoney(price)}
        </td>
      </tr>`;
    })
    .join("");

  const actionCopy =
    urgency === "high"
      ? `${escapeHtml(params.clientFirstName)} has opened this quote several times across multiple days and is spending time on tier details. <strong>Call within the next few hours</strong> to answer questions and help them decide.`
      : urgency === "medium"
        ? `${escapeHtml(params.clientFirstName)} is returning to the quote and exploring tiers. A follow-up today could move this forward. Their strongest click pattern is <strong>${escapeHtml(topTierLabel)}</strong> — lean into that value story.`
        : `${escapeHtml(params.clientFirstName)} is engaging with the quote. Monitor for another beat; if activity ramps up, reach out proactively.`;

  const inner = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:16px;font-family:${BTN_FONT};">
      <tr>
        <td style="vertical-align:top;">
          <div style="${ADMIN_KICKER}">Quote engagement</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <span class="yugo-admin-urgency-badge ${urgencyLevelClass}" style="display:inline-block;padding:6px 12px;background:${urgencyBg};color:${urgencyColor};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;font-family:${BTN_FONT};">
            ${escapeHtml(urgencyLabel)}
          </span>
        </td>
      </tr>
    </table>
    <h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 6px;font-family:${BTN_FONT};">
      ${escapeHtml(params.clientFirstName)} may be comparing options
    </h1>
    <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 20px;line-height:1.5;font-family:${BTN_FONT};">
      Quote <strong>${escapeHtml(params.publicQuoteId)}</strong>
      ${params.moveSizeLabel ? ` · ${escapeHtml(params.moveSizeLabel)}` : ""}
      ${params.moveDateLabel ? ` · ${escapeHtml(params.moveDateLabel)}` : ""}
    </p>

    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 18px;margin-bottom:20px;font-family:${BTN_FONT};">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;">Engagement snapshot</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;color:${TEXT};">
        <tr>
          <td style="padding:8px 10px 8px 0;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${params.viewCount}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Page views</span></td>
          <td style="padding:8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${params.uniqueDays}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Days active</span></td>
          <td style="padding:8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${escapeHtml(timeLabel)}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Longest focus (est.)</span></td>
          <td style="padding:8px 0 8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${escapeHtml(topTierLabel)}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Top tier clicks</span></td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;font-family:${BTN_FONT};">Tier interest</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:22px;font-family:${BTN_FONT};">
      ${tierRows}
    </table>

    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border-radius:0;padding:16px 18px;margin-bottom:20px;font-family:${BTN_FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;">Client</p>
            <p style="margin:0;color:${TEXT};font-weight:600;">${escapeHtml(params.clientFullName)}</p>
            <p style="margin:6px 0 0;color:${TEXT_MUTED};font-size:12px;">${escapeHtml(params.clientPhone || "—")}</p>
            <p style="margin:4px 0 0;color:${TEXT_MUTED};font-size:12px;">${escapeHtml(params.clientEmail || "—")}</p>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:12px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;">Move</p>
            <p style="margin:0;color:${TEXT};font-size:12px;line-height:1.5;">${escapeHtml(params.fromAddress || "—")}</p>
            <p style="margin:8px 0 0;color:${TEXT};font-size:12px;line-height:1.5;">${escapeHtml(params.toAddress || "—")}</p>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${ACCENT_ROSE};letter-spacing:0.08em;text-transform:uppercase;font-family:${BTN_FONT};">Recommended action</p>
    <p style="margin:0 0 22px;font-size:14px;color:${TEXT};line-height:1.6;font-family:${BTN_FONT};">
      ${actionCopy}
    </p>

    <a class="yugo-admin-cta" href="${params.adminQuoteUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW QUOTE IN OPS</a>

    <p style="margin:20px 0 0;font-size:11px;color:${TEXT_MUTED};line-height:1.5;font-family:${BTN_FONT};">
      Last activity: ${escapeHtml(params.lastEngagementLabel)} · Internal only — do not forward to the client.
    </p>
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
    <a class="yugo-admin-cta" href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">VIEW TIPS</a>
  `;
  return adminNotificationLayout(inner, undefined);
}
