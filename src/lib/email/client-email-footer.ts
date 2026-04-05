/**
 * Client email footer: slim transactional layout by default (nav + legal; no social row).
 *
 * Opt into {@link ClientEmailFooterOptions.variant} `"full"` for the legacy nav (email
 * preferences / unsubscribe) plus social icons. Set social profile URLs in env; if unset,
 * links fall back to your app origin ({@link getEmailBaseUrl}) home page.
 *
 * Env (optional URLs):
 *   NEXT_PUBLIC_EMAIL_SOCIAL_INSTAGRAM
 *   NEXT_PUBLIC_EMAIL_SOCIAL_FACEBOOK
 *   NEXT_PUBLIC_EMAIL_SOCIAL_X
 *   NEXT_PUBLIC_EMAIL_SOCIAL_YOUTUBE
 *   NEXT_PUBLIC_EMAIL_SOCIAL_TIKTOK
 *
 * Refer-a-friend footer link (optional):
 *   NEXT_PUBLIC_EMAIL_REFER_FRIEND_URL — default: {base}/client
 *
 * Placeholders __YUGO_FOOTER_*__ are replaced when sending (see resend.ts).
 *
 * Nav links use letter-spacing 0 (global email typography alignment).
 */
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getClientSupportEmail } from "@/lib/email/client-support-email";

/** Context line shown above legal copy; set per email type when building HTML. */
export type EmailFooterWhy = "booking" | "partner" | "generic" | "quote";

const FOOTER_WHY_COPY: Record<EmailFooterWhy, string> = {
  booking: "You're receiving this because you booked with Yugo.",
  partner:
    "You're receiving this because your organization was invited as a Yugo partner.",
  generic: "You're receiving this because you have a relationship with Yugo.",
  quote:
    "You're receiving this because you requested a moving quote from Yugo.",
};

/** {@link getClientEmailFooterTrs} options */
export type ClientEmailFooterOptions = {
  whyReceiving?: EmailFooterWhy;
  /**
   * `transactional` (default) omits the social icon row and marketing-style nav (preferences /
   * unsubscribe) — reduces Gmail “Promotions” signals vs. newsletter-style footers.
   */
  variant?: "full" | "transactional";
  /**
   * Background for the small gutter row above the footer (match outer page color, not the footer band).
   */
  spacerBackground?: string;
};

/** Match premium / finalize page cream so footer bands are not a stark white slab. */
const FOOTER_BG = "#FCF9F4";
/** Modest gutter between main body and footer nav (large values break mobile layout). */
const FOOTER_TOP_SPACER_PX = 24;
const FOOTER_TEXT = "#000000";
const FOOTER_LEGAL_TEXT = "#555555";
/** Body / nav text links — brand wine (not default blue). */
const FOOTER_LINK_WINE = "#5C1A33";
const FOOTER_HR = "#E5E5E5";
const FOOTER_NAV_FONT = "Helvetica Neue,Helvetica,Arial,sans-serif";
const FOOTER_LEGAL_FONT = "Helvetica Neue,Helvetica,Arial,sans-serif";

/** Black icons (self-hosted SVGs) — served from the app domain so they are never blocked. */
function getSocialIconUrls(
  base: string,
): Record<"instagram" | "facebook" | "x" | "youtube" | "tiktok", string> {
  const r = `${base}/email-icons`;
  return {
    instagram: `${r}/instagram.svg`,
    facebook: `${r}/facebook.svg`,
    x: `${r}/x.svg`,
    youtube: `${r}/youtube.svg`,
    tiktok: `${r}/tiktok.svg`,
  };
}

/**
 * Resend tag `template` names that may show the refer-a-friend band above the footer.
 * Kept empty so operational mail stays transactional and avoids Promotions heuristics;
 * add names here to restore per-template.
 */
export const TEMPLATE_NAMES_WITH_REFER_FRIEND = new Set<string>([]);

export function shouldIncludeReferFriendInFooter(
  template: string | undefined,
): boolean {
  if (!template) return false;
  return TEMPLATE_NAMES_WITH_REFER_FRIEND.has(template);
}

