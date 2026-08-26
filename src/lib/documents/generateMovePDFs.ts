/**
 * Auto-generate Move Summary, Invoice, and Receipt PDFs on move completion.
 * Uploads to Supabase Storage (move-documents), updates moves table.
 * Uses premium Yugo branding from @/lib/pdf-brand (logo, wine, gold, cream).
 */
import fs from "fs";
import path from "path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { getLegalBranding } from "@/lib/legal-branding";
import {
  WINE,
  DARK,
  GRAY,
  CREAM_BG,
  drawYugoFooter,
  drawBottomAccentBar,
  drawTopWineGradientBar,
  drawCenteredYugoLogoBlock,
  drawClientSignatureLetter,
  drawSectionHeading,
  getTableHeadStyles,
  TABLE_ALT_ROW,
  setSectionLabel,
  setBodyText,
  setHeroTitle,
  drawInfoBox,
} from "@/lib/pdf-brand";
import { isMoveRowLogisticsDelivery } from "@/lib/quotes/b2b-quote-copy";

const BUCKET = "move-documents";

const TIER_FEATURES: Record<string, string> = {
  essential: "Professional crew, dedicated truck, protective wrapping for key furniture, floor & entryway protection.",
  curated: "Professional crew, dedicated truck, protective wrapping for key furniture, floor & entryway protection.",
  essentials: "Standard crew, truck, basic wrap & pad, local move support.",
  signature: "Fully managed move, full furniture wrapping, room-of-choice placement, wardrobe box, debris removal.",
  estate: "White glove service, dedicated coordinator, full wrapping & packing, precision placement, 30-day concierge.",
  premium: "Premium crew, premium truck, white-glove handling, priority support.",
};

const LOGISTICS_INCLUDED_FALLBACK =
  "Licensed, insured logistics professionals, vehicle, equipment, and delivery handling as agreed.";

type MoveRow = {
  id: string;
  move_code: string | null;
  move_number?: string | null;
  service_type?: string | null;
  move_type?: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  from_address: string | null;
  to_address: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  tier_selected: string | null;
  estimate: number | null;
  amount?: number | null;
  deposit_amount: number | null;
  balance_amount: number | null;
  deposit_paid_at: string | null;
  balance_paid_at: string | null;
  crew_id: string | null;
  /** Per-job snapshot of the specific crew members assigned to this move.
   *  Prefer this over the crew row's `members` field (which is the whole
   *  team roster and can carry names never dispatched to this job). */
  assigned_members?: string[] | null;
  /** Business name when the job is billed to a company (office move,
   *  B2B delivery, event with corporate billing, or any residential
   *  move flagged as commercial). Empty for individual bookings. */
  company_name?: string | null;
  business_type?: string | null;
  organization_id?: string | null;
  source_company?: string | null;
  truck_primary?: string | null;
  truck_secondary?: string | null;
  actual_hours?: number | null;
  est_hours?: number | null;
  valuation_tier?: string | null;
  addons?: unknown[] | null;
  [key: string]: unknown;
};

type CrewRow = { name: string | null; members: string[] | unknown } | null;
type InventoryRow = { room: string | null; item_name: string | null; box_number?: string | null }[];
type ExtraRow = { description: string | null; quantity: number | null; fee_cents: number | null; status?: string }[];

function moveDisplayId(m: MoveRow): string {
  return m.move_code || `MV-${m.id.slice(0, 8).toUpperCase()}`;
}

// Strip the leading letter prefix AND the separator hyphen so
// "MV-30356" becomes "30356", not "-30356" (which produced
// "INV--30356" / "REC--30356" on every invoice + receipt).
function jobNumericSuffix(m: MoveRow): string {
  const code = m.move_code || "";
  return code.replace(/^[A-Z]+-?/i, "") || m.id.slice(0, 4).toUpperCase();
}
function invoiceNumber(m: MoveRow): string {
  return `INV-${jobNumericSuffix(m)}`;
}
function receiptNumber(m: MoveRow): string {
  return `REC-${jobNumericSuffix(m)}`;
}

/** Yugo's GST/HST registration number, shown on every invoice per
 *  Canadian CRA rules for invoices over $30. Hardcoded — this is a
 *  company-level identifier that changes only if the business
 *  restructures. */
const YUGO_GST_HST_NUMBER = "762694743RT0001";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function loadYugoLogoBase64(): string {
  const dir = path.join(process.cwd(), "public", "images");
  for (const name of ["yugo-logo-wine.png", "yugo-logo-black.png"] as const) {
    try {
      const logoPath = path.join(dir, name);
      const base64 = fs.readFileSync(logoPath, { encoding: "base64" });
      return `data:image/png;base64,${base64}`;
    } catch {
      /* try next */
    }
  }
  return "";
}

/** Cream wordmark for the wine hero band on the redesigned move summary. */
function loadYugoWordmarkCreamBase64(): string {
  try {
    const p = path.join(process.cwd(), "public", "images", "yugo-logo-cream.png");
    return `data:image/png;base64,${fs.readFileSync(p, { encoding: "base64" })}`;
  } catch {
    return "";
  }
}

/** Brand ornament for the wine footer band on the redesigned PDFs.
 *  Uses the cream-tinted variant so it reads on the wine footer;
 *  falls back to the wine PNG if the cream file is missing (which
 *  would render dark-on-dark, hence why it looked black in prod). */
function loadYugoSymbolBase64(): string {
  const dir = path.join(process.cwd(), "public");
  for (const name of ["yugo-symbol-cream.png", "yugo-symbol.png"] as const) {
    try {
      const b64 = fs.readFileSync(path.join(dir, name), { encoding: "base64" });
      return `data:image/png;base64,${b64}`;
    } catch {
      /* try next */
    }
  }
  return "";
}

/** Cream wordmark aspect ratio, taken from the source PNG
 *  (public/images/yugo-logo-cream.png is 1024×277 → ratio ≈ 3.7).
 *  Any callers rendering the wordmark should use `WORDMARK_ASPECT`
 *  as the width factor so the mark never gets squeezed. */
const WORDMARK_ASPECT = 1024 / 277;

/** Register Instrument Serif with the jsPDF instance so setFont("InstrumentSerif")
 *  resolves. Returns the family name if the embed succeeded, or falls back to
 *  the built-in "times" if the TTF isn't on disk. */
function registerSerifFont(doc: jsPDF): string {
  const dir = path.join(process.cwd(), "public", "fonts", "instrument-serif");
  try {
    const reg = fs.readFileSync(path.join(dir, "InstrumentSerif-Regular.ttf"), { encoding: "base64" });
    doc.addFileToVFS("InstrumentSerif-Regular.ttf", reg);
    doc.addFont("InstrumentSerif-Regular.ttf", "InstrumentSerif", "normal");
  } catch {
    return "times";
  }
  try {
    const ita = fs.readFileSync(path.join(dir, "InstrumentSerif-Italic.ttf"), { encoding: "base64" });
    doc.addFileToVFS("InstrumentSerif-Italic.ttf", ita);
    doc.addFont("InstrumentSerif-Italic.ttf", "InstrumentSerif", "italic");
  } catch {
    /* italic optional */
  }
  return "InstrumentSerif";
}

/** Body sans for the editorial PDFs. Brown is Yugo's canonical body
 *  face on the web (public/fonts/brown/*.woff2), but the woff2 → TTF
 *  conversion via wawoff2 produced files that jsPDF's strict TTF
 *  parser accepts for registration but silently renders as blank
 *  glyphs when set to bold — so every eyebrow label on the first
 *  redesigned invoice + receipt disappeared. Until Brown ships as
 *  jsPDF-safe TTFs (fontforge-generated, with the glyf table jsPDF
 *  requires), all editorial PDFs use jsPDF's built-in "helvetica"
 *  for body sans. Renders reliably in normal + bold weights.
 *
 *  Kept as a function so the future switch is one line: reintroduce
 *  the addFileToVFS/addFont loader here and return "Brown". */
function registerBrownFont(_doc: jsPDF): string {
  return "helvetica";
}

/** ─── Editorial Move Summary helpers ────────────────────────────────────
 *  Small pure formatters used by the redesigned generateMoveSummaryPDF.
 *  Kept close to the generator so anything the PDF prints is defined in
 *  one file the operator can grep and reason about. */

const COUNT_WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
  "Eight", "Nine", "Ten", "Eleven", "Twelve",
];
function crewCountToWord(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "-";
  return COUNT_WORDS[n] ?? String(Math.round(n));
}

