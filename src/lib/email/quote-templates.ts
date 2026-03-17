import { formatCurrency } from "@/lib/format-currency";
import { getEmailBaseUrl } from "@/lib/email-base-url";

/* ─── Brand tokens (matching the live quote page) ─── */
const BG = "#0A0A0A";
const CARD = "#141414";
const CARD_BORDER = "#1E1E1E";
const GOLD = "#B8962E";
const GOLD_LIGHT = "#C9A962";
const TX = "#E8E5E0";
const TX2 = "#AAA59E";
const TX3 = "#6B6560";
const WINE = "#5C1A33";

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
  /* Outer rounded wrapper: so the container housing everything has rounded corners, not a square frame. */
  const roundedWrapperStyle = `max-width:560px;margin:0 auto;border-radius:20px;overflow:hidden;background:${BG};border:1px solid ${CARD_BORDER};box-sizing:border-box`;
  const card = `
    <div style="${roundedWrapperStyle};font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TX};padding:0">
      <!-- Header -->
      <div style="text-align:center;padding:36px 36px 0">
        <img src="${logoUrl}" alt="YUGO+" width="90" height="25" style="display:inline-block;max-width:90px;height:auto;border:0" />
        <div style="width:40px;height:1px;background:${GOLD};margin:16px auto 0"></div>
      </div>
      <!-- Body -->
      <div style="padding:28px 36px 36px">
        ${innerHtml}
      </div>
      <!-- Footer: logo image (not text) so branding matches header -->
      <div style="border-top:1px solid ${CARD_BORDER};padding:24px 36px;text-align:center">
        <img src="${logoUrl}" alt="YUGO+" width="80" height="22" style="display:inline-block;max-width:80px;height:auto;border:0" />
        <div style="font-size:10px;color:${TX3};margin-top:8px">The Art of Moving</div>
      </div>
    </div>
  `;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link href="${INSTRUMENT_SERIF_LINK}" rel="stylesheet" />
  <style type="text/css">${INSTRUMENT_SERIF_FACE}</style>
</head>
<body style="margin:0;padding:0;background:${BG};display:flex;align-items:flex-start;justify-content:center;padding:24px 0;box-sizing:border-box">
  ${card}
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
    <div style="display:inline-block;background:${GOLD}22;border:1px solid ${GOLD};border-radius:999px;padding:6px 14px;margin:0 0 20px">
      <span style="font-size:10px;font-weight:700;color:${GOLD_LIGHT};letter-spacing:0.8px;text-transform:uppercase">&#10003; Guaranteed flat rate</span>
    </div>
  `;
}

function expiryNote(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const d = new Date(expiresAt);
  const formatted = d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
  return `
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:10px;padding:14px 18px;margin:0 0 28px">
      <span style="font-size:12px;color:${GOLD_LIGHT};font-weight:600">This quote is valid until ${formatted}. Book now to secure your rate.</span>
    </div>
  `;
}

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="display:block;background:${GOLD};color:${BG};padding:11px 28px;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none;text-align:center;margin:28px 0 10px;letter-spacing:0.6px">
      ${label}
    </a>
    <p style="font-size:10px;color:${TX3};text-align:center;margin:0 0 20px">Takes less than 2 minutes</p>
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
    <div style="border-top:1px solid ${CARD_BORDER};margin:28px 0 0;padding-top:24px">
      <div style="font-size:9px;font-weight:700;color:${TX3};text-transform:uppercase;letter-spacing:1.8px;margin-bottom:16px">The Yugo Difference</div>
      <table style="width:100%;border-collapse:collapse">
        ${items.map(([strong, rest]) => `
          <tr>
            <td style="padding:7px 0;font-size:12px;color:${GOLD};vertical-align:top;width:20px">&#10003;</td>
            <td style="padding:7px 0;font-size:12px;color:${TX2};line-height:1.5"><strong style="color:${TX}">${strong}</strong> &mdash; ${rest}</td>
          </tr>
        `).join("")}
      </table>
    </div>
  `;
}

function questionsFooter(coordinatorName?: string | null, coordinatorPhone?: string | null): string {
  const contact = coordinatorName
    ? `Reach out to ${coordinatorName}${coordinatorPhone ? ` at ${coordinatorPhone}` : ""} or reply to this email.`
    : "Simply reply to this email &mdash; we typically respond within a few hours.";
  return `
    <div style="border-top:1px solid ${CARD_BORDER};padding-top:20px;margin-top:24px">
      <div style="font-size:12px;color:${TX2};line-height:1.6">
        <strong style="color:${TX}">Have questions?</strong> ${contact}
      </div>
    </div>
  `;
}

