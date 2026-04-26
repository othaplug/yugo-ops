import { getClientEmailFooterTrs } from "@/lib/email/client-email-footer";
import {
  EMAIL_SANS_STACK,
  EMAIL_FOREST,
  EMAIL_FOREST_RULE,
  EMAIL_PREMIUM_ISLAND,
  EMAIL_PREMIUM_PAGE,
  EMAIL_PREMIUM_TABLE_HEAD,
  EMAIL_WINE,
  EMAIL_QUOTE_EXPIRY_BG,
  EMAIL_QUOTE_EXPIRY_BORDER,
  EMAIL_QUOTE_EXPIRY_TEXT,
  EMAIL_TIER_BODY_TEXT,
  EMAIL_TIER_ESTATE_ACCENT,
  EMAIL_TIER_ESTATE_BG,
  EMAIL_TIER_ESSENTIAL_BG,
  EMAIL_TIER_ESSENTIAL_BORDER,
  EMAIL_TIER_INK,
  EMAIL_TIER_ON_DARK,
  EMAIL_TIER_SIGNATURE_BG,
  EMAIL_TIER_SIGNATURE_BORDER_MUTED,
  emailPrimaryCtaStyle,
} from "@/lib/email/email-brand-tokens";
import { emailNestedKvRow } from "@/lib/email/email-kv-layout";
import { emailMapLinkHtml, escapeHtmlEmail } from "@/lib/email/email-link-utils";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import {
  EMAIL_LOGO_BLACK_W,
  EMAIL_LOGO_BLACK_H,
  getEmailLogoWineUrl,
} from "@/lib/email-templates";
import {
  EMAIL_FLUID_MAX_WIDTH_PX,
  getEmailResponsiveCss,
  getOutlookMsoHeadBlock,
  wrapOutlookFluidHybridInner,
} from "@/lib/email/email-responsive-css";
import { formatCurrencyEmail } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import {
  TIER_LABELS as DISPLAY_TIER_LABELS,
  displayLabel,
} from "@/lib/displayLabels";
import {
  getB2BQuoteEmailSubheading,
  quoteEmailCrewLine,
} from "@/lib/quotes/b2b-quote-copy";

/* Typography: hero = Instrument Serif + Georgia; light cream shell + wine wordmark (readable in light & dark mail clients). */
/* ─── Light shell (main quote letter — wine logo, WCAG-friendly on cream) ─── */
const SHELL_PAGE = EMAIL_PREMIUM_PAGE;
/** Warm cream card face — matches web quote islands. */
const SHELL_INNER = EMAIL_PREMIUM_ISLAND;
const SHELL_BORDER = EMAIL_FOREST_RULE;
const SHELL_TX = "#2A2523";
const SHELL_TX2 = "#3E4D40";
const SHELL_TX3 = "#5A6B5E";
/** Wine kicker on cream (was illegible light grey on white / inverted clients). */
const SHELL_EYEBROW = `font-family:${EMAIL_SANS_STACK};font-size:12px;font-weight:700;color:${EMAIL_WINE};letter-spacing:0.08em;text-transform:uppercase;`;

/* ─── Wine inset cards (labour/bin/price blocks on cream page) ─── */
const CARD = EMAIL_WINE;
const ACCENT_CREAM = "#EDE6DC";
const ACCENT_OFF_WHITE = "#F5F0E8";
const ACCENT_ROSE = "#D4AAB5";
const ACCENT_ROSE_MUTED = "#B88998";
const DARK_TX = "#F0EDE8";
const DARK_TX2 = "#A8A29C";
const DARK_TX3 = "#8A8580";
/** Near-black for small UI on tier badges (text on accent). */
const PAGE_INK = "#0A0A0A";

/** Kicker on dark inset cards only. */
const DARK_CARD_EYEBROW = `font-family:${EMAIL_SANS_STACK};font-size:12px;font-weight:700;color:${ACCENT_CREAM};letter-spacing:0px;text-transform:uppercase;`;

const EMAIL_TIER_LABELS: Record<string, string> = { ...DISPLAY_TIER_LABELS };

const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
  partial: "Partial Move",
};

function formatMoveSize(raw: string | null | undefined): string {
  if (!raw) return "";
  return MOVE_SIZE_LABELS[raw] ?? displayLabel(raw);
}

/* ─── Shared layout wrapper ─── */

const INSTRUMENT_SERIF_LINK =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";

/* Embedded @font-face so Instrument Serif loads in clients that block external stylesheets (e.g. Gmail). */
const INSTRUMENT_SERIF_FACE = `
@font-face {
  font-family: 'Instrument Serif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjnTLgNs.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: 'Instrument Serif';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/instrumentserif/v5/jizHRFtNs2ka5fXjeivQ4LroWlx-6zAjjH7Motmp5g.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`;