function serviceDisplay(
  serviceType: string | null | undefined,
  tierSelected: string | null | undefined,
): { label: string; caption: string } {
  const s = String(serviceType ?? "").toLowerCase();
  const tier = String(tierSelected ?? "").toLowerCase();
  if (s === "white_glove") {
    return { label: "White Glove", caption: "Premium handling and placement" };
  }
  if (s === "specialty") {
    return { label: "Specialty", caption: "Item-specific handling protocol" };
  }
  if (s === "single_item") {
    return { label: "Single Item", caption: "Item-level delivery" };
  }
  if (s === "labour_only") {
    return { label: "Labour Only", caption: "Crew hours, no transit" };
  }
  if (s === "event") {
    return { label: "Event Logistics", caption: "Venue delivery + return" };
  }
  if (s === "b2b_delivery" || s === "b2b_oneoff") {
    return { label: "B2B Delivery", caption: "Commercial logistics" };
  }
  if (s === "bin_rental") {
    return { label: "Bin Rental", caption: "Reusable move bins on rotation" };
  }
  if (s === "office_move") {
    return { label: "Office Move", caption: "Commercial relocation" };
  }
  if (s === "long_distance") {
    return { label: "Long Distance", caption: "Inter-city relocation" };
  }
  // Residential tier drives the label + caption for local moves
  if (s === "local_move") {
    if (tier === "estate") return { label: "Estate", caption: "White-glove residential move" };
    if (tier === "signature") return { label: "Signature", caption: "Full-service residential move" };
    return { label: "Essential", caption: "Transport with full protection" };
  }
  const fallback = (serviceType ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: fallback || "Move", caption: "As booked" };
}

function vehicleDisplay(primary: string | null | undefined, secondary?: string | null): string {
  const v = String(primary || secondary || "").toLowerCase();
  if (!v) return "-";
  if (v === "sprinter") return "Sprinter";
  if (v === "cube" || v === "cube_van") return "Cube Van";
  if (/^\d+ft$/.test(v)) return `${v.replace("ft", "ft")} Box Truck`;
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Valuation display per service. White-glove / specialty / office / event
 *  ship with Enhanced Protection by policy. Residential + long-distance
 *  default to Released but respect a coordinator-selected upgrade tier. */
function valuationDisplay(
  serviceType: string | null | undefined,
  valuationTier: string | null | undefined,
): { title: string; body: string } {
  const s = String(serviceType ?? "").toLowerCase();
  const t = String(valuationTier ?? "").toLowerCase().replace(/\s+/g, "_");
  const ENHANCED = {
    title: "Enhanced Protection",
    body:
      "Cargo liability at $5.00 per pound per article, total coverage up to $30,000, zero deductible. Full repair, or replacement at current market value where repair is not possible. Backed by our $5M commercial general liability.",
  };
  const FULL_REPLACEMENT = {
    title: "Full Replacement",
    body:
      "Full current market replacement value, up to $10,000 per item, up to $100,000 per shipment, zero deductible. Backed by our $5M commercial general liability.",
  };
  const RELEASED = {
    title: "Released Value",
    body:
      "Cargo liability at $0.60 per pound per article, the statutory baseline. Backed by our $5M commercial general liability.",
  };
  // Explicit upgrade rider on the row wins regardless of service.
  if (t === "enhanced" || t === "signature") return ENHANCED;
  if (t === "full_replacement" || t === "estate") return FULL_REPLACEMENT;
  // Service-level defaults.
  if (
    s === "white_glove" ||
    s === "specialty" ||
    s === "office_move" ||
    s === "event"
  ) {
    return ENHANCED;
  }
  return RELEASED;
}

function includedCopy(serviceType: string | null | undefined): string {
  const s = String(serviceType ?? "").toLowerCase();
  if (s === "white_glove" || s === "specialty") {
    return "Licensed and insured logistics professionals, a dedicated vehicle, all equipment, and premium white-glove handling as agreed at booking.";
  }
  if (s === "b2b_delivery" || s === "b2b_oneoff" || s === "single_item") {
    return "Licensed and insured logistics professionals, a dedicated vehicle, all equipment, and delivery handling as agreed at booking.";
  }
  if (s === "labour_only") {
    return "Licensed and insured labour crew, all equipment, and on-site handling as agreed at booking.";
  }
  if (s === "event") {
    return "Licensed and insured event crew, a dedicated vehicle, all equipment, setup, and teardown as agreed at booking.";
  }
  return "Licensed and insured movers, a dedicated truck, protective wrapping for key furniture, and floor + entryway protection.";
}

function eyebrowFor(serviceType: string | null | undefined): string {
  const s = String(serviceType ?? "").toLowerCase();
  if (
    s === "b2b_delivery" ||
    s === "b2b_oneoff" ||
    s === "single_item" ||
    s === "bin_rental"
  ) {
    return "DELIVERY SUMMARY";
  }
  return "MOVE SUMMARY";
}

function ledeFor(serviceType: string | null | undefined): string {
  const label = eyebrowFor(serviceType).toLowerCase();
  return `${label.charAt(0).toUpperCase() + label.slice(1)}, issued on completion. A record of the work carried out and the terms it was carried out under.`;
}

/** Bill-to block for the invoice / receipt header. Returns the party
 *  name (the entity being billed) as the large serif value, plus any
 *  attention/contact line that appears below. Company billing wins:
 *  a job with company_name shows "Acme Inc." as the party, with
 *  "Attn: Jane Doe" below; personal jobs show the client name as the
 *  party with contact lines below. */
function billTo(move: MoveRow): {
  party: string;
  attn?: string;
  isCompany: boolean;
} {
  const company = String(move.company_name ?? move.source_company ?? "").trim();
  const client = String(move.client_name ?? "").trim();
  const svc = String(move.service_type ?? "").toLowerCase();
  const isB2BService =
    svc === "b2b_delivery" ||
    svc === "b2b_oneoff" ||
    svc === "office_move";
  if (company) {
    return {
      party: company,
      attn: client && client.toLowerCase() !== company.toLowerCase() ? `Attn: ${client}` : undefined,
      isCompany: true,
    };
  }
  if (isB2BService && client) {
    return { party: client, isCompany: true };
  }
  return { party: client || "-", isCompany: false };
}

/** Line-item label for the invoice's first row per service type.
 *  Reuses serviceDisplay() so the label matches the summary but adds
 *  the "delivery service" / "move" suffix the invoice reads more
 *  naturally with. */
function invoiceLineLabel(
  serviceType: string | null | undefined,
  tierSelected: string | null | undefined,
): string {
  const s = String(serviceType ?? "").toLowerCase();
  const svc = serviceDisplay(s, tierSelected);
  if (
    s === "b2b_delivery" ||
    s === "b2b_oneoff" ||
    s === "single_item"
  ) {
    return `${svc.label} · Delivery service`;
  }
  if (s === "bin_rental") {
    return `${svc.label} · Rental package`;
  }
  if (s === "labour_only") {
    return `${svc.label} · Labour service`;
  }
  if (s === "event") {
    return `${svc.label} · Event service`;
  }
  if (s === "white_glove" || s === "specialty") {
    return `${svc.label} · Delivery service`;
  }
  if (s === "office_move") {
    return `${svc.label} · Relocation service`;
  }
  return `${svc.label} · Move service`;
}

/** Parse an inventory item name that may carry a "xN" / "×N" suffix
 *  (coordinators write "Quartz high-top tables x6" as a single string
 *  because move_inventory has no quantity column). Returns the clean
 *  name and the quantity so the PDF can print each in its own column
 *  instead of "Quartz high-top tables x6" beside a "1" that reads
 *  contradictory. */
function parseItemQuantity(raw: string | null | undefined): { name: string; quantity: number } {
  const s = String(raw ?? "").trim();
  if (!s) return { name: "Item", quantity: 1 };
  const m = s.match(/^(.*?)[\s]+[x×]\s*(\d+)\s*$/i);
  if (m) {
    const name = m[1].trim();
    const qty = Math.max(1, parseInt(m[2], 10) || 1);
    return { name: name || s, quantity: qty };
  }
  return { name: s, quantity: 1 };
}

function parseAddress(full: string | null | undefined): { street: string; cityLine: string; postal: string } {
  const raw = String(full ?? "").trim();
  if (!raw) return { street: "-", cityLine: "", postal: "" };
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const street = parts[0] ?? raw;
  const postalMatch = raw.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
  const postal = postalMatch ? postalMatch[0].toUpperCase() : "";
  const cityLine = parts.slice(1).join(", ").replace(postal, "").trim().replace(/,\s*$/, "");
  return { street, cityLine, postal };
}

/** Letter PDFs use points; default footer Y in pdf-brand targets mm layouts, so anchor to page bottom */
function pdfFooter(doc: jsPDF, footerLine: string): void {
  const pageH = doc.internal.pageSize.getHeight();
  drawYugoFooter(doc, { y: pageH - 30, line: footerLine });
}

/** Human-readable valuation line for PDFs (never raw DB tokens when we can help it) */
function formatValuationTierForPdf(tier: string | null | undefined): string {
  const raw = (tier || "").trim();
  if (!raw) return "Released value";
  const t = raw.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    released: "Released value",
    released_value: "Released value",
    enhanced: "Enhanced value",
    full_replacement: "Full replacement",
    essential: "Released value",
    signature: "Signature valuation",
    estate: "Estate valuation",
  };
  return map[t] || raw.replace(/_/g, " ");
}

/** Move Summary PDF: editorial layout matching brand reference —
 *  wine hero + footer bands, hairline-ruled sections, serif hero values,
 *  actual assigned crew as pills, service/valuation wired per service type. */
