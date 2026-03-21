import { formatCurrency } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import { getEmailBaseUrl } from "@/lib/email-base-url";

/* ─── Brand tokens ─── */
const BG = "#080808";
const CARD = "#111111";
const CARD_BORDER = "#1E1E1E";
const GOLD = "#B8962E";
const GOLD_LIGHT = "#C9A962";
const TX = "#F0EDE8";
const TX2 = "#A8A29C";
const TX3 = "#5E5A56";

/* ─── Tier card backgrounds (user-specified) ─── */
const CURATED_BG   = "#492A1D";  /* dark rust / brown  */
const SIG_BG       = "#2B3929";  /* dark forest green  */
const ESTATE_BG    = "#2B0416";  /* deep wine          */

/* ─── Tier accent colors (label, check marks) ─── */
const CURATED_ACCENT  = "#C9956A";  /* warm copper / amber         */
const SIG_ACCENT      = "#C9A962";  /* brand gold                  */
const ESTATE_ACCENT   = "#C9A84C";  /* estate gold                 */

/* ─── Tier card primary text (warm cream — legible on all three dark bgs) ─── */
const TIER_TX = "#F5EEE6";

const TIER_LABELS: Record<string, string> = {
  curated: "Curated",
  signature: "Signature",
  estate: "Estate",
  // legacy keys for quotes created before the rename
  essentials: "Curated",
  premier: "Signature",
};

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
  return MOVE_SIZE_LABELS[raw] ?? raw.toUpperCase();
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
  const logoUrl = `${base}/images/yugo-logo-gold.png`;

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
      .eq-hdr   { padding: 28px 20px 0 !important; }
      .eq-ftr   { padding: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:560px;width:100%;background-color:${BG};border:1px solid ${CARD_BORDER};">
        <!-- Header -->
        <tr>
          <td class="eq-hdr" align="center" style="padding:36px 36px 0;background-color:${BG};">
            <img src="${logoUrl}" alt="Yugo+" width="90" height="25" style="display:block;max-width:90px;height:auto;border:0;margin:0 auto;" />
            <div style="width:40px;height:1px;background-color:${GOLD};margin:18px auto 0;line-height:0;font-size:0;">&nbsp;</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td class="eq-inner" style="padding:32px 36px 40px;background-color:${BG};color:${TX};font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            ${innerHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td class="eq-ftr" align="center" style="padding:24px 36px 28px;background-color:${BG};border-top:1px solid ${CARD_BORDER};">
            <img src="${logoUrl}" alt="Yugo+" width="70" height="19" style="display:block;max-width:70px;height:auto;border:0;margin:0 auto 8px;" />
            <div style="font-size:9px;color:${TX3};letter-spacing:2px;text-transform:uppercase;">The Art of Moving</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
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
        <td style="background-color:${GOLD}1A;border:1px solid ${GOLD}80;padding:5px 14px;">
          <span style="font-size:9px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:1.4px;text-transform:uppercase;">Guaranteed flat rate</span>
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
          <span style="font-size:12px;color:#FCA5A5;font-weight:600;line-height:1.5;">This quote is valid until ${formatted}. Book now to secure your rate.</span>
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
          <a href="${url}" style="display:block;background-color:${GOLD};color:#0A0806;padding:14px 32px;font-size:11px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:1.2px;text-transform:uppercase;">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size:10px;color:${TX3};text-align:center;margin:0 0 24px;letter-spacing:0.3px;">${sub ?? "Takes less than 2 minutes"}</p>
  `;
}

function whyYugoBlock(): string {
  const items = [
    ["Flat-rate guarantee", "no hidden fees, no surprises"],
    ["Real-time tracking", "follow your crew live from your phone"],
    ["Low deposit to book", "balance due on move day"],
    ["Fully insured", "$2M commercial liability coverage"],
  ];
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0 0;border-top:1px solid ${CARD_BORDER};">
      <tr>
        <td style="padding-top:22px;">
          <div style="font-size:8px;font-weight:700;color:${TX3};text-transform:uppercase;letter-spacing:2.4px;margin-bottom:14px;">The Yugo Difference</div>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            ${items.map(([strong, rest]) => `
              <tr>
                <td style="padding:6px 0;font-size:10px;color:${GOLD};vertical-align:top;width:18px;line-height:1.6;">&#10003;</td>
                <td style="padding:6px 0;font-size:12px;color:${TX2};line-height:1.6;"><strong style="color:${TX};font-weight:600;">${strong}</strong> &mdash; ${rest}</td>
              </tr>
            `).join("")}
          </table>
        </td>
      </tr>
    </table>
  `;
}

