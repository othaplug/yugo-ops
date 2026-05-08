/**
 * Styled HTML templates for admin/coordinator notification emails.
 * Premium Yugo-branded shell: cream page, white card, WINE top bar, forest section accents.
 * Typography: 12px uppercase kickers; forest primary CTAs (matches transactional client mail).
 */
import { getClientEmailFooterTrs } from "@/lib/email/client-email-footer";
import {
  EMAIL_SANS_STACK,
  EMAIL_FOREST,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_PAGE,
  EMAIL_ROSE,
  EMAIL_WINE,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import { EMAIL_FLUID_MAX_WIDTH_PX } from "@/lib/email/email-responsive-css";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import {
  EMAIL_LOGO_BLACK_H,
  EMAIL_LOGO_BLACK_W,
  getEmailLogoWineUrl,
} from "@/lib/email-templates";

/* ─── Shared palette ───────────────────────────────────────────────── */
/** White card surface inside the cream page (matches premium island). */
const CARD_BG = "#FFFFFF";
/** Outer page — cream, matching client transactional shell. */
const SHELL_BG = EMAIL_PREMIUM_PAGE;
/** Muted fill for detail bands / summary tables (forest-tinted; readable on white card). */
const DETAIL_BAND_BG = EMAIL_PREMIUM_MUTED_FILL;
/** Primary ink. */
const TEXT = "#1C1917";
/** Secondary / muted ink. */
const TEXT_MUTED = "#6B635C";
const BTN_FONT = EMAIL_SANS_STACK;
/** Card outer border (forest tint, consistent with premium client mail). */
const CARD_BORDER = "rgba(44,62,45,0.13)";
/** Section divider inside card. */
const SECTION_RULE = `rgba(44,62,45,0.10)`;

/** Structured row labels — matches client quote KV tables. */
const ADMIN_LABEL_TD = `color:#6B635C;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding:6px 14px 6px 0;vertical-align:top;width:38%;font-family:${BTN_FONT}`;
/** Section kicker — WINE, 12px uppercase, matching lifecycle templates. */
const ADMIN_KICKER = `font-size:12px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;font-family:${BTN_FONT}`;

/* ─── Mobile CSS ───────────────────────────────────────────────────── */
const ADMIN_MOBILE_CSS = `<style type="text/css">
@media only screen and (max-width:600px){
  .ya-outer{padding:16px 0 40px !important;}
  .ya-card{width:100% !important;max-width:100% !important;border-left:none !important;border-right:none !important;}
  .ya-content{padding:24px 18px 28px !important;}
  .ya-header{padding:18px 18px 16px !important;}
  .ya-footer-band{padding:14px 18px 16px !important;}
}
</style>`;

/**
 * Premium admin notification shell: cream page → white card with WINE top bar → forest-accented sections.
 * All admin notifications use this wrapper.
 */
export function adminNotificationLayout(
  innerHtml: string,
  title?: string,
): string {
  const logoUrl = getEmailLogoWineUrl();
  const heading = title
    ? `<h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 18px;line-height:1.25;font-family:${BTN_FONT};">${escapeHtml(title)}</h1>`
    : "";
  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:only light;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="only light">
  <meta name="supported-color-schemes" content="light">
  ${ADMIN_MOBILE_CSS}
</head>
<body style="margin:0;padding:0;background-color:${SHELL_BG};font-family:${BTN_FONT};color:${TEXT};-webkit-text-fill-color:${TEXT};color-scheme:only light;" bgcolor="${SHELL_BG}">

<!-- Outer cream page -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SHELL_BG}" style="background-color:${SHELL_BG};color-scheme:only light;">
  <tr>
    <td class="ya-outer" align="center" bgcolor="${SHELL_BG}" style="padding:32px 20px 48px;background-color:${SHELL_BG};">

      <!-- 600px white card -->
      <table class="ya-card" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${CARD_BG}" style="max-width:${EMAIL_FLUID_MAX_WIDTH_PX}px;width:100%;background-color:${CARD_BG};border:1px solid ${CARD_BORDER};">

        <!-- WINE top accent bar -->
        <tr>
          <td style="background-color:${EMAIL_WINE};height:4px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
        </tr>

        <!-- Header: logo + "Internal" label -->
        <tr>
          <td class="ya-header" style="padding:22px 28px 18px;background-color:${CARD_BG};border-bottom:1px solid ${SECTION_RULE};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" style="display:block;border:0;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;" />
                </td>
                <td align="right" style="text-align:right;vertical-align:middle;">
                  <span style="display:inline-block;background-color:${EMAIL_PREMIUM_MUTED_FILL};color:${TEXT_MUTED};font-size:9px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;padding:4px 8px;font-family:${BTN_FONT};">Internal</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="ya-content" style="padding:28px 28px 32px;background-color:${CARD_BG};font-family:${BTN_FONT};color:${TEXT};font-size:14px;line-height:1.6;">
            ${heading}
            ${innerHtml}
          </td>
        </tr>

        <!-- Footer band inside card -->
        <tr>
          <td class="ya-footer-band" style="padding:14px 28px 18px;background-color:${SHELL_BG};border-top:1px solid ${SECTION_RULE};">
            <p style="margin:0;font-size:11px;color:${TEXT_MUTED};line-height:1.55;font-family:${BTN_FONT};">Internal notification — do not forward outside authorized channels.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>

  <!-- Branded footer -->
  ${getClientEmailFooterTrs({ whyReceiving: "generic" })}

</table>
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:20px;margin-bottom:24px;">
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:16px 20px;margin-bottom:20px;">
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

/** New lead from capture or admin (all coordinators + in-app; also direct email in notify). */
export function newLeadAdminEmailHtml(params: {
  leadNumber: string | null;
  clientName: string;
  serviceLabel: string;
  moveSizeLabel: string;
  preferredDateLabel: string;
  sourceLabel: string;
  leadUrl: string;
  contactEmail: string | null;
  contactPhone: string | null;
  fromAddress: string | null;
  toAddress: string | null;
}): string {
  const num = (params.leadNumber || "").trim();
  const titleLine = num
    ? `${escapeHtml(num)} · ${escapeHtml(params.clientName)}`
    : escapeHtml(params.clientName);
  const fromTo =
    (params.fromAddress || params.toAddress)
      ? `<tr><td style="${ADMIN_LABEL_TD}">Move route</td><td style="color:${TEXT};font-size:12px;padding:4px 0;line-height:1.45;">${
        params.fromAddress
          ? `From: ${escapeHtml(String(params.fromAddress))}${
              params.toAddress ? "<br/>" : ""
            }`
          : ""
      }${
        params.toAddress
          ? `${params.fromAddress ? "" : ""}To: ${escapeHtml(String(params.toAddress))}`
          : ""
      }</td></tr>`
      : "";
  const contactRows =
    params.contactEmail || params.contactPhone
      ? `<tr><td style="${ADMIN_LABEL_TD}">Contact</td><td style="color:${TEXT};padding:4px 0;">${
        [params.contactEmail ? escapeHtml(params.contactEmail) : "", params.contactPhone ? escapeHtml(params.contactPhone) : ""]
          .filter(Boolean)
          .join(" · ") || "—"
      }</td></tr>`
      : "";
  const inner = `
    <div style="${ADMIN_KICKER}">New lead</div>
    <h1 style="font-size:22px;font-weight:700;color:${TEXT};margin:0 0 6px;letter-spacing:-0.02em;">${titleLine}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.55;margin:0 0 18px;">
      A new lead just came in. Please respond as soon as you can, ideally within 5 minutes during business hours.
    </p>
    <p style="font-size:12px;font-weight:600;color:${EMAIL_FOREST};text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;font-family:${BTN_FONT};">Lead details</p>
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:18px 20px;margin-bottom:14px;">
      <table style="width:100%;font-size:14px;border-collapse:collapse;font-family:${BTN_FONT};">
        <tr><td style="${ADMIN_LABEL_TD}">Name</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${escapeHtml(params.clientName)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Service</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.serviceLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Size</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.moveSizeLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Move date</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.preferredDateLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Source</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(params.sourceLabel)}</td></tr>
        ${contactRows}
        ${fromTo}
      </table>
    </div>
    <p style="font-size:13px;color:${TEXT_MUTED};line-height:1.55;margin:0 0 20px;">
      Open the lead to assign, add notes, and follow up. If the client came from the website, they may be waiting for pricing.
    </p>
    <a class="yugo-admin-cta" href="${escapeHtml(params.leadUrl)}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">Open lead in Ops+</a>
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
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:16px 20px;margin-bottom:20px;">
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
          <div class="yugo-admin-meter-track" style="background:rgba(44,62,45,0.08);height:8px;overflow:hidden;">
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

    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:16px 18px;margin-bottom:20px;font-family:${BTN_FONT};">
      <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;">Engagement snapshot</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;color:${TEXT};">
        <tr>
          <td style="padding:8px 10px 8px 0;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${params.viewCount}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Page views</span></td>
          <td style="padding:8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${params.uniqueDays}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Days active</span></td>
          <td style="padding:8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${escapeHtml(timeLabel)}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Longest focus (est.)</span></td>
          <td style="padding:8px 0 8px 10px;width:25%;vertical-align:top;"><strong style="display:block;font-size:18px;color:${EMAIL_FOREST};">${escapeHtml(topTierLabel)}</strong><span style="font-size:11px;color:${TEXT_MUTED};">Top tier clicks</span></td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;font-family:${BTN_FONT};">Tier interest</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:22px;font-family:${BTN_FONT};">
      ${tierRows}
    </table>

    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:16px 18px;margin-bottom:20px;font-family:${BTN_FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;">Client</p>
            <p style="margin:0;color:${TEXT};font-weight:600;">${escapeHtml(params.clientFullName)}</p>
            <p style="margin:6px 0 0;color:${TEXT_MUTED};font-size:12px;">${escapeHtml(params.clientPhone || "—")}</p>
            <p style="margin:4px 0 0;color:${TEXT_MUTED};font-size:12px;">${escapeHtml(params.clientEmail || "—")}</p>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:12px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;">Move</p>
            <p style="margin:0;color:${TEXT};font-size:12px;line-height:1.5;">${escapeHtml(params.fromAddress || "—")}</p>
            <p style="margin:8px 0 0;color:${TEXT};font-size:12px;line-height:1.5;">${escapeHtml(params.toAddress || "—")}</p>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;font-family:${BTN_FONT};">Recommended action</p>
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

const ORG_TYPE_LABELS: Record<string, string> = {
  designer: "Designer",
  interior_designer: "Interior designer",
  retail: "Retail",
  furniture_retailer: "Furniture retail",
  b2b: "B2B",
  b2c: "B2C",
  hospitality: "Hospitality",
  gallery: "Gallery",
  art_gallery: "Art gallery",
  realtor: "Realtor",
  stager: "Stager",
  property_manager: "Property manager",
  property_management_residential: "Property management (residential)",
  property_management_commercial: "Property management (commercial)",
  developer: "Developer",
  developer_builder: "Developer",
  other: "Partner",
}

function organizationTypeLabel(raw: string | null | undefined): string {
  const k = (raw || "").toLowerCase().trim();
  if (!k) return "";
  return ORG_TYPE_LABELS[k] || k.replace(/_/g, " ");
}

const CREW_BUILDING_ELEVATOR_LABELS: Record<string, string> = {
  standard: "Standard (direct to floor)",
  split_transfer: "Split transfer",
  multi_transfer: "Multiple transfers",
  no_freight: "No freight elevator",
  stairs_only: "Stairs only",
};

/** Crew-submitted building profile: coordinator email with context and CTA to verify. */
export function buildingProfileCrewReportAdminEmailHtml(params: {
  isUpdate: boolean;
  address: string;
  buildingProfileId: string;
  complexityRating: number;
  elevatorSystemKey: string;
  estimatedExtraMinutesPerTrip: number;
  accessSummaryLines: string[];
  crewNotes: string | null;
  photoCount: number;
  timesReportedByCrew: number;
  moveCode: string | null;
  clientName: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  partnerOrgName: string | null;
  partnerOrgType: string | null;
}): string {
  const baseUrl = getEmailBaseUrl();
  const viewUrl = `${baseUrl}/admin/buildings/${encodeURIComponent(params.buildingProfileId)}`;
  const elevatorLabel =
    CREW_BUILDING_ELEVATOR_LABELS[params.elevatorSystemKey] ||
    params.elevatorSystemKey.replace(/_/g, " ");
  const typeLbl = organizationTypeLabel(params.partnerOrgType);
  const partnerLine =
    params.partnerOrgName && typeLbl
      ? `${params.partnerOrgName} · ${typeLbl}`
      : params.partnerOrgName
        ? params.partnerOrgName
        : typeLbl
          ? `Partner type: ${typeLbl}`
          : "";
  const notesRaw = params.crewNotes?.trim() || ""
  const notesForEmail =
    notesRaw.length > 1200 ? `${notesRaw.slice(0, 1200)}\u2026` : notesRaw
  const notesBlock = notesForEmail
    ? `<tr><td style="${ADMIN_LABEL_TD};vertical-align:top;">Crew notes</td><td style="color:${TEXT};font-size:13px;padding:4px 0;line-height:1.5;">${escapeHtml(notesForEmail)}</td></tr>`
    : "";
  const routeBlock =
    params.fromAddress || params.toAddress
      ? `<tr><td style="${ADMIN_LABEL_TD};vertical-align:top;">Job route</td><td style="color:${TEXT};font-size:13px;padding:4px 0;line-height:1.45;">${
        params.fromAddress
          ? `<span style="display:block;">Origin: ${escapeHtml(params.fromAddress)}</span>`
          : ""
      }${
        params.toAddress
          ? `<span style="display:block;margin-top:6px;">Destination: ${escapeHtml(params.toAddress)}</span>`
          : ""
      }</td></tr>`
      : "";
  const moveBlock =
    params.moveCode || params.clientName
      ? `<tr><td style="${ADMIN_LABEL_TD};vertical-align:top;">Related move</td><td style="color:${TEXT};font-weight:600;padding:4px 0;">${
        params.moveCode ? escapeHtml(params.moveCode) : "—"
      }${
        params.clientName
          ? `<span style="display:block;font-weight:500;margin-top:4px;font-size:13px;color:${TEXT_MUTED};">Client: ${escapeHtml(params.clientName)}</span>`
          : ""
      }</td></tr>`
      : "";
  const partnerRow = partnerLine
    ? `<tr><td style="${ADMIN_LABEL_TD}">Partner</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(partnerLine)}</td></tr>`
    : "";
  const flagsHtml =
    params.accessSummaryLines.length > 0
      ? `<ul style="margin:6px 0 0;padding-left:18px;color:${TEXT};font-size:13px;line-height:1.5;">${params.accessSummaryLines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
      : `<span style="color:${TEXT_MUTED};">None flagged</span>`;

  const intro = params.isUpdate
    ? "A crew finished the on-site building report for this address. The building record was updated and <strong>must be verified</strong> before planners rely on it for future quotes and jobs."
    : "A crew submitted a <strong>new</strong> building profile for this address. It is <strong>unverified</strong> until a coordinator reviews it in Ops+.";

  const inner = `
    <div style="${ADMIN_KICKER}">Crew building report</div>
    <h1 style="font-size:20px;font-weight:700;color:${TEXT};margin:0 0 10px;line-height:1.25;">${escapeHtml(params.address)}</h1>
    <p style="font-size:14px;color:${TEXT_MUTED};line-height:1.6;margin:0 0 18px;">${intro}</p>
    <p style="font-size:13px;color:${TEXT};line-height:1.55;margin:0 0 16px;padding:12px 14px;background:${DETAIL_BAND_BG};border-left:3px solid ${EMAIL_FOREST};">
      <strong style="color:${EMAIL_FOREST};">Complexity ${params.complexityRating} of 5.</strong>
      This is the crew&apos;s difficulty rating for access and vertical transport at this site.
      Compare it to your experience and adjust in the building editor if needed.
    </p>
    <p style="font-size:12px;font-weight:600;color:${EMAIL_FOREST};text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;font-family:${BTN_FONT};">Summary</p>
    <div class="yugo-admin-muted-fill" style="background:${DETAIL_BAND_BG};border:1px solid rgba(44,62,45,0.10);padding:16px 20px;margin-bottom:20px;">
      <table style="width:100%;font-size:13px;border-collapse:collapse;font-family:${BTN_FONT};">
        ${moveBlock}
        ${partnerRow}
        ${routeBlock}
        <tr><td style="${ADMIN_LABEL_TD}">Elevator / vertical</td><td style="color:${TEXT};padding:4px 0;">${escapeHtml(elevatorLabel)}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Extra time (est.)</td><td style="color:${TEXT};padding:4px 0;">${params.estimatedExtraMinutesPerTrip} minutes per trip (model estimate from crew inputs)</td></tr>
        <tr><td style="${ADMIN_LABEL_TD};vertical-align:top;">Site flags</td><td style="padding:4px 0;">${flagsHtml}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Photos attached</td><td style="color:${TEXT};padding:4px 0;">${params.photoCount} file${params.photoCount === 1 ? "" : "s"}</td></tr>
        <tr><td style="${ADMIN_LABEL_TD}">Crew reports on file</td><td style="color:${TEXT};padding:4px 0;">${params.timesReportedByCrew} (includes this submission)</td></tr>
        ${notesBlock}
      </table>
    </div>
    <p style="font-size:13px;color:${TEXT_MUTED};line-height:1.55;margin:0 0 20px;">
      Open the building profile to confirm details, set <strong>verified</strong> when accurate, and tune notes for future coordinators and quotes.
    </p>
    <a class="yugo-admin-cta" href="${viewUrl}" style="${emailPrimaryCtaStyle(BTN_FONT, "inline-block")}">REVIEW BUILDING IN OPS</a>
  `;
  return adminNotificationLayout(inner, undefined);
}