function generateMoveSummaryPDF(
  move: MoveRow,
  crew: CrewRow,
  inventory: InventoryRow,
  tierLabel: string,
  logoBase64: string,
  footerLine: string,
): Buffer {
  return generateEditorialMoveSummaryPDF(move, crew, inventory, tierLabel, logoBase64, footerLine);
}

/** Legacy generator retained for the "previous look" fallback while the
 *  editorial redesign shakes out on prod. Currently unused; the export
 *  above always calls the editorial version. Delete after two weeks of
 *  clean prod runs. */
function _legacyGenerateMoveSummaryPDF(
  move: MoveRow,
  crew: CrewRow,
  inventory: InventoryRow,
  tierLabel: string,
  logoBase64: string,
  footerLine: string,
): Buffer {
  const BODY = 12;
  const BLOCK = 18;
  const SUB = 10;
  const logistics = isMoveRowLogisticsDelivery(move);
  const doc = new jsPDF("p", "pt", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageWidth - margin * 2;
  const centerX = pageWidth / 2;
  let y = 0;

  const ensureSpace = (minBottomSpace: number) => {
    if (y + minBottomSpace > pageHeight - 56) {
      doc.addPage();
      drawTopWineGradientBar(doc, 7);
      y = drawCenteredYugoLogoBlock(doc, logoBase64, 14);
      setHeroTitle(doc, 13);
      doc.text(
        logistics ? "Delivery Summary (continued)" : "Move Summary (continued)",
        centerX,
        y,
        { align: "center" },
      );
      y += 22;
    }
  };

  drawTopWineGradientBar(doc, 7);
  y = drawCenteredYugoLogoBlock(doc, logoBase64, 14);

  setHeroTitle(doc, 17);
  doc.text(logistics ? "Delivery Summary" : "Move Summary", centerX, y, { align: "center" });
  y += 24;

  const pad = 12;
  const inner = margin + pad;
  setBodyText(doc, 9);
  const fromLines = doc.splitTextToSize(move.from_address || "-", contentW - pad * 2);
  const toLines = doc.splitTextToSize(move.to_address || "-", contentW - pad * 2);
  const boxTitle = logistics ? "JOB DETAILS" : "MOVE DETAILS";
  const idLabel = logistics ? `Job ref: ${moveDisplayId(move)}` : `Move ID: ${moveDisplayId(move)}`;
  const dateStr = formatDate(move.completed_at || move.scheduled_date);

  const boxTop = y;
  const boxH =
    pad +
    14 +
    BODY * 2 +
    6 +
    SUB +
    fromLines.length * BODY +
    6 +
    SUB +
    toLines.length * BODY +
    pad;

  drawInfoBox(doc, { x: margin, y: boxTop, width: contentW, height: boxH });

  let cy = boxTop + pad + 10;
  setSectionLabel(doc, 8);
  doc.text(boxTitle, inner, cy);
  cy += 14;
  setBodyText(doc, 9);
  doc.setFont("helvetica", "bold");
  doc.text(idLabel, inner, cy);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date: ${dateStr}`, pageWidth - inner, cy, { align: "right" });
  doc.setTextColor(...DARK);
  cy += BODY;
  doc.text(`Client: ${move.client_name || "-"}`, inner, cy);
  cy += BODY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FROM", inner, cy);
  doc.setFont("helvetica", "normal");
  setBodyText(doc, 9);
  cy += SUB;
  fromLines.forEach((line: string) => {
    doc.text(line, inner, cy);
    cy += BODY;
  });
  cy += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TO", inner, cy);
  doc.setFont("helvetica", "normal");
  setBodyText(doc, 9);
  cy += SUB;
  toLines.forEach((line: string) => {
    doc.text(line, inner, cy);
    cy += BODY;
  });

  y = boxTop + boxH + BLOCK;

  ensureSpace(96);
  y = drawSectionHeading(
    doc,
    logistics ? "Job & team" : "Package & crew",
    margin,
    y,
    contentW,
  );
  setBodyText(doc, 9);
  // Prefer moves.assigned_members (per-job subset the dispatcher actually
  // rostered onto this job) over crews.members (the whole team roster,
  // which routinely carries names never dispatched to this move — the
  // "John, Gary, Che, Belah, Connor" bug on the MV-30356 summary).
  // Fall back to the crew row only when the move has no snapshot.
  const assigned = Array.isArray(move.assigned_members)
    ? (move.assigned_members as string[]).filter(
        (s) => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  const rosterMembers =
    crew?.members && Array.isArray(crew.members)
      ? (crew.members as string[]).filter(
          (s) => typeof s === "string" && s.trim().length > 0,
        )
      : [];
  const displayMembers = assigned.length > 0 ? assigned : rosterMembers;
  const crewNames =
    displayMembers.length > 0
      ? displayMembers.join(", ")
      : crew?.name || "-";
  const crewCount = displayMembers.length;
  const moverWord = logistics ? "logistics professionals" : "movers";
  const durationLine =
    move.actual_hours != null
      ? `${move.actual_hours} hours`
      : move.est_hours != null
        ? `${move.est_hours} hours (estimated)`
        : "-";
  const pkgLines = [
    `Plan: ${tierLabel}`,
    `Crew: ${crewNames} (${crewCount || 0} ${moverWord})`,
    `${logistics ? "Vehicle" : "Truck"}: ${move.truck_primary || move.truck_secondary || "-"}`,
    `Duration: ${durationLine}`,
  ];
  pkgLines.forEach((line) => {
    doc.text(line, margin, y);
    y += BODY;
  });
  y += BLOCK - BODY;

  ensureSpace(72);
  y = drawSectionHeading(doc, "Inventory", margin, y, contentW);
  setBodyText(doc, 9);
  if (inventory.length === 0) {
    doc.text("No inventory recorded for this move.", margin, y);
    y += BODY;
  } else {
    const maxItems = 48;
    inventory.slice(0, maxItems).forEach((i) => {
      const room = i.room ? `[${i.room}] ` : "";
      const box = i.box_number ? ` #${i.box_number}` : "";
      doc.text(`${room}${i.item_name || "Item"}${box}`, margin, y);
      y += BODY;
    });
    if (inventory.length > maxItems) {
      doc.setTextColor(...GRAY);
      doc.text(`… and ${inventory.length - maxItems} more items.`, margin, y);
      doc.setTextColor(...DARK);
      y += BODY;
    }
  }
  y += BLOCK - BODY;

  ensureSpace(56);
  y = drawSectionHeading(doc, "What was included", margin, y, contentW);
  setBodyText(doc, 9);
  const tierKey = (move.tier_selected || "").toLowerCase().replace(/\s+/g, "_");
  const includedLine = logistics
    ? LOGISTICS_INCLUDED_FALLBACK
    : TIER_FEATURES[tierKey] || TIER_FEATURES.essential || "Moving service as agreed.";
  doc.splitTextToSize(includedLine, contentW).forEach((line: string) => {
    doc.text(line, margin, y);
    y += BODY;
  });
  y += BLOCK - BODY;

  ensureSpace(40);
  y = drawSectionHeading(doc, "Valuation coverage", margin, y, contentW);
  setBodyText(doc, 9);
  doc.text(formatValuationTierForPdf(move.valuation_tier), margin, y);
  y += BODY + 10;

  pdfFooter(doc, footerLine);
  drawBottomAccentBar(doc, true);
  return Buffer.from(doc.output("arraybuffer"));
}

/** ─── Editorial Move Summary generator ───────────────────────────────
 *  Matches the reference layout: full-bleed wine hero + wine footer bands,
 *  editorial center column with hairline rules, serif hero values, crew
 *  as outlined pills, per-service wired copy for service label, vehicle,
 *  valuation, and inclusions. */