/** Value cell style: no underline so addresses don’t look like links */
const valueCellStyle = `color:${TX};font-weight:600;padding:6px 0;text-align:right;font-size:12px;line-height:1.5;text-decoration:none`;

function detailRow(label: string, value: string): string {
  return `<tr><td style="color:${TX3};padding:6px 0;font-size:12px;vertical-align:top;line-height:1.5">${label}</td><td style="${valueCellStyle}">${value}</td></tr>`;
}

/** Move details as a plain table — no card/div wrapper, details just lay on the page */
function detailsPlain(rows: [string, string][]): string {
  if (rows.length === 0) return "";
  return `
    <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Move Details</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${rows.map(([l, v]) => detailRow(l, v)).join("")}
    </table>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>, recommendedTier?: string | null): string {
  const order = ["curated", "signature", "estate"];
  const rec = recommendedTier || "signature";

  const tierBgs: Record<string, string> = {
    curated: CARD,
    signature: "#181510",
    estate: "#160D12",
  };
  const tierBorders: Record<string, string> = {
    curated: CARD_BORDER,
    signature: `${GOLD}44`,
    estate: `${WINE}66`,
  };
  const tierAccents: Record<string, string> = {
    curated: TX3,
    signature: GOLD,
    estate: WINE,
  };

  const badgeLabels: Record<string, Record<string, string>> = {
    curated: { curated: "", signature: "Upgrade available", estate: "Premium option" },
    signature: { curated: "", signature: "RECOMMENDED", estate: "For the ultimate experience" },
    estate: { curated: "", signature: "", estate: "RECOMMENDED FOR YOU" },
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t = tiers[key];
      const label = TIER_LABELS[key] ?? t.label ?? key;
      const accent = tierAccents[key] ?? TX3;
      const isRec = key === rec;
      const badgeText = badgeLabels[rec]?.[key] ?? "";

      const padding = isRec ? "24px" : "16px";
      const priceFontSize = isRec ? "32px" : "22px";
      const borderWidth = isRec ? "2px" : "1px";
      const borderColor = isRec
        ? (key === "estate" ? WINE : GOLD)
        : (tierBorders[key] ?? CARD_BORDER);

      const badge = badgeText
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:${isRec ? (key === "estate" ? WINE : GOLD) : `${TX3}33`};color:${isRec ? BG : TX2};margin-left:8px;letter-spacing:0.5px;vertical-align:middle">${badgeText}</span>`
        : "";

      const includesHtml = isRec
        ? (t.includes || []).filter(Boolean).map((i) => `<span style="color:${GOLD}">&#10003;</span> ${i}`).join("<br/>")
        : "";

      return `
        <div style="background:${tierBgs[key] ?? CARD};border:${borderWidth} solid ${borderColor};border-radius:12px;padding:${padding};margin-bottom:14px">
          <div style="font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">
            ${label}${badge}
          </div>
          <div style="font-family:'Instrument Serif',serif;font-size:${priceFontSize};font-weight:700;color:${TX};margin-bottom:${isRec ? "12px" : "4px"}">${formatCurrency(t.price)}</div>
          ${includesHtml ? `<div style="font-size:11px;color:${TX2};line-height:1.8">${includesHtml}</div>` : ""}
        </div>
      `;
    })
    .join("");
}

function estateRecommendationNote(recommendedTier: string | null | undefined): string {
  if (recommendedTier !== "estate") return "";
  return `
    <div style="background:${CARD};border:1px solid ${WINE}44;border-radius:10px;padding:14px 18px;margin:0 0 20px">
      <span style="font-size:12px;color:${TX2};line-height:1.6">Based on your home and belongings, we recommend our <strong style="color:${TX}">Estate</strong> package for complete peace of mind.</span>
    </div>
  `;
}

function priceCard(label: string, price: number, note: string): string {
  return `
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">${label}</div>
      <div style="font-family:'Instrument Serif',serif;font-size:32px;font-weight:700;color:${GOLD_LIGHT}">${formatCurrency(price)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:6px">${note}</div>
    </div>
  `;
}

