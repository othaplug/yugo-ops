import { formatCurrency } from "@/lib/format-currency";
import { getEmailBaseUrl } from "@/lib/email-base-url";

function quoteEmailLayout(innerHtml: string): string {
  const base = getEmailBaseUrl();
  const logoUrl = `${base}/images/yugo-logo-gold.png`;
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#FAF7F2;color:#2C2C2C;padding:40px 36px;border-radius:14px;border:1px solid rgba(92,26,51,0.08)">
      <div style="text-align:center;margin-bottom:32px">
        <img src="${logoUrl}" alt="YUGO" width="100" height="28" style="display:inline-block;max-width:100px;height:auto;border:0" />
      </div>
      ${innerHtml}
      <div style="font-size:10px;color:#8A8580;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid rgba(92,26,51,0.08)">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#5C1A33">YUGO</span>
        <span style="color:#AAA;margin:0 6px">&middot;</span>
        Premium Moving Services
        <div style="margin-top:6px;font-size:9px;color:#AAA">Toronto &amp; GTA</div>
      </div>
    </div>
  `;
}

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
  return `
    <div style="background:rgba(92,26,51,0.06);border:1px solid rgba(92,26,51,0.15);border-radius:8px;padding:12px 16px;margin:0 0 24px">
      <span style="font-size:12px;color:#5C1A33;font-weight:600">This quote is valid until ${formatted}. Book now to secure your rate.</span>
    </div>
  `;
}

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="display:block;background:#5C1A33;color:#FAF7F2;padding:18px 28px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;text-align:center;margin:28px 0 12px;letter-spacing:0.5px">
      ${label}
    </a>
    <p style="font-size:10px;color:#888;text-align:center;margin:0 0 20px">Takes less than 2 minutes</p>
  `;
}

function whyYugoBlock(): string {
  return `
    <div style="border-top:1px solid rgba(92,26,51,0.12);margin:24px 0;padding-top:20px">
      <div style="font-size:9px;font-weight:700;color:#5C1A33;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px">The Yugo Difference</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#5C1A33;vertical-align:top;width:20px">&#10003;</td>
          <td style="padding:6px 0;font-size:12px;color:#4A4540"><strong style="color:#2C2C2C">Flat-rate guarantee</strong> &mdash; no hidden fees, no surprises</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#5C1A33;vertical-align:top">&#10003;</td>
          <td style="padding:6px 0;font-size:12px;color:#4A4540"><strong style="color:#2C2C2C">Real-time tracking</strong> &mdash; follow your crew live from your phone</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#5C1A33;vertical-align:top">&#10003;</td>
          <td style="padding:6px 0;font-size:12px;color:#4A4540"><strong style="color:#2C2C2C">Only $100 deposit</strong> &mdash; balance due before your move</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#5C1A33;vertical-align:top">&#10003;</td>
          <td style="padding:6px 0;font-size:12px;color:#4A4540"><strong style="color:#2C2C2C">Fully insured</strong> &mdash; $2M commercial liability coverage</td>
        </tr>
      </table>
    </div>
  `;
}

function questionsFooter(coordinatorName?: string | null, coordinatorPhone?: string | null): string {
  const contact = coordinatorName
    ? `Reach out to ${coordinatorName}${coordinatorPhone ? ` at ${coordinatorPhone}` : ""} or reply to this email.`
    : "Simply reply to this email &mdash; we typically respond within a few hours.";
  return `
    <div style="border-top:1px solid rgba(92,26,51,0.10);padding-top:16px;margin-top:24px">
      <div style="font-size:12px;color:#6B6560;line-height:1.6">
        <strong style="color:#2C2C2C">Have questions?</strong> ${contact}
      </div>
    </div>
  `;
}

function detailRow(label: string, value: string): string {
  return `<tr><td style="color:#8A8580;padding:5px 0;font-size:12px;vertical-align:top">${label}</td><td style="color:#2C2C2C;font-weight:600;padding:5px 0;text-align:right;font-size:12px">${value}</td></tr>`;
}

function detailsCard(rows: [string, string][]): string {
  return `
    <div style="border:1px solid rgba(92,26,51,0.10);border-radius:10px;padding:20px;margin-bottom:20px;background:rgba(92,26,51,0.02)">
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([l, v]) => detailRow(l, v)).join("")}
      </table>
    </div>
  `;
}

