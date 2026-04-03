import { getClientEmailFooterTrs, type EmailFooterWhy } from "@/lib/email/client-email-footer";

export type { EmailFooterWhy } from "@/lib/email/client-email-footer";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { getEmailBaseUrl } from "./email-base-url";
import { formatCurrency } from "./format-currency";
import { formatPhone, normalizePhone } from "./phone";

/* ═══ Client emails: Equinox-style transaction shell (bordered dark card, logo inside card). Table-based. ═══ */
const EQ_PAGE_BG = "#121212";
const EQ_CARD_BG = "#161616";
const EQ_CARD_BORDER = "rgba(255,255,255,0.22)";
export const EQ_SANS = "Helvetica Neue,Helvetica,Arial,sans-serif";

/* ═══ Legacy premium: full-width black + cream wordmark (quote follow-ups, reviews, low-sat). ═══ */
const EMAIL_BG = "#000000";
/** Hairline under wordmark on black (replaces gold). */
const EMAIL_DARK_HAIRLINE = "#EDE6DC";
const EMAIL_WINE = "#5C1A33";
const EMAIL_BRD = "#222222";
const EMAIL_TX = "#FFFFFF";
const EMAIL_TX2 = "#B0ADA8";
const EMAIL_TX3 = "#666";

/** Official Yugo logo URL for emails (cream wordmark on dark background). */
export function getEmailLogoUrl(): string {
  const base = getEmailBaseUrl();
  return `${base}/images/yugo-logo-cream.png`;
}

/** Dark logo for light email cards (Estate, admin notifications). */
export function getEmailLogoBlackUrl(): string {
  const base = getEmailBaseUrl();
  return `${base}/images/yugo-logo-black.png`;
}

/** Logo dimensions in HTML emails (~3.67:1). Keep compact so the mark doesn’t dominate the message. */
export const EMAIL_LOGO_BLACK_W = 80;
export const EMAIL_LOGO_BLACK_H = 22;
/** Width/height for cream wordmark on dark (same slot as former gold asset). */
export const EMAIL_LOGO_GOLD_W = 62;
export const EMAIL_LOGO_GOLD_H = 17;

/** Cream transactional shell (aligned with Estate palette; estate template HTML is unchanged). */
const PREMIUM_PAGE = "#FCF9F4";
const PREMIUM_BODY = "#3A3532";
const PREMIUM_BODY_MUTED = "#6B635C";
const PREMIUM_WINE = "#5C1A33";
const PREMIUM_ROSE = "#9E4A5C";
const PREMIUM_RULE = "rgba(92,26,51,0.14)";
const PREMIUM_MUTED_FILL = "#EBEBEB";
/** Gray / summary callouts — tight inset (credential cards, OTP, claims, deposit rows). */
const PREMIUM_CALLOUT_PAD = "12px 14px";
const PREMIUM_FONT = "'DM Sans',Helvetica Neue,Helvetica,Arial,sans-serif";
/**
 * Email typography (premium / cream templates):
 * - Display titles & large hero lines: PREMIUM_SERIF_HEADING, sentence case in copy, text-transform none, letter-spacing 0.
 * - Primary CTAs (filled wine or cream buttons): text-transform uppercase, letter-spacing 0; match plain-text *EmailText* CTA lines in ALL CAPS.
 * - Eyebrows & section labels: sentence case, text-transform none, letter-spacing 0 — except invite/credential kickers (PREMIUM_EYEBROW_UPPER).
 * - Body: PREMIUM_FONT (sans).
 */
const PREMIUM_SERIF_HEADING = "'Instrument Serif',Georgia,'Times New Roman',serif";
/** Wine subheads on invite & credential blocks: 12px, uppercase, letter-spacing 0 (explicit font-family for client consistency). */
const PREMIUM_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0px;text-transform:uppercase`;

/** Canonical label for premium tracking CTAs (all caps for plaintext + clients that ignore text-transform). */
export const PREMIUM_TRACK_CTA_LABEL = "TRACK YOUR MOVE";
/** Status-update emails for deliveries (same typography as {@link PREMIUM_TRACK_CTA_LABEL}). */
export const PREMIUM_TRACK_DELIVERY_CTA_LABEL = "TRACK YOUR DELIVERY";

/** 12px, uppercase, 0 letter-spacing, compact padding — shared wine primary for tracking links. */
const PREMIUM_COMPACT_WINE_CTA_STYLE = `background-color:${PREMIUM_WINE};color:#FFFFFF !important;-webkit-text-fill-color:#FFFFFF;padding:10px 28px;font-size:12px;font-weight:700;letter-spacing:0px;text-transform:uppercase;text-decoration:none;border-radius:0;font-family:${PREMIUM_FONT};line-height:1;`;

/**
 * Wine CTA for track-style links (cream premium shell). Use {@link PREMIUM_TRACK_CTA_LABEL} for copy.
 */
export function premiumCompactWineCtaAnchor(
  href: string,
  label: string,
  layout: "inline" | "block" = "inline",
): string {
  const disp =
    layout === "block"
      ? "display:block;text-align:center;width:100%;box-sizing:border-box;"
      : "display:inline-block;";
  return `<a href="${href}" style="${disp}${PREMIUM_COMPACT_WINE_CTA_STYLE}">${label.toUpperCase()}</a>`;
}

/** Company footer line for all emails (claim, admin, lifecycle). */
export const EMAIL_FOOTER_COMPANY =
  "Yugo Inc. · 507 King Street E., Toronto, ON · (647) 370-4525";

/** Cream wordmark centered — dark email cards (#161616, promo black, legacy black). */
function emailCardLogoCream(): string {
  const logoUrl = getEmailLogoUrl();
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 22px;">
  <tr>
    <td align="center" style="padding:0;">
      <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_GOLD_W}" height="${EMAIL_LOGO_GOLD_H}" style="display:block;border:0;max-width:${EMAIL_LOGO_GOLD_W}px;height:auto;margin:0 auto;" />
    </td>
  </tr>
</table>`;
}

/** Cream wordmark + hairline — legacy premium black shell. */
function emailCardLogoCreamLegacy(): string {
  const logoUrl = getEmailLogoUrl();
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 24px;">
  <tr>
    <td align="center" style="padding:0 0 16px;">
      <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_GOLD_W}" height="${EMAIL_LOGO_GOLD_H}" style="display:block;border:0;max-width:${EMAIL_LOGO_GOLD_W}px;height:auto;margin:0 auto;" />
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:0 16px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="height:1px;background:linear-gradient(to right,transparent,${EMAIL_DARK_HAIRLINE},transparent);font-size:0;line-height:0;">&nbsp;</td></tr></table>
    </td>
  </tr>
</table>`;
}

/** Estate header: black logo in light mode, cream wordmark when client uses dark mode (prefers-color-scheme). */
function emailCardLogoEstate(): string {
  const blackUrl = getEmailLogoBlackUrl();
  const creamUrl = getEmailLogoUrl();
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 20px;">
  <tr>
    <td align="center" style="padding:0;">
      <img src="${blackUrl}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" class="estate-email-logo-light" style="display:block;border:0;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;margin:0 auto;" />
      <img src="${creamUrl}" alt="" width="${EMAIL_LOGO_GOLD_W}" height="${EMAIL_LOGO_GOLD_H}" class="estate-email-logo-dark" style="display:none;border:0;max-width:${EMAIL_LOGO_GOLD_W}px;height:auto;margin:0 auto;" />
    </td>
  </tr>
</table>`;
}

/** Client contact email and phone for footer. */
function getContactEmail(): string {
  return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YUGO_EMAIL) || "notifications@opsplus.co";
}
function getContactPhone(): string {
  return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YUGO_PHONE) || "(647) 370-4525";
}

/** Black wordmark + wine–rose rule — premium transactional shell (not the Estate confirmation template). */
function emailCardLogoBlackPremiumRule(): string {
  const blackUrl = getEmailLogoBlackUrl();
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 24px;">
  <tr>
    <td align="center" style="padding:0;">
      <img src="${blackUrl}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" style="display:block;border:0;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;margin:0 auto;" />
    </td>
  </tr>
  <tr>
    <td align="center" style="padding:14px 16px 0;">
      <table width="72" cellpadding="0" cellspacing="0" border="0" role="presentation">
        <tr><td style="height:2px;background:linear-gradient(90deg,${PREMIUM_WINE},${PREMIUM_ROSE},${PREMIUM_WINE});font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Hairline section divider. Uses zero line-height on the rule cell so inherited body line-height
 * does not balloon the gap (email clients treat &nbsp; as a full text line otherwise).
 * Second row is a small fixed spacer before the next block.
 */
function premiumSectionRule(): string {
  const hairlineTd = `border-top:1px solid ${PREMIUM_RULE};font-size:0;line-height:0;mso-line-height-rule:exactly;padding:0;height:1px;`;
  const spacerTd = `font-size:0;line-height:0;mso-line-height-rule:exactly;padding:0;height:6px;`;
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0;"><tr><td style="${hairlineTd}">&nbsp;</td></tr><tr><td style="${spacerTd}">&nbsp;</td></tr></table>`;
}