function questionsFooter(coordinatorName?: string | null, coordinatorPhone?: string | null): string {
  const contact = coordinatorName
    ? `Reach out to ${coordinatorName}${coordinatorPhone ? ` at ${coordinatorPhone}` : ""} or simply reply to this email.`
    : "Simply reply to this email &mdash; we typically respond within a few hours.";
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;border-top:1px solid ${CARD_BORDER};">
      <tr>
        <td style="padding-top:18px;">
          <p style="font-size:12px;color:${TX2};line-height:1.7;margin:0;"><strong style="color:${TX};font-weight:500;">Have questions?</strong> ${contact}</p>
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
    <div style="font-size:8px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:2.4px;margin-bottom:10px;">Move Details</div>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid ${CARD_BORDER};margin-bottom:28px;">
      ${rows.map(([l, v], i) => detailRow(l, v, i === rows.length - 1)).join("")}
    </table>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>, quoteUrl: string, recommendedTier?: string | null): string {
  const order = ["curated", "signature", "estate"];
  const rec = recommendedTier || "signature";

  /* Tier card backgrounds — user-specified premium dark palette */
  const tierBgs: Record<string, string> = {
    curated:   CURATED_BG,
    signature: SIG_BG,
    estate:    ESTATE_BG,
  };

  /* Border: muted version of the accent, stronger on recommended */
  const tierBorderMuted: Record<string, string> = {
    curated:   `${CURATED_ACCENT}50`,
    signature: `${SIG_ACCENT}50`,
    estate:    `${ESTATE_ACCENT}50`,
  };
  const tierBorderRec: Record<string, string> = {
    curated:   CURATED_ACCENT,
    signature: SIG_ACCENT,
    estate:    ESTATE_ACCENT,
  };

  const tierAccents: Record<string, string> = {
    curated:   CURATED_ACCENT,
    signature: SIG_ACCENT,
    estate:    ESTATE_ACCENT,
  };

  const badgeLabels: Record<string, Record<string, string>> = {
    curated:   { curated: "",  signature: "Upgrade available",        estate: "Premium option" },
    signature: { curated: "",  signature: "RECOMMENDED",              estate: "For the ultimate experience" },
    estate:    { curated: "",  signature: "",                         estate: "RECOMMENDED FOR YOU" },
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t         = tiers[key];
      const label     = TIER_LABELS[key] ?? t.label ?? key;
      const accent    = tierAccents[key] ?? TX3;
      const isRec     = key === rec;
      const badgeText = badgeLabels[rec]?.[key] ?? "";
      const cardBg    = tierBgs[key] ?? CARD;
      const borderClr = isRec ? tierBorderRec[key] : (tierBorderMuted[key] ?? CARD_BORDER);
      const borderW   = isRec ? "2px" : "1px";
      const padVal    = isRec ? "24px 22px" : "16px 18px";
      const priceSz   = isRec ? "34px" : "22px";

      const badge = badgeText
        ? `<span style="display:inline-block;padding:2px 9px;font-size:7px;font-weight:700;background-color:${isRec ? accent : TIER_TX + "1A"};color:${isRec ? BG : TIER_TX + "88"};margin-left:8px;letter-spacing:1px;text-transform:uppercase;vertical-align:middle;">${badgeText}</span>`
        : "";

      /* Checklist only on the recommended card */
      const includesRows = isRec
        ? (t.includes || []).filter(Boolean).map((item) =>
            `<tr><td style="color:${accent};font-size:10px;padding:4px 0;vertical-align:top;width:16px;line-height:1.5;">&#10003;</td><td style="color:${TIER_TX}CC;font-size:11px;padding:4px 0;line-height:1.5;">${item}</td></tr>`
          ).join("")
        : "";

      const cardContent = `
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${cardBg};border:${borderW} solid ${borderClr};margin-bottom:12px;">
          <tr>
            <td style="padding:${padVal};">
              <div style="font-size:8px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">${label}${badge}</div>
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
        <td align="center" style="background-color:${CARD};border:1px solid ${GOLD}40;padding:28px 24px;">
          <div style="font-size:8px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:2.4px;margin-bottom:10px;">${label}</div>
          <div style="font-family:${HERO_FONT};font-size:36px;font-weight:400;color:${GOLD_LIGHT};line-height:1;">${formatCurrency(price)}</div>
          <div style="font-size:11px;color:${TX3};margin-top:8px;letter-spacing:0.3px;">${note}</div>
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
          <div style="font-size:8px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:2.4px;margin-bottom:6px;">Your Coordinator</div>
          <div style="font-size:14px;color:${TX};font-weight:500;">${name}</div>
          ${phone ? `<div style="font-size:12px;color:${TX2};margin-top:3px;">${phone}</div>` : ""}
        </td>
      </tr>
    </table>
  `;
}

const HERO_FONT = "'Instrument Serif', Georgia, 'Times New Roman', serif";

function heading(text: string): string {
  return `<h1 style="font-family:${HERO_FONT};font-size:30px;font-weight:400;margin:0 0 14px;color:${TX};line-height:1.25;letter-spacing:-0.3px;">${text}</h1>`;
}

function subHeading(text: string): string {
  return `<div style="font-size:8px;font-weight:700;color:${GOLD};letter-spacing:2.8px;text-transform:uppercase;margin-bottom:12px;">${text}</div>`;
}

function bodyText(text: string): string {
  return `<p style="font-size:13px;color:${TX2};line-height:1.75;margin:0 0 28px;">${text}</p>`;
}

/** Single "Access" row when fromAccess and/or toAccess exist. */
function accessRows(fromAccess: string | null | undefined, toAccess: string | null | undefined): [string, string][] {
  const from = formatAccessForDisplay(fromAccess);
  const to = formatAccessForDisplay(toAccess);
  if (from && to) return [["Access", `Pickup: ${from}; Drop-off: ${to}`]];
  if (from) return [["Access", from]];
  if (to) return [["Access", to]];
  return [];
}

/* ─── Templates ─── */

/* Residential (3-tier) */
function residentialTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  if (d.fromAddress) rows.push(["From", d.fromAddress]);
  if (d.toAddress) rows.push(["To", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  return quoteEmailLayout(`
    ${subHeading("Your Moving Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("We have prepared your personalized moving quote with three flat-rate packages. Choose the level of service that fits your needs &mdash; every option includes professional movers, a dedicated truck, and full protection.")}
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
  if (d.fromAddress) rows.push(["Origin", d.fromAddress]);
  if (d.toAddress) rows.push(["Destination", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  const price = d.customPrice ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Long Distance Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your long distance moving quote is ready. We have calculated a flat rate based on your route and inventory &mdash; no surprises on arrival day.")}
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
  if (d.fromAddress) rows.push(["Current Office", d.fromAddress]);
  if (d.toAddress) rows.push(["New Office", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Relocation Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Thank you for considering Yugo+ for your office relocation. We have prepared a tailored proposal with flat-rate pricing, project management, and IT equipment handling included.")}
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
  if (d.fromAddress) rows.push(["Pickup", d.fromAddress]);
  if (d.toAddress) rows.push(["Delivery", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your delivery quote is ready. We will handle your item with care from pickup to placement &mdash; fully insured, flat-rate, no surprises.")}
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
  if (d.fromAddress) rows.push(["Pickup", d.fromAddress]);
  if (d.toAddress) rows.push(["Delivery", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice ?? d.tiers?.curated?.price ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("White Glove Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your white glove service quote is ready. Premium handling with custom crating, climate control, and enhanced insurance &mdash; your valuables deserve the best.")}
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
  if (d.fromAddress) rows.push(["From", d.fromAddress]);
  if (d.toAddress) rows.push(["To", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Target Date", dateDisplay(d.moveDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} professional movers`]);
  if (d.estHours != null && d.estHours > 0) rows.push(["Est. duration", `~${d.estHours} hours`]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Specialty Service Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Thank you for reaching out about your specialty project. We have put together a custom proposal with all specialized equipment and handling included.")}
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
    ? `Here's your event logistics quote for <strong style="color:${TX}">${d.eventName}</strong>. We handle delivery, setup, and return &mdash; same crew every day so they know the layout.`
    : "Here's your event logistics quote. We handle delivery, setup, and return &mdash; same crew every day so they know the layout.";

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
      <div style="font-size:10px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px">${leg.label}</div>
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
        <div style="margin-top:6px">Deposit to confirm: <strong style="color:${GOLD_LIGHT}">${formatCurrency(deposit)}</strong></div>
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
  if (d.fromAddress) rows.push(["Location", d.fromAddress]);
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
    ${bodyText("Your labour service quote is ready. Professional crew with all tools included \u2014 no truck needed.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">Labour Service</div>
      ${labourNote ? `<div style="font-size:12px;color:${TX2};margin-bottom:10px">${labourNote}</div>` : ""}
      <div style="font-family:${HERO_FONT};font-size:32px;font-weight:700;color:${GOLD_LIGHT}">${formatCurrency(total)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:6px">+${formatCurrency(tax)} HST &middot; Total ${formatCurrency(total + tax)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:4px">Deposit to book: <strong style="color:${TX}">${formatCurrency(deposit)}</strong> (50%)</div>
    </div>
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
  `);
}

/* B2B One-Off */
function b2bOneOffTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.b2bBusinessName) rows.push(["Business", d.b2bBusinessName]);
  if (d.b2bItems) rows.push(["Items", d.b2bItems]);
  if (d.fromAddress) rows.push(["Pickup", d.fromAddress]);
  if (d.toAddress) rows.push(["Delivery", d.toAddress]);
  rows.push(...accessRows(d.fromAccess, d.toAccess));
  rows.push(["Date", dateDisplay(d.moveDate)]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your commercial delivery quote is ready. Professional crew with full equipment \u2014 flat-rate, no hidden fees.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${priceCard("Delivery All Inclusive", total, `+${formatCurrency(tax)} HST \u00b7 Full payment at booking`)}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Confirm Payment")}
    <p style="font-size:11px;color:${TX3};text-align:center;margin:0 0 20px;line-height:1.6">
      Need regular deliveries? Ask about our <strong style="color:${TX}">Partner Program</strong> for volume pricing and a dedicated portal.
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
  "quote-b2boneoff": b2bOneOffTemplate,
};

export function renderQuoteTemplate(template: string, data: QuoteTemplateData): string {
  const renderer = TEMPLATE_MAP[template];
  if (!renderer) throw new Error(`Unknown quote template: ${template}`);
  return renderer(data);
}
