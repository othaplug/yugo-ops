import { emailLayout } from "@/lib/email-templates";
import { formatCurrency } from "@/lib/format-currency";

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
  return `<p style="font-size:11px;color:#D48A29;margin:0 0 16px">This quote expires ${formatted}.</p>`;
}

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="display:block;background:#C9A962;color:#0D0D0D;padding:16px 28px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;text-align:center;margin:24px 0 16px">
      ${label} &rarr;
    </a>
  `;
}

function detailRow(label: string, value: string): string {
  return `<tr><td style="color:#666;padding:4px 0;font-size:12px">${label}:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right;font-size:12px">${value}</td></tr>`;
}

function detailsCard(rows: [string, string][]): string {
  return `
    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([l, v]) => detailRow(l, v)).join("")}
      </table>
    </div>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>): string {
  const order = ["essentials", "premier", "estate"];
  const highlights: Record<string, string> = {
    essentials: "rgba(232,229,224,0.08)",
    premier: "rgba(201,169,98,0.12)",
    estate: "rgba(201,169,98,0.20)",
  };
  const badges: Record<string, string> = {
    premier: '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:#C9A962;color:#0D0D0D;margin-left:6px">POPULAR</span>',
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t = tiers[key];
      return `
        <div style="background:${highlights[key] ?? "#1E1E1E"};border:1px solid ${key === "premier" ? "rgba(201,169,98,0.4)" : "#2A2A2A"};border-radius:10px;padding:16px;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:#C9A962;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
            ${t.label}${badges[key] ?? ""}
          </div>
          <div style="font-family:serif;font-size:24px;font-weight:700;color:#F5F5F3;margin-bottom:10px">${formatCurrency(t.price)}</div>
          <div style="font-size:11px;color:#999;line-height:1.6">
            ${t.includes.map((i) => `&check; ${i}`).join("<br/>")}
          </div>
        </div>
      `;
    })
    .join("");
}

function coordinatorBlock(name?: string | null, phone?: string | null): string {
  if (!name) return "";
  return `
    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your Coordinator</div>
      <div style="font-size:13px;color:#E8E5E0;font-weight:600">${name}</div>
      ${phone ? `<div style="font-size:12px;color:#999;margin-top:2px">${phone}</div>` : ""}
    </div>
  `;
}

/* ── Residential (3-tier) ── */
function residentialTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.moveSize) rows.push(["Move Size", d.moveSize]);
  if (d.fromAddress) rows.push(["From", d.fromAddress]);
  if (d.toAddress) rows.push(["To", d.toAddress]);
  rows.push(["Date", dateDisplay(d.moveDate)]);

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Moving Quote</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Thanks for choosing YUGO. Here&apos;s your personalized moving quote with three package options.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${d.tiers ? tierCards(d.tiers) : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
    <p style="font-size:11px;color:#666;text-align:center">
      All prices are flat-rate. No hidden fees, ever.
    </p>
  `);
}

/* ── Long Distance ── */
function longDistanceTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.fromAddress) rows.push(["Origin", d.fromAddress]);
  if (d.toAddress) rows.push(["Destination", d.toAddress]);
  if (d.distance) rows.push(["Distance", d.distance]);
  if (d.moveSize) rows.push(["Move Size", d.moveSize]);
  rows.push(["Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Long Distance Quote</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your long distance moving quote is ready. We&apos;ve calculated a flat rate based on your route and inventory.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;font-weight:700;margin-bottom:6px">Flat Rate</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#999;margin-top:4px">+ HST &middot; No hidden fees</div>
      </div>
    ` : ""}
    ${d.tiers ? tierCards(d.tiers) : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
  `);
}

/* ── Office Move ── */
function officeTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.companyName) rows.push(["Company", d.companyName]);
  if (d.fromAddress) rows.push(["Current Office", d.fromAddress]);
  if (d.toAddress) rows.push(["New Office", d.toAddress]);
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Relocation Proposal</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Thank you for considering YUGO for your office relocation. Please find your tailored proposal below.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;font-weight:700;margin-bottom:6px">Project Estimate</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#999;margin-top:4px">+ HST &middot; Flat-rate guarantee</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
    <p style="font-size:11px;color:#666;text-align:center">
      Includes project management, IT equipment handling, and post-move support.
    </p>
  `);
}

/* ── Single Item ── */
function singleItemTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.itemDescription) rows.push(["Item", d.itemDescription]);
  if (d.itemCategory) rows.push(["Category", d.itemCategory]);
  if (d.fromAddress) rows.push(["Pickup", d.fromAddress]);
  if (d.toAddress) rows.push(["Delivery", d.toAddress]);
  rows.push(["Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Delivery Quote</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your delivery quote is ready. We&apos;ll handle your item with care from pickup to placement.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;font-weight:700;margin-bottom:6px">Flat Price</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#999;margin-top:4px">+ HST &middot; All-inclusive</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
  `);
}

/* ── White Glove ── */
function whiteGloveTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.itemDescription) rows.push(["Item", d.itemDescription]);
  if (d.fromAddress) rows.push(["Pickup", d.fromAddress]);
  if (d.toAddress) rows.push(["Delivery", d.toAddress]);
  rows.push(["Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice ?? d.tiers?.essentials?.price;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">White Glove Service Quote</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your white glove service quote is ready. Premium handling with custom crating, climate control, and full insurance.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;font-weight:700;margin-bottom:6px">Premium Service Rate</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#999;margin-top:4px">+ HST &middot; Enhanced insurance included</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
  `);
}

/* ── Specialty ── */
function specialtyTemplate(d: QuoteTemplateData): string {
  const rows: [string, string][] = [];
  if (d.projectType) rows.push(["Project Type", d.projectType]);
  if (d.fromAddress) rows.push(["From", d.fromAddress]);
  if (d.toAddress) rows.push(["To", d.toAddress]);
  rows.push(["Target Date", dateDisplay(d.moveDate)]);

  const price = d.customPrice;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Specialty Service Proposal</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Thank you for reaching out about your specialty project. We&apos;ve put together a custom proposal for you.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#999;text-transform:uppercase;font-weight:700;margin-bottom:6px">Custom Quote</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#999;margin-top:4px">+ HST &middot; Includes all specialized equipment</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
  `);
}

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