function premiumEmailWrapper(innerHtml: string, footerWhy: EmailFooterWhy): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PREMIUM_PAGE}" style="background-color:${PREMIUM_PAGE};color-scheme:light;">
  <tr>
    <td align="center" bgcolor="${PREMIUM_PAGE}" style="padding:36px 20px 48px;background-color:${PREMIUM_PAGE};color-scheme:light;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${PREMIUM_PAGE}" style="max-width:100%;background-color:${PREMIUM_PAGE};">
        <tr>
          <td bgcolor="${PREMIUM_PAGE}" style="padding:0;font-family:${PREMIUM_FONT};color:${PREMIUM_BODY};-webkit-text-fill-color:${PREMIUM_BODY};font-size:15px;line-height:1.65;">
            ${emailCardLogoBlackPremiumRule()}
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${emailFooterRow(footerWhy)}
</table>
  `;
}

/** Equinox-style footer rows (tokens replaced at send time). */
function emailFooterRow(why: EmailFooterWhy = "booking"): string {
  return getClientEmailFooterTrs({ whyReceiving: why });
}

/**
 * Transactional wrapper: warm cream page, flat content (no card border), shared footer.
 */
export function emailLayout(innerHtml: string, _footerLoginUrl?: string, footerWhy: EmailFooterWhy = "booking"): string {
  void _footerLoginUrl;
  return premiumEmailWrapper(innerHtml, footerWhy);
}

/**
 * Promo / long-form transactional shell (quote follow-ups, nurture). Same premium shell as {@link emailLayout}.
 */
export function equinoxPromoLayout(innerHtml: string, footerWhy: EmailFooterWhy = "generic"): string {
  return premiumEmailWrapper(innerHtml, footerWhy);
}

const PREMIUM_PROMO_CTA_ANCHOR_STYLE = `display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF !important;-webkit-text-fill-color:#FFFFFF;padding:16px 40px;font-size:13px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;font-family:${PREMIUM_FONT};border-radius:0;line-height:1;`;

