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

function invoiceNumber(m: MoveRow): string {
  const code = m.move_code || "";
  const num = code.replace(/^[A-Z]+/i, "") || m.id.slice(0, 4).toUpperCase();
  return `INV-${num}`;
}

function receiptNumber(m: MoveRow): string {
  const code = m.move_code || "";
  const num = code.replace(/^[A-Z]+/i, "") || m.id.slice(0, 4).toUpperCase();
  return `REC-${num}`;
}

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

/** Move Summary PDF: wine gradient, centered wordmark, section rules, letter/pt spacing */
function generateMoveSummaryPDF(
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
  const crewNames =
    crew?.members && Array.isArray(crew.members)
      ? (crew.members as string[]).join(", ")
      : crew?.name || "-";
  const crewCount = Array.isArray(crew?.members) ? (crew.members as string[]).length : 0;
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

/** Invoice PDF: wine gradient shell, centered wordmark, readable spacing (no wordmark text) */
function generateInvoicePDF(
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

/** Payment receipt: premium shell, generous line height, optional client signature from sign-off */
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

  await admin.storage.from(BUCKET).upload(summaryPath, summaryBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  await admin.storage.from(BUCKET).upload(invoicePath, invoiceBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  await admin.storage.from(BUCKET).upload(receiptPath, receiptBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });

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
