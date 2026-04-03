import { getClientEmailFooterTrs } from "@/lib/email/client-email-footer";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { EMAIL_LOGO_GOLD_H, EMAIL_LOGO_GOLD_W } from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatCurrency } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import { TIER_LABELS as DISPLAY_TIER_LABELS, displayLabel } from "@/lib/displayLabels";
import { getB2BQuoteEmailSubheading, quoteEmailCrewLine } from "@/lib/quotes/b2b-quote-copy";

/* Typography: hero = Instrument Serif + Georgia; kickers = 12px uppercase, letter-spacing 0; cream/rose accents on black (no gold). */
/* ─── Brand tokens ─── */
const BG = "#080808";
const CARD = "#111111";
const CARD_BORDER = "#1E1E1E";
/** Cream / off-white / rose accents for text & rules on near-black (replaces gold). */
const ACCENT_CREAM = "#EDE6DC";
const ACCENT_OFF_WHITE = "#F5F0E8";
const ACCENT_ROSE = "#D4AAB5";
const ACCENT_ROSE_MUTED = "#B88998";
const CTA_BG = ACCENT_OFF_WHITE;
const CTA_TX = "#0D0B0A";
const TX = "#F0EDE8";
const TX2 = "#A8A29C";
const TX3 = "#5E5A56";

/** Shared kicker/eyebrow on dark quote shell (12px, uppercase, 0 tracking). */
const QUOTE_EYEBROW = `font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:${ACCENT_CREAM};letter-spacing:0px;text-transform:uppercase;`;

/* ─── Tier card backgrounds (user-specified) ─── */
const CURATED_BG   = "#492A1D";  /* dark rust / brown  */
const SIG_BG       = "#2B3929";  /* dark forest green  */
const ESTATE_BG    = "#2B0416";  /* deep wine          */

/* ─── Tier accent colors (label, check marks) — cream/rose tones, no gold ─── */
const CURATED_ACCENT  = "#E8C4A8";  /* warm peach on rust            */
const SIG_ACCENT      = "#D8E3D8";  /* soft sage-cream on forest     */
const ESTATE_ACCENT   = "#E8C4D0";  /* rose-cream on wine            */

/* ─── Tier card primary text (warm cream — legible on all three dark bgs) ─── */
const TIER_TX = "#F5EEE6";

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
  const base = getEmailBaseUrl();
  const logoUrl = `${base}/images/yugo-logo-cream.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">
    ${INSTRUMENT_SERIF_FACE}
    @media only screen and (max-width:600px) {
      .eq-inner { padding: 24px 20px 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};">
  <tr>
    <td align="center" style="padding:24px 16px 0;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:560px;width:100%;background-color:${BG};border:1px solid ${CARD_BORDER};">
        <tr>
          <td class="eq-inner" style="padding:32px 36px 40px;background-color:${BG};color:${TX};font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <div class="eq-hdr" align="center" style="margin:0 0 16px;">
              <img src="${logoUrl}" alt="Yugo" width="${EMAIL_LOGO_GOLD_W}" height="${EMAIL_LOGO_GOLD_H}" style="display:block;max-width:${EMAIL_LOGO_GOLD_W}px;height:auto;border:0;margin:0 auto;" />
              <div style="width:40px;height:1px;background-color:${ACCENT_ROSE_MUTED};margin:8px auto 0;line-height:0;font-size:0;">&nbsp;</div>
            </div>
            ${innerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${getClientEmailFooterTrs()}
</table>
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

function flatRateBadge(): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
      <tr>
        <td style="background-color:${ACCENT_ROSE}18;border:1px solid ${ACCENT_ROSE_MUTED}66;padding:6px 14px;">
          <span style="${QUOTE_EYEBROW}">Guaranteed flat rate</span>
        </td>
      </tr>
    </table>
  `;
}