function getContactEmail(): string {
  return getClientSupportEmail();
}

function getContactPhone(): string {
  return (
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_YUGO_PHONE) ||
    "(647) 370-4525"
  );
}

export function getReferFriendFooterUrl(): string {
  const env =
    (typeof process !== "undefined" &&
      process.env?.NEXT_PUBLIC_EMAIL_REFER_FRIEND_URL?.trim()) ||
    "";
  if (env) return env;
  return `${getEmailBaseUrl()}/client`;
}

type SocialKey = "instagram" | "facebook" | "x" | "youtube" | "tiktok";

function envSocial(key: SocialKey): string {
  const envMap: Record<SocialKey, string | undefined> = {
    instagram: process.env?.NEXT_PUBLIC_EMAIL_SOCIAL_INSTAGRAM,
    facebook: process.env?.NEXT_PUBLIC_EMAIL_SOCIAL_FACEBOOK,
    x: process.env?.NEXT_PUBLIC_EMAIL_SOCIAL_X,
    youtube: process.env?.NEXT_PUBLIC_EMAIL_SOCIAL_YOUTUBE,
    tiktok: process.env?.NEXT_PUBLIC_EMAIL_SOCIAL_TIKTOK,
  };
  return (envMap[key] || "").trim();
}

/** Public profile URL, or site home if env not set (icons always visible). */
function socialHref(key: SocialKey): string {
  const v = envSocial(key);
  if (v) return v;
  return `${getEmailBaseUrl()}/`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseFromEmailAddress(fromHeader: string): string {
  const raw = (fromHeader || "").trim();
  const m = raw.match(/<([^>]+)>/);
  if (m) return m[1].trim();
  return raw;
}

function hrRow(): string {
  return `
    <tr>
      <td style="padding:0 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr><td style="height:1px;background-color:${FOOTER_HR};line-height:0;font-size:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>`;
}

function navLink(href: string, label: string): string {
  return `<a href="${href}" style="color:${FOOTER_LINK_WINE};font-family:${FOOTER_NAV_FONT};font-size:11px;font-weight:400;letter-spacing:0;text-transform:none;text-decoration:none;border-bottom:1px solid ${FOOTER_LINK_WINE};padding-bottom:2px;">${label}</a>`;
}

/** Full-width table rows: optional REFER A FRIEND band (no GET APP). */
function buildReferFriendTopRows(params: {
  includeReferFriend: boolean;
  referFriendUrl: string;
  showMarketingTopRow: boolean;
}): string {
  const { includeReferFriend, referFriendUrl, showMarketingTopRow } = params;
  if (!showMarketingTopRow || !includeReferFriend) return "";
  const link = `<a href="${escapeHtml(referFriendUrl)}" style="color:${FOOTER_LINK_WINE};font-family:${FOOTER_NAV_FONT};font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;text-decoration:none;border-bottom:1px solid ${FOOTER_LINK_WINE};padding-bottom:3px;">Refer a friend</a>`;
  return `
    ${hrRow()}
    <tr>
      <td align="center" style="padding:0;font-family:${FOOTER_NAV_FONT};background-color:${FOOTER_BG};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;width:100%;margin:0 auto;">
          <tr><td align="center" style="padding:20px 12px;">${link}</td></tr>
        </table>
      </td>
    </tr>
    ${hrRow()}`;
}

function socialIconCell(url: string, iconUrl: string, alt: string): string {
  return `<td style="padding:0 10px;vertical-align:middle;">
    <a href="${escapeHtml(url)}" style="text-decoration:none;">
      <img src="${iconUrl}" alt="${escapeHtml(alt)}" width="22" height="22" style="display:block;border:0;" />
    </a>
  </td>`;
}

/**
 * Direct children of the outer client email `<table>`.
 * Starts with optional top promo rows, then nav + optional social row + white legal block.
 */
export function getClientEmailFooterTrs(
  options?: ClientEmailFooterOptions,
): string {
  const variant = options?.variant ?? "transactional";
  const spacerBg = options?.spacerBackground ?? FOOTER_BG;
  const whyKey = options?.whyReceiving ?? "booking";
  const whyLine = FOOTER_WHY_COPY[whyKey];
  const base = getEmailBaseUrl();
  const privacyUrl = `${base}/privacy`;
  const termsUrl = `${base}/legal/terms-of-use`;
  const contactEmail = getContactEmail();
  const contactPhone = getContactPhone();
  const mailtoContact = `mailto:${encodeURIComponent(contactEmail)}`;
  const mailtoPrefs = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent("Email preferences")}`;
  const mailtoUnsub = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent("Unsubscribe")}`;
  const tel = `tel:${contactPhone.replace(/\s/g, "").replace(/[()]/g, "")}`;
  const addrLine1 = "507 King Street E";
  const addrLine2 = "Toronto, Ontario";
  const addrLine3 = "M5A 1M3";
  const fullAddr = `${addrLine1}, ${addrLine2} ${addrLine3}, Canada`;
  const mapsUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(fullAddr)}`;

  const ig = socialHref("instagram");
  const fb = socialHref("facebook");
  const x = socialHref("x");
  const yt = socialHref("youtube");
  const tt = socialHref("tiktok");

  const SOCIAL_ICON = getSocialIconUrls(base);

  const socialRowInner = `<tr><td align="center" style="padding:16px 8px;">
    <table cellpadding="0" cellspacing="0" border="0" role="presentation" align="center"><tr>
      ${socialIconCell(ig, SOCIAL_ICON.instagram, "Instagram")}
      ${socialIconCell(fb, SOCIAL_ICON.facebook, "Facebook")}
      ${socialIconCell(x, SOCIAL_ICON.x, "X")}
      ${socialIconCell(yt, SOCIAL_ICON.youtube, "YouTube")}
      <td style="padding:0 0 0 14px;vertical-align:middle;border-left:1px solid ${FOOTER_HR};">
        <a href="${escapeHtml(tt)}" style="text-decoration:none;">
          <img src="${SOCIAL_ICON.tiktok}" alt="TikTok" width="22" height="22" style="display:block;border:0;" />
        </a>
      </td>
    </tr></table>
  </td></tr>`;

  const navTransactional = `
              ${navLink(mailtoContact, "CONTACT US")}
              <span style="color:${FOOTER_HR};margin:0 12px;font-size:11px;">|</span>
              ${navLink(privacyUrl, "PRIVACY POLICY")}
              <span style="color:${FOOTER_HR};margin:0 12px;font-size:11px;">|</span>
              ${navLink(termsUrl, "TERMS")}`;
  const navFull = `
              ${navLink(mailtoContact, "CONTACT US")}
              <span style="color:${FOOTER_HR};margin:0 12px;font-size:11px;">|</span>
              ${navLink(privacyUrl, "PRIVACY POLICY")}
              <span style="color:${FOOTER_HR};margin:0 12px;font-size:11px;">|</span>
              ${navLink(mailtoPrefs, "EMAIL PREFERENCES")}
              <span style="color:${FOOTER_HR};margin:0 12px;font-size:11px;">|</span>
              ${navLink(mailtoUnsub, "UNSUBSCRIBE")}`;

  const addressBookParagraph =
    variant === "transactional"
      ? `<p style="margin:0 0 14px;">
                Please add <a href="mailto:__YUGO_FOOTER_SENDER_MAILTO__" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">__YUGO_FOOTER_SENDER_EMAIL__</a> to your address book so important messages from Yugo reach your primary inbox.
              </p>`
      : `<p style="margin:0 0 14px;">
                Please add <a href="mailto:__YUGO_FOOTER_SENDER_MAILTO__" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">__YUGO_FOOTER_SENDER_EMAIL__</a> to your address book to ensure you receive updates about your move, offers, and exclusive perks.
              </p>`;

  const navRow = variant === "transactional" ? navTransactional : navFull;
  const socialBlock =
    variant === "transactional" ? "" : `${socialRowInner}${hrRow()}`;

  return `