function coordinatorBlock(name?: string | null, phone?: string | null): string {
  if (!name) return "";
  return `
    <div style="border-top:1px solid ${CARD_BORDER};padding-top:18px;margin:18px 0 22px">
      <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:1.5px;margin-bottom:6px">Your Coordinator</div>
      <div style="font-size:13px;color:${TX};font-weight:600">${name}</div>
      ${phone ? `<div style="font-size:12px;color:${TX2};margin-top:3px">${phone}</div>` : ""}
    </div>
  `;
}

function heading(text: string): string {
  return `<h1 style="font-family:'Instrument Serif',serif;font-size:28px;font-weight:400;margin:0 0 12px;color:${TX};line-height:1.3">${text}</h1>`;
}

function subHeading(text: string): string {
  return `<div style="font-size:9px;font-weight:700;color:${GOLD};letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">${text}</div>`;
}

function bodyText(text: string): string {
  return `<p style="font-size:14px;color:${TX2};line-height:1.7;margin:0 0 28px">${text}</p>`;
}

/* ─── Templates ─── */

/* Residential (3-tier) */
function residentialTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.moveSize) rows.push(["Move Size", formatMoveSize(d.moveSize)]);
  if (d.fromAddress) rows.push(["From", d.fromAddress]);
  if (d.toAddress) rows.push(["To", d.toAddress]);
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
    ${d.tiers ? tierCards(d.tiers, d.recommendedTier) : ""}
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
    ${d.tiers ? tierCards(d.tiers, d.recommendedTier) : ""}
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
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Relocation Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Thank you for considering YUGO+ for your office relocation. We have prepared a tailored proposal with flat-rate pricing, project management, and IT equipment handling included.")}
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
  const rows: [string, string][] = [];
  if (d.eventName) rows.push(["Event", d.eventName]);
  if (d.toAddress) rows.push(["Venue", d.toAddress]);
  if (d.fromAddress) rows.push(["Origin", d.fromAddress]);
  rows.push(["Delivery", dateDisplay(d.moveDate)]);
  if (d.eventReturnDate) rows.push(["Return", dateDisplay(d.eventReturnDate)]);
  if (d.estCrewSize != null && d.estCrewSize > 0) rows.push(["Crew", `${d.estCrewSize} movers`]);
  if (d.truckSize) rows.push(["Truck", d.truckSize]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);
  const deposit = Math.max(300, Math.round((total + tax) * 0.25));

  const breakdown: string[] = [];
  if (d.eventDeliveryCharge) breakdown.push(`Delivery: ${formatCurrency(d.eventDeliveryCharge)}`);
  if (d.eventSetupFee) breakdown.push(`Setup at venue: ${formatCurrency(d.eventSetupFee)}`);
  if (d.eventReturnCharge) breakdown.push(`Return: ${formatCurrency(d.eventReturnCharge)}`);
  const breakdownHtml = breakdown.length > 0
    ? `<div style="font-size:11px;color:${TX2};line-height:1.9;margin-bottom:8px">${breakdown.join(`<br/>`)}</div>`
    : "";

  return quoteEmailLayout(`
    ${subHeading("Event Logistics Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your event logistics quote is ready. We handle delivery to venue, on-site setup, and return teardown \u2014 same crew both days so they know the layout.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">Event Quote</div>
      ${breakdownHtml}
      <div style="border-top:1px solid ${CARD_BORDER};margin:10px 0 12px"></div>
      <div style="font-family:'Instrument Serif',serif;font-size:32px;font-weight:700;color:${GOLD_LIGHT}">${formatCurrency(total)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:6px">+${formatCurrency(tax)} HST &middot; Total ${formatCurrency(total + tax)}</div>
      <div style="font-size:11px;color:${TX3};margin-top:4px">Deposit to confirm both dates: <strong style="color:${TX}">${formatCurrency(deposit)}</strong></div>
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
      <div style="font-family:'Instrument Serif',serif;font-size:32px;font-weight:700;color:${GOLD_LIGHT}">${formatCurrency(total)}</div>
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
  rows.push(["Date", dateDisplay(d.moveDate)]);

  const total = d.customPrice ?? 0;
  const tax = Math.round(total * 0.13);

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your commercial delivery quote is ready. Professional crew with full equipment \u2014 flat-rate, no hidden fees.")}
    ${expiryNote(d.expiresAt)}
    ${detailsPlain(rows)}
    ${priceCard("Delivery — All Inclusive", total, `+${formatCurrency(tax)} HST \u00b7 Full payment at booking`)}
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