function expiryNote(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  const formatted = d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 28px;">
      <tr>
        <td style="background-color:#DC262618;border-left:3px solid #DC2626;padding:12px 16px;">
          <span style="font-size:12px;color:#FCA5A5;font-weight:600;line-height:1.5;">Your rate is guaranteed until ${formatted}. Book before then to secure your date and price.</span>
        </td>
      </tr>
    </table>
  `;
}

function ctaButton(url: string, label: string, sub?: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 8px;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:block;background-color:${CTA_BG};color:${CTA_TX};padding:10px 28px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:0px;text-transform:uppercase;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size:10px;color:${TX3};text-align:center;margin:0 0 24px;letter-spacing:0;">${sub ?? "Booking takes less than two minutes"}</p>
  `;
}

function whyYugoBlock(): string {
  const items = [
    ["Flat-rate guarantee", "transparent pricing with nothing added on the day"],
    ["Real-time tracking", "follow your crew from your phone, every step of the way"],
    ["Dedicated coordinator", "a single point of contact from booking through the final placement"],
    ["Fully insured", "WSIB coverage, $2M General Liability, and comprehensive cargo insurance"],
  ];
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;border-top:1px solid ${CARD_BORDER};">
      <tr>
        <td style="padding-top:22px;">
          <div style="${QUOTE_EYEBROW}margin-bottom:12px;">The Yugo difference</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${items.map(([strong, rest]) => `
              <tr>
                <td style="padding:6px 0;font-size:10px;color:${ACCENT_ROSE};vertical-align:top;width:18px;line-height:1.6;">—</td>
                <td style="padding:6px 0;font-size:12px;color:${TX2};line-height:1.6;"><strong style="color:${TX};font-weight:600;">${strong}</strong> - ${rest}</td>
              </tr>
            `).join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function questionsFooter(coordinatorName?: string | null, coordinatorPhone?: string | null): string {
  const support = getClientSupportEmail();
  const contact = coordinatorName
    ? `Your coordinator ${coordinatorName} is available${coordinatorPhone ? ` at ${coordinatorPhone}` : ""} or by email at ${support}.`
    : `Email us at ${support} and we will get back to you within a few hours.`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid ${CARD_BORDER};">
      <tr>
        <td style="padding-top:18px;">
          <p style="font-size:12px;color:${TX2};line-height:1.7;margin:0;"><strong style="color:${TX};font-weight:500;">We are here to help.</strong> ${contact}</p>
        </td>
      </tr>
    </table>
  `;
}

function detailRow(label: string, value: string, last = false): string {
  const border = last ? "" : `border-bottom:1px solid ${CARD_BORDER};`;
  return `
    <tr>
      <td style="${border}color:${TX3};padding:9px 0;font-size:11px;vertical-align:top;line-height:1.5;width:40%;">${label}</td>
      <td style="${border}color:${TX};font-weight:500;padding:9px 0;text-align:right;font-size:12px;line-height:1.5;text-decoration:none;vertical-align:top;">${value}</td>
    </tr>`;
}

/** Move details as a plain table — no card/div wrapper, details just lay on the page */
function detailsPlain(rows: [string, string][]): string {
  if (rows.length === 0) return "";
  return `
    <div style="${QUOTE_EYEBROW}margin-bottom:10px;">Move details</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${CARD_BORDER};margin-bottom:28px;">
      ${rows.map(([l, v], i) => detailRow(l, v, i === rows.length - 1)).join("")}
    </table>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>, quoteUrl: string, recommendedTier?: string | null): string {
  const order = ["essential", "signature", "estate"];
  const rec = recommendedTier || "signature";

  /* Tier card backgrounds — user-specified premium dark palette */
  const tierBgs: Record<string, string> = {
    essential: CURATED_BG,
    signature: SIG_BG,
    estate:    ESTATE_BG,
  };

  /* Border: muted version of the accent, stronger on recommended */
  const tierBorderMuted: Record<string, string> = {
    essential: `${CURATED_ACCENT}50`,
    signature: `${SIG_ACCENT}50`,
    estate:    `${ESTATE_ACCENT}50`,
  };
  const tierBorderRec: Record<string, string> = {
    essential: CURATED_ACCENT,
    signature: SIG_ACCENT,
    estate:    ESTATE_ACCENT,
  };

  const tierAccents: Record<string, string> = {
    essential: CURATED_ACCENT,
    signature: SIG_ACCENT,
    estate:    ESTATE_ACCENT,
  };

  const badgeLabels: Record<string, Record<string, string>> = {
    essential: { essential: "",  signature: "Upgrade available",        estate: "Premium option" },
    signature: { essential: "",  signature: "RECOMMENDED",              estate: "For the ultimate experience" },
    estate:    { essential: "",  signature: "",                         estate: "RECOMMENDED FOR YOU" },
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t         = tiers[key];
      const label     = EMAIL_TIER_LABELS[key] ?? t.label ?? key;
      const accent    = tierAccents[key] ?? TX3;
      const isRec     = key === rec;
      const badgeText = badgeLabels[rec]?.[key] ?? "";
      const cardBg    = tierBgs[key] ?? CARD;
      const borderClr = isRec ? tierBorderRec[key] : (tierBorderMuted[key] ?? CARD_BORDER);
      const borderW   = isRec ? "2px" : "1px";
      const padVal    = isRec ? "24px 22px" : "16px 18px";
      const priceSz   = isRec ? "34px" : "22px";

      const badge = badgeText
        ? `<span style="display:inline-block;padding:2px 9px;font-size:7px;font-weight:700;background-color:${isRec ? accent : TIER_TX + "1A"};color:${isRec ? BG : TIER_TX + "88"};margin-left:8px;letter-spacing:0;text-transform:none;vertical-align:middle;">${badgeText}</span>`
        : "";

      /* Checklist only on the recommended card */
      const includesRows = isRec
        ? (t.includes || []).filter(Boolean).map((item) =>
            `<tr><td style="color:${accent};font-size:10px;padding:4px 0;vertical-align:top;width:16px;line-height:1.5;">—</td><td style="color:${TIER_TX}CC;font-size:11px;padding:4px 0;line-height:1.5;">${item}</td></tr>`
          ).join("")
        : "";

      const cardContent = `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${cardBg};border:${borderW} solid ${borderClr};margin-bottom:12px;">
          <tr>
            <td style="padding:${padVal};">
              <div style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:700;color:${accent};letter-spacing:0px;text-transform:uppercase;margin-bottom:10px;">${label}${badge}</div>
              <div style="font-family:${HERO_FONT};font-size:${priceSz};font-weight:400;color:${TIER_TX};line-height:1;margin-bottom:${isRec ? "16px" : "4px"};">${formatCurrency(t.price)}</div>
              ${includesRows ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:4px;">${includesRows}</table>` : ""}
            </td>
          </tr>
        </table>
      `;

      return `<a href="${quoteUrl}" style="display:block;text-decoration:none;color:inherit;">${cardContent}</a>`;
    })
    .join("");
}

function estateRecommendationNote(recommendedTier: string | null | undefined): string {
  if (recommendedTier !== "estate") return "";
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:${ESTATE_BG};border-left:3px solid ${ESTATE_ACCENT};padding:12px 16px;">
          <span style="font-size:12px;color:${TIER_TX}CC;line-height:1.6;">Based on your home and belongings, we recommend our <strong style="color:${TIER_TX};">Estate</strong> package for complete peace of mind.</span>
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
          <div style="${QUOTE_EYEBROW}margin-bottom:10px;">${label}</div>
          <div style="font-family:${HERO_FONT};font-size:36px;font-weight:400;color:${ACCENT_OFF_WHITE};line-height:1;letter-spacing:0;">${formatCurrency(price)}</div>
          <div style="font-size:11px;color:${TX3};margin-top:8px;letter-spacing:0;">${note}</div>
        </td>
      </tr>
    </table>
  `;
}

function coordinatorBlock(name?: string | null, phone?: string | null): string {
  if (!name) return "";
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 24px;border-top:1px solid ${CARD_BORDER};">
      <tr>
        <td style="padding-top:16px;">
          <div style="${QUOTE_EYEBROW}margin-bottom:8px;">Your coordinator</div>
          <div style="font-size:14px;color:${TX};font-weight:500;">${name}</div>
          ${phone ? `<div style="font-size:12px;color:${TX2};margin-top:3px;">${phone}</div>` : ""}
        </td>
      </tr>
    </table>
  `;
}

const HERO_FONT = "'Instrument Serif', Georgia, 'Times New Roman', serif";

function heading(text: string): string {
  return `<h1 style="font-family:${HERO_FONT};font-size:30px;font-weight:400;margin:0 0 14px;color:${TX};line-height:1.25;letter-spacing:0;">${text}</h1>`;
}

function subHeading(text: string): string {
  return `<div style="${QUOTE_EYEBROW}margin:0 0 12px;">${text}</div>`;
}

function bodyText(text: string): string {
  return `<p style="font-size:13px;color:${TX2};line-height:1.75;margin:0 0 28px;">${text}</p>`;
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
    rows.push([fromLabel, fromAddress]);
    if (fa) rows.push(["Access", fa]);
  } else if (fa) {
    rows.push(["Access", fa]);
  }

  if (toAddress) {
    rows.push([toLabel, toAddress]);
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
  const pickups = Array.isArray(d.pickupLocations) ? d.pickupLocations.filter((p) => p.address?.trim()) : [];
  const dropoffs = Array.isArray(d.dropoffLocations) ? d.dropoffLocations.filter((p) => p.address?.trim()) : [];
  if (pickups.length > 1 || dropoffs.length > 1) {
    pickups.forEach((p, i) => {
      const label = pickups.length > 1 ? `Pickup ${i + 1}` : "From";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffs.forEach((p, i) => {
      const label = dropoffs.length > 1 ? `Destination ${i + 1}` : "To";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(...addressRowsWithAccess("From", d.fromAddress, d.fromAccess, "To", d.toAddress, d.toAccess));
  }
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  return quoteEmailLayout(`
    ${subHeading("Your Moving Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("We have prepared three flat-rate service options tailored to your move. Every package includes professional movers, a dedicated truck, and full protection. Choose the level of care that suits you best.")}
    ${flatRateBadge()}
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
  const pickups = Array.isArray(d.pickupLocations) ? d.pickupLocations.filter((p) => p.address?.trim()) : [];
  const dropoffs = Array.isArray(d.dropoffLocations) ? d.dropoffLocations.filter((p) => p.address?.trim()) : [];
  if (pickups.length > 1 || dropoffs.length > 1) {
    pickups.forEach((p, i) => {
      const label = pickups.length > 1 ? `Pickup ${i + 1}` : "Origin";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffs.forEach((p, i) => {
      const label = dropoffs.length > 1 ? `Destination ${i + 1}` : "Destination";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(...addressRowsWithAccess("Origin", d.fromAddress, d.fromAccess, "Destination", d.toAddress, d.toAccess));
  }
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  const price = d.customPrice ?? d.tiers?.essential?.price ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Long Distance Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your long distance quote is ready. We have prepared a single flat rate based on your route and inventory. Everything is included, with nothing left to chance on moving day.")}
    ${flatRateBadge()}
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
  rows.push(...addressRowsWithAccess("Current Office", d.fromAddress, d.fromAccess, "New Office", d.toAddress, d.toAccess));
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Relocation Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Thank you for considering Yugo for your office relocation. We have prepared a tailored proposal that covers every detail, from project coordination to careful equipment handling.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Project Estimate", price, "+ HST &middot; Flat-rate guarantee") : ""}
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
  const pickupsSi = Array.isArray(d.pickupLocations) ? d.pickupLocations.filter((p) => p.address?.trim()) : [];
  const dropoffsSi = Array.isArray(d.dropoffLocations) ? d.dropoffLocations.filter((p) => p.address?.trim()) : [];
  if (pickupsSi.length > 1 || dropoffsSi.length > 1) {
    pickupsSi.forEach((p, i) => {
      const label = pickupsSi.length > 1 ? `Pickup ${i + 1}` : "Pickup";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffsSi.forEach((p, i) => {
      const label = dropoffsSi.length > 1 ? `Delivery ${i + 1}` : "Delivery";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(...addressRowsWithAccess("Pickup", d.fromAddress, d.fromAccess, "Delivery", d.toAddress, d.toAccess));
  }
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", quoteEmailCrewLine(d.estCrewSize, "single_item")]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice ?? d.tiers?.essential?.price ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
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
  const pickupsWg = Array.isArray(d.pickupLocations) ? d.pickupLocations.filter((p) => p.address?.trim()) : [];
  const dropoffsWg = Array.isArray(d.dropoffLocations) ? d.dropoffLocations.filter((p) => p.address?.trim()) : [];
  if (pickupsWg.length > 1 || dropoffsWg.length > 1) {
    pickupsWg.forEach((p, i) => {
      const label = pickupsWg.length > 1 ? `Pickup ${i + 1}` : "Pickup";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
    dropoffsWg.forEach((p, i) => {
      const label = dropoffsWg.length > 1 ? `Delivery ${i + 1}` : "Delivery";
      rows.push([label, p.address]);
      const pa = formatAccessForDisplay(p.access ?? null);
      if (pa) rows.push(["Access", pa]);
    });
  } else {
    rows.push(...addressRowsWithAccess("Pickup", d.fromAddress, d.fromAccess, "Delivery", d.toAddress, d.toAccess));
  }
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0)
    rows.push(["Crew", quoteEmailCrewLine(d.estCrewSize, "white_glove")]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice ?? d.tiers?.essential?.price ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("White Glove Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your white glove quote is ready. From custom crating to climate-controlled handling, every detail has been considered. Your most valued possessions deserve nothing less.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${price ? priceCard("Premium Service Rate", price, "+ HST &middot; Enhanced insurance included") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* Specialty */
function specialtyTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.projectType) rows.push(["Project Type", d.projectType]);
  rows.push(...addressRowsWithAccess("From", d.fromAddress, d.fromAccess, "To", d.toAddress, d.toAccess));
  rows.push(["Target Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Specialty Service Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
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
    ? `Your event logistics quote for <strong style="color:${TX}">${d.eventName}</strong> is ready. We handle delivery, setup, and return, with the same crew each day so every detail is seamless.`
    : "Your event logistics quote is ready. We handle delivery, setup, and return, with the same crew each day so every detail is taken care of.";

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const grand = total + tax;
  const deposit =
    d.eventDeposit != null && d.eventDeposit > 0
      ? d.eventDeposit
      : Math.max(300, Math.ceil(total * 0.25));

  const legs = d.eventLegBlocks;
  const legsHtml =
    legs && legs.length > 0
      ? legs
          .map(
            (leg) => `
    <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid ${CARD_BORDER};text-align:left">
      <div style="${QUOTE_EYEBROW}margin-bottom:8px;">${leg.label}</div>
      <div style="font-size:11px;color:${TX2};line-height:1.7;margin-bottom:6px">
        <strong style="color:${TX}">Delivery:</strong> ${leg.deliveryDay}<br/>
        <strong style="color:${TX}">Return:</strong> ${leg.returnDay}<br/>
        <strong style="color:${TX}">Origin:</strong> ${leg.origin}<br/>
        <strong style="color:${TX}">Venue:</strong> ${leg.venue}<br/>
        <strong style="color:${TX}">Crew:</strong> ${leg.crewLine}
      </div>
      <div style="font-size:11px;color:${TX2};line-height:1.8">
        Delivery: ${formatCurrency(leg.delivery)}<br/>
        Return: ${formatCurrency(leg.ret)}<br/>
        <strong style="color:${TX}">Subtotal:</strong> ${formatCurrency(leg.legSubtotal)}
      </div>
    </div>`,
          )
          .join("")
      : "";

  const setupLine =
    d.eventSetupFee && d.eventSetupFee > 0
      ? `<div style="font-size:12px;color:${TX2};margin:12px 0;text-align:left"><strong style="color:${TX}">SETUP:</strong> ${formatCurrency(d.eventSetupFee)}</div>`
      : "";

  return quoteEmailLayout(`
    ${subHeading("Event Logistics Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText(intro)}
    ${expiryNote(d.expiresAt)}
    <div style="text-align:left;margin-bottom:20px">
      ${legsHtml}
      ${setupLine}
      <div style="border-top:1px solid ${CARD_BORDER};padding-top:14px;margin-top:8px;font-size:12px;color:${TX2};line-height:1.9">
        <div><strong style="color:${TX}">Total:</strong> ${formatCurrency(total)}</div>
        <div>HST (13%): ${formatCurrency(tax)}</div>
        <div><strong style="color:${TX}">Grand Total:</strong> ${formatCurrency(grand)}</div>
        <div style="margin-top:6px">Deposit to confirm: <strong style="color:${ACCENT_CREAM}">${formatCurrency(deposit)}</strong></div>
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
    rows.push(["Location", d.fromAddress]);
    const locAccess = formatAccessForDisplay(d.fromAccess);
    if (locAccess) rows.push(["Access", locAccess]);
  }
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.labourCrewSize != null && d.labourHours != null) {
    rows.push(["Crew", `${d.labourCrewSize} movers \u00d7 ${d.labourHours} hours`]);
  }
  if (d.labourVisits != null && d.labourVisits >= 2) rows.push(["Visits", "2 visits scheduled"]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const deposit = Math.max(200, Math.round((total + tax) * 0.50));

  const labourNote = d.labourCrewSize && d.labourHours && d.labourRate
    ? `${d.labourCrewSize} movers \u00d7 ${d.labourHours} hrs \u00d7 $${d.labourRate}/hr`
    : "";

  return quoteEmailLayout(`
    ${subHeading("Your Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your labour service quote is ready. A professional crew arrives fully equipped and ready to work. No truck required.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    <div style="background:${CARD};border:1px solid ${ACCENT_ROSE_MUTED}44;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="${QUOTE_EYEBROW}margin-bottom:8px;">Labour service</div>
      ${labourNote ? `<div style="font-size:12px;color:${TX2};margin-bottom:10px">${labourNote}</div>` : ""}
      <div style="font-family:${HERO_FONT};font-size:32px;font-weight:700;color:${ACCENT_OFF_WHITE};letter-spacing:0;">${formatCurrency(total)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:6px">+${formatCurrency(tax)} HST &middot; Total ${formatCurrency(total + tax)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:4px">Deposit to book: <strong style="color:${TX}">${formatCurrency(deposit)}</strong> (50%)</div>
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
      ? `<ul style="margin:0 0 16px;padding-left:18px;color:${TX2};font-size:12px;line-height:1.55">${d.binIncludeLines
          .map((line) => `<li style="margin-bottom:4px">${line}</li>`)
          .join("")}</ul>`
      : `<p style="margin:0 0 16px;color:${TX2};font-size:12px;line-height:1.55">Reusable plastic bins, wardrobe boxes on move day, zip ties (1 per bin).</p>`;
  if (d.binDropOffDate) {
    rows.push(["Bin delivery", `${dateDisplay(d.binDropOffDate)} — ${d.binDeliveryAddress || d.toAddress || ""}`]);
  }
  if (d.binMoveDate) {
    rows.push(["Your move", dateDisplay(d.binMoveDate)]);
  }
  if (d.binPickupDate) {
    rows.push([
      "Bin pickup",
      `${dateDisplay(d.binPickupDate)} — from ${d.binPickupAddress || d.fromAddress || d.toAddress || ""}`,
    ]);
  }

  const subtotal = d.binSubtotal ?? d.customPrice ?? 0;
  const tax = d.binTax ?? Math.round(subtotal * 0.13);
  const grand = d.binGrandTotal ?? subtotal + tax;

  const quoteLines =
    d.binLineItems && d.binLineItems.length > 0
      ? d.binLineItems
          .map(
            (l) =>
              `<tr><td style="padding:6px 0;border-bottom:1px solid ${CARD_BORDER};color:${TX2}">${l.label}</td><td style="padding:6px 0;border-bottom:1px solid ${CARD_BORDER};text-align:right">${formatCurrency(l.amount)}</td></tr>`,
          )
          .join("")
      : "";

  return quoteEmailLayout(`
    ${subHeading("Your Yugo Bin Rental Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your eco-friendly bin rental quote is ready.")}
    <p style="${QUOTE_EYEBROW}margin:0 0 8px;">What&apos;s included</p>
    ${includeBullets}
    ${expiryNote(d.expiresAt)}
    <p style="${QUOTE_EYEBROW}margin:0 0 8px;">Your schedule</p>
    ${detailsPlain(rows)}
    <div style="text-align:left;margin:16px 0">
      <p style="font-size:11px;font-weight:700;color:${TX};text-transform:none;letter-spacing:0;margin:0 0 8px">Quote</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:12px;color:${TX2}">
        ${quoteLines}
        <tr><td style="padding:8px 0;font-weight:600;color:${TX}">Subtotal</td><td style="padding:8px 0;text-align:right">${formatCurrency(subtotal)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:600;color:${TX}">HST (13%)</td><td style="padding:8px 0;text-align:right">${formatCurrency(tax)}</td></tr>
        <tr><td style="padding:10px 0 0;font-weight:700;color:${TX}">Total</td><td style="padding:10px 0 0;text-align:right;font-weight:700;color:${ACCENT_CREAM}">${formatCurrency(grand)}</td></tr>
      </table>
    </div>
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    <p style="font-size:11px;color:${TX3};text-align:center;margin:0 0 16px;line-height:1.6">This quote is valid for 7 days. Full payment confirms your rental.</p>
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* B2B One-Off */
function b2bOneOffTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.b2bBusinessName) rows.push(["Business", d.b2bBusinessName]);
  if (d.b2bItems) rows.push(["Items", d.b2bItems]);
  rows.push(...addressRowsWithAccess("Pickup", d.fromAddress, d.fromAccess, "Delivery", d.toAddress, d.toAccess));
  rows.push(["Delivery Date", dateDisplay(d.moveDate)]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const scopeLine = getB2BQuoteEmailSubheading(
    d.b2bVerticalCode ?? undefined,
    d.b2bHandlingType ?? undefined,
  );

  return quoteEmailLayout(`
    ${subHeading("COMMERCIAL DELIVERY QUOTE")}
    <p style="font-size:14px;font-weight:600;color:${ACCENT_OFF_WHITE};letter-spacing:0;margin:0 0 20px;line-height:1.5;">${scopeLine}</p>
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your commercial delivery quote is ready. One transparent flat rate with professional logistics from pickup through delivery.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${priceCard("Delivery All Inclusive", total, `+${formatCurrency(tax)} HST \u00b7 Full payment at booking (card) or Net 30 when invoiced`)}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "VIEW QUOTE & CONFIRM")}
    <p style="font-size:11px;color:${TX3};text-align:center;margin:0 0 20px;line-height:1.6">
      Planning regular deliveries? Our <strong style="color:${TX}">Partner Program</strong> offers priority scheduling, volume pricing, and a dedicated portal.
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

export function renderQuoteTemplate(template: string, data: QuoteTemplateData): string {
  const renderer = TEMPLATE_MAP[template];
  if (!renderer) throw new Error(`Unknown quote template: ${template}`);
  return renderer(data);
}