__YUGO_FOOTER_TOP_PROMO__
    <tr>
      <td aria-hidden="true" height="${FOOTER_TOP_SPACER_PX}" style="padding:0;background-color:${spacerBg};height:${FOOTER_TOP_SPACER_PX}px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
    </tr>
    <tr>
      <td align="center" style="padding:0;background-color:${FOOTER_BG};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;width:100%;margin:0 auto;">
          ${hrRow()}
          <tr>
            <td align="center" style="padding:18px 16px 20px;font-family:${FOOTER_NAV_FONT};background-color:${FOOTER_BG};">
              ${navRow}
            </td>
          </tr>
          ${hrRow()}
          ${socialBlock}
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:0;background-color:${FOOTER_BG};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;width:100%;margin:0 auto;">
          <tr>
            <td style="padding:28px 24px 36px;font-family:${FOOTER_LEGAL_FONT};font-size:11px;line-height:1.65;color:${FOOTER_LEGAL_TEXT};text-align:center;">
              <p style="margin:0 0 14px;font-size:10px;color:#666666;line-height:1.55;">
                ${escapeHtml(whyLine)}
              </p>
              <p style="margin:0 0 14px;">
                This email was sent to <a href="mailto:__YUGO_FOOTER_RECIPIENT_MAILTO__" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">__YUGO_FOOTER_RECIPIENT__</a>.
              </p>
              ${addressBookParagraph}
              <p style="margin:0;">
                <strong style="color:${FOOTER_LEGAL_TEXT};font-weight:600;">Yugo Inc.</strong>
                <a href="${mapsUrl}" style="color:${FOOTER_LINK_WINE};text-decoration:underline;margin-left:6px;">${addrLine1} ${addrLine2}, ${addrLine3}, Canada</a>
              </p>
              <p style="margin:14px 0 0;font-size:10px;color:#888888;">
                We are always here to help. <a href="${mailtoContact}" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">Email us</a>
                <span style="color:#cccccc;"> &middot; </span>
                <a href="${tel}" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">Call ${escapeHtml(contactPhone)}</a>
              </p>
              <p style="margin:12px 0 0;font-size:10px;color:#aaaaaa;">
                <a href="${privacyUrl}" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">Privacy policy</a>
                <span style="color:#cccccc;margin:0 8px;">|</span>
                <a href="${termsUrl}" style="color:${FOOTER_LINK_WINE};text-decoration:underline;">Terms of use</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export interface EmailFooterTokenContext {
  recipientEmail: string;
  fromHeader: string;
  template?: string;
  /** When false, hide REFER row (e.g. admin mail without a template tag). */
  showMarketingTopRow: boolean;
}