function generateEditorialMoveSummaryPDF(
  move: MoveRow,
  crew: CrewRow,
  inventory: InventoryRow,
  _tierLabel: string,
  _logoBase64: string,
  _footerLine: string,
): Buffer {
  // Palette (matches the approved artifact mockup 1:1)
  const WINE_RGB: [number, number, number] = [43, 4, 22];
  const CREAM_RGB: [number, number, number] = [249, 237, 228];
  const CREAM_MUTED: [number, number, number] = [216, 202, 190];
  const INK: [number, number, number] = [26, 19, 16];
  const INK_MUTED: [number, number, number] = [122, 110, 103];
  const RULE_RGB: [number, number, number] = [232, 225, 218];
  const PAPER_RGB: [number, number, number] = [255, 252, 247];

  const doc = new jsPDF("p", "pt", "letter");
  // Brand fonts embedded per-document via jsPDF's font vfs. Both
  // fall back to jsPDF built-ins when their TTF is missing at read
  // time so a partial deploy doesn't crash generation.
  const SERIF = registerSerifFont(doc);
  const SANS = registerBrownFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;

  const logistics = isMoveRowLogisticsDelivery(move);
  const svcType = String(move.service_type ?? move.move_type ?? "").toLowerCase();
  const svcDisp = serviceDisplay(svcType, move.tier_selected);
  const vehicle = vehicleDisplay(move.truck_primary, move.truck_secondary);
  const valuation = valuationDisplay(svcType, move.valuation_tier);
  const included = includedCopy(svcType);
  const summaryEyebrow = eyebrowFor(svcType);
  const lede = ledeFor(svcType);

  // Crew: prefer moves.assigned_members (fixed 26ab3841) over crews.members.
  const assigned = Array.isArray(move.assigned_members)
    ? (move.assigned_members as string[]).filter(
        (s) => typeof s === "string" && s.trim().length > 0,
      )
    : [];
  const rosterMembers =
    crew?.members && Array.isArray(crew.members)
      ? (crew.members as string[]).filter(
          (s) => typeof s === "string" && s.trim().length > 0,
        )
      : [];
  const crewNames = assigned.length > 0 ? assigned : rosterMembers;

  const durationText =
    move.actual_hours != null
      ? `${move.actual_hours} hours`
      : move.est_hours != null
        ? `${move.est_hours} hours`
        : "-";
  const durationCaption = move.actual_hours != null ? "As delivered" : "Estimated at survey";

  const dateStr = formatDate(move.completed_at || move.scheduled_date);
  // Editorial hero format: "10 JULY 2026" (day, then month, then year).
  // Fall back to whatever formatDate returned when parsing fails.
  const dateSource = move.completed_at || move.scheduled_date;
  let dateForHero = dateStr.toUpperCase();
  if (dateSource) {
    const d = new Date(dateSource);
    if (!Number.isNaN(d.getTime())) {
      const day = d.toLocaleDateString("en-CA", { day: "numeric", timeZone: "America/Toronto" });
      const month = d.toLocaleDateString("en-CA", { month: "long", timeZone: "America/Toronto" }).toUpperCase();
      const year = d.toLocaleDateString("en-CA", { year: "numeric", timeZone: "America/Toronto" });
      dateForHero = `${day} ${month} ${year}`;
    }
  }

  const wordmarkCream = loadYugoWordmarkCreamBase64();
  const symbol = loadYugoSymbolBase64();

  // ─── HERO BAND ──────────────────────────────────────
  const heroH = 108;
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, 0, pageW, heroH, "F");

  // Wordmark, cream, left
  if (wordmarkCream) {
    try {
      // Wordmark PNG is 2:1 (roughly). Render at 22pt tall.
      const wmH = 22;
      const wmW = wmH * WORDMARK_ASPECT;
      doc.addImage(wordmarkCream, "PNG", margin, 40, wmW, wmH);
    } catch { /* skip logo */ }
  } else {
    doc.setTextColor(...CREAM_RGB);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(20);
    doc.text("YUGO", margin, 56);
  }

  // Right: eyebrow / job id / date
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);

  doc.text("JOB REFERENCE", pageW - margin, 40, { align: "right" });

  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(28);

  doc.text(moveDisplayId(move), pageW - margin, 68, { align: "right" });

  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8.5);

  doc.text(dateForHero, pageW - margin, 86, { align: "right" });


  let y = heroH + 34;

  // ─── PREPARED FOR ────────────────────────────────────
  doc.setTextColor(...WINE_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("PREPARED FOR", margin, y);


  y += 22;
  doc.setTextColor(...INK);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(30);
  doc.text(move.client_name || "-", margin, y);

  y += 20;
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(9.5);
  const ledeLines = doc.splitTextToSize(lede, contentW);
  ledeLines.forEach((ln: string) => {
    doc.text(ln, margin, y);
    y += 13;
  });
  y += 12;

  // Hairline rule
  const drawRule = () => {
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 26;
  };
  drawRule();

  // ─── ADDRESSES ──────────────────────────────────────
  const colW = (contentW - 40) / 2;
  const rightColX = margin + colW + 40;

  const fromParsed = parseAddress(move.from_address);
  const toParsed = parseAddress(move.to_address);

  const drawAddressBlock = (x: number, label: string, parsed: ReturnType<typeof parseAddress>) => {
    let cy = y;
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(label, x, cy);
  

    cy += 22;
    doc.setTextColor(...INK);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(17);
    const streetLines = doc.splitTextToSize(parsed.street, colW);
    streetLines.forEach((ln: string) => {
      doc.text(ln, x, cy);
      cy += 19;
    });

    if (parsed.cityLine || parsed.postal) {
      doc.setTextColor(...INK_MUTED);
      doc.setFont(SANS, "normal");
      doc.setFontSize(10);
      const sub = [parsed.cityLine, parsed.postal].filter(Boolean).join("   ");
      doc.text(sub, x, cy + 2);
    }
  };

  drawAddressBlock(margin, "COLLECTED FROM", fromParsed);
  drawAddressBlock(rightColX, "DELIVERED TO", toParsed);

  // Arrow between columns (wine)
  const arrowY = y + 12;
  const arrowStartX = margin + colW + 6;
  const arrowEndX = rightColX - 6;
  doc.setDrawColor(...WINE_RGB);
  doc.setLineWidth(0.8);
  doc.line(arrowStartX, arrowY, arrowEndX - 4, arrowY);
  // arrowhead
  doc.line(arrowEndX - 6, arrowY - 3, arrowEndX, arrowY);
  doc.line(arrowEndX - 6, arrowY + 3, arrowEndX, arrowY);

  y += 62;
  drawRule();

  // ─── STATS ROW (Service / Vehicle / Crew / On site) ─
  const stats = [
    { label: "SERVICE", value: svcDisp.label, caption: svcDisp.caption },
    { label: "VEHICLE", value: vehicle, caption: "Dedicated" },
    { label: "CREW", value: crewCountToWord(crewNames.length || 0), caption: "Logistics professionals" },
    { label: "ON SITE", value: durationText, caption: durationCaption },
  ];
  const statColW = contentW / 4;
  stats.forEach((s, i) => {
    const x = margin + statColW * i;
    let cy = y;
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(s.label, x, cy);
  

    cy += 20;
    doc.setTextColor(...INK);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(19);
    doc.text(s.value, x, cy);

    cy += 22;
    doc.setTextColor(...INK_MUTED);
    doc.setFont(SANS, "normal");
    doc.setFontSize(9);
    const capLines = doc.splitTextToSize(s.caption, statColW - 10);
    capLines.slice(0, 2).forEach((ln: string) => {
      doc.text(ln, x, cy);
      cy += 11;
    });
  });
  y += 62;
  drawRule();

  // ─── YOUR CREW ON THE DAY (pills) ────────────────────
  if (crewNames.length > 0) {
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text("YOUR CREW ON THE DAY", margin, y);
  

    y += 18;
    let px = margin;
    const pillH = 22;
    const pillPadX = 14;
    const pillGap = 8;
    doc.setFont(SANS, "normal");
    doc.setFontSize(10);
    for (const name of crewNames) {
      const w = doc.getTextWidth(name) + pillPadX * 2;
      if (px + w > pageW - margin) {
        px = margin;
        y += pillH + 6;
      }
      // pill outline + paper fill
      doc.setDrawColor(...RULE_RGB);
      doc.setFillColor(...PAPER_RGB);
      doc.setLineWidth(0.6);
      // roundedRect(x, y, w, h, rx, ry, style)
      doc.roundedRect(px, y, w, pillH, 11, 11, "FD");
      doc.setTextColor(...INK);
      doc.text(name, px + w / 2, y + 14.5, { align: "center" });
      px += w + pillGap;
    }
    y += pillH + 20;
    drawRule();
  }

  // ─── MANIFEST TABLE ─────────────────────────────────
  doc.setTextColor(...WINE_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("MANIFEST", margin, y);


  y += 18;
  // Column headers
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("ITEM", margin, y);
  doc.text("QTY", pageW - margin, y, { align: "right" });

  y += 8;
  doc.setDrawColor(...RULE_RGB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  // Group items by room; each room becomes a "group" heading row.
  const byRoom = new Map<string, InventoryRow>();
  for (const it of inventory) {
    const key = (it.room || "Items").toString();
    const arr = byRoom.get(key) ?? [];
    arr.push(it);
    byRoom.set(key, arr);
  }
  if (byRoom.size === 0) {
    doc.setTextColor(...INK_MUTED);
    doc.setFont(SANS, "italic");
    doc.setFontSize(10);
    doc.text("No inventory recorded for this move.", margin, y);
    y += 18;
  } else {
    let totalItems = 0;
    for (const [room, items] of byRoom.entries()) {
      // Group heading
      doc.setTextColor(...WINE_RGB);
      doc.setFont(SANS, "bold");
      doc.setFontSize(8);
      doc.text(room.toUpperCase(), margin, y);
    
      y += 14;

      // Aggregate identical item names into (name, count) pairs.
      // Each row contributes its parsed quantity (from a "xN" suffix
      // in the item name), not just 1. A row like "Quartz high-top
      // tables x6" adds 6 to the total, not 1.
      const counts = new Map<string, number>();
      for (const it of items) {
        const parsed = parseItemQuantity(it.item_name);
        counts.set(parsed.name, (counts.get(parsed.name) ?? 0) + parsed.quantity);
      }
      for (const [name, count] of counts.entries()) {
        totalItems += count;
        doc.setTextColor(...INK);
        doc.setFont(SANS, "normal");
        doc.setFontSize(11);
        doc.text(name, margin, y);
        doc.setFont(SERIF, "normal");
        doc.setFontSize(13);
        doc.text(String(count), pageW - margin, y, { align: "right" });
        y += 16;
      }
      y += 4;
    }
    // Total row
    y += 4;
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 16;
    doc.setTextColor(...INK);
    doc.setFont(SANS, "bold");
    doc.setFontSize(9);
    doc.text("TOTAL ITEMS HANDLED", margin, y);
  
    doc.setFont(SERIF, "normal");
    doc.setFontSize(20);
    doc.setTextColor(...WINE_RGB);
    doc.text(String(totalItems), pageW - margin, y + 2, { align: "right" });
  }

  // ─── FOOTER BAND (wine) ─────────────────────────────
  const footerH = 160;
  const footerTop = Math.max(pageH - footerH, y + 24);
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, footerTop, pageW, footerH, "F");

  const fPad = 28;
  const fColX = margin;
  const fColW = (contentW - 40) / 2;
  const fRightX = margin + fColW + 40;
  let fy = footerTop + fPad;

  // Left: What was included
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("WHAT WAS INCLUDED", fColX, fy);


  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(9.5);
  const incLines = doc.splitTextToSize(included, fColW);
  let fyLeft = fy + 14;
  incLines.forEach((ln: string) => {
    doc.text(ln, fColX, fyLeft);
    fyLeft += 12;
  });

  // Right: Valuation coverage
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("VALUATION COVERAGE", fRightX, fy);


  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(15);
  doc.text(valuation.title, fRightX, fy + 20);

  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(9.5);
  const valLines = doc.splitTextToSize(valuation.body, fColW);
  let fyRight = fy + 36;
  valLines.forEach((ln: string) => {
    doc.text(ln, fRightX, fyRight);
    fyRight += 12;
  });

  // Bottom legal row — thin hairline in a low-opacity cream, drawn as
  // a solid line in a color that reads as ~18% cream on wine. jsPDF's
  // opacity path (setGState) isn't in the TS types, so we bake the
  // effective color instead.
  const legalY = pageH - 36;
  doc.setDrawColor(76, 47, 60);
  doc.setLineWidth(0.4);
  doc.line(margin, legalY - 14, pageW - margin, legalY - 14);

  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);

  doc.setTextColor(...CREAM_RGB);
  doc.text("HELLOYUGO INC.", margin, legalY - 2);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8);
  const legalLine1Width = doc.getTextWidth("HELLOYUGO INC.");
  doc.text("  ·  507 KING STREET EAST, TORONTO, ONTARIO M5A 1M3", margin + legalLine1Width, legalY - 2);


  doc.text("(647) 370 4525  ·  INFO@HELLOYUGO.COM  ·  ITSYUGO.COM", margin, legalY + 10);


  // Ornament symbol, right
  if (symbol) {
    try {
      const sSize = 32;
      doc.addImage(symbol, "PNG", pageW - margin - sSize, legalY - sSize + 10, sSize, sSize);
    } catch { /* skip */ }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** Public entry: dispatches to the editorial redesign. */
function generateInvoicePDF(
  move: MoveRow,
  extraItems: ExtraRow,
  tierLabel: string,
  tierPrice: number,
  logoBase64: string,
  footerLine: string,
  companyLegal: string,
): Buffer {
  return generateEditorialInvoicePDF(move, extraItems, tierLabel, tierPrice, logoBase64, footerLine, companyLegal);
}

function _legacyGenerateInvoicePDF(
  move: MoveRow,
  extraItems: ExtraRow,
  tierLabel: string,
  tierPrice: number,
  logoBase64: string,
  footerLine: string,
  companyLegal: string,
): Buffer {
  const BODY = 12;
  const logistics = isMoveRowLogisticsDelivery(move);
  const doc = new jsPDF("p", "pt", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const centerX = pageWidth / 2;
  let y = 0;

  drawTopWineGradientBar(doc, 7);
  y = drawCenteredYugoLogoBlock(doc, logoBase64, 14);
  setHeroTitle(doc, 17);
  doc.text("Invoice", centerX, y, { align: "center" });
  y += 24;

  const invNum = invoiceNumber(move);
  const issuedDate = formatDate(move.completed_at || move.scheduled_date);
  setBodyText(doc, 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice #: ${invNum}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date issued: ${issuedDate}`, pageWidth - margin, y, { align: "right" });
  doc.setTextColor(...DARK);
  y += BODY;

  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text("Bill to:", margin, y);
  y += BODY;
  doc.setTextColor(...DARK);
  setBodyText(doc, 10);
  doc.text(`${move.client_name || "-"}`, margin, y);
  y += BODY;
  doc.setFontSize(9);
  if (move.client_email) {
    doc.text(move.client_email, margin, y);
    y += BODY;
  }
  if (move.client_phone) {
    doc.text(move.client_phone, margin, y);
    y += BODY;
  }
  y += 10;

  const approvedExtras = extraItems.filter((e) => (e.status ?? "approved") === "approved" && (e.fee_cents ?? 0) > 0);
  const subtotal = tierPrice + approvedExtras.reduce((s, e) => s + (Number(e.fee_cents) || 0) / 100 * (e.quantity || 1), 0);
  const hst = calcHST(subtotal);
  const total = subtotal + hst;
  const depositPaid = Number(move.deposit_amount ?? Math.round(tierPrice * 0.25));
  const balancePaid = Number(move.balance_amount ?? (total - depositPaid));
  const amountOwing = Math.max(0, total - depositPaid - balancePaid);

  const tableBody: (string | number)[][] = [
    [`${tierLabel} plan`, formatCurrency(tierPrice)],
    ...approvedExtras.map((e) => [`Add-on: ${e.description || "Item"}`, formatCurrency((Number(e.fee_cents) || 0) / 100 * (e.quantity || 1))]),
    ["Subtotal", formatCurrency(subtotal)],
    ["HST (13%)", formatCurrency(hst)],
    ["Total", formatCurrency(total)],
  ];
  const headStyles = getTableHeadStyles(true);
  autoTable(doc, {
    startY: y,
    head: [["Description", "Amount"]],
    body: tableBody,
    theme: "plain",
    headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 320 }, 1: { cellWidth: 80, halign: "right" } },
    margin: { left: margin },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  setBodyText(doc, 9);
  const depositDate = formatDate(move.deposit_paid_at);
  const balanceDate = formatDate(move.balance_paid_at);
  doc.text(`Deposit paid ${depositDate}`, margin, y);
  doc.text(`-${formatCurrency(depositPaid)}`, pageWidth - margin, y, { align: "right" });
  y += BODY;
  doc.text(`Balance paid ${balanceDate}`, margin, y);
  doc.text(`-${formatCurrency(balancePaid)}`, pageWidth - margin, y, { align: "right" });
  y += BODY;
  doc.setFont("helvetica", "bold");
  doc.text("Amount owing", margin, y);
  doc.text(formatCurrency(amountOwing), pageWidth - margin, y, { align: "right" });
  y += BODY + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    logistics ? "Thank you for your business. This invoice covers your delivery." : "Thank you for your business.",
    margin,
    y,
  );
  y += BODY;
  doc.text(`${companyLegal}, Toronto ON`, margin, y);

  pdfFooter(doc, footerLine);
  drawBottomAccentBar(doc, false);
  return Buffer.from(doc.output("arraybuffer"));
}

/** Public entry: dispatches to the editorial redesign. */
function generateReceiptPDF(
  move: MoveRow,
  tierLabel: string,
  depositPaid: number,
  balancePaid: number,
  logoBase64: string,
  footerLine: string,
  signatureDataUrl?: string | null,
  cardLast4?: string | null,
): Buffer {
  return generateEditorialReceiptPDF(
    move, tierLabel, depositPaid, balancePaid, logoBase64, footerLine, signatureDataUrl, cardLast4,
  );
}

function _legacyGenerateReceiptPDF(
  move: MoveRow,
  tierLabel: string,
  depositPaid: number,
  balancePaid: number,
  logoBase64: string,
  footerLine: string,
  signatureDataUrl?: string | null,
  cardLast4?: string | null,
): Buffer {
  const BODY = 12;
  const BLOCK = 16;
  const logistics = isMoveRowLogisticsDelivery(move);
  const doc = new jsPDF("p", "pt", "letter");
  const margin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentW = pageWidth - margin * 2;
  const centerX = pageWidth / 2;
  let y = 0;

  drawTopWineGradientBar(doc, 7);
  y = drawCenteredYugoLogoBlock(doc, logoBase64, 14);
  setHeroTitle(doc, 17);
  doc.text("Payment Receipt", centerX, y, { align: "center" });
  y += 24;

  setBodyText(doc, 10);
  doc.setFont("helvetica", "bold");
  doc.text(`Receipt #: ${receiptNumber(move)}`, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(move.balance_paid_at || move.completed_at)}`, pageWidth - margin, y, { align: "right" });
  doc.setTextColor(...DARK);
  y += BODY;

  doc.text(`Client: ${move.client_name || "-"}`, margin, y);
  y += BODY;

  const fromLines = doc.splitTextToSize(move.from_address || "-", contentW);
  const toLines = doc.splitTextToSize(move.to_address || "-", contentW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(logistics ? "ROUTE FROM" : "FROM", margin, y);
  y += BODY - 2;
  doc.setFont("helvetica", "normal");
  setBodyText(doc, 9);
  doc.setTextColor(...DARK);
  fromLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += BODY;
  });
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(logistics ? "ROUTE TO" : "TO", margin, y);
  y += BODY - 2;
  doc.setFont("helvetica", "normal");
  setBodyText(doc, 9);
  doc.setTextColor(...DARK);
  toLines.forEach((line: string) => {
    doc.text(line, margin, y);
    y += BODY;
  });
  y += 10;

  const totalPaid = depositPaid + balancePaid;
  const cardSuffix = cardLast4 ? `Card ending ${cardLast4}` : "Card";
  const jobNoun = logistics ? "delivery" : "move";

  const tableBody: (string | number)[][] = [
    [formatDate(move.deposit_paid_at), `Deposit ${tierLabel} ${jobNoun}`, cardSuffix, formatCurrency(depositPaid)],
    [
      formatDate(move.balance_paid_at || move.completed_at),
      `Balance ${tierLabel} ${jobNoun}`,
      cardSuffix,
      formatCurrency(balancePaid),
    ],
    ["", "Total Paid", "", formatCurrency(totalPaid)],
  ];
  const headStyles = getTableHeadStyles(true);
  autoTable(doc, {
    startY: y,
    head: [["DATE", "DESCRIPTION", "METHOD", "AMOUNT"]],
    body: tableBody,
    theme: "plain",
    headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 140 },
      2: { cellWidth: 80 },
      3: { cellWidth: 80, halign: "right" },
    },
    margin: { left: margin },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(
    logistics
      ? "This receipt confirms full payment for your completed delivery."
      : "This receipt confirms full payment for your completed move.",
    margin,
    y,
  );
  y += BODY + 4;

  const sig =
    typeof signatureDataUrl === "string" && signatureDataUrl.trim().startsWith("data:image")
      ? signatureDataUrl.trim()
      : null;
  if (sig) {
    y = drawClientSignatureLetter(doc, sig, y, margin);
    y += BLOCK;
  }

  pdfFooter(doc, footerLine);
  drawBottomAccentBar(doc, true);
  return Buffer.from(doc.output("arraybuffer"));
}

/** ─── Editorial Invoice generator ────────────────────────────────────
 *  Same wine hero + footer bands and hairline-ruled interior as the
 *  Move Summary. Bill-to auto-switches to company name when the move
 *  is billed to a business. GST/HST number, address, and support
 *  email surface on every doc. */
function generateEditorialInvoicePDF(
  move: MoveRow,
  extraItems: ExtraRow,
  _tierLabel: string,
  tierPrice: number,
  _logoBase64: string,
  _footerLine: string,
  _companyLegal: string,
): Buffer {
  const WINE_RGB: [number, number, number] = [43, 4, 22];
  const CREAM_RGB: [number, number, number] = [249, 237, 228];
  const CREAM_MUTED: [number, number, number] = [216, 202, 190];
  const INK: [number, number, number] = [26, 19, 16];
  const INK_MUTED: [number, number, number] = [122, 110, 103];
  const RULE_RGB: [number, number, number] = [232, 225, 218];

  const doc = new jsPDF("p", "pt", "letter");
  const SERIF = registerSerifFont(doc);
  const SANS = registerBrownFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;

  const invNum = invoiceNumber(move);
  const issued = formatEditorialDate(move.completed_at || move.scheduled_date);
  const bill = billTo(move);
  const svcType = String(move.service_type ?? move.move_type ?? "").toLowerCase();
  const lineLabel = invoiceLineLabel(svcType, move.tier_selected);

  const approvedExtras = extraItems.filter(
    (e) => (e.status ?? "approved") === "approved" && (e.fee_cents ?? 0) > 0,
  );
  const subtotal =
    tierPrice +
    approvedExtras.reduce(
      (s, e) => s + ((Number(e.fee_cents) || 0) / 100) * (e.quantity || 1),
      0,
    );
  const hst = calcHST(subtotal);
  const total = subtotal + hst;
  const depositPaid = Number(move.deposit_amount ?? Math.round(tierPrice * 0.25));
  const balancePaid = Number(move.balance_amount ?? (total - depositPaid));
  const amountOwing = Math.max(0, total - depositPaid - balancePaid);

  const wordmarkCream = loadYugoWordmarkCreamBase64();
  const symbol = loadYugoSymbolBase64();

  // ─── HERO ───────────────────────────────────────────
  const heroH = 108;
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, 0, pageW, heroH, "F");
  if (wordmarkCream) {
    try {
      const wmH = 22;
      const wmW = wmH * WORDMARK_ASPECT;
      doc.addImage(wordmarkCream, "PNG", margin, 40, wmW, wmH);
    } catch { /* skip */ }
  }
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("INVOICE", pageW - margin, 40, { align: "right" });
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(28);
  doc.text(invNum, pageW - margin, 68, { align: "right" });
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8.5);
  doc.text(`ISSUED ${issued.toUpperCase()}`, pageW - margin, 86, { align: "right" });

  let y = heroH + 34;
  const drawRule = () => {
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 26;
  };
  const eyebrow = (label: string) => {
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(label, margin, y);
  };

  // ─── BILL TO ────────────────────────────────────────
  eyebrow("BILL TO");
  y += 30;
  doc.setTextColor(...INK);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(30);
  doc.text(bill.party, margin, y);

  y += 18;
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(11);
  const contactLines: string[] = [];
  if (bill.attn) contactLines.push(bill.attn);
  if (move.client_email) contactLines.push(move.client_email);
  if (move.client_phone) contactLines.push(move.client_phone);
  contactLines.forEach((ln) => {
    doc.text(ln, margin, y);
    y += 13;
  });
  y += 12;
  drawRule();

  // ─── ROUTE ──────────────────────────────────────────
  const colW = (contentW - 40) / 2;
  const rightColX = margin + colW + 40;
  const fromParsed = parseAddress(move.from_address);
  const toParsed = parseAddress(move.to_address);
  const routeBlock = (x: number, label: string, parsed: ReturnType<typeof parseAddress>) => {
    let cy = y;
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(label, x, cy);
    cy += 22;
    doc.setTextColor(...INK);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(17);
    doc.splitTextToSize(parsed.street, colW).forEach((ln: string) => {
      doc.text(ln, x, cy);
      cy += 19;
    });
    if (parsed.cityLine || parsed.postal) {
      doc.setTextColor(...INK_MUTED);
      doc.setFont(SANS, "normal");
      doc.setFontSize(10);
      const sub = [parsed.cityLine, parsed.postal].filter(Boolean).join("   ");
      doc.text(sub, x, cy + 2);
    }
  };
  routeBlock(margin, "COLLECTED FROM", fromParsed);
  routeBlock(rightColX, "DELIVERED TO", toParsed);
  const arrowY = y + 12;
  doc.setDrawColor(...WINE_RGB);
  doc.setLineWidth(0.8);
  doc.line(margin + colW + 6, arrowY, rightColX - 10, arrowY);
  doc.line(rightColX - 12, arrowY - 3, rightColX - 6, arrowY);
  doc.line(rightColX - 12, arrowY + 3, rightColX - 6, arrowY);
  y += 62;
  drawRule();

  // ─── LINE ITEMS ─────────────────────────────────────
  eyebrow("LINE ITEMS");
  y += 24;

  // Header row
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("DESCRIPTION", margin, y);
  doc.text("AMOUNT", pageW - margin, y, { align: "right" });
  y += 8;
  doc.setDrawColor(...RULE_RGB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  const row = (label: string, amt: number, opts?: { emphasize?: boolean }) => {
    doc.setTextColor(...INK);
    doc.setFont(SANS, opts?.emphasize ? "bold" : "normal");
    doc.setFontSize(12);
    doc.text(label, margin, y);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(14);
    doc.text(formatCurrency(amt), pageW - margin, y, { align: "right" });
    y += 18;
  };
  row(lineLabel, tierPrice);
  approvedExtras.forEach((e) => {
    row(
      `Add-on · ${e.description || "Item"}`,
      ((Number(e.fee_cents) || 0) / 100) * (e.quantity || 1),
    );
  });

  // Subtotal / HST separated by hairline
  y += 2;
  doc.setDrawColor(...RULE_RGB);
  doc.line(margin, y, pageW - margin, y);
  y += 16;
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(11);
  doc.text("Subtotal", margin, y);
  doc.setTextColor(...INK);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(14);
  doc.text(formatCurrency(subtotal), pageW - margin, y, { align: "right" });
  y += 18;

  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(11);
  doc.text("HST (13%)", margin, y);
  doc.setTextColor(...INK);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(14);
  doc.text(formatCurrency(hst), pageW - margin, y, { align: "right" });
  y += 20;

  // Total (big serif)
  doc.setDrawColor(...RULE_RGB);
  doc.line(margin, y, pageW - margin, y);
  y += 18;
  doc.setTextColor(...INK);
  doc.setFont(SANS, "bold");
  doc.setFontSize(10.5);
  doc.text("TOTAL", margin, y);
  doc.setTextColor(...WINE_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(26);
  doc.text(formatCurrency(total), pageW - margin, y + 2, { align: "right" });
  y += 22;
  drawRule();

  // ─── PAYMENT SUMMARY ─────────────────────────────────
  eyebrow("PAYMENT SUMMARY");
  y += 20;
  const paidRow = (label: string, amt: number) => {
    doc.setTextColor(...INK_MUTED);
    doc.setFont(SANS, "normal");
    doc.setFontSize(11);
    doc.text(label, margin, y);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(13);
    doc.text(`-${formatCurrency(amt)}`, pageW - margin, y, { align: "right" });
    y += 16;
  };
  paidRow(`Deposit paid · ${formatEditorialDate(move.deposit_paid_at)}`, depositPaid);
  paidRow(`Balance paid · ${formatEditorialDate(move.balance_paid_at)}`, balancePaid);
  y += 4;
  doc.setDrawColor(...RULE_RGB);
  doc.line(margin, y, pageW - margin, y);
  y += 18;
  doc.setTextColor(...INK);
  doc.setFont(SANS, "bold");
  doc.setFontSize(10.5);
  doc.text("AMOUNT OWING", margin, y);
  doc.setTextColor(...WINE_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(26);
  doc.text(formatCurrency(amountOwing), pageW - margin, y + 2, { align: "right" });

  // ─── FOOTER ─────────────────────────────────────────
  const footerH = 160;
  const footerTop = Math.max(pageH - footerH, y + 24);
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, footerTop, pageW, footerH, "F");
  const fPad = 28;
  const fColW = (contentW - 40) / 2;
  const fRightX = margin + fColW + 40;
  const fy = footerTop + fPad;

  // Left: GST/HST number as its own value.
  // (Terms block removed per operator directive — the balance-on-file
  // language belonged on the original booking contract, not on the
  // receipt-of-payment doc a client re-opens weeks later.)
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("GST / HST", margin, fy);
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(17);
  doc.text(YUGO_GST_HST_NUMBER, margin, fy + 22);

  // Right: Support column. Copy neutralised so it reads the same
  // whether the client opened the PDF from email or from the track-move
  // portal (no "reply to this invoice", which fails on the portal).
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("QUESTIONS?", fRightX, fy);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(17);
  doc.text("info@helloyugo.com", fRightX, fy + 22);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(10);
  doc.text("(647) 370 4525 · same or next business day", fRightX, fy + 40);

  // Bottom legal
  const legalY = pageH - 36;
  doc.setDrawColor(76, 47, 60);
  doc.setLineWidth(0.4);
  doc.line(margin, legalY - 14, pageW - margin, legalY - 14);
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("HELLOYUGO INC.", margin, legalY - 2);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8);
  doc.text(
    "  ·  507 KING STREET EAST, TORONTO, ONTARIO M5A 1M3",
    margin + doc.getTextWidth("HELLOYUGO INC."),
    legalY - 2,
  );
  doc.text(
    "(647) 370 4525  ·  INFO@HELLOYUGO.COM  ·  ITSYUGO.COM",
    margin,
    legalY + 10,
  );
  if (symbol) {
    try {
      const sSize = 32;
      doc.addImage(symbol, "PNG", pageW - margin - sSize, legalY - sSize + 10, sSize, sSize);
    } catch { /* skip */ }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** ─── Editorial Payment Receipt generator ─────────────────────── */
function generateEditorialReceiptPDF(
  move: MoveRow,
  _tierLabel: string,
  depositPaid: number,
  balancePaid: number,
  _logoBase64: string,
  _footerLine: string,
  signatureDataUrl?: string | null,
  cardLast4?: string | null,
): Buffer {
  const WINE_RGB: [number, number, number] = [43, 4, 22];
  const CREAM_RGB: [number, number, number] = [249, 237, 228];
  const CREAM_MUTED: [number, number, number] = [216, 202, 190];
  const INK: [number, number, number] = [26, 19, 16];
  const INK_MUTED: [number, number, number] = [122, 110, 103];
  const RULE_RGB: [number, number, number] = [232, 225, 218];

  const doc = new jsPDF("p", "pt", "letter");
  const SERIF = registerSerifFont(doc);
  const SANS = registerBrownFont(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;

  const recNum = receiptNumber(move);
  const paidDate = formatEditorialDate(move.balance_paid_at || move.deposit_paid_at || move.completed_at);
  const bill = billTo(move);
  const svcType = String(move.service_type ?? move.move_type ?? "").toLowerCase();
  const svc = serviceDisplay(svcType, move.tier_selected);
  const jobNoun = ["b2b_delivery", "b2b_oneoff", "single_item", "bin_rental"].includes(svcType)
    ? "delivery"
    : "move";
  const cardSuffix = cardLast4 ? `Card ending ${cardLast4}` : "Card on file";
  const totalPaid = depositPaid + balancePaid;

  const wordmarkCream = loadYugoWordmarkCreamBase64();
  const symbol = loadYugoSymbolBase64();

  // Hero
  const heroH = 108;
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, 0, pageW, heroH, "F");
  if (wordmarkCream) {
    try {
      const wmH = 22;
      const wmW = wmH * WORDMARK_ASPECT;
      doc.addImage(wordmarkCream, "PNG", margin, 40, wmW, wmH);
    } catch { /* skip */ }
  }
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("PAYMENT RECEIPT", pageW - margin, 40, { align: "right" });
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(28);
  doc.text(recNum, pageW - margin, 68, { align: "right" });
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8.5);
  doc.text(`PAID ${paidDate.toUpperCase()}`, pageW - margin, 86, { align: "right" });

  let y = heroH + 34;
  const drawRule = () => {
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 26;
  };
  const eyebrow = (label: string) => {
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(label, margin, y);
  };

  // Paid by
  eyebrow("PAID BY");
  y += 30;
  doc.setTextColor(...INK);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(30);
  doc.text(bill.party, margin, y);
  y += 18;
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(11);
  const contactLines: string[] = [];
  if (bill.attn) contactLines.push(bill.attn);
  if (move.client_email) contactLines.push(move.client_email);
  if (move.client_phone) contactLines.push(move.client_phone);
  contactLines.forEach((ln) => {
    doc.text(ln, margin, y);
    y += 13;
  });
  y += 12;
  drawRule();

  // Route
  const colW = (contentW - 40) / 2;
  const rightColX = margin + colW + 40;
  const fromParsed = parseAddress(move.from_address);
  const toParsed = parseAddress(move.to_address);
  const routeBlock = (x: number, label: string, parsed: ReturnType<typeof parseAddress>) => {
    let cy = y;
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text(label, x, cy);
    cy += 22;
    doc.setTextColor(...INK);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(17);
    doc.splitTextToSize(parsed.street, colW).forEach((ln: string) => {
      doc.text(ln, x, cy);
      cy += 19;
    });
    if (parsed.cityLine || parsed.postal) {
      doc.setTextColor(...INK_MUTED);
      doc.setFont(SANS, "normal");
      doc.setFontSize(10);
      doc.text([parsed.cityLine, parsed.postal].filter(Boolean).join("   "), x, cy + 2);
    }
  };
  routeBlock(margin, "COLLECTED FROM", fromParsed);
  routeBlock(rightColX, "DELIVERED TO", toParsed);
  const arrowY = y + 12;
  doc.setDrawColor(...WINE_RGB);
  doc.setLineWidth(0.8);
  doc.line(margin + colW + 6, arrowY, rightColX - 10, arrowY);
  doc.line(rightColX - 12, arrowY - 3, rightColX - 6, arrowY);
  doc.line(rightColX - 12, arrowY + 3, rightColX - 6, arrowY);
  y += 62;
  drawRule();

  // Payments table
  eyebrow("PAYMENTS");
  y += 24;
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  const colDate = margin;
  const colDesc = margin + 90;
  const colMethod = margin + 320;
  const colAmt = pageW - margin;
  doc.text("DATE", colDate, y);
  doc.text("DESCRIPTION", colDesc, y);
  doc.text("METHOD", colMethod, y);
  doc.text("AMOUNT", colAmt, y, { align: "right" });
  y += 8;
  doc.setDrawColor(...RULE_RGB);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 18;
  const payRow = (date: string, desc: string, method: string, amt: number) => {
    doc.setTextColor(...INK);
    doc.setFont(SANS, "normal");
    doc.setFontSize(11);
    doc.text(date, colDate, y);
    doc.text(desc, colDesc, y);
    doc.text(method, colMethod, y);
    doc.setFont(SERIF, "normal");
    doc.setFontSize(14);
    doc.text(formatCurrency(amt), colAmt, y, { align: "right" });
    y += 22;
  };
  if (depositPaid > 0) {
    payRow(
      formatEditorialDate(move.deposit_paid_at),
      `Deposit · ${svc.label} ${jobNoun}`,
      cardSuffix,
      depositPaid,
    );
  }
  if (balancePaid > 0 || depositPaid === 0) {
    payRow(
      formatEditorialDate(move.balance_paid_at || move.completed_at),
      `Balance · ${svc.label} ${jobNoun}`,
      cardSuffix,
      balancePaid,
    );
  }
  y += 4;
  doc.setDrawColor(...RULE_RGB);
  doc.line(margin, y, pageW - margin, y);
  y += 22;
  doc.setTextColor(...INK);
  doc.setFont(SANS, "bold");
  doc.setFontSize(10.5);
  doc.text("TOTAL PAID", margin, y);
  doc.setTextColor(...WINE_RGB);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(26);
  doc.text(formatCurrency(totalPaid), pageW - margin, y + 2, { align: "right" });
  y += 26;
  drawRule();

  // Confirm note + signature
  doc.setTextColor(...INK_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(11.5);
  const confirmLines = doc.splitTextToSize(
    `This receipt confirms full payment for your completed ${jobNoun}. A duplicate copy has been emailed to the address above. Keep this record for your files.`,
    colW,
  );
  confirmLines.forEach((ln: string, i: number) => {
    doc.text(ln, margin, y + i * 14);
  });

  const sig =
    typeof signatureDataUrl === "string" && signatureDataUrl.trim().startsWith("data:image")
      ? signatureDataUrl.trim()
      : null;
  if (sig) {
    const sigX = rightColX;
    const sigY = y;
    doc.setTextColor(...WINE_RGB);
    doc.setFont(SANS, "bold");
    doc.setFontSize(8);
    doc.text("CLIENT SIGNATURE", sigX, sigY);
    try {
      doc.addImage(sig, "PNG", sigX, sigY + 8, 220, 56);
    } catch { /* skip */ }
    doc.setDrawColor(...RULE_RGB);
    doc.setLineWidth(0.5);
    doc.rect(sigX, sigY + 8, 220, 56);
  }

  // Footer
  const footerH = 160;
  const footerTop = Math.max(pageH - footerH, y + 24);
  doc.setFillColor(...WINE_RGB);
  doc.rect(0, footerTop, pageW, footerH, "F");
  const fPad = 28;
  const fColW = (contentW - 40) / 2;
  const fRightX = margin + fColW + 40;
  const fy = footerTop + fPad;
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("ON RECORD", margin, fy);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(9.5);
  doc.splitTextToSize(
    "Payments processed by Square. This receipt is your legal proof of payment. Refunds, if applicable, follow the terms on your original quote.",
    fColW,
  ).forEach((ln: string, i: number) => {
    doc.text(ln, margin, fy + 14 + i * 12);
  });
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("NEED A DUPLICATE?", fRightX, fy);
  doc.setFont(SERIF, "normal");
  doc.setFontSize(15);
  doc.text("info@helloyugo.com", fRightX, fy + 20);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(9.5);
  doc.splitTextToSize(
    "We keep every receipt on file. Reach out any time for a fresh PDF or additional statement.",
    fColW,
  ).forEach((ln: string, i: number) => {
    doc.text(ln, fRightX, fy + 40 + i * 12);
  });

  const legalY = pageH - 36;
  doc.setDrawColor(76, 47, 60);
  doc.setLineWidth(0.4);
  doc.line(margin, legalY - 14, pageW - margin, legalY - 14);
  doc.setTextColor(...CREAM_RGB);
  doc.setFont(SANS, "bold");
  doc.setFontSize(8);
  doc.text("HELLOYUGO INC.", margin, legalY - 2);
  doc.setTextColor(...CREAM_MUTED);
  doc.setFont(SANS, "normal");
  doc.setFontSize(8);
  doc.text(
    "  ·  507 KING STREET EAST, TORONTO, ONTARIO M5A 1M3",
    margin + doc.getTextWidth("HELLOYUGO INC."),
    legalY - 2,
  );
  doc.text(
    "(647) 370 4525  ·  INFO@HELLOYUGO.COM  ·  ITSYUGO.COM",
    margin,
    legalY + 10,
  );
  if (symbol) {
    try {
      const sSize = 32;
      doc.addImage(symbol, "PNG", pageW - margin - sSize, legalY - sSize + 10, sSize, sSize);
    } catch { /* skip */ }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** Shared "10 July 2026" formatter used across the editorial docs.
 *  Falls back to whatever formatDate returned when parsing fails. */
function formatEditorialDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  const day = d.toLocaleDateString("en-CA", { day: "numeric", timeZone: "America/Toronto" });
  const month = d.toLocaleDateString("en-CA", { month: "long", timeZone: "America/Toronto" });
  const year = d.toLocaleDateString("en-CA", { year: "numeric", timeZone: "America/Toronto" });
  return `${day} ${month} ${year}`;
}

export async function generateMovePDFs(moveId: string): Promise<{ summaryPath: string; invoicePath: string; receiptPath: string }> {
  const admin = createAdminClient();

  const { data: move, error: moveErr } = await admin
    .from("moves")
    .select("*")
    .eq("id", moveId)
    .single();

  if (moveErr || !move) throw new Error("Move not found");

  const moveRow = move as MoveRow;
  const displayId = moveDisplayId(moveRow);

  const [
    { data: crew },
    { data: inventory },
    { data: extraItems },
    { data: signOffRow },
  ] = await Promise.all([
    moveRow.crew_id
      ? admin.from("crews").select("name, members").eq("id", moveRow.crew_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("move_inventory").select("room, item_name, box_number").eq("move_id", moveId).order("room").order("item_name"),
    admin.from("extra_items").select("description, quantity, fee_cents, status").eq("job_id", moveId).eq("job_type", "move"),
    admin.from("client_sign_offs").select("signature_data_url").eq("job_id", moveId).eq("job_type", "move").maybeSingle(),
  ]);

  const crewData = crew as CrewRow;
  const invList = (inventory ?? []) as InventoryRow;
  const extras = (extraItems ?? []) as ExtraRow;
  const approvedExtras = extras.filter((e) => (e.status ?? "approved") === "approved");

  const tierLabel = (moveRow.tier_selected || "Essential").replace(/_/g, " ");
  const tierPrice = Number(moveRow.estimate ?? moveRow.amount ?? 0);
  const depositPaid = Number(moveRow.deposit_amount ?? Math.round(tierPrice * 0.25));
  const balancePaid = Number(moveRow.balance_amount ?? (tierPrice - depositPaid));

  const branding = await getLegalBranding();
  const footerLine = `${branding.companyLegal} · ${branding.address}`.replace(/\s+/g, " ").trim();
  const companyLegal = branding.companyLegal;

  const logoBase64 = loadYugoLogoBase64();
  const summaryBuffer = generateMoveSummaryPDF(
    moveRow,
    crewData,
    invList,
    tierLabel,
    logoBase64,
    footerLine,
  );
  const invoiceBuffer = generateInvoicePDF(
    moveRow,
    extras,
    tierLabel,
    tierPrice,
    logoBase64,
    footerLine,
    companyLegal,
  );
  const receiptBuffer = generateReceiptPDF(
    moveRow,
    tierLabel,
    depositPaid,
    balancePaid,
    logoBase64,
    footerLine,
    signOffRow?.signature_data_url ?? null,
    undefined,
  );

  const summaryPath = `moves/${moveId}/move-summary-${displayId}.pdf`;
  const invoicePath = `moves/${moveId}/invoice-${displayId}.pdf`;
  const receiptPath = `moves/${moveId}/receipt-${displayId}.pdf`;

  // cacheControl: "0" — Supabase Storage's default is 3600s, which
  // let browsers/CDN serve the pre-regenerate PDF for up to an hour
  // after a fresh upload. Every regen call has to be able to show its
  // output immediately, so we ask Storage to never cache these files.
  const uploadOpts = {
    contentType: "application/pdf",
    upsert: true,
    cacheControl: "0",
  };
  await admin.storage.from(BUCKET).upload(summaryPath, summaryBuffer, uploadOpts);
  await admin.storage.from(BUCKET).upload(invoicePath, invoiceBuffer, uploadOpts);
  await admin.storage.from(BUCKET).upload(receiptPath, receiptBuffer, uploadOpts);

  // Store storage paths (not public URLs): bucket is private; APIs create signed URLs on demand
  await admin
    .from("moves")
    .update({
      summary_pdf_url: summaryPath,
      invoice_pdf_url: invoicePath,
      receipt_pdf_url: receiptPath,
    })
    .eq("id", moveId);

  return { summaryPath, invoicePath, receiptPath };
}
