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
  essentials: "Essentials",
  premier: "Premier",
  estate: "Estate",
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

function quoteEmailLayout(innerHtml: string): string {
  const base = getEmailBaseUrl();
  const logoUrl = `${base}/images/yugo-logo-gold.png`;
  return `
    <div style="font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:${BG};color:${TX};padding:0;border-radius:16px;overflow:hidden;border:1px solid ${CARD_BORDER}">
      <!-- Header -->
      <div style="text-align:center;padding:36px 36px 0">
        <img src="${logoUrl}" alt="YUGO" width="90" height="25" style="display:inline-block;max-width:90px;height:auto;border:0" />
        <div style="width:40px;height:1px;background:${GOLD};margin:16px auto 0"></div>
      </div>
      <!-- Body -->
      <div style="padding:28px 36px 36px">
        ${innerHtml}
      </div>
      <!-- Footer -->
      <div style="border-top:1px solid ${CARD_BORDER};padding:24px 36px;text-align:center">
        <div style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:13px;font-weight:600;letter-spacing:2px;color:${GOLD}">YUGO</div>
        <div style="font-size:10px;color:${TX3};margin-top:6px">The Art of Moving</div>
      </div>
    </div>
  `;
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
  tiers?: Record<string, QuoteTier> | null;
  customPrice?: number | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
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
  const formatted = d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
  return `
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:10px;padding:14px 18px;margin:0 0 28px">
      <span style="font-size:12px;color:${GOLD_LIGHT};font-weight:600">This quote is valid until ${formatted}. Book now to secure your rate.</span>
    </div>
  `;
}

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="display:block;background:${GOLD};color:${BG};padding:16px 28px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;text-align:center;margin:28px 0 10px;letter-spacing:0.5px">
      ${label}
    </a>
    <p style="font-size:10px;color:${TX3};text-align:center;margin:0 0 20px">Takes less than 2 minutes</p>
  `;
}

function whyYugoBlock(): string {
  const items = [
    ["Flat-rate guarantee", "no hidden fees, no surprises"],
    ["Real-time tracking", "follow your crew live from your phone"],
    ["Only $100 deposit", "balance due before your move"],
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

function detailRow(label: string, value: string): string {
  return `<tr><td style="color:${TX3};padding:6px 0;font-size:12px;vertical-align:top;line-height:1.5">${label}</td><td style="color:${TX};font-weight:600;padding:6px 0;text-align:right;font-size:12px;line-height:1.5">${value}</td></tr>`;
}

function detailsCard(rows: [string, string][]): string {
  return `
    <div style="border:1px solid ${CARD_BORDER};border-radius:12px;padding:20px;margin-bottom:24px;background:${CARD}">
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([l, v]) => detailRow(l, v)).join("")}
      </table>
    </div>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>): string {
  const order = ["essentials", "premier", "estate"];
  const tierBgs: Record<string, string> = {
    essentials: CARD,
    premier: "#181510",
    estate: "#160D12",
  };
  const tierBorders: Record<string, string> = {
    essentials: CARD_BORDER,
    premier: `${GOLD}44`,
    estate: `${WINE}66`,
  };
  const tierAccents: Record<string, string> = {
    essentials: TX3,
    premier: GOLD,
    estate: WINE,
  };
  const badges: Record<string, string> = {
    premier: `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:${GOLD};color:${BG};margin-left:8px;letter-spacing:0.5px;vertical-align:middle">POPULAR</span>`,
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t = tiers[key];
      const label = TIER_LABELS[key] ?? t.label ?? key;
      const accent = tierAccents[key] ?? TX3;
      return `
        <div style="background:${tierBgs[key] ?? CARD};border:1px solid ${tierBorders[key] ?? CARD_BORDER};border-radius:12px;padding:20px;margin-bottom:14px">
          <div style="font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">
            ${label}${badges[key] ?? ""}
          </div>
          <div style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;color:${TX};margin-bottom:12px">${formatCurrency(t.price)}</div>
          <div style="font-size:11px;color:${TX2};line-height:1.8">
            ${(t.includes || []).filter(Boolean).map((i) => `<span style="color:${GOLD}">&#10003;</span> ${i}`).join("<br/>")}
          </div>
        </div>
      `;
    })
    .join("");
}

function priceCard(label: string, price: number, note: string): string {
  return `
    <div style="background:${CARD};border:1px solid ${GOLD}33;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
      <div style="font-size:9px;color:${TX3};text-transform:uppercase;font-weight:700;letter-spacing:1.5px;margin-bottom:8px">${label}</div>
      <div style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;color:${GOLD_LIGHT}">${formatCurrency(price)}</div>
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
  return `<h1 style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;margin:0 0 12px;color:${TX};line-height:1.3">${text}</h1>`;
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

  return quoteEmailLayout(`
    ${subHeading("Your Moving Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("We have prepared your personalized moving quote with three flat-rate packages. Choose the level of service that fits your needs &mdash; every option includes professional movers, a dedicated truck, and full protection.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${d.tiers ? tierCards(d.tiers) : ""}
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

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Long Distance Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your long distance moving quote is ready. We have calculated a flat rate based on your route and inventory &mdash; no surprises on arrival day.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? priceCard("Flat Rate", price, "+ HST &middot; No hidden fees") : ""}
    ${d.tiers ? tierCards(d.tiers) : ""}
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
    ${bodyText("Thank you for considering YUGO for your office relocation. We have prepared a tailored proposal with flat-rate pricing, project management, and IT equipment handling included.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
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

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("Your Delivery Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your delivery quote is ready. We will handle your item with care from pickup to placement &mdash; fully insured, flat-rate, no surprises.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
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

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return quoteEmailLayout(`
    ${subHeading("White Glove Service Quote")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Your white glove service quote is ready. Premium handling with custom crating, climate control, and enhanced insurance &mdash; your valuables deserve the best.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
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

  const price = d.customPrice;

  return quoteEmailLayout(`
    ${subHeading("Specialty Service Proposal")}
    ${heading(`Hi${d.clientName ? ` ${d.clientName}` : ""}`,)}
    ${bodyText("Thank you for reaching out about your specialty project. We have put together a custom proposal with all specialized equipment and handling included.")}
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? priceCard("Custom Quote", price, "+ HST &middot; Includes all specialized equipment") : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
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
};

export function renderQuoteTemplate(template: string, data: QuoteTemplateData): string {
  const renderer = TEMPLATE_MAP[template];
  if (!renderer) throw new Error(`Unknown quote template: ${template}`);
  return renderer(data);
}
