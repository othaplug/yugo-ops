import { getClientSupportEmail } from "@/lib/email/client-support-email";
import {
  EMAIL_FOREST,
  EMAIL_FOREST_CALLOUT_BG,
  EMAIL_FOREST_CALLOUT_BORDER,
  EMAIL_FOREST_RULE,
  EMAIL_PREMIUM_MUTED_FILL,
  EMAIL_PREMIUM_TABLE_HEAD,
  EMAIL_WINE,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import {
  emailLayout,
  legacyEmailLayout,
  equinoxPromoLayout,
  equinoxPromoCta,
  equinoxPromoFinePrint,
  PREMIUM_FONT,
  PREMIUM_TRACK_CTA_LABEL,
} from "@/lib/email-templates";
import { emailNestedKvRow } from "@/lib/email/email-kv-layout";
import { emailMapLinkHtml, escapeHtmlEmail } from "@/lib/email/email-link-utils";
import { humanizePaymentProcessorMessage } from "@/lib/email/payment-error-message";
import { formatCurrencyEmail } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import { formatPhone } from "@/lib/phone";

/* ═══════════════════════════════════════════════════════════
   Pre-Move, Post-Move, Review & Lifecycle Email Templates
   ═══════════════════════════════════════════════════════════
   Typography: display h1 / EQ_H1 = HERO_SERIF (Instrument Serif, Georgia), sentence case,
   letter-spacing 0. Primary CTAs = forest fill + white type (10px uppercase, 1.2px tracking).
   Accent kickers use forest on cream (FOREST_EYEBROW_UPPER), 12px uppercase + tracked (quote parity).
   Track links use PREMIUM_TRACK_CTA_LABEL on CTAs.
   ═══════════════════════════════════════════════════════════ */

/** First name only for email greetings (all client-facing emails). */
function firstName(full: string | undefined): string {
  return (full || "").trim().split(/\s+/)[0] || "";
}

function dateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "To be confirmed";
  const raw = dateStr.trim();
  const d = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "To be confirmed";
  return d.toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Display headlines — Instrument Serif with Georgia fallback. */
const HERO_SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
/** Cream `equinoxPromoLayout` page — dark text (not #FFFFFF / #DDDDDD, which disappear on #FCF9F4). */
const PROMO_CREAM_BODY = "#3A3532";
const PROMO_CREAM_MUTED = "#6B635C";
const PROMO_CREAM_RULE = EMAIL_FOREST_RULE;
/** Hairlines inside summary tables on cream (visibility on #FCF9F4). */
const CONTRACT_DIVIDER = "rgba(44,62,45,0.12)";
const CONTRACT_DIVIDER_STRONG = "rgba(44,62,45,0.22)";
const CONTRACT_TABLE_OUTER = `1px solid ${PROMO_CREAM_RULE}`;
const PROMO_CREAM_FILL = EMAIL_PREMIUM_MUTED_FILL;
const PROMO_CREAM_CALLOUT_PAD = "12px 14px";
/** Warm island band behind contract table titles (quote page parity). */
const EQ_CREME_HEAD = EMAIL_PREMIUM_TABLE_HEAD;
const PROMO_CREAM_H1 = `font-size:30px;font-weight:700;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};margin:0 0 18px;letter-spacing:0;line-height:1.15;text-transform:none;font-family:${HERO_SERIF}`;
const PROMO_CREAM_P = `font-size:15px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.62;margin:0;font-family:${PREMIUM_FONT}`;
/** `emailLayout` / `legacyEmailLayout` = cream shell — must not use white/#A3A3A3 (invisible on #FCF9F4). */
const EQ_H1 = `font-size:28px;font-weight:700;margin:0 0 12px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};letter-spacing:0;text-transform:none;line-height:1.22;font-family:${HERO_SERIF}`;
const EQ_LEAD = `font-size:14px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.62;margin:0 0 24px;font-family:${PREMIUM_FONT}`;
/** Review / legacy blocks on same cream wrapper as {@link legacyEmailLayout}. */
const CREAM_REVIEW_H1 = `font-size:22px;font-weight:700;margin:0 0 10px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};line-height:1.28;font-family:'Instrument Serif',Georgia,'Times New Roman',serif`;
const CREAM_REVIEW_P = `font-size:14px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.65;margin:0 0 22px;font-family:${PREMIUM_FONT}`;
const CREAM_REVIEW_SMALL = `font-size:11px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.62;text-align:center;font-family:${PREMIUM_FONT}`;
/** Red / urgent kicker — 12px caps, 0 tracking (Gmail-safe). */
const ALERT_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#D14343 !important;-webkit-text-fill-color:#D14343;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px`;
/** Section kicker on cream (forest; legacy name was “gold”). */
const FOREST_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px`;
/** Amber kicker (low-sat, warnings). */
const AMBER_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#D48A29 !important;-webkit-text-fill-color:#D48A29;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px`;
/** Success kicker (payment received, move complete). */
const SUCCESS_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#2D9F5A !important;-webkit-text-fill-color:#2D9F5A;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px`;
/** Wine kicker (cancellation and heavy tone). */
const WINE_EYEBROW_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#5C1A33 !important;-webkit-text-fill-color:#5C1A33;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px`;
/** Summary / contract table title row (full width). */
const CONTRACT_HDR_FULL = `background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.06em;text-transform:uppercase;font-family:${PREMIUM_FONT}`;
/** Two-column table header cells (description / amount). */
const CONTRACT_HDR_SPLIT = `background-color:${EQ_CREME_HEAD};padding:10px 14px;font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.06em;text-transform:uppercase;font-family:${PREMIUM_FONT}`;
/** Total / footer row label inside contract tables. */
const CONTRACT_TOTAL_LABEL = `border-top:1px solid ${CONTRACT_DIVIDER_STRONG};padding:14px 16px;font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.06em;text-transform:uppercase;font-family:${PREMIUM_FONT}`;
const ACCESS_NOTE_LABEL = `<span style="font-size:11px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0.07em;text-transform:uppercase;font-family:${PREMIUM_FONT};">Access</span>`;
const CALLOUT_TOP_FOREST = `background:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:16px;margin-bottom:20px;font-family:${PREMIUM_FONT}`;

const KV_DIV = `1px solid ${CONTRACT_DIVIDER}`;
const LKV_LABEL = `padding:6px 0 6px 14px;font-size:11px;font-weight:600;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};text-transform:uppercase;letter-spacing:0.06em;font-family:${PREMIUM_FONT};vertical-align:top;width:38%`;
const LKV_LABEL_TOP = `${LKV_LABEL};vertical-align:top`;
const LKV_VALUE = `padding:6px 14px 6px 10px;font-size:12px;color:${PROMO_CREAM_BODY};text-align:right;font-family:${PREMIUM_FONT};font-weight:600;vertical-align:top`;
const LKV_VALUE_TOP = `${LKV_VALUE};vertical-align:top`;
const LKV_VALUE_REF = `padding:6px 14px 6px 10px;font-size:12px;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-align:right;font-family:${PREMIUM_FONT};font-weight:700;vertical-align:top`;
const LKV_VALUE_GREEN = `padding:6px 14px 6px 10px;font-size:12px;color:#2D9F5A;text-align:right;font-family:${PREMIUM_FONT};font-weight:700;vertical-align:top`;

function creamContractKvRow(
  label: string,
  valueHtml: string,
  valueStyle: string,
  labelStyle: string = LKV_LABEL,
): string {
  return emailNestedKvRow({
    borderTop: KV_DIV,
    labelStyle,
    valueStyle,
    label,
    valueHtml,
  });
}

/** Wine inset panel (pre-move checklist, card-on-file explainer, partner notices). */
const WINE_INSET_RULE = "rgba(255,255,255,0.2)";
const EQ_PANEL = `background:${EMAIL_WINE};border:1px solid ${WINE_INSET_RULE};border-radius:0;padding:20px;margin-bottom:20px;font-family:${PREMIUM_FONT}`;
/** Light kicker on wine {@link EQ_PANEL} — 12px uppercase, tracked. */
const PANEL_KICKER_ON_WINE_UPPER = `font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#E8DFD8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px`;
/** Body copy on wine inset panels. */
const EQ_ON_WINE_PANEL = "rgba(255,255,255,0.88)";

function creamSupportMailtoLink(): string {
  const e = getClientSupportEmail();
  return `<a href="mailto:${e}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${e}</a>`;
}

function wineMailtoAddress(address: string): string {
  return `<a href="mailto:${address}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;font-weight:600;">${address}</a>`;
}

function ctaButton(url: string, label: string, sub?: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 ${sub ? "6px" : "16px"};">
      <tr>
        <td align="center" style="text-align:center;">
          <a href="${url}" style="${emailPrimaryCtaStyle(PREMIUM_FONT, "inline-block")}">${label.toUpperCase()}</a>
        </td>
      </tr>
    </table>
    ${sub ? `<p style="font-size:10px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};text-align:center;margin:0 0 16px;letter-spacing:0.02em;font-family:${PREMIUM_FONT};">${sub}</p>` : ""}
  `;
}

/** Escape `&` for HTML `href` (query strings in attributes). */
function hrefAttr(url: string): string {
  return url.replace(/&/g, "&amp;");
}

/** 1–3 → in-app `/review?token=…&rating=N`; 4–5 → redirect API (records rating, then Google review). */
function starRatingLinks(reviewUrl: string, reviewRedirectUrl: string): string {
  const sep = reviewUrl.includes("?") ? "&" : "?";
  const rsep = reviewRedirectUrl.includes("?") ? "&" : "?";
  const starStyle =
    "display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;font-size:18px;color:#5A6B5E;text-decoration:none;margin:0 2px;border-radius:0;background:rgba(44,62,45,0.08);border:1px solid rgba(44,62,45,0.14)";
  const link1 = hrefAttr(`${reviewUrl}${sep}rating=1`);
  const link2 = hrefAttr(`${reviewUrl}${sep}rating=2`);
  const link3 = hrefAttr(`${reviewUrl}${sep}rating=3`);
  const link4 = hrefAttr(`${reviewRedirectUrl}${rsep}rating=4`);
  const link5 = hrefAttr(`${reviewRedirectUrl}${rsep}rating=5`);
  return `
    <div style="font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.08em;text-transform:uppercase;line-height:1.45;margin-bottom:10px;text-align:center">Rate your experience</div>
    <div style="margin:0 0 24px;text-align:center">
      <a href="${link1}" style="${starStyle}" title="1 star">1</a>
      <a href="${link2}" style="${starStyle}" title="2 stars">2</a>
      <a href="${link3}" style="${starStyle}" title="3 stars">3</a>
      <a href="${link4}" style="${starStyle}" title="4 stars">4</a>
      <a href="${link5}" style="${starStyle}" title="5 stars">5</a>
    </div>
  `;
}

/* ── T-72 Hours: Checklist Email ── */

export interface PreMove72hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  fromAccess?: string | null;
  toAccess?: string | null;
  trackingUrl: string;
}

export function preMove72hrEmail(d: PreMove72hrData): string {
  const accessNotes: string[] = [];
  const fromAccessLabel = formatAccessForDisplay(d.fromAccess);
  const toAccessLabel = formatAccessForDisplay(d.toAccess);
  if (
    fromAccessLabel &&
    toAccessLabel &&
    fromAccessLabel !== "None" &&
    toAccessLabel !== "None"
  )
    accessNotes.push(
      `${ACCESS_NOTE_LABEL} <span style="font-size:11px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0.07em;text-transform:uppercase;font-family:${PREMIUM_FONT};">PICKUP:</span> ${fromAccessLabel}; <span style="font-size:11px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0.07em;text-transform:uppercase;font-family:${PREMIUM_FONT};">DROP-OFF:</span> ${toAccessLabel} — please reserve the elevator/loading dock.`,
    );
  else if (fromAccessLabel && fromAccessLabel !== "None")
    accessNotes.push(
      `${ACCESS_NOTE_LABEL} ${fromAccessLabel} - please reserve the elevator/loading dock.`,
    );
  else if (toAccessLabel && toAccessLabel !== "None")
    accessNotes.push(
      `${ACCESS_NOTE_LABEL} ${toAccessLabel} - please reserve the elevator/loading dock.`,
    );

  return emailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">Three days to go</div>
    <h1 style="${EQ_H1}">Your move is almost here${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your move is confirmed for <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${dateDisplay(d.moveDate)}</strong>. A little preparation goes a long way. Here is a quick checklist to make the day as smooth as possible.
    </p>

    <div style="${EQ_PANEL}">
      <div style="${PANEL_KICKER_ON_WINE_UPPER}margin-bottom:14px;">Pre-move checklist</div>
      <div style="font-size:13px;color:${EQ_ON_WINE_PANEL};line-height:2;font-family:${PREMIUM_FONT}">
        <div>— Book elevator or loading dock at both locations</div>
        <div>— Reserve parking access for our truck</div>
        <div>— Finish packing any remaining boxes</div>
        <div>— Clear hallways and pathways throughout</div>
        <div>— Arrange care for pets and young children on the day</div>
        <div>— Keep valuables, medications, and important documents with you</div>
        <div>— Defrost the freezer and empty the fridge</div>
      </div>
    </div>

    ${
      accessNotes.length > 0
        ? `
      <div style="${CALLOUT_TOP_FOREST}">
        <div style="${FOREST_EYEBROW_UPPER};margin-bottom:8px">Access notes</div>
        <div style="font-size:12px;color:${PROMO_CREAM_BODY};line-height:1.6">
          ${accessNotes.join("<br/>")}
        </div>
      </div>
    `
        : ""
    }

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:22px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Move details</td></tr>
      ${creamContractKvRow("Reference", escapeHtmlEmail(d.moveCode), LKV_VALUE_REF)}
      ${creamContractKvRow("From", emailMapLinkHtml(d.fromAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${creamContractKvRow("To", emailMapLinkHtml(d.toAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
    </table>

    ${ctaButton(d.trackingUrl, PREMIUM_TRACK_CTA_LABEL)}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      We are here if you need anything. Email ${creamSupportMailtoLink()} or reach your coordinator directly.
    </p>
  `);
}