function tierCards(tiers: Record<string, QuoteTier>): string {
  const order = ["essentials", "premier", "estate"];
  const highlights: Record<string, string> = {
    essentials: "#FFFFFF",
    premier: "rgba(92,26,51,0.04)",
    estate: "rgba(92,26,51,0.08)",
  };
  const borders: Record<string, string> = {
    essentials: "rgba(0,0,0,0.08)",
    premier: "rgba(92,26,51,0.20)",
    estate: "rgba(92,26,51,0.30)",
  };
  const badges: Record<string, string> = {
    premier: '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:#5C1A33;color:#FAF7F2;margin-left:6px;letter-spacing:0.5px">POPULAR</span>',
  };

  return order
    .filter((k) => tiers[k])
    .map((key) => {
      const t = tiers[key];
      return `
        <div style="background:${highlights[key] ?? "#FFF"};border:1px solid ${borders[key] ?? "rgba(0,0,0,0.08)"};border-radius:10px;padding:18px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:700;color:#5C1A33;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:6px">
            ${t.label}${badges[key] ?? ""}
          </div>
          <div style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;font-weight:700;color:#2C2C2C;margin-bottom:10px">${formatCurrency(t.price)}</div>
          <div style="font-size:11px;color:#6B6560;line-height:1.7">
            ${t.includes.filter(Boolean).map((i) => `&#10003; ${i}`).join("<br/>")}
          </div>
        </div>
      `;
    })
    .join("");
}

function coordinatorBlock(name?: string | null, phone?: string | null): string {
  if (!name) return "";
  return `
    <div style="border-top:1px solid rgba(92,26,51,0.10);padding-top:16px;margin:16px 0 20px">
      <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Your Coordinator</div>
      <div style="font-size:13px;color:#2C2C2C;font-weight:600">${name}</div>
      ${phone ? `<div style="font-size:12px;color:#6B6560;margin-top:2px">${phone}</div>` : ""}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Moving Quote</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      We have prepared your personalized moving quote with three flat-rate packages. Choose the level of service that fits your needs &mdash; every option includes professional movers, a dedicated truck, and full protection.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${d.tiers ? tierCards(d.tiers) : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
    ${whyYugoBlock()}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Long Distance Quote</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      Your long distance moving quote is ready. We have calculated a flat rate based on your route and inventory &mdash; no surprises on arrival day.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(92,26,51,0.04);border:1px solid rgba(92,26,51,0.12);border-radius:10px;padding:22px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Flat Rate</div>
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;color:#5C1A33">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#8A8580;margin-top:4px">+ HST &middot; No hidden fees</div>
      </div>
    ` : ""}
    ${d.tiers ? tierCards(d.tiers) : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Quote & Book")}
    ${whyYugoBlock()}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Relocation Proposal</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      Thank you for considering YUGO for your office relocation. We have prepared a tailored proposal with flat-rate pricing, project management, and IT equipment handling included.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(92,26,51,0.04);border:1px solid rgba(92,26,51,0.12);border-radius:10px;padding:22px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Project Estimate</div>
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;color:#5C1A33">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#8A8580;margin-top:4px">+ HST &middot; Flat-rate guarantee</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Delivery Quote</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      Your delivery quote is ready. We will handle your item with care from pickup to placement &mdash; fully insured, flat-rate, no surprises.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(92,26,51,0.04);border:1px solid rgba(92,26,51,0.12);border-radius:10px;padding:22px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Flat Price</div>
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;color:#5C1A33">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#8A8580;margin-top:4px">+ HST &middot; All-inclusive</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">White Glove Service Quote</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      Your white glove service quote is ready. Premium handling with custom crating, climate control, and enhanced insurance &mdash; your valuables deserve the best.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(92,26,51,0.04);border:1px solid rgba(92,26,51,0.12);border-radius:10px;padding:22px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Premium Service Rate</div>
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;color:#5C1A33">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#8A8580;margin-top:4px">+ HST &middot; Enhanced insurance included</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Quote & Book")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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

  return quoteEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Specialty Service Proposal</div>
    <h1 style="font-family:'Instrument Serif',Georgia,serif;font-size:28px;font-weight:400;margin:0 0 10px;color:#2C2C2C">Hi${d.clientName ? ` ${d.clientName}` : ""},</h1>
    <p style="font-size:14px;color:#6B6560;line-height:1.7;margin:0 0 28px">
      Thank you for reaching out about your specialty project. We have put together a custom proposal with all specialized equipment and handling included.
    </p>
    ${expiryNote(d.expiresAt)}
    ${detailsCard(rows)}
    ${price ? `
      <div style="background:rgba(92,26,51,0.04);border:1px solid rgba(92,26,51,0.12);border-radius:10px;padding:22px;text-align:center;margin-bottom:20px">
        <div style="font-size:9px;color:#8A8580;text-transform:uppercase;font-weight:700;letter-spacing:1px;margin-bottom:6px">Custom Quote</div>
        <div style="font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;color:#5C1A33">${formatCurrency(price)}</div>
        <div style="font-size:11px;color:#8A8580;margin-top:4px">+ HST &middot; Includes all specialized equipment</div>
      </div>
    ` : ""}
    ${coordinatorBlock(d.coordinatorName, d.coordinatorPhone)}
    ${ctaButton(d.quoteUrl, "View Full Proposal")}
    ${questionsFooter(d.coordinatorName, d.coordinatorPhone)}
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