function equinoxPromoCtaTable(url: string, label: string, anchorStyle: string): string {
  const hairlineTd = `border-top:1px solid ${PREMIUM_RULE};font-size:0;line-height:0;mso-line-height-rule:exactly;padding:0;height:1px;`;
  const spacerTd = `font-size:0;line-height:0;mso-line-height-rule:exactly;padding:0;height:12px;`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:28px 0 0;">
  <tr>
    <td style="${hairlineTd}">&nbsp;</td>
  </tr>
  <tr>
    <td style="${spacerTd}">&nbsp;</td>
  </tr>
  <tr>
    <td align="center" style="text-align:center;">
      <a href="${url}" style="${anchorStyle}text-align:center;">${label.toUpperCase()}</a>
    </td>
  </tr>
</table>`;
}

/** CTA block preceded by a hairline rule. */
export function equinoxPromoCta(url: string, label: string): string {
  return equinoxPromoCtaTable(url, label, PREMIUM_PROMO_CTA_ANCHOR_STYLE);
}

/** Same layout as {@link equinoxPromoCta} with standardized track-move button typography. */
export function equinoxPromoTrackMoveCta(url: string): string {
  return equinoxPromoCtaTable(url, PREMIUM_TRACK_CTA_LABEL, `display:inline-block;${PREMIUM_COMPACT_WINE_CTA_STYLE}`);
}

/** Muted fine-print line beneath the CTA. */
export function equinoxPromoFinePrint(text: string): string {
  return `<p style="font-size:11px;color:${PREMIUM_BODY_MUTED} !important;-webkit-text-fill-color:${PREMIUM_BODY_MUTED};margin:20px 0 0;line-height:1.55;font-family:${PREMIUM_FONT};text-align:left;">${text}</p>`;
}

/* ══════════════════════════════════════════════════════════════════
   Estate (White Glove) confirmation, cream, wine + gold palette.
   Typography: Georgia headers, DM Sans body. Generous spacing.
   ══════════════════════════════════════════════════════════════════ */
const ESTATE_CREAM_PAGE = "#F3EDE4";
const ESTATE_CREAM_CARD = "#FFFCF9";
const ESTATE_WINE = "#5C1A33";
const ESTATE_GOLD_DARK = "#A67C2A";
const ESTATE_BODY = "#3A3532";
const ESTATE_BODY_MUTED = "#6B635C";
const ESTATE_DM_SANS = "'DM Sans',Helvetica Neue,Helvetica,Arial,sans-serif";
const ESTATE_GEORGIA = "'Instrument Serif',Georgia,'Times New Roman',serif";

/** Thin wine rule with generous breathing room — replaces ━━━━ dividers. */
function estateDivider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding:36px 0 32px;border-top:1px solid rgba(92,26,51,0.14);font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/** Estate section eyebrow — sentence case, Instrument Serif. */
function estateLabel(text: string): string {
  return `<p style="font-family:${ESTATE_GEORGIA};font-size:11px;font-weight:700;letter-spacing:0;color:${ESTATE_WINE};text-transform:none;margin:0 0 20px;line-height:1.4;">${text}</p>`;
}

/**
 * Estate luxury wrapper: warm cream page, ivory card with wine-tint border (logo + hairline inside card).
 * Completely distinct from the dark promo shell.
 */
const ESTATE_EMAIL_DARK_MODE_CSS = `
<style type="text/css">
@media (prefers-color-scheme: dark) {
  .estate-email-logo-light { display: none !important; }
  .estate-email-logo-dark { display: block !important; }
  .estate-email-logo-rule {
    background: #D4B87A !important;
    background-image: linear-gradient(90deg, #A67C2A, #F0E4C8, #A67C2A) !important;
  }
}
@media only screen and (max-width: 600px) {
  .estate-email-outer {
    padding-left: 0 !important;
    padding-right: 0 !important;
    padding-top: 20px !important;
    padding-bottom: 48px !important;
  }
  .estate-email-inner {
    width: 100% !important;
    max-width: 100% !important;
    border: none !important;
    border-width: 0 !important;
  }
  .estate-email-content {
    padding: 28px 16px 36px !important;
  }
}
</style>
`.trim();

function estateLuxuryCreamLayout(innerHtml: string): string {
  return `
${ESTATE_EMAIL_DARK_MODE_CSS}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${ESTATE_CREAM_PAGE};">
  <tr>
    <td class="estate-email-outer" align="center" style="padding:36px 20px 60px;background-color:${ESTATE_CREAM_PAGE};">
      <table class="estate-email-inner" width="580" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;width:580px;background-color:${ESTATE_CREAM_CARD};border:1px solid rgba(92,26,51,0.16);">
        <tr>
          <td class="estate-email-content" style="padding:52px 48px 56px;font-family:${ESTATE_DM_SANS};color:${ESTATE_BODY};font-size:15px;line-height:1.78;">
            ${emailCardLogoEstate()}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 28px;">
              <tr>
                <td align="center" style="padding:0;">
                  <table width="72" cellpadding="0" cellspacing="0" border="0" role="presentation">
                    <tr><td class="estate-email-logo-rule" style="height:2px;background:linear-gradient(90deg,${ESTATE_WINE},${ESTATE_GOLD_DARK},${ESTATE_WINE});font-size:0;line-height:0;">&nbsp;</td></tr>
                  </table>
                </td>
              </tr>
            </table>
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${emailFooterRow()}
</table>
  `;
}

/** Previous Yugo look: cream wordmark in premium shell — quote follow-ups, reviews, low-satisfaction. */
export function legacyEmailLayout(innerHtml: string, footerLoginUrl?: string): string {
  void footerLoginUrl;
  return premiumEmailWrapper(innerHtml, "generic");
}

/** Minimal status email (crew on the way, arrived, etc.): headline, body, optional CTA. Table-based, full-width dark. */
export function statusUpdateEmailHtml(params: {
  headline: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
  /** Set false for live move/delivery tracking pings (no legal footer). Default true. */
  includeFooter?: boolean;
}): string {
  const { headline, body, ctaUrl, ctaLabel, includeFooter = true } = params;
  const useCompactTrackCta =
    !!ctaLabel &&
    (ctaLabel === PREMIUM_TRACK_CTA_LABEL ||
      ctaLabel === PREMIUM_TRACK_DELIVERY_CTA_LABEL ||
      ctaLabel === "Track your move" ||
      ctaLabel === "Track your delivery");
  const ctaHtml = ctaUrl && ctaLabel
    ? `
    <tr>
      <td align="center" style="padding:8px 0 32px;">
        ${
          useCompactTrackCta
            ? premiumCompactWineCtaAnchor(
                ctaUrl,
                ctaLabel === "Track your delivery" || ctaLabel === PREMIUM_TRACK_DELIVERY_CTA_LABEL
                  ? PREMIUM_TRACK_DELIVERY_CTA_LABEL
                  : PREMIUM_TRACK_CTA_LABEL,
              )
            : `<a href="${ctaUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:13px 32px;font-size:13px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;">${ctaLabel}</a>`
        }
      </td>
    </tr>
  `
    : "";
  const bottomPad = includeFooter ? "24px" : "40px";
  const footerBlock = includeFooter ? emailFooterRow("booking") : "";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PREMIUM_PAGE};">
  <tr>
    <td align="center" style="padding:24px 16px ${bottomPad};">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:100%;">
        <tr>
          <td style="padding:0;font-family:${EQ_SANS};">
            ${emailCardLogoBlackPremiumRule()}
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:26px;font-weight:700;letter-spacing:0;text-transform:none;color:${PREMIUM_BODY};padding-bottom:16px;line-height:1.35;font-family:${PREMIUM_SERIF_HEADING};">${headline}</td>
              </tr>
              <tr>
                <td style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;">${body}</td>
              </tr>
              ${ctaHtml}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${footerBlock}
</table>
  `;
}

/** Legacy: logo block for templates that embed their own wrapper (deprecated; use emailLayout). */
function emailLogo() {
  const logoUrl = getEmailLogoUrl();
  return `
    <div style="text-align:center;margin-bottom:28px">
      <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_GOLD_W}" height="${EMAIL_LOGO_GOLD_H}" style="display:inline-block;max-width:${EMAIL_LOGO_GOLD_W}px;height:auto;border:0" />
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
  "in-transit": "#5C1A33",
  dispatched: "#5C1A33",
  delivered: "#2D9F5A",
  cancelled: "#D14343",
};

function statusBadge(status: string) {
  const s = (status || "").replace("-", " ");
  const c = STATUS_COLORS[status] || PREMIUM_WINE;
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
      <tr><td style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;padding-bottom:8px;">Project update</td></tr>
      <tr><td style="font-size:26px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};padding-bottom:20px;font-family:${PREMIUM_SERIF_HEADING};">${delivery.delivery_number}, ${delivery.customer_name}</td></tr>
      <tr><td style="padding:0;">${premiumSectionRule()}</td></tr>
      <tr>
        <td style="padding:0 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="font-size:9px;color:${PREMIUM_BODY_MUTED};text-transform:none;font-weight:700;letter-spacing:0;padding-bottom:8px;">Current status</td></tr>
            <tr><td style="padding-bottom:16px;">${statusBadge(delivery.status)}</td></tr>
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" style="font-size:12px;color:${PREMIUM_BODY_MUTED};padding:4px 8px 4px 0;vertical-align:top;">Delivery to:</td>
                    <td width="50%" style="font-size:12px;font-weight:600;color:${PREMIUM_BODY};padding:4px 0;vertical-align:top;">${delivery.delivery_address || "-"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${PREMIUM_BODY_MUTED};padding:4px 8px 4px 0;vertical-align:top;">Pickup from:</td>
                    <td style="font-size:12px;font-weight:600;color:${PREMIUM_BODY};padding:4px 0;vertical-align:top;">${delivery.pickup_address || "-"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${PREMIUM_BODY_MUTED};padding:4px 8px 4px 0;vertical-align:top;">Date &amp; window:</td>
                    <td style="font-size:12px;font-weight:600;color:${PREMIUM_BODY};padding:4px 0;vertical-align:top;">${delivery.scheduled_date || "-"} &middot; ${delivery.delivery_window || "-"}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:${PREMIUM_BODY_MUTED};padding:4px 8px 4px 0;vertical-align:top;">Items:</td>
                    <td style="font-size:12px;font-weight:600;color:${PREMIUM_BODY};padding:4px 0;vertical-align:top;">${items} items</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <a href="${trackUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Track this project</a>
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
      <div style="font-size:9px;font-weight:700;color:${PREMIUM_BODY_MUTED};text-transform:none;letter-spacing:0;margin-bottom:8px">Current stage</div>
      <div style="height:10px;background:${PREMIUM_MUTED_FILL};border-radius:999px;overflow:hidden;">
        <div class="move-bar-fill" style="height:100%;width:${pct}%;min-width:${pct > 0 ? 4 : 0}px;background:linear-gradient(90deg,${PREMIUM_WINE},${PREMIUM_ROSE});border-radius:999px"></div>
      </div>
      <div style="font-size:12px;font-weight:600;color:${labelColor};margin-top:8px;letter-spacing:0">${currentLabel}</div>
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
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Your move was updated</div>
    <div style="font-size:20px;font-weight:700;margin:0 0 8px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};letter-spacing:0;text-transform:none;">Your move was updated</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 4px;">We&apos;ve made changes to your move recently.</p>
    ${statusBarHtml}
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 24px;">Click below to view your full dashboard and see what changed.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      ${premiumCompactWineCtaAnchor(trackUrl, PREMIUM_TRACK_CTA_LABEL)}
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.</p>
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
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">${PREMIUM_TRACK_CTA_LABEL}</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi${clientName ? `, ${clientName}` : ""}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Use the link below to track your move, view documents, and message your coordinator. No account or login required.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      ${premiumCompactWineCtaAnchor(trackUrl, PREMIUM_TRACK_CTA_LABEL)}
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.</p>
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:16px;">Invoice summary</div>
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;color:${PREMIUM_BODY};">${invoice.invoice_number}</div>
    ${premiumSectionRule()}
    <div style="text-align:center;padding:8px 0 16px;">
      <div style="font-size:9px;color:${PREMIUM_BODY_MUTED};text-transform:none;font-weight:700;margin-bottom:8px;">Amount due</div>
      <div style="font-family:${PREMIUM_SERIF_HEADING};font-size:28px;font-weight:700;color:${PREMIUM_WINE};">${formatCurrency(invoice.amount)}</div>
      <div style="font-size:10px;color:${PREMIUM_BODY_MUTED};margin-top:4px;">Due: ${invoice.due_date}</div>
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Change request update</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Your change request has been ${isApproved ? "approved" : "declined"}</div>
    ${premiumSectionRule()}
    <div style="padding:0 0 12px;">
      <div style="font-size:11px;color:${PREMIUM_BODY_MUTED};margin-bottom:8px;"><strong style="color:${PREMIUM_BODY};">Request type:</strong> ${type}</div>
      <p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:0;">${description}</p>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid ${PREMIUM_RULE};">
        <span style="display:inline-block;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;background:${isApproved ? "#2D9F5A22" : "#D1434322"};color:${isApproved ? "#2D9F5A" : "#D14343"};">${isApproved ? "Approved" : "Declined"}</span>
      </div>
      ${isApproved && feeDollars ? `<p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:16px 0 0;">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>` : ""}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      ${premiumCompactWineCtaAnchor(portalUrl, PREMIUM_TRACK_CTA_LABEL)}
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Inventory change request</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">New request, ${moveCode}</div>
    ${premiumSectionRule()}
    <div style="padding:0 0 12px;">
      <p style="font-size:13px;color:${PREMIUM_BODY};line-height:1.5;margin:0 0 12px;"><strong>Client:</strong> ${clientName}</p>
      <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};line-height:1.5;margin:0 0 8px;">Adding <strong>${addedCount}</strong> line(s), removing <strong>${removedCount}</strong> line(s).</p>
      <p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:0;">Auto-calculated net: <strong>${deltaStr}</strong></p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${adminUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Review in admin</a>
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Inventory update</div>
    <div style="font-size:24px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${headline}</div>
    ${premiumSectionRule()}
    <div style="padding:0 0 12px;">
      <p style="font-size:13px;color:${PREMIUM_BODY};line-height:1.5;margin:0 0 12px;">Hi ${clientName},</p>
      ${
        isOk
          ? `<p style="font-size:12px;color:${PREMIUM_BODY_MUTED};line-height:1.5;margin:0 0 12px;">Net price change: <strong>${netDelta >= 0 ? "+" : ""}$${netDelta}</strong></p>
             <p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:0 0 12px;">Updated move total: <strong>$${newTotal}</strong></p>
             ${adminNote ? `<p style="font-size:12px;color:${PREMIUM_BODY_MUTED};line-height:1.5;margin:0 0 12px;">Note from your coordinator: ${adminNote}</p>` : ""}
             ${additionalDeposit && additionalDeposit > 0 ? `<p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:0;">Additional amount due: <strong>$${additionalDeposit}</strong>, you can pay from your move portal.</p>` : ""}`
          : `<p style="font-size:12px;color:${PREMIUM_BODY_MUTED};line-height:1.5;margin:0 0 12px;">${declineReason || "Please review the details in your portal or contact your coordinator."}</p>`
      }
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${portalUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">View your move</a>
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Extra item approved</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Your extra item has been approved</div>
    ${premiumSectionRule()}
    <div style="padding:0 0 12px;">
      <p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:0;">${description}</p>
      ${feeDollars ? `<p style="font-size:12px;color:${PREMIUM_BODY};line-height:1.5;margin:16px 0 0;">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>` : ""}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      ${premiumCompactWineCtaAnchor(portalUrl, PREMIUM_TRACK_CTA_LABEL)}
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
  const pwdPill = `<span style="font-family:'Courier New',Courier,monospace;font-size:13px;color:${PREMIUM_BODY};background:rgba(92,26,51,0.09);padding:6px 10px;border-radius:6px;display:inline-block;">${tempPassword}</span>`;
  const inner = `
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">You&apos;re invited</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Welcome to Yugo${name ? `, ${name}` : ""}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">You&apos;ve been invited to join Yugo as a <strong style="color:${PREMIUM_WINE};">${roleLabel}</strong>. Your account has been created, sign in with the temporary password below and you&apos;ll be prompted to set a new password.</p>
    ${premiumSectionRule()}
    <div style="${PREMIUM_EYEBROW_UPPER};margin:0 0 16px;">Your credentials</div>
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin:0 0 16px;">
      <div style="font-size:12px;color:${PREMIUM_BODY};margin-bottom:6px;line-height:1.4;"><strong>Email:</strong> <a href="mailto:${email}" style="color:${PREMIUM_WINE};">${email}</a></div>
      <div style="font-size:12px;color:${PREMIUM_BODY};line-height:1.4;"><strong>Temporary password:</strong><br/><span style="display:inline-block;margin-top:6px;">${pwdPill}</span></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to continue setup</a>
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl, "generic");
}

export function inviteUserEmailText(params: { name: string; email: string; roleLabel: string; tempPassword: string; loginUrl: string }) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `YOU'RE INVITED

Welcome to Yugo${name ? `, ${name}` : ""}

You've been invited to join Yugo as a ${roleLabel}. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

YOUR CREDENTIALS:
Email: ${email}
Temporary password: ${tempPassword}

LOG IN TO CONTINUE SETUP: ${loginUrl}

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
  const pwdPill = `<span style="font-family:'Courier New',Courier,monospace;font-size:13px;color:${PREMIUM_BODY};background:rgba(92,26,51,0.09);padding:6px 10px;border-radius:6px;display:inline-block;">${tempPassword}</span>`;
  const inner = `
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Partner</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 12px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">You&apos;ve been added as a Yugo Partner.</div>
    <p style="font-size:15px;color:${PREMIUM_BODY_MUTED};line-height:1.65;margin:0 0 24px;">Your account is ready. Here&apos;s everything you need to get started.</p>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 24px;"><strong style="color:${PREMIUM_WINE};">${companyName}</strong> is set up as a <strong style="color:${PREMIUM_WINE};">${typeLabel}</strong> partner with Yugo${contactName ? `. Welcome, ${contactName}.` : "."} Sign in with the temporary password below; you&apos;ll be prompted to set a new password.</p>
    ${premiumSectionRule()}
    <div style="${PREMIUM_EYEBROW_UPPER};margin:0 0 16px;">Your credentials</div>
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin:0 0 16px;">
      <div style="font-size:12px;color:${PREMIUM_BODY};margin-bottom:6px;line-height:1.4;"><strong>Email:</strong> <a href="mailto:${email}" style="color:${PREMIUM_WINE};">${email}</a></div>
      <div style="font-size:12px;color:${PREMIUM_BODY};line-height:1.4;"><strong>Temporary password:</strong><br/><span style="display:inline-block;margin-top:6px;">${pwdPill}</span></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:28px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">ACCESS YOUR PARTNER PORTAL</a>
    </td></tr></table>
    ${premiumSectionRule()}
    <div style="${PREMIUM_EYEBROW_UPPER};margin:0 0 14px;">What&apos;s next</div>
    <div style="font-size:14px;color:${PREMIUM_BODY};line-height:1.85;margin:0 0 24px;">
      <div>1. Set your password</div>
      <div>2. Complete your profile</div>
      <div>3. Your first booking request</div>
    </div>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl, "partner");
}

export function invitePartnerEmailText(params: { contactName: string; companyName: string; email: string; typeLabel: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `PARTNER ACCOUNT

You've been added as a Yugo Partner.

Your account is ready. Here's everything you need to get started.

${companyName} is set up as a ${typeLabel} partner with Yugo${contactName ? `. Welcome, ${contactName}.` : "."} Sign in with the temporary password below; you'll be prompted to set a new password.

YOUR CREDENTIALS:
Email: ${email}
Temporary password: ${tempPassword}

ACCESS YOUR PARTNER PORTAL: ${loginUrl}

WHAT'S NEXT:
1. Set your password
2. Complete your profile
3. Your first booking request

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by Yugo | Learn more: ${baseUrl}/about`;
}

/** Email when an existing Yugo user is added to a partner (no new account, no temp password). */
export function addedToPartnerEmail(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { companyName, loginUrl } = params;
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Portal access added</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">You&apos;ve been added to ${companyName}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Your account now has access to <strong style="color:${PREMIUM_WINE};">${companyName}</strong> on the Yugo Partner Portal. Log in with your existing password to view deliveries and manage requests.</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to partner portal</a>
    </td></tr></table>
  `;
  return emailLayout(inner, loginUrl, "partner");
}

export function addedToPartnerEmailText(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { companyName, loginUrl } = params;
  return `Portal access added

You've been added to ${companyName} on the Yugo Partner Portal. Log in with your existing password to view deliveries and manage requests.

LOG IN TO PARTNER PORTAL: ${loginUrl}`;
}

export function partnerPasswordResetEmail(params: {
  contactName: string;
  companyName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  const pwdPill = `<span style="font-family:'Courier New',Courier,monospace;font-size:13px;color:${PREMIUM_BODY};background:rgba(92,26,51,0.09);padding:6px 10px;border-radius:6px;display:inline-block;">${tempPassword}</span>`;
  const inner = `
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Password reset</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">New password for your Yugo partner account</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">A new temporary password has been set for your <strong style="color:${PREMIUM_WINE};">${companyName}</strong> partner portal access${contactName ? ` (${contactName})` : ""}. Sign in with the credentials below and you&apos;ll be prompted to set a new password.</p>
    ${premiumSectionRule()}
    <div style="${PREMIUM_EYEBROW_UPPER};margin:0 0 16px;">Your credentials</div>
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin:0 0 16px;">
      <div style="font-size:12px;color:${PREMIUM_BODY};margin-bottom:6px;line-height:1.4;"><strong>Email:</strong> <a href="mailto:${email}" style="color:${PREMIUM_WINE};">${email}</a></div>
      <div style="font-size:12px;color:${PREMIUM_BODY};line-height:1.4;"><strong>New temporary password:</strong><br/><span style="display:inline-block;margin-top:6px;">${pwdPill}</span></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">ACCESS YOUR PARTNER PORTAL</a>
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">For security, we recommend changing this password after you sign in. If you didn&apos;t request this, contact your admin.</p>
  `;
  return emailLayout(inner, loginUrl, "partner");
}

export function partnerPasswordResetEmailText(params: { contactName: string; companyName: string; email: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `PASSWORD RESET – Yugo Partner Portal

A new temporary password has been set for your ${companyName} partner portal access${contactName ? ` (${contactName})` : ""}. Sign in with the credentials below and you'll be prompted to set a new password.

YOUR CREDENTIALS:
Email: ${email}
New temporary password: ${tempPassword}

ACCESS YOUR PARTNER PORTAL: ${loginUrl}

For security, we recommend changing this password after you sign in. If you didn't request this, contact your admin.

Powered by Yugo | Learn more: ${baseUrl}/about`;
}

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  const displayName = client.name || "Partner";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Partner portal access</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Welcome to Yugo${displayName !== "Partner" ? `, ${displayName}` : ""}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;">Your partner portal is ready. Sign in anytime to:</p>
    <ul style="font-size:14px;color:${PREMIUM_BODY};line-height:1.7;margin:0 0 24px;padding-left:20px;">
      <li>Track deliveries and see real-time status</li>
      <li>View and download invoices</li>
      <li>Message our team and get support</li>
    </ul>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${client.portalUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Access your portal</a>
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">If you didn&apos;t request this, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, undefined, "partner");
}

export function referralReceivedEmail(params: { agentName: string; clientName: string; property: string }) {
  const { agentName, clientName, property } = params;
  const ref = clientName || property || "this property";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Referral received</div>
    <div style="font-size:20px;font-weight:600;margin:0 0 16px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${agentName},</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Your referral for <strong style="color:${PREMIUM_WINE};">${ref}</strong> has been received and added to our pipeline.</p>
    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:6px;">Status</div>
      <div style="font-size:13px;color:${PREMIUM_BODY};font-weight:600;">In pipeline – your team is on it</div>
      <div style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin-top:4px;line-height:1.5;">We&apos;ll be in touch as we process the lead and coordinate the move.</div>
    </div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 24px;">Thank you for continuing to trust Yugo with your clients. We take every referral seriously and will keep you updated.</p>
  `;
  return emailLayout(inner);
}

export function crewPortalInviteEmail(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  const pinPill = `<span style="font-family:'Courier New',Courier,monospace;font-size:13px;color:${PREMIUM_BODY};background:rgba(92,26,51,0.09);padding:6px 10px;border-radius:6px;display:inline-block;">${pin}</span>`;
  const inner = `
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Crew portal access</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Welcome to the Crew Portal${name ? `, ${name}` : ""}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">You&apos;ve been invited to log in to the Yugo Crew Portal to start jobs, update status, and share your location with dispatch.</p>
    ${premiumSectionRule()}
    <div style="${PREMIUM_EYEBROW_UPPER};margin:0 0 16px;">Your login</div>
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <div style="font-size:12px;color:${PREMIUM_BODY};margin-bottom:6px;line-height:1.4;"><strong>Phone:</strong> ${phoneDisplay}</div>
      <div style="font-size:12px;color:${PREMIUM_BODY};line-height:1.4;"><strong>PIN:</strong><br/><span style="display:inline-block;margin-top:6px;">${pinPill}</span></div>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:24px;">
      <a href="${loginUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:16px 40px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">Log in to crew portal</a>
    </td></tr></table>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">Sessions expire after one shift (12h). Keep your PIN secure. If you didn&apos;t expect this invite, you can safely ignore this email.</p>
  `;
  return emailLayout(inner, loginUrl, "generic");
}

export function crewPortalInviteEmailText(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  return `CREW PORTAL ACCESS

Welcome to the Crew Portal${name ? `, ${name}` : ""}

You've been invited to log in to the Yugo Crew Portal to start jobs, update status, and share your location with dispatch.

YOUR LOGIN:
Phone: ${phoneDisplay}
PIN: ${pin}

LOG IN TO CREW PORTAL: ${loginUrl}

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
  const { clientName, moveCode, moveDate, fromAddress, toAddress, tierLabel, serviceLabel, totalWithTax, depositPaid, balanceRemaining, trackingUrl } = params;
  const name = (clientName || "").split(" ")[0];

  const dateDisplay = moveDate
    ? new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const headline =
    name.length > 0
      ? `Your move is confirmed, ${name}.`
      : "Your move is confirmed.";
  return equinoxPromoLayout(
    `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Booking confirmed</div>
    <h1 style="font-size:28px;font-weight:700;color:${PREMIUM_BODY};margin:0 0 14px;letter-spacing:0;line-height:1.2;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${headline}</h1>
    <p style="font-size:15px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 28px;font-family:${PREMIUM_FONT};">Your deposit is in and your ${serviceLabel.toLowerCase()} is confirmed. Here are your details.</p>

    ${premiumSectionRule()}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin:0 0 8px;">
      <tr>
        <td style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;border-collapse:collapse;font-family:${PREMIUM_FONT};">
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;">Booking</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;letter-spacing:0;">${moveCode}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">Service</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${serviceLabel}${tierLabel ? ` - ${tierLabel}` : ""}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">Date</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${dateDisplay}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">From</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${fromAddress}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">To</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${toAddress}</td>
            </tr>
            <tr>
              <td style="color:#2D7A4F;font-weight:600;padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">Deposit paid</td>
              <td style="color:#2D7A4F;font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${formatCurrency(depositPaid)}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">Balance remaining</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${formatCurrency(balanceRemaining)}</td>
            </tr>
            <tr>
              <td style="color:${PREMIUM_BODY_MUTED};padding:8px 0;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">Total (incl. HST)</td>
              <td style="color:${PREMIUM_BODY};font-weight:600;padding:8px 0;text-align:right;vertical-align:top;border-top:1px solid ${PREMIUM_RULE};">${formatCurrency(totalWithTax)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.65;margin:24px 0 0;font-family:${PREMIUM_FONT};">Your coordinator will reach out within 24 hours to confirm crew and timing. Track your move in real-time on move day.</p>

    ${equinoxPromoTrackMoveCta(trackingUrl)}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:${PREMIUM_WINE} !important;-webkit-text-fill-color:${PREMIUM_WINE};text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `,
    "booking",
  );
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

/** @deprecated Use essentialConfirmationEmail */
export const essentialsConfirmationEmail = (p: TierConfirmationParams): string => essentialConfirmationEmail(p);
/** @deprecated Use essentialConfirmationEmail */
export const curatedConfirmationEmail = (p: TierConfirmationParams): string => essentialConfirmationEmail(p);

export function essentialConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  const firstName = (p.clientName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  const headline = firstName ? `Your move is confirmed, ${firstName}.` : "Your move is confirmed.";
  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px">Move confirmed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;margin:0 0 12px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${headline}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 24px">
      Your move is confirmed. Here are your details:
    </p>

    ${premiumSectionRule()}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding:0;">
      <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">Move details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Date:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">From:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">To:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Plan:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">Essential</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Crew:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Vehicle:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Total:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed flat rate)</td></tr>
      </table>
    </td></tr></table>

    ${premiumSectionRule()}
    <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">What to expect</div>
    <div style="font-size:13px;color:${PREMIUM_BODY};line-height:1.8">
      <div>&middot; Our crew will arrive within your time window</div>
      <div>&middot; All moving blankets, equipment, and floor protection included</div>
      <div>&middot; You&apos;ll receive a reminder 48 hours before your move</div>
    </div>

    ${premiumSectionRule()}
    <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">What to prepare</div>
    <div style="font-size:13px;color:${PREMIUM_BODY};line-height:1.8">
      <div>&middot; Have boxes packed and sealed</div>
      <div>&middot; Clear pathways for the crew</div>
      <div>&middot; Confirm elevator booking if applicable</div>
    </div>

    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D7A4F;font-weight:600;padding:2px 0">Deposit paid:</td><td style="color:#2D7A4F;font-weight:600;padding:2px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:2px 0">Balance remaining:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:2px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:4px 0 20px;">
      ${premiumCompactWineCtaAnchor(p.trackingUrl, PREMIUM_TRACK_CTA_LABEL)}
    </td></tr></table>

    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};margin:0 0 16px;text-align:center">
      Questions? Email ${getClientSupportEmail()} or call us anytime.
    </p>
  `);
}

/** @deprecated Use signatureConfirmationEmail */
export const premierConfirmationEmail = (p: TierConfirmationParams): string => signatureConfirmationEmail(p);

export function signatureConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  const firstName = (p.clientName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  const headline = firstName ? `Your move is confirmed, ${firstName}.` : "Your move is confirmed.";
  const includesHtml = (p.includes || [])
    .map(
      (inc) =>
        `<div style="font-size:12px;color:${PREMIUM_BODY};line-height:2">${inc}</div>`,
    )
    .join("");
  return emailLayout(`
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px">Booking confirmed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;margin:0 0 12px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${headline}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 24px">
      Everything is set. No surprises - just a smooth, professional move.
    </p>

    ${premiumSectionRule()}
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding:0;">
      <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">Your signature move</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Date:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">From:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">To:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Plan:</td><td style="color:${PREMIUM_WINE};font-weight:600;padding:4px 0;text-align:right">Signature</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Crew:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Vehicle:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Total:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed - no surprises)</td></tr>
      </table>
    </td></tr></table>

    ${premiumSectionRule()}
    <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">What&apos;s included</div>
    <div style="font-size:12px;line-height:2">
      ${includesHtml || `<span style="color:${PREMIUM_BODY_MUTED}">Details confirmed with your coordinator.</span>`}
    </div>

    ${premiumSectionRule()}
    <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">Before your move</div>
    <div style="font-size:13px;color:${PREMIUM_BODY};line-height:1.8">
      <div>&middot; You&apos;ll receive a reminder 48 hours before</div>
      <div>&middot; A day-before SMS with your crew details and ETA window</div>
      <div>&middot; Our team will handle disassembly - just let us know which pieces need it</div>
    </div>

    ${premiumSectionRule()}
    <div style="font-size:10px;color:${PREMIUM_WINE};text-transform:none;font-weight:700;letter-spacing:0;margin-bottom:10px">Your tracking page</div>
    <div style="font-size:13px;color:${PREMIUM_BODY_MUTED};line-height:1.6">
      Follow your move in real-time on move day:
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;margin-bottom:20px;"><tr><td align="center">
      ${premiumCompactWineCtaAnchor(p.trackingUrl, PREMIUM_TRACK_CTA_LABEL, "block")}
    </td></tr></table>

    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D7A4F;font-weight:600;padding:2px 0">Deposit paid:</td><td style="color:#2D7A4F;font-weight:600;padding:2px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:${PREMIUM_BODY_MUTED};padding:2px 0">Balance remaining:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:2px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin:0 0 16px;text-align:center">
      Looking forward to a smooth move.<br/>
      <strong style="color:${PREMIUM_BODY}">- The Yugo Team</strong>
    </p>
  `);
}

export function estateConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  const coordName = p.coordinatorName || "your coordinator";
  const firstName = (p.clientName || "").split(" ")[0];
  const estateCoordLinkStyle = `color:${ESTATE_WINE};text-decoration:underline;`;
  const coordDigits = p.coordinatorPhone ? normalizePhone(p.coordinatorPhone) : "";
  const phoneDisplay = p.coordinatorPhone ? formatPhone(p.coordinatorPhone) : "";
  const coordPhoneHtml =
    phoneDisplay && coordDigits.length > 0
      ? `<a href="tel:+1${coordDigits}" style="${estateCoordLinkStyle}">${escapeHtml(phoneDisplay)}</a>`
      : phoneDisplay
        ? escapeHtml(phoneDisplay)
        : "";
  const coordEmailRaw = p.coordinatorEmail?.trim() ?? "";
  const coordEmailHtml = coordEmailRaw
    ? `<a href="mailto:${encodeURIComponent(coordEmailRaw)}" style="${estateCoordLinkStyle}">${escapeHtml(coordEmailRaw)}</a>`
    : "";
  const coordContactLine =
    coordPhoneHtml && coordEmailHtml
      ? `${coordPhoneHtml}<span style="color:${ESTATE_BODY_MUTED};">&nbsp;&middot;&nbsp;</span>${coordEmailHtml}`
      : `${coordPhoneHtml}${coordEmailHtml}`;

  const canonicalIncludes = [
    `Dedicated crew of ${p.crewSize} - hand-selected for your move`,
    `${p.truckDisplayName} - exclusively reserved for you`,
    `Pre-move inventory walkthrough (${coordName} will call to schedule this within 24 hours)`,
    "Premium quilted blankets for every piece",
    "Complete floor, wall, and doorway protection",
    "Full furniture disassembly and reassembly",
    "White glove handling for fragile and high-value items",
    "Professional cleaning of both properties",
    "Full Replacement Value Protection ($10K/item, $100K total)",
    "Dedicated move coordinator from start to finish",
    "Real-time GPS tracking with personal status updates",
    "Post-move quality inspection",
  ];

  const includesRows = [
    ...canonicalIncludes,
    ...(p.includes || []).filter(
      (inc) => !canonicalIncludes.some((ci) => ci.toLowerCase().includes(inc.toLowerCase().slice(0, 20)))
    ),
  ]
    .map((inc) => `<tr><td style="padding:7px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:7px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">${inc}</td></tr>`)
    .join("");

  return estateLuxuryCreamLayout(`
    <p style="font-family:${ESTATE_DM_SANS};font-size:15px;color:${ESTATE_BODY_MUTED};margin:0 0 36px;line-height:1.6;">Dear ${firstName || p.clientName || ""},</p>

    <h1 style="font-family:${ESTATE_GEORGIA};font-size:30px;font-weight:400;color:${ESTATE_WINE};margin:0 0 20px;line-height:1.35;letter-spacing:0;">Welcome to your<br/>Yugo Estate experience.</h1>

    <p style="font-size:15px;color:${ESTATE_BODY};margin:0 0 0;line-height:1.78;">
      Thank you for entrusting Yugo with your move. Your Estate experience has been confirmed, and every detail is being prepared with care.
    </p>

    ${estateDivider()}

    ${estateLabel("Your estate move")}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;width:38%;vertical-align:top;">Date</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;">${dateStr}</td>
      </tr>
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Time</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${p.timeWindow} - your crew will arrive promptly</td>
      </tr>
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Origin</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${p.fromAddress}</td>
      </tr>
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Destination</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${p.toAddress}</td>
      </tr>
      ${p.crewNames ? `
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Your crew</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${p.crewNames}</td>
      </tr>` : ""}
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Your vehicle</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${p.truckDisplayName}</td>
      </tr>
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:10px 0;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">Your coordinator</td>
        <td style="color:${ESTATE_BODY};font-weight:600;padding:10px 0;text-align:right;vertical-align:top;border-top:1px solid rgba(92,26,51,0.07);">${coordName}</td>
      </tr>
    </table>

    ${estateDivider()}

    ${estateLabel("Your estate experience includes")}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${includesRows}
    </table>

    ${estateDivider()}

    ${estateLabel("What happens next")}

    <p style="font-size:15px;color:${ESTATE_BODY};margin:0 0 20px;line-height:1.78;">
      Within the next 24 hours, ${p.coordinatorName ? `<strong>${p.coordinatorName}</strong>` : "your coordinator"} will reach out personally to:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:28px;">
      <tr><td style="padding:6px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:6px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">Schedule your pre-move walkthrough (in-person or virtual)</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:6px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">Confirm any items requiring special handling</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:6px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">Review your timeline and any access requirements</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:6px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">Answer every question you have</td></tr>
      <tr><td style="padding:6px 0;vertical-align:top;width:18px;font-size:14px;color:${ESTATE_WINE};">&#10022;</td><td style="padding:6px 0;font-size:14px;color:${ESTATE_BODY};line-height:1.6;">Send your welcome package</td></tr>
    </table>

    <p style="font-size:15px;color:${ESTATE_BODY};margin:0 0 16px;line-height:1.78;">
      72 hours before your move, you&apos;ll receive a detailed itinerary with crew names, vehicle details, and your move-day timeline.
    </p>
    <p style="font-size:15px;color:${ESTATE_BODY};margin:0;line-height:1.78;">
      On move day, ${p.coordinatorName ? `<strong>${p.coordinatorName}</strong>` : "your coordinator"} will be available by phone throughout the entire process.
    </p>

    ${estateDivider()}

    ${estateLabel("Your move tracker")}

    <p style="font-size:15px;color:${ESTATE_BODY};margin:0 0 24px;line-height:1.78;">Follow every step in real-time:</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:16px;">
      <tr>
        <td>
          <a href="${p.trackingUrl}" style="display:inline-block;background-color:${ESTATE_WINE};color:#FFFFFF;padding:10px 28px;font-size:12px;font-weight:700;letter-spacing:0px;text-transform:uppercase;text-decoration:none;font-family:${ESTATE_DM_SANS};border-radius:0;line-height:1;">${PREMIUM_TRACK_CTA_LABEL}</a>
        </td>
      </tr>
    </table>

    ${estateDivider()}

    ${estateLabel("Investment")}

    <p style="font-family:${ESTATE_GEORGIA};font-size:28px;color:${ESTATE_WINE};margin:0 0 10px;line-height:1.2;letter-spacing:0;">${formatCurrency(p.totalWithTax)}</p>
    <p style="font-size:13px;color:${ESTATE_BODY_MUTED};margin:0 0 20px;line-height:1.65;">This is your guaranteed rate. No hourly charges. No surprises. No hidden fees.</p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;border-collapse:collapse;table-layout:fixed;width:100%;">
      <tr>
        <td style="color:#2D7A4F;font-weight:600;padding:12px 16px 12px 0;vertical-align:middle;width:58%;">Deposit paid</td>
        <td align="right" style="color:#2D7A4F;font-weight:600;padding:12px 0;vertical-align:middle;text-align:right;white-space:nowrap;">${formatCurrency(p.depositPaid)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0;border-top:1px solid rgba(92,26,51,0.12);font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="color:${ESTATE_BODY_MUTED};padding:12px 16px 12px 0;vertical-align:middle;">Balance remaining</td>
        <td align="right" style="color:${ESTATE_GOLD_DARK};font-weight:600;padding:12px 0;vertical-align:middle;text-align:right;white-space:nowrap;">${formatCurrency(p.balanceRemaining)}</td>
      </tr>
    </table>

    ${estateDivider()}

    <p style="font-family:${ESTATE_GEORGIA};font-size:16px;font-style:italic;color:${ESTATE_BODY_MUTED};margin:0 0 28px;line-height:1.6;">It&apos;s our privilege to handle your move.</p>

    ${p.coordinatorName ? `
    <p style="font-size:16px;font-weight:700;color:${ESTATE_BODY};margin:0 0 4px;font-family:${ESTATE_DM_SANS};">${p.coordinatorName}</p>
    <p style="font-size:13px;color:${ESTATE_BODY_MUTED};margin:0 0 8px;font-family:${ESTATE_DM_SANS};">Move Coordinator, Yugo</p>
    <p style="font-size:13px;color:${ESTATE_BODY};margin:0;font-family:${ESTATE_DM_SANS};">
      ${coordContactLine}
    </p>
    ` : `
    <p style="font-size:13px;color:${ESTATE_BODY_MUTED};margin:0;font-family:${ESTATE_DM_SANS};">Yugo Estate Team</p>
    `}

    <p style="font-family:${ESTATE_GEORGIA};font-size:11px;letter-spacing:0;text-transform:none;color:${ESTATE_WINE};margin:32px 0 0;line-height:1.4;">Yugo - The Art of Moving</p>
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

  return emailLayout(
    `
    <div style="font-size:10px;font-weight:700;color:#2D7A4F;letter-spacing:0;text-transform:none;margin-bottom:8px">New booking</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${clientName} - ${serviceLabel}${tierLabel ? ` (${tierLabel})` : ""}</h1>

    ${premiumSectionRule()}
    <table style="width:100%;font-size:12px;border-collapse:collapse;margin-bottom:16px">
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0;width:100px">Move:</td><td style="color:${PREMIUM_WINE};font-weight:600;padding:4px 0">${moveCode}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Client:</td><td style="color:${PREMIUM_BODY};padding:4px 0">${clientName}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Email:</td><td style="color:${PREMIUM_BODY};padding:4px 0">${clientEmail}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Phone:</td><td style="color:${PREMIUM_BODY};padding:4px 0">${clientPhone ? formatPhone(clientPhone) : "-"}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Date:</td><td style="color:${PREMIUM_BODY};padding:4px 0">${dateDisplay}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Route:</td><td style="color:${PREMIUM_BODY};padding:4px 0">${fromAddress} &rarr; ${toAddress}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Total:</td><td style="color:${PREMIUM_BODY};font-weight:600;padding:4px 0">${formatCurrency(totalWithTax)}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Deposit:</td><td style="color:#2D7A4F;font-weight:600;padding:4px 0">${formatCurrency(depositPaid)}</td></tr>
      <tr><td style="color:${PREMIUM_BODY_MUTED};padding:4px 0">Square:</td><td style="color:${PREMIUM_BODY};padding:4px 0;font-size:10px;font-family:monospace">${paymentId}</td></tr>
    </table>

    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <div style="font-size:11px;color:${PREMIUM_WINE};font-weight:600;line-height:1.35;">Action needed:</div>
      <div style="font-size:12px;color:${PREMIUM_BODY};margin-top:4px;line-height:1.45;">Assign a crew and confirm timing with the client within 24 hours.</div>
    </div>
  `,
    undefined,
    "generic",
  );
}

export function verificationCodeEmail(params: { code: string; purpose: "email_change" | "2fa" }) {
  const { code, purpose } = params;
  const title = purpose === "email_change" ? "Verify your email change" : "Your Yugo login code";
  const desc = purpose === "email_change"
    ? "You requested to change your email address. Enter this code to confirm:"
    : "Use this code to complete your sign-in. It expires in 15 minutes.";
  const inner = `
    <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Account verification</div>
    <div style="font-size:20px;font-weight:600;margin:0 0 16px;color:${PREMIUM_BODY};font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">${title}</div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">${desc}</p>
    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};text-align:center;margin-bottom:16px;">
      <div style="${PREMIUM_EYEBROW_UPPER};margin-bottom:8px;">Your code</div>
      <code style="font-size:30px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};font-family:'Courier New',Courier,monospace;line-height:1.2;">${code}</code>
      <div style="font-size:10px;color:${PREMIUM_BODY_MUTED};margin-top:8px;letter-spacing:0;">Expires in 15 minutes</div>
    </div>
    <p style="font-size:11px;color:${PREMIUM_BODY_MUTED};line-height:1.5;">If you didn&apos;t request this, you can safely ignore this email. Your account remains secure.</p>
  `;
  return emailLayout(inner, undefined, "generic");
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
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Claim received</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been received.</p>
    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <p style="font-size:13px;color:${PREMIUM_BODY_MUTED};margin:0 0 4px;line-height:1.35;">${itemCount} item${itemCount !== 1 ? "s" : ""} claimed</p>
      <p style="font-size:22px;font-weight:700;color:${PREMIUM_WINE};margin:0;line-height:1.2;">$${totalClaimed.toLocaleString()} total declared value</p>
    </div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;">We&apos;ll review your claim within <strong>3 business days</strong> and contact you with next steps.</p>
    <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin:0;">Reference: ${escapeHtml(claimNumber)}</p>
  `;
  return emailLayout(inner, undefined, "booking");
}

/** Claim filed on client's behalf by admin — premium dark layout. */
export function claimCreatedByAdminEmailHtml(claimNumber: string, clientName: string, itemCount: number, totalClaimed: number): string {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Claim filed</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">A damage claim <strong>${escapeHtml(claimNumber)}</strong> has been filed on your behalf by our team.</p>
    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <p style="font-size:13px;color:${PREMIUM_BODY_MUTED};margin:0 0 4px;line-height:1.35;">${itemCount} item${itemCount !== 1 ? "s" : ""} claimed</p>
      <p style="font-size:22px;font-weight:700;color:${PREMIUM_WINE};margin:0;line-height:1.2;">$${totalClaimed.toLocaleString()} total declared value</p>
    </div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;">Our team is already reviewing this claim. We&apos;ll contact you with updates and next steps.</p>
    <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin:0;">Reference: ${escapeHtml(claimNumber)}</p>
  `;
  return emailLayout(inner, undefined, "booking");
}

/** Claim approved — premium dark layout. */
export function claimApprovalEmailHtml(claimNumber: string, clientName: string, approvedAmount: number, resolutionNotes: string): string {
  const notesBlock = resolutionNotes
    ? `<p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;"><strong>Resolution:</strong> ${escapeHtml(resolutionNotes)}</p>`
    : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Claim review complete</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been reviewed.</p>
    ${premiumSectionRule()}
    <div style="background:rgba(45,122,79,0.12);padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin:0 0 4px;letter-spacing:0;line-height:1.35;">Approved Amount</p>
      <p style="font-size:28px;font-weight:700;color:#2D7A4F;margin:0;font-family:${PREMIUM_SERIF_HEADING};letter-spacing:0;line-height:1.15;">$${approvedAmount.toLocaleString()}</p>
    </div>
    ${notesBlock}
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0;">Payout will be processed via e-Transfer within 5 business days.</p>
  `;
  return emailLayout(inner, undefined, "booking");
}

/** Claim status update — premium dark layout. */
export function claimStatusUpdateEmailHtml(claimNumber: string, clientName: string, fromStatus: string, toStatus: string, notes: string | null): string {
  const fromLabel = fromStatus.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const toLabel = toStatus.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const notesBlock = notes
    ? `<p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;"><strong>Notes:</strong> ${escapeHtml(notes)}</p>`
    : "";
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Claim status update</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">There&apos;s an update on your claim <strong>${escapeHtml(claimNumber)}</strong>.</p>
    ${premiumSectionRule()}
    <div style="background:${PREMIUM_MUTED_FILL};padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <p style="font-size:12px;color:${PREMIUM_BODY_MUTED};margin:0 0 4px;line-height:1.35;">Status</p>
      <p style="font-size:14px;color:${PREMIUM_BODY};margin:0;"><span style="text-decoration:line-through;color:${PREMIUM_BODY_MUTED};">${escapeHtml(fromLabel)}</span> &rarr; <strong style="color:${PREMIUM_BODY};">${escapeHtml(toLabel)}</strong></p>
    </div>
    ${notesBlock}
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0;">If you have any questions, email ${getClientSupportEmail()} and our team will get back to you.</p>
  `;
  return emailLayout(inner, undefined, "booking");
}

/** Claim denied — premium dark layout. */
export function claimDenialEmailHtml(claimNumber: string, clientName: string, reason: string): string {
  const inner = `
    <div style="font-size:10px;font-weight:700;color:${PREMIUM_WINE};letter-spacing:0;text-transform:none;margin-bottom:8px;">Claim review complete</div>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Hi ${escapeHtml(clientName)}</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 20px;">Your claim <strong>${escapeHtml(claimNumber)}</strong> has been reviewed.</p>
    ${premiumSectionRule()}
    <div style="background:rgba(153,27,27,0.08);padding:${PREMIUM_CALLOUT_PAD};margin-bottom:16px;">
      <p style="font-size:14px;color:#991B1B;line-height:1.45;margin:0;">Unfortunately, we were unable to approve this claim.</p>
    </div>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};line-height:1.6;margin:0 0 16px;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p style="font-size:13px;color:${PREMIUM_BODY_MUTED};line-height:1.5;margin:0;">If you have additional information to support your claim, please email ${getClientSupportEmail()}.</p>
  `;
  return emailLayout(inner, undefined, "booking");
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
  const accent = PROJECT_STATUS_ACCENT[d.statusKey] || PREMIUM_WINE;
  const isIssue = d.statusKey === "issue_reported";
  const isDelivered = ["delivered", "installed"].includes(d.statusKey);

  const badge = `<span style="display:inline-block;background:${accent}22;color:${accent};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0;text-transform:none;">${d.statusLabel}</span>`;

  const notesBlock = d.notes
    ? `
    ${premiumSectionRule()}
    <div style="border-left:3px solid ${accent};padding:10px 12px;background:${PREMIUM_MUTED_FILL};margin-bottom:16px;">
      <p style="font-size:13px;color:${PREMIUM_BODY};line-height:1.5;margin:0;font-style:italic;">&ldquo;${escapeHtml(d.notes)}&rdquo;</p>
    </div>`
    : "";

  const closingLine = isIssue
    ? `Our team has been notified and will follow up with you shortly.`
    : isDelivered
      ? `This item has been successfully delivered to site.`
      : `Log in to your Yugo portal to view the full project breakdown.`;

  const inner = `
    <p style="font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;color:${PREMIUM_BODY_MUTED};margin:0 0 16px;">${escapeHtml(d.projectNumber)} &middot; ${escapeHtml(d.projectName)}</p>
    <h1 style="font-size:28px;font-weight:700;letter-spacing:0;color:${PREMIUM_BODY};margin:0 0 12px;font-family:${PREMIUM_SERIF_HEADING};text-transform:none;">Item status update</h1>
    <p style="font-size:14px;color:${PREMIUM_BODY_MUTED};margin:0 0 24px;">Hi ${escapeHtml(d.partnerName)}, here&rsquo;s the latest on one of your project items.</p>
    ${premiumSectionRule()}
    <div style="padding-bottom:14px;border-bottom:1px solid ${PREMIUM_RULE};margin-bottom:16px;">
      <p style="font-size:16px;font-weight:700;color:${PREMIUM_BODY};margin:0 0 8px;">${escapeHtml(d.itemName)}</p>
      ${badge}
    </div>
    ${notesBlock}
    <p style="font-size:13px;color:${PREMIUM_BODY};line-height:1.5;margin:0 0 24px;">${closingLine}</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
      <a href="${d.portalUrl}" style="display:inline-block;background-color:${PREMIUM_WINE};color:#FFFFFF;padding:13px 32px;font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;text-decoration:none;border-radius:0;">View Project</a>
    </td></tr></table>
  `;
  return emailLayout(inner, undefined, "partner");
}