/* ── T-24 Hours: Crew Details ── */

export interface PreMove24hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  crewLeadName?: string | null;
  crewSize?: number | null;
  truckInfo?: string | null;
  arrivalWindow?: string | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  trackingUrl: string;
}

export function preMove24hrEmail(d: PreMove24hrData): string {
  return emailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">Tomorrow&apos;s the day</div>
    <h1 style="${EQ_H1}">Your crew is confirmed${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Everything is in place for your move tomorrow. Your arrival window and crew details are below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:18px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Crew details</td></tr>
      ${d.crewLeadName ? creamContractKvRow("Crew lead", escapeHtmlEmail(d.crewLeadName), LKV_VALUE) : ""}
      ${d.crewSize ? creamContractKvRow("Crew size", `${d.crewSize} movers`, LKV_VALUE) : ""}
      ${d.truckInfo ? creamContractKvRow("Truck", escapeHtmlEmail(d.truckInfo), LKV_VALUE) : ""}
      ${creamContractKvRow("Arrival", escapeHtmlEmail(d.arrivalWindow ?? "Morning window - your coordinator will confirm the exact time"), LKV_VALUE_REF)}
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:20px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Move details</td></tr>
      ${creamContractKvRow("Date", escapeHtmlEmail(dateDisplay(d.moveDate)), LKV_VALUE)}
      ${creamContractKvRow("From", emailMapLinkHtml(d.fromAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${creamContractKvRow("To", emailMapLinkHtml(d.toAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
    </table>

    ${
      d.coordinatorName
        ? `
      <div style="${CALLOUT_TOP_FOREST}">
        <div style="${FOREST_EYEBROW_UPPER};margin-bottom:6px">Your coordinator</div>
        <div style="font-size:13px;color:${PROMO_CREAM_BODY};margin-top:4px">${d.coordinatorName}${d.coordinatorPhone ? ` &middot; ${formatPhone(d.coordinatorPhone)}` : ""}</div>
        <div style="font-size:11px;color:${PROMO_CREAM_MUTED};margin-top:4px">Available by phone or text if you need anything before tomorrow.</div>
      </div>
    `
        : ""
    }

    ${ctaButton(d.trackingUrl, "TRACK YOUR MOVE LIVE")}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Your crew will call approximately 30 minutes before they arrive.
    </p>
  `);
}

/* ── Balance Receipt ── */

export interface BalanceReceiptData {
  clientName: string;
  moveCode: string;
  amount: number;
  paymentMethod?: string | null;
  totalPaid: number;
  trackingUrl: string;
}

export function balanceReceiptEmail(d: BalanceReceiptData): string {
  return emailLayout(`
    <div style="${SUCCESS_EYEBROW_UPPER}">Payment received</div>
    <h1 style="${EQ_H1}">Thank you${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your payment has been completed. Your account for this move is now paid in full.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:24px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Payment summary</td></tr>
      ${creamContractKvRow("Reference", escapeHtmlEmail(d.moveCode), LKV_VALUE_REF)}
      ${creamContractKvRow("Balance paid", formatCurrencyEmail(d.amount), LKV_VALUE_GREEN)}
      ${d.paymentMethod ? creamContractKvRow("Payment method", escapeHtmlEmail(d.paymentMethod), LKV_VALUE) : ""}
      ${emailNestedKvRow({
        borderTop: `1px solid ${CONTRACT_DIVIDER_STRONG}`,
        labelStyle: `${CONTRACT_TOTAL_LABEL};border-top:0;padding:10px 0 10px 14px`,
        valueStyle: `padding:10px 14px 10px 10px;font-size:14px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0;font-family:${PREMIUM_FONT};text-align:right;vertical-align:middle`,
        label: "Total paid",
        valueHtml: formatCurrencyEmail(d.totalPaid),
      })}
    </table>

    ${ctaButton(d.trackingUrl, "View move details")}
  `);
}

/* ── Move Complete ── */

export interface MoveCompleteData {
  clientName: string;
  moveCode: string;
  fromAddress: string;
  toAddress: string;
  completedDate: string | null;
  trackingUrl: string;
  surveyUrl?: string | null;
}

export function moveCompleteEmail(d: MoveCompleteData): string {
  return emailLayout(`
    <div style="${SUCCESS_EYEBROW_UPPER}">Move complete</div>
    <h1 style="${EQ_H1}">Congratulations${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your move is complete. It was a privilege to take care of your home and belongings today. Your documents and receipts are ready in your portal whenever you need them.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:24px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Move summary</td></tr>
      ${creamContractKvRow("Reference", escapeHtmlEmail(d.moveCode), LKV_VALUE_REF)}
      ${creamContractKvRow("From", emailMapLinkHtml(d.fromAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${creamContractKvRow("To", emailMapLinkHtml(d.toAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${d.completedDate ? creamContractKvRow("Completed", escapeHtmlEmail(dateDisplay(d.completedDate)), LKV_VALUE_GREEN) : ""}
    </table>

    <div style="margin-bottom:22px;font-family:${PREMIUM_FONT}">
      <div style="${FOREST_EYEBROW_UPPER};margin-bottom:10px">Your documents</div>
      <p style="font-size:13px;color:${PROMO_CREAM_MUTED};line-height:1.65;margin:0">
        Your move summary, invoice, and receipt are available to download directly from your portal. We keep these secure and accessible at any time.
      </p>
    </div>

    <div style="margin-bottom:24px;font-family:${PREMIUM_FONT}">
      <div style="${FOREST_EYEBROW_UPPER};margin-bottom:10px">What&apos;s next</div>
      <div style="font-size:13px;color:${PROMO_CREAM_MUTED};line-height:1.85">
        <div>1. Download your documents from the portal</div>
        <div>2. A brief follow-up will arrive by email shortly</div>
        <div>3. Settle in and enjoy your new space</div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View your move portal")}
  `);
}

/* ── Review Request (score >= 4 or null) ── */

export interface ReviewRequestData {
  clientName: string;
  moveCode: string;
  googleReviewUrl: string;
  referralUrl?: string | null;
  trackingUrl: string;
}

export function reviewRequestEmail(d: ReviewRequestData): string {
  return legacyEmailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">How was your experience?</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</div>
    <p style="${CREAM_REVIEW_P}">
      Your feedback means a great deal to us and to families looking for a mover they can trust. A brief review is the best way to share your experience.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <a href="${d.googleReviewUrl}" style="${emailPrimaryCtaStyle(PREMIUM_FONT, "inline-block")}">
            SHARE YOUR EXPERIENCE
          </a>
        </td>
      </tr>
    </table>

    ${
      d.referralUrl
        ? `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
        <tr>
          <td style="background-color:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:16px;text-align:center;">
            <div style="${FOREST_EYEBROW_UPPER};margin-bottom:8px;text-align:center;">Know someone moving?</div>
            <div style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};margin-bottom:8px;">Give $50. Get $50.</div>
            <p style="font-size:12px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin:0 0 16px;line-height:1.6;">Share your referral link and you both receive $50 off a future move.</p>
            <a href="${d.referralUrl}" style="display:inline-block;background-color:transparent;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};padding:10px 24px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-decoration:none;border:1px solid ${EMAIL_FOREST};text-transform:uppercase;">
              SHARE YOUR LINK
            </a>
          </td>
        </tr>
      </table>
    `
        : ""
    }

    <p style="${CREAM_REVIEW_SMALL}">
      Thank you for trusting Yugo with your home. The Yugo Team
    </p>
  `);
}

/* ── Tier-specific Review Request (2h after completion) ── */

export interface ReviewRequestTierData {
  clientName: string;
  tier: "essential" | "signature" | "estate" | string;
  /** In-app review flow: 1–3 star links (`/review?token=…&rating=N`). */
  reviewUrl: string;
  /** 4–5 star links: `/api/review/redirect?token=…` then Google review. */
  reviewRedirectUrl: string;
  referralUrl?: string | null;
  trackingUrl: string;
  coordinatorName?: string | null;
}

/** @deprecated Use reviewRequestCuratedEmail */
export const reviewRequestEssentialsEmail = (
  d: ReviewRequestTierData,
): string => reviewRequestCuratedEmail(d);

export function reviewRequestCuratedEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">How was your experience?</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</div>
    <p style="${CREAM_REVIEW_P}">
      It was a pleasure taking care of your move today. We hope you are already settling in comfortably.
    </p>
    <p style="${CREAM_REVIEW_P}">
      If you have a moment, we would be truly grateful for a brief review. Your words help other families find the level of care they deserve, and they mean everything to our crew.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="${CREAM_REVIEW_SMALL}">
      Thank you for trusting Yugo with your home. The Yugo Team
    </p>
  `);
}

/** @deprecated Use reviewRequestSignatureEmail */
export const reviewRequestPremierEmail = (d: ReviewRequestTierData): string =>
  reviewRequestSignatureEmail(d);

export function reviewRequestSignatureEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">Your experience matters</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</div>
    <p style="${CREAM_REVIEW_P}">
      It was truly a pleasure taking care of your move today. We hope you are already settling in and feeling at home.
    </p>
    <p style="${CREAM_REVIEW_P}">
      If you have a moment, a brief review would mean the world to our team. Your words help other families find the care and confidence they deserve on moving day.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="${CREAM_REVIEW_SMALL}">
      With gratitude, The Yugo Team
    </p>
  `);
}

export function reviewRequestEstateEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">A note of gratitude</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">${firstName(d.clientName) ? `${firstName(d.clientName)}, it was our privilege` : "It was our privilege"}</div>
    <p style="${CREAM_REVIEW_P}">
      Thank you for entrusting Yugo with your home and belongings. Every detail of your move matters to us, and we hope today reflected that.
    </p>
    <p style="${CREAM_REVIEW_P}">
      If your experience was as exceptional as we intended, we would be honoured by a brief review. It helps other families find the quality of care they deserve, and it means everything to our team.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="${CREAM_REVIEW_SMALL}">
      With gratitude,<br/>${d.coordinatorName || "The Yugo Team"}<br/>Yugo, The Art of Moving
    </p>
  `);
}

export interface ReviewRequestReminderData {
  clientName: string;
  reviewUrl: string;
  reviewRedirectUrl: string;
}

export function reviewRequestReminderEmail(
  d: ReviewRequestReminderData,
): string {
  return legacyEmailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">A gentle reminder</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">A moment for your review${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</div>
    <p style="${CREAM_REVIEW_P}">
      We know settling in keeps you busy. Whenever you have a moment, your review would mean the world to our team and to families searching for a mover they can trust.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="${CREAM_REVIEW_SMALL}">
      Thank you for choosing Yugo. The Yugo Team
    </p>
  `);
}

/* ── Low Satisfaction Follow-Up (score < 4) ── */

export interface LowSatisfactionData {
  clientName: string;
  moveCode: string;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  coordinatorEmail?: string | null;
  trackingUrl: string;
}

export function lowSatisfactionEmail(d: LowSatisfactionData): string {
  const support = getClientSupportEmail();
  const coordEmailRaw = (d.coordinatorEmail || "").trim();
  const coordMail = coordEmailRaw
    ? `<div style="margin-top:4px"><a href="mailto:${coordEmailRaw.replace(/&/g, "&amp;")}" style="color:rgba(255,255,255,0.95) !important;-webkit-text-fill-color:rgba(255,255,255,0.95);text-decoration:underline;font-size:13px;font-weight:600;">${escapeHtmlEmail(coordEmailRaw)}</a></div>`
    : "";
  return legacyEmailLayout(`
    <div style="${AMBER_EYEBROW_UPPER}">We are here for you</div>
    <div role="heading" aria-level="1" style="${CREAM_REVIEW_H1}">We hear you${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}.</div>
    <p style="${CREAM_REVIEW_P}">
      We understand your experience fell short of what you deserved, and we sincerely apologize. This is not the standard we hold ourselves to, and we are committed to making it right.
    </p>

    <div style="background:${EMAIL_WINE};border:1px solid ${WINE_INSET_RULE};border-radius:0;padding:14px 16px;margin-bottom:20px">
      <div style="font-size:13px;color:rgba(255,255,255,0.85);line-height:1.7">
        <div>Your dedicated coordinator is available to resolve this personally:</div>
        ${d.coordinatorName ? `<div style="color:rgba(255,255,255,0.98);font-weight:600;margin-top:8px">${escapeHtmlEmail(d.coordinatorName)}</div>` : ""}
        ${d.coordinatorPhone ? `<div style="margin-top:4px"><a href="tel:${String(d.coordinatorPhone).replace(/\s/g, "").replace(/[()]/g, "")}" style="color:rgba(255,255,255,0.95) !important;-webkit-text-fill-color:rgba(255,255,255,0.95);text-decoration:underline;font-size:13px;font-weight:600;">${escapeHtmlEmail(formatPhone(d.coordinatorPhone))}</a></div>` : ""}
        ${coordMail}
      </div>
    </div>

    <p style="${CREAM_REVIEW_P}">
      Please reach us at <a href="mailto:${support}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${support}</a> or call us directly. We will not consider this resolved until you are fully satisfied.
    </p>

    ${ctaButton(d.trackingUrl, "View your move details")}
  `);
}

/* ── Internal Alert: Low Satisfaction ── */

export interface InternalLowSatAlertData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  npsScore: number | null;
  moveDate: string | null;
}

export function internalLowSatAlertEmail(d: InternalLowSatAlertData): string {
  const emailRaw = (d.clientEmail || "").trim();
  const emailCell = emailRaw
    ? `<a href="mailto:${emailRaw.replace(/&/g, "&amp;")}" style="color:rgba(255,255,255,0.95) !important;-webkit-text-fill-color:rgba(255,255,255,0.95);text-decoration:underline;font-weight:600;">${escapeHtmlEmail(emailRaw)}</a>`
    : "—";
  const wineKvLabel =
    "padding:5px 8px 5px 0;color:rgba(255,255,255,0.72);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;width:38%;vertical-align:top";
  const wineKvVal =
    "padding:5px 0;color:rgba(255,255,255,0.95);font-size:12px;text-align:right;font-weight:600;vertical-align:top";
  const wineKvRule = `1px solid ${WINE_INSET_RULE}`;
  return legacyEmailLayout(`
    <div style="${ALERT_EYEBROW_UPPER}">Low satisfaction alert</div>
    <div role="heading" aria-level="1" style="font-size:20px;font-weight:700;margin:0 0 20px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-family:${HERO_SERIF}">${escapeHtmlEmail(d.moveCode)} — ${escapeHtmlEmail(d.clientName)}</div>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.2);border-radius:0;padding:14px;margin-bottom:20px">
      <div style="font-size:12px;color:#D14343;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">NPS/SATISFACTION SCORE: ${d.npsScore ?? "N/A"}/5</div>
      <div style="font-size:12px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin-top:4px">This client reported a low satisfaction score. Follow up immediately.</div>
    </div>

    <div style="background:${EMAIL_WINE};border:1px solid ${WINE_INSET_RULE};border-radius:0;padding:20px;margin-bottom:20px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px;border-collapse:collapse;font-family:${PREMIUM_FONT}">
        ${emailNestedKvRow({
          borderTop: "none",
          labelStyle: wineKvLabel,
          valueStyle: wineKvVal,
          label: "Client",
          valueHtml: escapeHtmlEmail(d.clientName),
        })}
        ${emailNestedKvRow({
          borderTop: wineKvRule,
          labelStyle: wineKvLabel,
          valueStyle: wineKvVal,
          label: "Email",
          valueHtml: emailCell,
        })}
        ${emailNestedKvRow({
          borderTop: wineKvRule,
          labelStyle: wineKvLabel,
          valueStyle: wineKvVal,
          label: "Phone",
          valueHtml: d.clientPhone ? escapeHtmlEmail(formatPhone(d.clientPhone)) : "—",
        })}
        ${emailNestedKvRow({
          borderTop: wineKvRule,
          labelStyle: wineKvLabel,
          valueStyle: wineKvVal,
          label: "Move date",
          valueHtml: d.moveDate ? escapeHtmlEmail(dateDisplay(d.moveDate)) : "—",
        })}
      </table>
    </div>

    <div style="background:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:14px">
      <div style="${FOREST_EYEBROW_UPPER};margin-bottom:4px">Action required</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">Contact the client within 2 hours. Review request has been suppressed.</div>
    </div>
  `);
}

/* ── Referral Offer ── */

export interface ReferralOfferData {
  clientName: string;
  referralUrl: string;
}

export function referralOfferEmail(d: ReferralOfferData): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(`
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">Give $50. Get $50.</div>
    <p style="${PROMO_CREAM_P}">${name ? `${name}, refer` : "Refer"} a friend to Yugo and you will both receive <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$50 off</strong> a residential move. Credits apply automatically when they book.</p>
    ${equinoxPromoCta(d.referralUrl, "Share Your Link")}
    ${equinoxPromoFinePrint("Residential moves only. One referral bonus per new customer.")}
  `);
}

/* ═══════════════════════════════════════════════════════════
   Quote Follow-Up Email Templates
   ═══════════════════════════════════════════════════════════ */

export interface QuoteFollowup1Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
}

export function quoteFollowup1Email(d: QuoteFollowup1Data): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">${name ? `${name}, your` : "Your"} Yugo quote is ready.</div>
    <p style="${PROMO_CREAM_P}">We have prepared a guaranteed flat-rate ${d.serviceLabel.toLowerCase()} quote for you. One transparent price, nothing added on the day.</p>
    ${equinoxPromoCta(d.quoteUrl, "View Your Quote")}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `,
    "quote",
  );
}

export interface QuoteFollowup2Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  moveDate: string | null;
  expiresAt: string | null;
  /** variant hint: warm | essential (default) */
  tier?: string | null;
  addons?: string[];
}

export function quoteFollowup2Email(d: QuoteFollowup2Data): string {
  const name = firstName(d.clientName);
  const isWarm = !!d.tier;

  let heading: string;
  let body: string;
  let ctaLabel: string;

  const expiryText = (() => {
    if (!d.expiresAt) return null;
    const days = Math.max(
      0,
      Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000),
    );
    if (days <= 0) return "QUOTE EXPIRES TODAY";
    if (days === 1) return "QUOTE EXPIRES IN 1 DAY";
    return `QUOTE EXPIRES IN ${days} DAYS`;
  })();

  if (isWarm) {
    heading = name
      ? `${name}, your booking is almost complete.`
      : "Your booking is almost complete.";
    body =
      "Your preferred package is still available. Secure your date and rate whenever you are ready.";
    ctaLabel = "Complete My Booking";
  } else {
    heading = name ? `A gentle reminder, ${name}.` : "A gentle reminder.";
    body = d.moveDate
      ? `Availability for <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${dateDisplay(d.moveDate)}</strong> is limited. Your guaranteed rate is held until your quote expires.`
      : "Your guaranteed flat-rate price is held until your quote expires. When you are ready, securing your date takes just a moment.";
    ctaLabel = "Secure My Date";
  }

  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">${heading}</div>
    <p style="${PROMO_CREAM_P}">${body}${expiryText ? `<br/><br/><span style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:13px;">${expiryText}</span>` : ""}</p>
    ${equinoxPromoCta(d.quoteUrl, ctaLabel)}
    ${equinoxPromoFinePrint(`Need to adjust anything? Email <a href="mailto:${getClientSupportEmail()}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `,
    "quote",
  );
}

export interface QuoteFollowup3Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  expiresAt: string | null;
  /** hot variant — payment was started */
  tier?: string | null;
}

/* ═══════════════════════════════════════════════════════════
   Cancellation Confirmation Email
   ═══════════════════════════════════════════════════════════ */

export interface CancellationConfirmData {
  clientName: string;
  moveCode: string;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  cancellationReason: string;
  refundAmount: number | null;
  trackingUrl: string;
}

export function cancellationConfirmEmail(d: CancellationConfirmData): string {
  return emailLayout(`
    <div style="${WINE_EYEBROW_UPPER}">Cancellation confirmed</div>
    <div role="heading" aria-level="1" style="${EQ_H1}">Your booking is cancelled${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</div>
    <p style="${EQ_LEAD}">
      Move reference <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${d.moveCode}</strong> has been cancelled. Details are below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:22px;font-family:${PREMIUM_FONT}">
      <tr><td style="${CONTRACT_HDR_FULL}">Cancelled move</td></tr>
      ${creamContractKvRow("Reference", escapeHtmlEmail(d.moveCode), LKV_VALUE_REF)}
      ${creamContractKvRow("From", emailMapLinkHtml(d.fromAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${creamContractKvRow("To", emailMapLinkHtml(d.toAddress), LKV_VALUE_TOP, LKV_LABEL_TOP)}
      ${d.moveDate ? creamContractKvRow("Date", escapeHtmlEmail(dateDisplay(d.moveDate)), LKV_VALUE) : ""}
      ${creamContractKvRow("Reason", escapeHtmlEmail(d.cancellationReason), LKV_VALUE_TOP, LKV_LABEL_TOP)}
    </table>

    ${
      d.refundAmount && d.refundAmount > 0
        ? `
      <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.22);border-radius:0;padding:20px;margin-bottom:22px;font-family:${PREMIUM_FONT}">
        <div style="${SUCCESS_EYEBROW_UPPER};margin-bottom:8px">Refund issued</div>
        <div style="font-size:26px;font-weight:700;color:#2D9F5A;margin-bottom:8px">${formatCurrencyEmail(d.refundAmount)}</div>
        <div style="font-size:12px;color:${PROMO_CREAM_MUTED};line-height:1.6">
          Refunds typically post within 3&ndash;5 business days; your bank may take up to 7 business days.
        </div>
      </div>
    `
        : `
      <div style="background:rgba(212,138,41,0.08);border:1px solid rgba(212,138,41,0.22);border-radius:0;padding:16px;margin-bottom:22px;font-family:${PREMIUM_FONT}">
        <div style="font-size:12px;color:#D48A29;line-height:1.6">
          Per our cancellation policy, no refund applies. Email ${creamSupportMailtoLink()} with questions.
        </div>
      </div>
    `
    }

    <p style="${EQ_LEAD}">
      We hope to have the opportunity to serve you again. Please email ${creamSupportMailtoLink()} or visit our site whenever you are ready to rebook.
    </p>

    ${ctaButton(d.trackingUrl, "View cancellation details")}
  `);
}

/* ═══════════════════════════════════════════════════════════
   Updated Quote Email
   ═══════════════════════════════════════════════════════════ */

export interface QuoteUpdatedData {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  changesSummary: string;
}

export function quoteUpdatedEmail(d: QuoteUpdatedData): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">${name ? `${name}, your` : "Your"} quote has been updated.</div>
    <p style="${PROMO_CREAM_P};margin:0 0 18px;">We have revised your ${d.serviceLabel.toLowerCase()} quote. A summary of the changes is below.</p>
    <div style="background:${PROMO_CREAM_FILL};padding:${PROMO_CREAM_CALLOUT_PAD};margin:0;border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;">
      <div style="font-size:14px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};line-height:1.65;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${d.changesSummary}</div>
    </div>
    ${equinoxPromoCta(d.quoteUrl, "Review Updated Quote")}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `,
    "quote",
  );
}

/* ═══════════════════════════════════════════════════════════
   Balance Reminder & Auto-Charge Email Templates
   ═══════════════════════════════════════════════════════════ */

export interface BalanceReminder72hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  trackingUrl: string;
}

export function balanceReminder72hrEmail(d: BalanceReminder72hrData): string {
  return emailLayout(`
    <div style="${FOREST_EYEBROW_UPPER}">Balance due</div>
    <h1 style="${EQ_H1}">Remaining balance${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Amount <strong style="color:${EMAIL_FOREST}">${formatCurrencyEmail(d.balanceAmount)}</strong> is due before your move on <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="${EQ_PANEL}">
      <div style="${PANEL_KICKER_ON_WINE_UPPER};margin-bottom:12px">Automatic payment</div>
      <div style="background:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:16px;font-family:${PREMIUM_FONT}">
        <div style="${FOREST_EYEBROW_UPPER};margin-bottom:8px">Card on file</div>
        <div style="font-size:12px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.65">
          We will charge <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${formatCurrencyEmail(d.balanceAmount)}</strong> approximately 48 hours before your move. No action required.
        </div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View move details")}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Questions? Email ${creamSupportMailtoLink()} or call your coordinator.
    </p>
  `);
}

export interface BalanceReminder48hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  ccTotal: number;
  autoChargeDate: string | null;
  paymentPageUrl: string;
  trackingUrl: string;
}

export function balanceReminder48hrEmail(d: BalanceReminder48hrData): string {
  return emailLayout(`
    <div style="${AMBER_EYEBROW_UPPER}">Balance due soon</div>
    <h1 style="${EQ_H1}">${formatCurrencyEmail(d.balanceAmount)} due${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your remaining balance will be charged to the card on file before your move on <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="margin-bottom:22px;font-family:${PREMIUM_FONT}">
      <div style="background:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:22px;text-align:center">
        <div style="${FOREST_EYEBROW_UPPER}margin-bottom:10px;">Scheduled charge</div>
        <div style="font-size:28px;font-weight:700;color:${EMAIL_FOREST};margin-bottom:10px;letter-spacing:0">${formatCurrencyEmail(d.balanceAmount)}</div>
        <div style="font-size:12px;color:${PROMO_CREAM_MUTED};line-height:1.65">
          Charge date: <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${dateDisplay(d.autoChargeDate)}</strong>. No action needed.
        </div>
      </div>
    </div>

    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Questions? Email ${creamSupportMailtoLink()} or call your coordinator.
    </p>
  `);
}

export interface BalanceAutoChargeReceiptData {
  clientName: string;
  moveCode: string;
  baseBalance: number;
  processingFee: number;
  transactionFee: number;
  totalCharged: number;
  trackingUrl: string;
}

export function balanceAutoChargeReceiptEmail(
  d: BalanceAutoChargeReceiptData,
): string {
  return emailLayout(`
    <div style="${SUCCESS_EYEBROW_UPPER}">Payment charged</div>
    <h1 style="${EQ_H1}">Payment received${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your card on file was charged for the remaining balance on move <strong style="color:${EMAIL_FOREST}">${d.moveCode}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:${CONTRACT_TABLE_OUTER};margin-bottom:20px;font-family:${PREMIUM_FONT}">
      <tr>
        <td style="padding:0;background-color:${EQ_CREME_HEAD};">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;width:100%;">
            <tr>
              <td style="${CONTRACT_HDR_SPLIT}">Description</td>
              <td align="right" style="${CONTRACT_HDR_SPLIT}">Amount</td>
            </tr>
          </table>
        </td>
      </tr>
      ${creamContractKvRow("Base balance", formatCurrencyEmail(d.baseBalance), LKV_VALUE, LKV_LABEL)}
      ${creamContractKvRow("Processing fee (3.3%)", formatCurrencyEmail(d.processingFee), LKV_VALUE, LKV_LABEL)}
      ${creamContractKvRow("Transaction fee", formatCurrencyEmail(d.transactionFee), LKV_VALUE, LKV_LABEL)}
      ${emailNestedKvRow({
        borderTop: `1px solid ${CONTRACT_DIVIDER_STRONG}`,
        labelStyle: `${CONTRACT_TOTAL_LABEL};border-top:0;padding:10px 0 10px 14px`,
        valueStyle: `padding:10px 14px 10px 10px;font-size:15px;font-weight:700;color:${EMAIL_FOREST};letter-spacing:0;font-family:${PREMIUM_FONT};text-align:right;vertical-align:middle`,
        label: "Total",
        valueHtml: formatCurrencyEmail(d.totalCharged),
      })}
    </table>

    <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.22);border-radius:0;padding:16px;margin-bottom:22px;text-align:center;font-family:${PREMIUM_FONT}">
      <div style="font-family:${PREMIUM_FONT};font-size:12px;font-weight:700;color:#2D9F5A !important;-webkit-text-fill-color:#2D9F5A;letter-spacing:0px;text-transform:uppercase;">Your account is paid in full.</div>
    </div>

    ${ctaButton(d.trackingUrl, "View move details")}
  `);
}

export interface BalanceChargeFailedClientData {
  clientName: string;
  moveCode: string;
  balanceAmount: number;
}

export function balanceChargeFailedClientEmail(
  d: BalanceChargeFailedClientData,
): string {
  return emailLayout(`
    <div style="${ALERT_EYEBROW_UPPER}">Payment failed</div>
    <div role="heading" aria-level="1" style="${EQ_H1}">Action required${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</div>
    <p style="${EQ_LEAD}">
      We could not charge your card on file for <strong style="color:#D14343">${formatCurrencyEmail(d.balanceAmount)}</strong> (move <strong style="color:${EMAIL_FOREST}">${d.moveCode}</strong>).
    </p>

    <div style="background:rgba(209,67,67,0.08);border:1px solid rgba(209,67,67,0.25);border-radius:0;padding:${PROMO_CREAM_CALLOUT_PAD};margin-bottom:22px;text-align:center;font-family:${PREMIUM_FONT}">
      <div style="font-size:13px;color:#D14343 !important;-webkit-text-fill-color:#D14343;font-weight:600;margin-bottom:8px;line-height:1.35">Please contact us before your move.</div>
      <div style="font-size:15px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:700;letter-spacing:0;line-height:1.3">1-833-333-YUGO (9846)</div>
    </div>

    <p style="font-size:12px;color:${PROMO_CREAM_MUTED};line-height:1.65;text-align:center;font-family:${PREMIUM_FONT}">
      Or email ${creamSupportMailtoLink()}; your coordinator will follow up.
    </p>
  `);
}

export interface BalanceChargeFailedAdminData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  errorMessage: string;
}

export function balanceChargeFailedAdminEmail(
  d: BalanceChargeFailedAdminData,
): string {
  const errHuman = escapeHtmlEmail(
    humanizePaymentProcessorMessage(d.errorMessage),
  );
  const admDiv = `1px solid ${PROMO_CREAM_RULE}`;
  const admLbl = `padding:6px 0 6px 12px;font-size:11px;font-weight:600;line-height:1.35;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};vertical-align:top;text-transform:uppercase;letter-spacing:0.06em;font-family:${PREMIUM_FONT};width:38%`;
  const admVal = `padding:6px 12px 6px 8px;font-size:12px;line-height:1.35;text-align:right;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;vertical-align:top`;
  const admValRed = `padding:6px 12px 6px 8px;font-size:12px;line-height:1.35;text-align:right;color:#D14343 !important;-webkit-text-fill-color:#D14343;font-weight:700;vertical-align:top`;
  return emailLayout(`
    <div style="${ALERT_EYEBROW_UPPER}">Urgent</div>
    <div role="heading" aria-level="1" style="${EQ_H1}">${escapeHtmlEmail(d.moveCode)} — charge failed</div>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.22);border-radius:0;padding:${PROMO_CREAM_CALLOUT_PAD};margin-bottom:16px;font-family:${PREMIUM_FONT}">
      <div style="font-size:12px;color:#D14343 !important;-webkit-text-fill-color:#D14343;font-weight:700;line-height:1.35;text-transform:uppercase;letter-spacing:0.05em">Auto-charge failed — ${formatCurrencyEmail(d.balanceAmount)}</div>
      <div style="font-size:11px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin-top:8px;line-height:1.45"><span style="font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};">Error:</span> ${errHuman}</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid ${PROMO_CREAM_RULE};margin-bottom:16px;font-family:${PREMIUM_FONT}">
      <tr>
        <td style="background-color:${EQ_CREME_HEAD};padding:10px 12px;font-size:12px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};letter-spacing:0.06em;text-transform:uppercase;font-family:${PREMIUM_FONT};">Client</td>
      </tr>
      ${emailNestedKvRow({ borderTop: admDiv, labelStyle: admLbl, valueStyle: admVal, label: "Name", valueHtml: escapeHtmlEmail(d.clientName) })}
      ${emailNestedKvRow({ borderTop: admDiv, labelStyle: admLbl, valueStyle: admVal, label: "Email", valueHtml: wineMailtoAddress(d.clientEmail) })}
      ${emailNestedKvRow({
        borderTop: admDiv,
        labelStyle: admLbl,
        valueStyle: admVal,
        label: "Phone",
        valueHtml: d.clientPhone ? escapeHtmlEmail(formatPhone(d.clientPhone)) : "—",
      })}
      ${emailNestedKvRow({
        borderTop: admDiv,
        labelStyle: admLbl,
        valueStyle: admVal,
        label: "Move date",
        valueHtml: d.moveDate ? escapeHtmlEmail(dateDisplay(d.moveDate)) : "—",
      })}
      ${emailNestedKvRow({
        borderTop: admDiv,
        labelStyle: admLbl,
        valueStyle: admValRed,
        label: "Balance",
        valueHtml: formatCurrencyEmail(d.balanceAmount),
      })}
    </table>

    <div style="background:${EMAIL_FOREST_CALLOUT_BG};border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:${PROMO_CREAM_CALLOUT_PAD};font-family:${PREMIUM_FONT}">
      <div style="${FOREST_EYEBROW_UPPER};margin-bottom:6px">Action required</div>
      <div style="font-size:12px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.45">Contact the client immediately. Move is imminent and balance is unpaid.</div>
    </div>
  `);
}

/* ═══════════════════════════════════════════════════════════
   Partner billing & card lifecycle — use emailLayout (premium shell):
   bare fragments from send.ts were wrapped in a near-black body with unstyled
   <p> tags; Gmail defaulted to dark text, so the message looked like a black slab.
   ═══════════════════════════════════════════════════════════ */

export interface PartnerStatementDueData {
  partnerName: string;
  statementNumber: string;
  amount: number;
  paymentUrl: string;
}

export function partnerStatementDueEmail(d: PartnerStatementDueData): string {
  const amt = Number(d.amount).toFixed(2);
  return emailLayout(
    `
    <div style="${WINE_EYEBROW_UPPER}">Partner billing</div>
    <h1 style="${EQ_H1}">Statement due</h1>
    <p style="${EQ_LEAD}">
      Hi ${firstName(d.partnerName) || d.partnerName}, statement <strong style="color:${EMAIL_FOREST}">${d.statementNumber}</strong> is due: <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${amt} CAD</strong>.
    </p>
    ${ctaButton(d.paymentUrl, "Pay statement")}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Questions? Email ${creamSupportMailtoLink()}.
    </p>
  `,
    undefined,
    "partner",
  );
}

export interface PartnerStatementPaidData {
  partnerName: string;
  statementNumber: string;
  amount: number;
  receiptUrl?: string | null;
}

export function partnerStatementPaidEmail(d: PartnerStatementPaidData): string {
  const amt = Number(d.amount).toFixed(2);
  const receipt = d.receiptUrl ? ctaButton(d.receiptUrl, "View receipt") : "";
  return emailLayout(
    `
    <div style="${SUCCESS_EYEBROW_UPPER}">Payment received</div>
    <h1 style="${EQ_H1}">Statement paid</h1>
    <p style="${EQ_LEAD}">
      Hi ${firstName(d.partnerName) || d.partnerName}, we received payment for statement <strong style="color:${EMAIL_FOREST}">${d.statementNumber}</strong> (<strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${amt} CAD</strong>).
    </p>
    ${receipt}
  `,
    undefined,
    "partner",
  );
}

export interface PartnerStatementChargeFailedData {
  partnerName: string;
  statementNumber: string;
  amount: number;
  errorMessage: string;
}

export function partnerStatementChargeFailedEmail(
  d: PartnerStatementChargeFailedData,
): string {
  const procMsg = escapeHtmlEmail(
    humanizePaymentProcessorMessage(d.errorMessage),
  );
  return emailLayout(
    `
    <div style="${ALERT_EYEBROW_UPPER}">Urgent</div>
    <div role="heading" aria-level="1" style="${EQ_H1}">Partner charge failed</div>
    <p style="${EQ_LEAD}">
      Card declined for <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${escapeHtmlEmail(d.partnerName)}</strong>, statement <strong style="color:${EMAIL_FOREST}">${escapeHtmlEmail(d.statementNumber)}</strong> (<strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${formatCurrencyEmail(d.amount)}</strong>).
    </p>
    <div style="background:rgba(209,67,67,0.08);border:1px solid rgba(209,67,67,0.22);border-radius:0;padding:${PROMO_CREAM_CALLOUT_PAD};margin-bottom:22px;font-family:${PREMIUM_FONT}">
      <div style="${ALERT_EYEBROW_UPPER};margin-bottom:6px">Processor message</div>
      <div style="font-size:12px;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};line-height:1.45">${procMsg}</div>
    </div>
  `,
    undefined,
    "generic",
  );
}

export interface PartnerStatementChargeFailedPartnerData {
  partnerName: string;
  statementNumber: string;
  amount: number;
  updateCardUrl: string;
}

export function partnerStatementChargeFailedPartnerEmail(
  d: PartnerStatementChargeFailedPartnerData,
): string {
  const amt = Number(d.amount).toFixed(2);
  return emailLayout(
    `
    <div style="${ALERT_EYEBROW_UPPER}">Payment failed</div>
    <div role="heading" aria-level="1" style="${EQ_H1}">Update your card${firstName(d.partnerName) ? `, ${firstName(d.partnerName)}` : ""}</div>
    <p style="${EQ_LEAD}">
      We could not charge the card on file for statement <strong style="color:${EMAIL_FOREST}">${d.statementNumber}</strong> (<strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${amt} CAD</strong>).
    </p>
    ${ctaButton(d.updateCardUrl, "Update payment method")}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Updating your card restores automatic billing for future statements.
    </p>
  `,
    undefined,
    "partner",
  );
}

export interface PartnerCardExpiringData {
  partnerName: string;
  cardBrand: string;
  cardLastFour: string;
  updateCardUrl: string;
}

export function partnerCardExpiringEmail(d: PartnerCardExpiringData): string {
  return emailLayout(
    `
    <div style="${AMBER_EYEBROW_UPPER}">Payment method</div>
    <h1 style="${EQ_H1}">Card expiring soon</h1>
    <p style="${EQ_LEAD}">
      Hi ${firstName(d.partnerName) || d.partnerName}, your <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${d.cardBrand} ending in ${d.cardLastFour}</strong> on file for partner billing expires soon.
    </p>
    <div style="${EQ_PANEL}">
      <div style="${PANEL_KICKER_ON_WINE_UPPER}">Why update now</div>
      <div style="font-size:12px;color:${EQ_ON_WINE_PANEL};line-height:1.65">
        Automatic statement charges use this card. An expired card can delay payouts and require manual follow-up.
      </div>
    </div>
    ${ctaButton(d.updateCardUrl, "Update card on file")}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      ${creamSupportMailtoLink()} · Partner billing
    </p>
  `,
    undefined,
    "partner",
  );
}

export interface AdminCardExpiringNoticeData {
  entityType: "partner" | "client";
  entityName: string;
  cardLastFour: string;
  updateCardUrl: string;
}

export function adminCardExpiringNoticeEmail(
  d: AdminCardExpiringNoticeData,
): string {
  const label = d.entityType === "partner" ? "Partner" : "Client";
  return emailLayout(
    `
    <div style="${WINE_EYEBROW_UPPER}">Admin</div>
    <h1 style="${EQ_H1}">Card expiring soon</h1>
    <p style="${EQ_LEAD}">
      ${label} <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${d.entityName}</strong> has a card ending in <strong style="color:${EMAIL_FOREST}">${d.cardLastFour}</strong> expiring soon.
    </p>
    ${ctaButton(d.updateCardUrl, "Open profile")}
  `,
    undefined,
    "generic",
  );
}

export interface ClientCardExpiringData {
  clientName: string;
  moveCode: string | null | undefined;
  updateCardUrl: string;
}

export function clientCardExpiringEmail(d: ClientCardExpiringData): string {
  const ref = (d.moveCode && String(d.moveCode).trim()) || "your move";
  return emailLayout(`
    <div style="${AMBER_EYEBROW_UPPER}">Payment method</div>
    <h1 style="${EQ_H1}">Your card expires soon${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      The card on file for <strong style="color:${EMAIL_FOREST}">${ref}</strong> expires before we can charge your remaining balance. Update it so payment runs on schedule.
    </p>
    <div style="${EQ_PANEL}">
      <div style="${PANEL_KICKER_ON_WINE_UPPER}">Automatic balance charge</div>
      <div style="font-size:12px;color:${EQ_ON_WINE_PANEL};line-height:1.65">
        We charge the remaining balance to the card on file before move day. An expired card may delay service until billing is resolved.
      </div>
    </div>
    ${ctaButton(d.updateCardUrl, PREMIUM_TRACK_CTA_LABEL)}
    <p style="font-size:11px;color:${PROMO_CREAM_MUTED};text-align:center;font-family:${PREMIUM_FONT}">
      Use your move portal from the button above, or email ${creamSupportMailtoLink()} for help.
    </p>
  `);
}

export function quoteFollowup3Email(d: QuoteFollowup3Data): string {
  const name = firstName(d.clientName);
  const isHot = (d as QuoteFollowup3Data & { tier?: string }).tier === "hot";
  const expiryDisplay = d.expiresAt ? dateDisplay(d.expiresAt) : null;
  const heading = isHot
    ? name
      ? `${name}, pick up where you left off.`
      : "Pick up where you left off."
    : name
      ? `${name}, your quote is expiring soon.`
      : "Your quote is expiring soon.";
  const body = isHot
    ? "Your quote is still active. Complete your booking whenever you are ready and your date will be secured."
    : `Your ${d.serviceLabel.toLowerCase()} quote ${expiryDisplay ? `expires <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${expiryDisplay}</strong>` : "is expiring soon"}. After that, we will need to refresh your rate based on availability.`;

  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">${heading}</div>
    <p style="${PROMO_CREAM_P}">${body}</p>
    ${equinoxPromoCta(d.quoteUrl, isHot ? "Complete Booking" : "View Your Quote")}
    ${equinoxPromoFinePrint(`Need more time? Email <a href="mailto:${getClientSupportEmail()}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${getClientSupportEmail()}</a> and we will be happy to help.`)}
  `,
    "quote",
  );
}

/* ── Post-move: 72hr Perks & Referral Email ── */

export interface PostMovePerksEmailData {
  clientName: string;
  moveCode: string;
  referralCode: string | null;
  referredDiscount: number;
  referrerCredit: number;
  trackingUrl: string;
  activePerks: {
    title: string;
    description: string | null;
    offer_type: string;
    discount_value: number | null;
    redemption_code: string | null;
    redemption_url: string | null;
  }[];
}

export function postMovePerksEmail(d: PostMovePerksEmailData): string {
  const name = firstName(d.clientName);

  const perksHtml =
    d.activePerks.length > 0
      ? d.activePerks
          .map((p) => {
            const offerLabel =
              p.offer_type === "percentage_off" && p.discount_value
                ? `${p.discount_value}% off`
                : p.offer_type === "dollar_off" && p.discount_value
                  ? `$${p.discount_value} off`
                  : p.offer_type === "free_service"
                    ? "Free service"
                    : p.offer_type === "consultation"
                      ? "Free consultation"
                      : "Special offer";
            return `
          <div style="border-top:1px solid ${PROMO_CREAM_RULE};padding:16px 0;">
            <div style="font-size:13px;font-weight:600;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin-bottom:4px;text-transform:capitalize;">${escapeHtmlEmail(p.title)} <span style="font-size:10px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};font-weight:400;text-transform:none;">— ${offerLabel}</span></div>
            ${p.description ? `<div style="font-size:13px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin-bottom:8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${escapeHtmlEmail(p.description)}</div>` : ""}
            ${p.redemption_code ? `<span style="font-family:monospace;font-size:12px;font-weight:700;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};letter-spacing:0;">${escapeHtmlEmail(p.redemption_code)}</span>` : ""}
            ${p.redemption_url ? `<a href="${hrefAttr(p.redemption_url)}" style="font-size:11px;font-weight:700;color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin-left:${p.redemption_code ? "12px" : "0"};letter-spacing:0.08em;text-transform:uppercase;">REDEEM</a>` : ""}
          </div>
        `;
          })
          .join("")
      : "";

  const referralBlock = d.referralCode
    ? `
      <p style="font-size:15px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};line-height:1.6;margin:28px 0 8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Know someone planning a move? Share your code and they receive <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${d.referredDiscount} off</strong>. You earn a <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${d.referrerCredit} credit</strong> as our thank you.</p>
      <div style="border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:20px;text-align:center;margin-bottom:8px;background:${PROMO_CREAM_FILL};">
        <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};">${d.referralCode}</div>
        <div style="font-size:11px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin-top:6px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Your referral code</div>
      </div>
    `
    : "";

  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">${name ? `${name}, your` : "Your"} move is complete.</div>
    <p style="${PROMO_CREAM_P}">Thank you for trusting Yugo with your home. Your exclusive post-move perks are waiting below.</p>
    ${perksHtml ? `<div style="margin-top:8px;">${perksHtml}</div>` : ""}
    ${referralBlock}
    ${equinoxPromoCta(d.trackingUrl, "View Move Summary")}
  `,
    "booking",
  );
}

/* ── Post-move: 365-day Anniversary Email ── */

export interface MoveAnniversaryEmailData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  referralCode: string | null;
  referredDiscount: number;
}

export function moveAnniversaryEmail(d: MoveAnniversaryEmailData): string {
  const name = firstName(d.clientName);
  const moveDateStr = d.moveDate
    ? new Date(d.moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "last year";
  const route =
    d.fromAddress && d.toAddress
      ? ` from ${d.fromAddress.split(",")[0]} to ${d.toAddress.split(",")[0]}`
      : "";

  return equinoxPromoLayout(
    `
    <div role="heading" aria-level="1" style="${PROMO_CREAM_H1}">One year${name ? `, ${name}` : ""}.</div>
    <p style="${PROMO_CREAM_P}">We had the pleasure of moving you${route} on <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">${moveDateStr}</strong>. We hope you have settled in beautifully.</p>
    ${
      d.referralCode
        ? `
      <p style="${PROMO_CREAM_P};margin:28px 0 8px;">Planning another move, or know someone who is? Your referral code gives them <strong style="color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};font-weight:600;">$${d.referredDiscount} off</strong>.</p>
      <div style="border:1px solid ${EMAIL_FOREST_CALLOUT_BORDER};border-top:2px solid ${EMAIL_FOREST};border-radius:0;padding:20px;text-align:center;background:${PROMO_CREAM_FILL};">
        <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0;color:${PROMO_CREAM_BODY} !important;-webkit-text-fill-color:${PROMO_CREAM_BODY};">${d.referralCode}</div>
        <div style="font-size:11px;color:${PROMO_CREAM_MUTED} !important;-webkit-text-fill-color:${PROMO_CREAM_MUTED};margin-top:6px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;">Your referral code</div>
      </div>
    `
        : ""
    }
    ${equinoxPromoFinePrint(`Planning your next move? Email <a href="mailto:${getClientSupportEmail()}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;">${getClientSupportEmail()}</a> and we would be glad to help.`)}
  `,
    "booking",
  );
}