function quoteEmailLayout(innerHtml: string): string {
  const logoUrl = getEmailLogoWineUrl();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="color-scheme" content="only light" />
  <meta name="supported-color-schemes" content="light" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">
    ${INSTRUMENT_SERIF_FACE}
    :root, html { color-scheme: only light; }
    .yugo-quote-body { color-scheme: only light; }
    /* Apple Mail / iOS “dark” mail view — lock surfaces to our light palette (no auto-invert). */
    @media (prefers-color-scheme: dark) {
      .yugo-quote-body {
        background-color: ${SHELL_PAGE} !important;
        color: ${SHELL_TX} !important;
        -webkit-text-fill-color: ${SHELL_TX} !important;
      }
      table.yugo-quote-page { background-color: ${SHELL_PAGE} !important; }
      table.yugo-quote-page > tbody > tr > td { background-color: ${SHELL_PAGE} !important; }
      table.yugo-quote-card,
      table.yugo-quote-card > tbody > tr > td { background-color: ${SHELL_INNER} !important; }
      td.eq-inner {
        background-color: ${SHELL_INNER} !important;
        color: ${SHELL_TX} !important;
        -webkit-text-fill-color: ${SHELL_TX} !important;
      }
      td.yugo-quote-expiry-bar {
        background-color: ${EMAIL_QUOTE_EXPIRY_BG} !important;
        border-top: 1px solid ${EMAIL_QUOTE_EXPIRY_BORDER} !important;
        border-bottom: 1px solid ${EMAIL_QUOTE_EXPIRY_BORDER} !important;
      }
      td.yugo-tier-es {
        background-color: ${EMAIL_TIER_ESSENTIAL_BG} !important;
      }
      td.yugo-tier-sig {
        background-color: ${EMAIL_TIER_SIGNATURE_BG} !important;
      }
      td.yugo-tier-est {
        background-color: ${EMAIL_TIER_ESTATE_BG} !important;
      }
      .yugo-quote-body img,
      table.yugo-quote-page img {
        filter: none !important;
        -webkit-filter: none !important;
      }
    }
    ${getEmailResponsiveCss()}
  </style>
  ${getOutlookMsoHeadBlock()}
</head>
<body class="yugo-quote-body" style="margin:0;padding:0;background-color:${SHELL_PAGE};color:${SHELL_TX};-webkit-text-fill-color:${SHELL_TX};color-scheme:only light;">
${wrapOutlookFluidHybridInner(
  `
<table class="yugo-quote-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${SHELL_PAGE}" style="background-color:${SHELL_PAGE};color-scheme:only light;">
  <tr>
    <td class="email-outer-gutter" align="center" bgcolor="${SHELL_PAGE}" style="padding:24px 16px 0;background-color:${SHELL_PAGE};color-scheme:only light;">
      <table class="yugo-quote-card email-fluid-inner" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" bgcolor="${SHELL_INNER}" style="max-width:600px;width:100%;background-color:${SHELL_INNER};border:1px solid ${SHELL_BORDER};color-scheme:only light;">
        <tr>
          <td class="eq-inner email-content-pad" bgcolor="${SHELL_INNER}" style="padding:32px 36px 40px;background-color:${SHELL_INNER};color:${SHELL_TX};-webkit-text-fill-color:${SHELL_TX};font-family:${EMAIL_SANS_STACK};color-scheme:only light;">
            <div class="eq-hdr" align="center" style="margin:0 0 20px;">
              <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_BLACK_W}" height="${EMAIL_LOGO_BLACK_H}" style="display:block;max-width:${EMAIL_LOGO_BLACK_W}px;height:auto;border:0;margin:0 auto;-webkit-filter:none !important;filter:none !important;" />
            </div>
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${getClientEmailFooterTrs({
    whyReceiving: "quote",
    spacerBackground: SHELL_PAGE,
  })}
</table>
`,
  EMAIL_FLUID_MAX_WIDTH_PX,
  SHELL_PAGE,
)}
</body>
</html>`;
}

/* ─── Types ─── */

export interface QuoteTier {
  label: string;
  price: number;
  includes: string[];
}

export interface QuoteTemplateData {
  clientName: string;
  quoteId: string;
  quoteUrl: string;
  serviceType: string;
  expiresAt?: string | null;
  fromAddress?: string;
  toAddress?: string;
  fromAccess?: string | null;
  toAccess?: string | null;
  /** Multi-stop pickup / drop-off (from quote factors); when multiple, email shows every stop. */
  pickupLocations?: { address: string; access?: string | null }[];
  dropoffLocations?: { address: string; access?: string | null }[];
  moveDate?: string | null;
  moveSize?: string | null;
  companyName?: string | null;
  itemDescription?: string | null;
  itemCategory?: string | null;
  projectType?: string | null;
  distance?: string | null;
  /** Crew size (e.g. 3 movers) for residential/long distance */
  estCrewSize?: number | null;
  /** Estimated hours for the move */
  estHours?: number | null;
  /** Truck size label when available (e.g. 20ft truck) */
  truckSize?: string | null;
  tiers?: Record<string, QuoteTier> | null;
  customPrice?: number | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  recommendedTier?: string | null;
  // Event
  eventName?: string | null;
  eventReturnDate?: string | null;
  eventDeliveryCharge?: number | null;
  eventSetupFee?: number | null;
  eventReturnCharge?: number | null;
  /** Per-leg rows for multi-event emails */
  eventLegBlocks?: {
    label: string;
    deliveryDay: string;
    returnDay: string;
    origin: string;
    venue: string;
    crewLine: string;
    delivery: number;
    ret: number;
    legSubtotal: number;
  }[];
  eventDeposit?: number | null;
  // Labour Only
  labourCrewSize?: number | null;
  labourHours?: number | null;
  labourRate?: number | null;
  labourVisits?: number | null;
  labourDescription?: string | null;
  // B2B One-Off
  b2bBusinessName?: string | null;
  b2bItems?: string | null;
  b2bVerticalCode?: string | null;
  /** Matches `factors_applied.b2b_handling_type` for commercial quote emails. */
  b2bHandlingType?: string | null;
  // Bin rental
  binBundleLabel?: string | null;
  binDropOffDate?: string | null;
  binPickupDate?: string | null;
  binMoveDate?: string | null;
  binDeliveryAddress?: string | null;
  binPickupAddress?: string | null;
  binLineItems?: { label: string; amount: number }[] | null;
  binSubtotal?: number | null;
  binTax?: number | null;
  binGrandTotal?: number | null;
  /** Bullet lines for bin rental "what's included" */
  binIncludeLines?: string[] | null;
}

/* ─── Building blocks ─── */

function dateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "To be confirmed";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function expiryNote(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  const formatted = d.toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const textStyle = `font-size:13px;color:${EMAIL_QUOTE_EXPIRY_TEXT} !important;-webkit-text-fill-color:${EMAIL_QUOTE_EXPIRY_TEXT};font-weight:600;line-height:1.55;`;
  const boxStyle = `background-color:${EMAIL_QUOTE_EXPIRY_BG};border-top:1px solid ${EMAIL_QUOTE_EXPIRY_BORDER};border-bottom:1px solid ${EMAIL_QUOTE_EXPIRY_BORDER};padding:14px 16px;`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
      <tr>
        <td align="center" style="padding:0 8px;">
          <table cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:400px;width:88%;margin:0 auto;" role="presentation">
            <tr>
              <td class="yugo-quote-expiry-bar" style="${boxStyle}">
                <span style="${textStyle}">This quote expires on ${formatted}. Book now to secure your rate.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function ctaButton(url: string, label: string, sub?: string): string {
  const font = EMAIL_SANS_STACK;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 8px;">
      <tr>
        <td align="center">
          <a href="${url}" style="${emailPrimaryCtaStyle(font, "block")}">${label.toUpperCase()}</a>
        </td>
      </tr>
    </table>
    <p style="font-size:10px;color:${SHELL_TX3};text-align:center;margin:0 0 24px;letter-spacing:0.02em;">${sub ?? "Booking takes less than two minutes"}</p>
  `;
}