export function applyEmailFooterTokens(
  html: string,
  ctx: EmailFooterTokenContext,
): string {
  if (
    !html.includes("__YUGO_FOOTER_RECIPIENT__") &&
    !html.includes("__YUGO_FOOTER_RECIPIENT_MAILTO__")
  ) {
    return html;
  }

  const senderRaw = parseFromEmailAddress(ctx.fromHeader);

  const top = buildReferFriendTopRows({
    includeReferFriend: shouldIncludeReferFriendInFooter(ctx.template),
    referFriendUrl: getReferFriendFooterUrl(),
    showMarketingTopRow: ctx.showMarketingTopRow,
  });

  return html
    .split("__YUGO_FOOTER_TOP_PROMO__")
    .join(top)
    .split("__YUGO_FOOTER_RECIPIENT_MAILTO__")
    .join(encodeURIComponent(ctx.recipientEmail))
    .split("__YUGO_FOOTER_SENDER_MAILTO__")
    .join(encodeURIComponent(senderRaw))
    .split("__YUGO_FOOTER_RECIPIENT__")
    .join(escapeHtml(ctx.recipientEmail))
    .split("__YUGO_FOOTER_SENDER_EMAIL__")
    .join(escapeHtml(senderRaw));
}

/** Full-width footer table for layouts outside the main client wrapper (e.g. admin). */
export function getEmailFooterStandaloneFragment(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background-color:${FOOTER_BG};margin-top:24px;">
${getClientEmailFooterTrs()}
</table>`;
}