function whyYugoBlock(): string {
  const items = [
    [
      "Transparent flat-rate pricing",
      "clear scope with nothing added on the day",
    ],
    [
      "Real-time tracking",
      "follow your crew from your phone, every step of the way",
    ],
    [
      "Dedicated coordinator",
      "a single point of contact from booking through the final placement",
    ],
    [
      "Fully insured",
      "WSIB coverage, $2M General Liability, and comprehensive cargo insurance",
    ],
  ];
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;border-top:1px solid ${SHELL_BORDER};">
      <tr>
        <td style="padding-top:22px;">
          <div style="${SHELL_EYEBROW}margin-bottom:12px;">The Yugo difference</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${items
              .map(
                ([strong, rest]) => `
              <tr>
                <td style="padding:6px 0;font-size:10px;color:${EMAIL_WINE};vertical-align:top;width:18px;line-height:1.6;">—</td>
                <td style="padding:6px 0;font-size:12px;color:${SHELL_TX2};line-height:1.6;"><strong style="color:${SHELL_TX};font-weight:600;">${strong}</strong> - ${rest}</td>
              </tr>
            `,
              )
              .join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function questionsFooter(
  coordinatorName?: string | null,
  coordinatorPhone?: string | null,
): string {
  const support = getClientSupportEmail();
  const supportLink = `<a href="mailto:${encodeURIComponent(support)}" style="color:${EMAIL_FOREST} !important;-webkit-text-fill-color:${EMAIL_FOREST};text-decoration:underline;font-weight:600;">${escapeHtmlEmail(support)}</a>`;
  const contact = coordinatorName
    ? `Your coordinator ${escapeHtmlEmail(coordinatorName ?? "")} is available${coordinatorPhone ? ` at ${escapeHtmlEmail(coordinatorPhone)}` : ""} or by email at ${supportLink}.`
    : `Email us at ${supportLink} and we will get back to you within a few hours.`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid ${SHELL_BORDER};">
      <tr>
        <td style="padding-top:18px;">
          <p style="font-size:12px;color:${SHELL_TX2};line-height:1.7;margin:0;"><strong style="color:${SHELL_TX};font-weight:600;">We are here to help.</strong> ${contact}</p>
        </td>
      </tr>
    </table>
  `;
}

function detailRow(label: string, valueHtml: string, last = false): string {
  const border = last ? "" : `border-bottom:1px solid ${SHELL_BORDER};`;
  return `
    <tr>
      <td style="padding:0;${border}">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;width:100%;">
          <tr>
            <td style="color:${SHELL_TX3};padding:7px 0;font-size:11px;vertical-align:top;line-height:1.5;width:38%;text-transform:uppercase;letter-spacing:0.07em;">${label}</td>
            <td style="color:${SHELL_TX};font-weight:600;padding:7px 0;text-align:right;font-size:12px;line-height:1.5;vertical-align:top;">${valueHtml}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

/** Move details as a plain table — no card/div wrapper, details just lay on the page */
function detailsPlain(rows: [string, string][]): string {
  if (rows.length === 0) return "";
  return `
    <div style="${SHELL_EYEBROW}margin-bottom:10px;">Move details</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${SHELL_BORDER};margin-bottom:28px;">
      ${rows.map(([l, v], i) => detailRow(l, v, i === rows.length - 1)).join("")}
    </table>
  `;
}

function tierCards(
  tiers: Record<string, QuoteTier>,
  quoteUrl: string,
  recommendedTier?: string | null,
): string {
  const order = ["essential", "signature", "estate"];
  const rec = recommendedTier || "signature";

  const tierCellClass: Record<string, string> = {
    essential: "yugo-tier-es",
    signature: "yugo-tier-sig",
    estate: "yugo-tier-est",
  };

  const badgeLabels: Record<string, Record<string, string>> = {
    essential: {
      essential: "",
      signature: "Upgrade available",
      estate: "Premium option",
    },
    signature: {
      essential: "",
      signature: "RECOMMENDED",
      estate: "For the ultimate experience",
    },
    estate: { essential: "", signature: "", estate: "RECOMMENDED FOR YOU" },
  };

  const titleBase = `font-family:${EMAIL_SANS_STACK};font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px;`;

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t = tiers[key];
      const label = EMAIL_TIER_LABELS[key] ?? t.label ?? key;
      const isRec = key === rec;
      const badgeText = badgeLabels[rec]?.[key] ?? "";
      const padVal = isRec ? "24px 22px" : "16px 18px";
      const priceSz = isRec ? "34px" : "22px";
      const cellClass = tierCellClass[key] ?? "yugo-tier-es";

      let cardBg = EMAIL_TIER_ESSENTIAL_BG;
      let borderStyle = "";
      let titleColor = EMAIL_FOREST;
      let priceColor = EMAIL_TIER_INK;
      let priceFill = EMAIL_TIER_INK;
      let bulletColor = EMAIL_FOREST;
      let lineColor = EMAIL_TIER_BODY_TEXT;
      let badgeRecBg = EMAIL_FOREST;
      let badgeRecFg = "#FFFFFF";
      let badgeMutedBg = "rgba(44,62,45,0.08)";
      let badgeMutedFg = SHELL_TX3;

      if (key === "signature") {
        cardBg = EMAIL_TIER_SIGNATURE_BG;
        borderStyle = isRec
          ? `2px solid ${EMAIL_WINE}`
          : `1px solid ${EMAIL_TIER_SIGNATURE_BORDER_MUTED}`;
        titleColor = EMAIL_WINE;
        priceColor = EMAIL_WINE;
        priceFill = EMAIL_WINE;
        bulletColor = EMAIL_WINE;
        lineColor = EMAIL_TIER_BODY_TEXT;
        badgeRecBg = EMAIL_WINE;
        badgeRecFg = "#FFFFFF";
        badgeMutedBg = "rgba(92,26,51,0.08)";
        badgeMutedFg = EMAIL_WINE;
      } else if (key === "estate") {
        cardBg = EMAIL_TIER_ESTATE_BG;
        borderStyle = isRec
          ? `2px solid ${EMAIL_TIER_ESTATE_ACCENT}`
          : `1px solid rgba(232,196,208,0.35)`;
        titleColor = EMAIL_TIER_ESTATE_ACCENT;
        priceColor = EMAIL_TIER_ON_DARK;
        priceFill = EMAIL_TIER_ON_DARK;
        bulletColor = EMAIL_TIER_ESTATE_ACCENT;
        lineColor = "rgba(245,238,230,0.92)";
        badgeRecBg = EMAIL_TIER_ESTATE_ACCENT;
        badgeRecFg = PAGE_INK;
        badgeMutedBg = "rgba(255,255,255,0.12)";
        badgeMutedFg = "rgba(245,238,230,0.85)";
      } else {
        borderStyle = isRec
          ? `2px solid ${EMAIL_FOREST}`
          : `1px solid ${EMAIL_TIER_ESSENTIAL_BORDER}`;
      }

      const badge = badgeText
        ? `<span style="display:inline-block;padding:2px 9px;font-size:7px;font-weight:700;background-color:${isRec ? badgeRecBg : badgeMutedBg};color:${isRec ? badgeRecFg : badgeMutedFg};margin-left:8px;letter-spacing:0.5px;text-transform:uppercase;vertical-align:middle;">${badgeText}</span>`
        : "";

      const includesRows = isRec
        ? (t.includes || [])
            .filter(Boolean)
            .map(
              (item) =>
                `<tr><td style="color:${bulletColor} !important;-webkit-text-fill-color:${bulletColor};font-size:10px;padding:4px 0;vertical-align:top;width:16px;line-height:1.5;">—</td><td style="color:${lineColor} !important;-webkit-text-fill-color:${lineColor};font-size:11px;padding:4px 0;line-height:1.5;">${item}</td></tr>`,
            )
            .join("")
        : "";

      const cardContent = `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${cardBg};border:${borderStyle};margin-bottom:12px;">
          <tr>
            <td class="${cellClass}" style="padding:${padVal};background-color:${cardBg};">
              <div style="${titleBase}color:${titleColor} !important;-webkit-text-fill-color:${titleColor};">${label}${badge}</div>
              <div style="font-family:${HERO_FONT};font-size:${priceSz};font-weight:400;color:${priceColor} !important;-webkit-text-fill-color:${priceFill};line-height:1;margin-bottom:${isRec ? "16px" : "4px"};">${formatCurrencyEmail(t.price)}</div>
              ${includesRows ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:4px;">${includesRows}</table>` : ""}
            </td>
          </tr>
        </table>
      `;

      return `<a href="${quoteUrl}" style="display:block;text-decoration:none;color:inherit;">${cardContent}</a>`;
    })
    .join("");
}

function estateRecommendationNote(
  recommendedTier: string | null | undefined,
): string {
  if (recommendedTier !== "estate") return "";
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
      <tr>
        <td class="yugo-tier-est" style="background-color:${EMAIL_TIER_ESTATE_BG};border-top:2px solid ${EMAIL_TIER_ESTATE_ACCENT};padding:12px 16px;">
          <span style="font-size:12px;color:rgba(245,238,230,0.9) !important;-webkit-text-fill-color:rgba(245,238,230,0.9);line-height:1.6;">Based on your home and belongings, we recommend our <strong style="color:${EMAIL_TIER_ON_DARK} !important;-webkit-text-fill-color:${EMAIL_TIER_ON_DARK};">Estate</strong> package for complete peace of mind.</span>
        </td>
      </tr>
    </table>
  `;
}

function priceCard(label: string, price: number, note: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:28px;">
      <tr>
        <td align="center" style="background-color:${CARD};border:1px solid ${ACCENT_ROSE_MUTED}55;padding:24px 22px;">
          <div style="${DARK_CARD_EYEBROW}margin-bottom:10px;">${label}</div>
          <div style="font-family:${HERO_FONT};font-size:36px;font-weight:400;color:${ACCENT_OFF_WHITE};line-height:1;letter-spacing:0;">${formatCurrencyEmail(price)}</div>
          <div style="font-size:11px;color:${DARK_TX3};margin-top:8px;letter-spacing:0.04em;text-transform:uppercase;">${note}</div>
        </td>
      </tr>
    </table>
  `;
}

function coordinatorBlock(name?: string | null, phone?: string | null): string {
  if (!name) return "";
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 24px;border-top:1px solid ${SHELL_BORDER};">
      <tr>
        <td style="padding-top:16px;">
          <div style="${SHELL_EYEBROW}margin-bottom:8px;">Your coordinator</div>
          <div style="font-size:14px;color:${SHELL_TX};font-weight:600;">${name}</div>
          ${phone ? `<div style="font-size:12px;color:${SHELL_TX2};margin-top:3px;">${phone}</div>` : ""}
        </td>
      </tr>
    </table>
  `;
}

const HERO_FONT = "'Instrument Serif', Georgia, 'Times New Roman', serif";

function heading(text: string): string {
  return `<h1 style="font-family:${HERO_FONT};font-size:30px;font-weight:400;margin:0 0 14px;color:${SHELL_TX};line-height:1.25;letter-spacing:0;">${text}</h1>`;
}

function subHeading(text: string): string {
  return `<div style="${SHELL_EYEBROW}margin:0 0 12px;">${text}</div>`;
}

function bodyText(text: string): string {
  return `<p style="font-size:13px;color:${SHELL_TX2};line-height:1.75;margin:0 0 28px;">${text}</p>`;
}

/**
 * Address rows with access immediately after each stop. Falls back to a lone
 * "Access" row when access exists but the corresponding address is missing.
 */
function addressRowsWithAccess(
  fromLabel: string,
  fromAddress: string | undefined,
  fromAccess: string | null | undefined,
  toLabel: string,
  toAddress: string | undefined,
  toAccess: string | null | undefined,
): [string, string][] {
  const rows: [string, string][] = [];
  const fa = formatAccessForDisplay(fromAccess);
  const ta = formatAccessForDisplay(toAccess);

  if (fromAddress) {
    rows.push([fromLabel, emailMapLinkHtml(fromAddress)]);
    if (fa) rows.push(["Access", fa]);
  } else if (fa) {
    rows.push(["Access", fa]);
  }

  if (toAddress) {
    rows.push([toLabel, emailMapLinkHtml(toAddress)]);
    if (ta) rows.push(["Access", ta]);
  } else if (ta) {
    rows.push(["Access", ta]);
  }

  return rows;
}

/* ─── Templates ─── */

/* Residential (3-tier) */
function residentialTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  const pickups = Array.isArray(d.pickupLocations)
    ? d.pickupLocations.filter((p) => p.address?.trim())
    : [];
  const dropoffs = Array.isArray(d.dropoffLocations)
    ? d.dropoffLocations.filter((p) => p.address?.trim())
    : [];
  if (pickups.length > 1 || dropoffs.length > 1) {
    pickups.forEach((p, i) => {
      const label = pickups.length > 1 ? `Pickup ${i + 1}` : "From";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffs.forEach((p, i) => {
      const label = dropoffs.length > 1 ? `Destination ${i + 1}` : "To";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(
      ...addressRowsWithAccess(
        "From",
        d.fromAddress,
        d.fromAccess,
        "To",
        d.toAddress,
        d.toAccess,
      ),
    );
  }
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0)
    rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  return quoteEmailLayout(`
    ${subHeading("Your Moving Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("We have prepared three flat-rate service options tailored to your move. Every package includes professional movers, a dedicated truck, and full protection. Choose the level of care that suits you best.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${d.tiers ? tierCards(d.tiers, d.quoteUrl, d.recommendedTier) : ""}
    ${estateRecommendationNote(d.recommendedTier)}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
    ${whyYugoBlock()}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Long Distance */
function longDistanceTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  const pickups = Array.isArray(d.pickupLocations)
    ? d.pickupLocations.filter((p) => p.address?.trim())
    : [];
  const dropoffs = Array.isArray(d.dropoffLocations)
    ? d.dropoffLocations.filter((p) => p.address?.trim())
    : [];
  if (pickups.length > 1 || dropoffs.length > 1) {
    pickups.forEach((p, i) => {
      const label = pickups.length > 1 ? `Pickup ${i + 1}` : "Origin";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffs.forEach((p, i) => {
      const label =
        dropoffs.length > 1 ? `Destination ${i + 1}` : "Destination";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(
      ...addressRowsWithAccess(
        "Origin",
        d.fromAddress,
        d.fromAccess,
        "Destination",
        d.toAddress,
        d.toAccess,
      ),
    );
  }
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0)
    rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  const price =
    d.customPrice ??
    d.tiers?.essential?.price ??
    d.tiers?.curated?.price ??
    d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Long Distance Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your long distance quote is ready. We have prepared a single flat rate based on your route and inventory. Everything is included, with nothing left to chance on moving day.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Flat Rate", price, "+ HST &middot; No hidden fees") : ""}
    ${d.tiers ? tierCards(d.tiers, d.quoteUrl, d.recommendedTier) : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
    ${whyYugoBlock()}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Office Move */
function officeTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.companyName) rows.push(["Company", d.companyName]);
  rows.push(
    ...addressRowsWithAccess(
      "Current Office",
      d.fromAddress,
      d.fromAccess,
      "New Office",
      d.toAddress,
      d.toAccess,
    ),
  );
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Relocation Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Thank you for considering Yugo for your office relocation. We have prepared a tailored proposal that covers every detail, from project coordination to careful equipment handling.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Project Estimate", price, "+ HST &middot; Details in your quote") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Single Item */
function singleItemTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.itemDescription) rows.push(["Item", d.itemDescription]);
  if (d.itemCategory) rows.push(["Category", d.itemCategory]);
  const pickupsSi = Array.isArray(d.pickupLocations)
    ? d.pickupLocations.filter((p) => p.address?.trim())
    : [];
  const dropoffsSi = Array.isArray(d.dropoffLocations)
    ? d.dropoffLocations.filter((p) => p.address?.trim())
    : [];
  if (pickupsSi.length > 1 || dropoffsSi.length > 1) {
    pickupsSi.forEach((p, i) => {
      const label = pickupsSi.length > 1 ? `Pickup ${i + 1}` : "Pickup";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffsSi.forEach((p, i) => {
      const label = dropoffsSi.length > 1 ? `Delivery ${i + 1}` : "Delivery";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(
      ...addressRowsWithAccess(
        "Pickup",
        d.fromAddress,
        d.fromAccess,
        "Delivery",
        d.toAddress,
        d.toAccess,
      ),
    );
  }
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", quoteEmailCrewLine(d.estCrewSize, "single_item")]);
  if (d.estHours != null && d.estHours > 0)
    rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price =
    d.customPrice ??
    d.tiers?.essential?.price ??
    d.tiers?.curated?.price ??
    d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your delivery quote is ready. We will handle your item with the same care and attention we bring to every job, from pickup through final placement.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Flat Price", price, "+ HST &middot; All-inclusive") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* White Glove */
function whiteGloveTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.itemDescription) rows.push(["Item", d.itemDescription]);
  const pickupsWg = Array.isArray(d.pickupLocations)
    ? d.pickupLocations.filter((p) => p.address?.trim())
    : [];
  const dropoffsWg = Array.isArray(d.dropoffLocations)
    ? d.dropoffLocations.filter((p) => p.address?.trim())
    : [];
  if (pickupsWg.length > 1 || dropoffsWg.length > 1) {
    pickupsWg.forEach((p, i) => {
      const label = pickupsWg.length > 1 ? `Pickup ${i + 1}` : "Pickup";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffsWg.forEach((p, i) => {
      const label = dropoffsWg.length > 1 ? `Delivery ${i + 1}` : "Delivery";
      rows.push([label, emailMapLinkHtml(p.address)]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(
      ...addressRowsWithAccess(
        "Pickup",
        d.fromAddress,
        d.fromAccess,
        "Delivery",
        d.toAddress,
        d.toAccess,
      ),
    );
  }
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", quoteEmailCrewLine(d.estCrewSize, "white_glove")]);
  if (d.estHours != null && d.estHours > 0)
    rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price =
    d.customPrice ??
    d.tiers?.essential?.price ??
    d.tiers?.curated?.price ??
    d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("White Glove Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your white glove quote is ready. From custom crating to climate-controlled handling, every detail has been considered. Your most valued possessions deserve nothing less.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Premium Service Rate", price, "+ HST &middot; ENHANCED INSURANCE INCLUDED") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Specialty */
function specialtyTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.projectType) rows.push(["Project Type", d.projectType]);
  rows.push(
    ...addressRowsWithAccess(
      "From",
      d.fromAddress,
      d.fromAccess,
      "To",
      d.toAddress,
      d.toAccess,
    ),
  );
  rows.push(["Target Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0)
    rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Specialty Service Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Thank you for entrusting us with your specialty project. We have prepared a custom proposal with all the specialized equipment and care your project requires.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Custom Quote", price, "+ HST &middot; Includes all specialized equipment") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Event */
function eventTemplate(d: QuoteTemplateData): string {
  const intro = d.eventName
    ? `Your event logistics quote for <strong style="color:${EMAIL_WINE}">${d.eventName}</strong> is ready. We handle delivery, setup, and return, with the same crew each day so every detail is seamless.`
    : "Your event logistics quote is ready. We handle delivery, setup, and return, with the same crew each day so every detail is taken care of.";

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const grand = total + tax;
  const deposit =
    d.eventDeposit != null && d.eventDeposit > 0
      ? d.eventDeposit
      : Math.max(300, Math.ceil(total * 0.25));

  const legs = d.eventLegBlocks;
  const evLegRule = `1px solid ${SHELL_BORDER}`;
  const evLegLbl = `padding:12px 14px 12px 0;font-size:11px;font-weight:700;color:${SHELL_TX2};text-transform:uppercase;letter-spacing:0.07em;width:38%;vertical-align:top;line-height:1.45;font-family:${EMAIL_SANS_STACK}`;
  const evLegVal = `padding:12px 0;font-size:13px;font-weight:600;color:${SHELL_TX};vertical-align:top;line-height:1.5;text-align:right;font-family:${EMAIL_SANS_STACK}`;
  const evMoneyLbl = `padding:11px 14px 11px 0;font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:uppercase;letter-spacing:0.06em;width:38%;vertical-align:top`;
  const evMoneyVal = `padding:11px 0;font-size:14px;font-weight:600;color:${SHELL_TX};vertical-align:top;text-align:right`;
  const legsHtml =
    legs && legs.length > 0
      ? legs
          .map(
            (leg) => `
    <div style="margin-bottom:36px;padding-bottom:4px;border-bottom:1px solid ${SHELL_BORDER};text-align:left">
      <div style="${SHELL_EYEBROW}margin-bottom:16px;">${escapeHtmlEmail(leg.label)}</div>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin:0 0 20px;border:1px solid ${SHELL_BORDER};">
        ${emailNestedKvRow({
          borderTop: "none",
          labelStyle: evLegLbl,
          valueStyle: evLegVal,
          label: "DELIVERY",
          valueHtml: escapeHtmlEmail(leg.deliveryDay),
        })}
        ${emailNestedKvRow({
          borderTop: evLegRule,
          labelStyle: evLegLbl,
          valueStyle: evLegVal,
          label: "RETURN",
          valueHtml: escapeHtmlEmail(leg.returnDay),
        })}
        ${emailNestedKvRow({
          borderTop: evLegRule,
          labelStyle: evLegLbl,
          valueStyle: evLegVal,
          label: "ORIGIN",
          valueHtml: escapeHtmlEmail(leg.origin),
        })}
        ${emailNestedKvRow({
          borderTop: evLegRule,
          labelStyle: evLegLbl,
          valueStyle: evLegVal,
          label: "VENUE",
          valueHtml: escapeHtmlEmail(leg.venue),
        })}
        ${emailNestedKvRow({
          borderTop: evLegRule,
          labelStyle: evLegLbl,
          valueStyle: evLegVal,
          label: "CREW",
          valueHtml: escapeHtmlEmail(leg.crewLine),
        })}
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;border:1px solid ${SHELL_BORDER};">
        ${emailNestedKvRow({
          borderTop: "none",
          labelStyle: evMoneyLbl,
          valueStyle: evMoneyVal,
          label: "DELIVERY",
          valueHtml: formatCurrencyEmail(leg.delivery),
        })}
        ${emailNestedKvRow({
          borderTop: evLegRule,
          labelStyle: evMoneyLbl,
          valueStyle: evMoneyVal,
          label: "RETURN",
          valueHtml: formatCurrencyEmail(leg.ret),
        })}
        ${emailNestedKvRow({
          borderTop: `2px solid ${SHELL_BORDER}`,
          labelStyle: `${evMoneyLbl};padding-top:14px`,
          valueStyle: `${evMoneyVal};padding-top:14px;font-size:15px;font-weight:700`,
          label: "SUBTOTAL",
          valueHtml: formatCurrencyEmail(leg.legSubtotal),
        })}
      </table>
    </div>`,
          )
          .join("")
      : "";

  const setupLine =
    d.eventSetupFee && d.eventSetupFee > 0
      ? `<div style="font-size:12px;color:${SHELL_TX2};margin:12px 0;text-align:left"><strong style="color:${SHELL_TX}">SETUP:</strong> ${formatCurrencyEmail(d.eventSetupFee)}</div>`
      : "";

  return quoteEmailLayout(`
    ${subHeading("Event Logistics Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText(intro)}
    ${expiryNote(d.expiresAt)}
    <div style="text-align:left;margin-bottom:20px">
      ${legsHtml}
      ${setupLine}
      <div style="border-top:1px solid ${SHELL_BORDER};padding-top:14px;margin-top:8px;font-size:12px;color:${SHELL_TX2};line-height:1.9">
        <div><strong style="color:${SHELL_TX}">Total:</strong> ${formatCurrencyEmail(total)}</div>
        <div>HST (13%): ${formatCurrencyEmail(tax)}</div>
        <div><strong style="color:${SHELL_TX}">Grand Total:</strong> ${formatCurrencyEmail(grand)}</div>
        <div style="margin-top:6px">Deposit to confirm: <strong style="color:${EMAIL_WINE}">${formatCurrencyEmail(deposit)}</strong></div>
      </div>
    </div>
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Confirm Event")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Labour Only */
function labourOnlyTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.labourDescription) rows.push(["Work", d.labourDescription]);
  if (d.fromAddress) {
    rows.push(["Location", emailMapLinkHtml(d.fromAddress)]);
    const locAccess = formatAccessForDisplay(d.fromAccess);
    if (locAccess) rows.push(["Access", locAccess]);
  }
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.labourCrewSize != null && d.labourHours != null) {
    rows.push([
      "Crew",
      `${d.labourCrewSize} movers \u00d7 ${d.labourHours} hours`,
    ]);
  }
  if (d.labourVisits != null && d.labourVisits >= 2)
    rows.push(["Visits", "2 visits scheduled"]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const deposit = Math.max(200, Math.round((total + tax) * 0.5));

  const labourNote =
    d.labourCrewSize && d.labourHours && d.labourRate
      ? `${d.labourCrewSize} movers \u00d7 ${d.labourHours} hrs \u00d7 $${d.labourRate}/hr`
      : "";

  return quoteEmailLayout(`
    ${subHeading("Your Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your labour service quote is ready. A professional crew arrives fully equipped and ready to work. No truck required.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    <div style="background:${CARD};border:1px solid ${ACCENT_ROSE_MUTED}44;border-radius:0;padding:24px;text-align:center;margin-bottom:24px">
      <div style="${DARK_CARD_EYEBROW}margin-bottom:8px;">Labour service</div>
      ${labourNote ? `<div style="font-size:12px;color:${DARK_TX2};margin-bottom:10px">${labourNote}</div>` : ""}
      <div style="font-family:${HERO_FONT};font-size:32px;font-weight:700;color:${ACCENT_OFF_WHITE};letter-spacing:0;">${formatCurrencyEmail(total)}</div>
      <div style="font-size:11px;color:${DARK_TX3};margin-top:6px">+${formatCurrencyEmail(tax)} HST &middot; Total ${formatCurrencyEmail(total + tax)}</div>
      <div style="font-size:11px;color:${DARK_TX3};margin-top:4px">Deposit to book: <strong style="color:${DARK_TX}">${formatCurrencyEmail(deposit)}</strong> (50%)</div>
    </div>
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Bin rental */
function binRentalTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  const includeBullets =
    d.binIncludeLines && d.binIncludeLines.length > 0
      ? `<ul style="margin:0 0 16px;padding-left:18px;color:${SHELL_TX2};font-size:12px;line-height:1.55">${d.binIncludeLines
          .map((line) => `<li style="margin-bottom:4px">${line}</li>`)
          .join("")}</ul>`
      : `<p style="margin:0 0 16px;color:${SHELL_TX2};font-size:12px;line-height:1.55">Reusable plastic bins, wardrobe boxes on move day, zip ties (1 per bin).</p>`;
  if (d.binDropOffDate) {
    const addr = d.binDeliveryAddress || d.toAddress || "";
    rows.push([
      "Bin delivery",
      addr
        ? `${dateDisplay(d.binDropOffDate)} &mdash; ${emailMapLinkHtml(addr)}`
        : escapeHtmlEmail(dateDisplay(d.binDropOffDate)),
    ]);
  }
  if (d.binMoveDate) {
    rows.push(["Your move", escapeHtmlEmail(dateDisplay(d.binMoveDate))]);
  }
  if (d.binPickupDate) {
    const addr = d.binPickupAddress || d.fromAddress || d.toAddress || "";
    rows.push([
      "Bin pickup",
      addr
        ? `${dateDisplay(d.binPickupDate)} &mdash; from ${emailMapLinkHtml(addr)}`
        : escapeHtmlEmail(dateDisplay(d.binPickupDate)),
    ]);
  }

  const subtotal = d.binSubtotal ?? d.customPrice ?? 0;
  const tax = d.binTax ?? Math.round(subtotal * 0.13);
  const grand = d.binGrandTotal ?? subtotal + tax;

  const binLineLeft = `padding:5px 0;font-size:12px;color:${SHELL_TX2};vertical-align:top;line-height:1.4`;
  const binLineRight = `padding:5px 0;text-align:right;font-size:12px;color:${SHELL_TX};vertical-align:top;white-space:nowrap`;
  const binSumLeft = `padding:6px 0;font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle`;
  const binSumRight = `padding:6px 0;text-align:right;font-size:12px;color:${SHELL_TX};font-weight:600;vertical-align:middle`;
  const binTotalLeft = `padding:8px 0 0;font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle`;
  const binTotalRight = `padding:8px 0 0;text-align:right;font-size:13px;font-weight:700;color:${EMAIL_WINE};vertical-align:middle`;

  const quoteLines =
    d.binLineItems && d.binLineItems.length > 0
      ? d.binLineItems
          .map((l) =>
            emailNestedKvRow({
              borderTop: `1px solid ${SHELL_BORDER}`,
              labelStyle: binLineLeft,
              valueStyle: binLineRight,
              label: escapeHtmlEmail(l.label),
              valueHtml: formatCurrencyEmail(l.amount),
            }),
          )
          .join("")
      : "";

  const binLedgerTable = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:${SHELL_TX2};border-collapse:collapse;">
        <tr>
          <td style="padding:0;background-color:${EMAIL_PREMIUM_TABLE_HEAD};">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="padding:8px 0;font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:uppercase;letter-spacing:0.07em;">Description</td>
                <td align="right" style="padding:8px 0;font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:uppercase;letter-spacing:0.07em;">Amount</td>
              </tr>
            </table>
          </td>
        </tr>
        ${quoteLines}
        ${emailNestedKvRow({
          borderTop: `1px solid ${SHELL_BORDER}`,
          labelStyle: binSumLeft,
          valueStyle: binSumRight,
          label: "Subtotal",
          valueHtml: formatCurrencyEmail(subtotal),
        })}
        ${emailNestedKvRow({
          borderTop: `1px solid ${SHELL_BORDER}`,
          labelStyle: binSumLeft,
          valueStyle: binSumRight,
          label: "HST (13%)",
          valueHtml: formatCurrencyEmail(tax),
        })}
        ${emailNestedKvRow({
          borderTop: `1px solid ${SHELL_BORDER}`,
          labelStyle: binTotalLeft,
          valueStyle: binTotalRight,
          label: "Total",
          valueHtml: formatCurrencyEmail(grand),
        })}
      </table>`;

  return quoteEmailLayout(`
    ${subHeading("Your Yugo Bin Rental Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your eco-friendly bin rental quote is ready.")}
    <p style="${SHELL_EYEBROW}margin:0 0 8px;">What&apos;s included</p>
    ${includeBullets}
    ${expiryNote(d.expiresAt)}
    <p style="${SHELL_EYEBROW}margin:0 0 8px;">Your schedule</p>
    ${detailsPlain(rows)}
    <div style="text-align:left;margin:16px 0">
      <p style="font-size:11px;font-weight:700;color:${SHELL_TX};text-transform:none;letter-spacing:0;margin:0 0 8px">Quote</p>
      ${binLedgerTable}
    </div>
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    <p style="font-size:11px;color:${SHELL_TX3};text-align:center;margin:0 0 16px;line-height:1.6">This quote is valid for 7 days. Full payment confirms your rental.</p>
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* B2B One-Off */
function b2bOneOffTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.b2bBusinessName) rows.push(["Business", d.b2bBusinessName]);
  if (d.b2bItems) rows.push(["Items", d.b2bItems]);
  rows.push(
    ...addressRowsWithAccess(
      "Pickup",
      d.fromAddress,
      d.fromAccess,
      "Delivery",
      d.toAddress,
      d.toAccess,
    ),
  );
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const scopeLine = getB2BQuoteEmailSubheading(
    d.b2bVerticalCode ?? undefined,
    d.b2bHandlingType ?? undefined,
  );

  return quoteEmailLayout(`
    ${subHeading("Delivery Quote")}
    <p style="font-size:14px;font-weight:600;color:${EMAIL_WINE};letter-spacing:0;margin:0 0 20px;line-height:1.5;">${scopeLine}</p>
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`)}
    ${bodyText("Your commercial delivery quote is ready. One transparent flat rate with professional logistics from pickup through delivery.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${priceCard("Delivery All Inclusive", total, `+${formatCurrencyEmail(tax)} HST \u00b7 Full payment at booking (card) or Net 30 when invoiced`)}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "VIEW QUOTE & CONFIRM")}
    <p style="font-size:11px;color:${SHELL_TX3};text-align:center;margin:0 0 20px;line-height:1.6">
      Planning regular deliveries? Our <strong style="color:${EMAIL_WINE}">Partner Program</strong> offers priority scheduling, volume pricing, and a dedicated portal.
    </p>
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* ─── Template registry ─── */

const TEMPLATE_MAP: Record<string, (d: QuoteTemplateData) => string> = {
  "quote-residential": residentialTemplate,
  "quote-longdistance": longDistanceTemplate,
  "quote-office": officeTemplate,
  "quote-singleitem": singleItemTemplate,
  "quote-whiteglove": whiteGloveTemplate,
  "quote-specialty": specialtyTemplate,
  "quote-event": eventTemplate,
  "quote-labouronly": labourOnlyTemplate,
  "quote-binrental": binRentalTemplate,
  "quote-b2boneoff": b2bOneOffTemplate,
};

export function renderQuoteTemplate(
  template: string,
  data: QuoteTemplateData,
): string {
  const renderer = TEMPLATE_MAP[template];
  if (!renderer) throw new Error(`Unknown quote template: ${template}`);
  return renderer(data);
}
