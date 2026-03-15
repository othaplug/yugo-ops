/**
 * Auto-generate Move Summary, Invoice, and Receipt PDFs on move completion.
 * Uploads to Supabase Storage (move-documents), updates moves table, and inserts into move_files.
 * Uses premium branding from @/lib/pdf-brand (wine, gold, cream, Instrument Serif / Times).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/format-currency";
import {
  WINE,
  GOLD,
  DARK,
  GRAY,
  GRAY_LIGHT,
  CREAM_BG,
  drawYugoHeader,
  drawYugoFooter,
  drawTopAccentBar,
  drawBottomAccentBar,
  getTableHeadStyles,
  TABLE_ALT_ROW,
  setSectionLabel,
  setBodyText,
  setHeroTitle,
} from "@/lib/pdf-brand";

const BUCKET = "move-documents";
const HST_RATE = 0.13;

const TIER_FEATURES: Record<string, string> = {
  essentials: "Standard crew, truck, basic wrap & pad, local move support.",
  curated: "Curated crew, premium truck, full wrap & pad, dedicated support.",
  premium: "Premium crew, premium truck, white-glove handling, priority support.",
};

type MoveRow = {
  id: string;
  move_code: string | null;
  move_number?: string | null;
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
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function pdfHeader(doc: jsPDF, yStart: number, centerX: number): number {
  let y = drawYugoHeader(doc, { yStart, centerX, margin: 50 });
  return y;
}

function pdfFooter(doc: jsPDF): void {
  drawYugoFooter(doc, { y: 285 });
}

/** Move Summary PDF */
function generateMoveSummaryPDF(
  move: MoveRow,
  crew: CrewRow,
  inventory: InventoryRow,
  tierLabel: string
): Buffer {
  const doc = new jsPDF("p", "pt", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const centerX = pageWidth / 2;
  let y = 36;

  drawTopAccentBar(doc, true);
  y = pdfHeader(doc, 24, centerX);
  setHeroTitle(doc, 16);
  doc.text("Move Summary", centerX, y, { align: "center" });
  y += 22;

  setBodyText(doc, 10);
  doc.text(`Move ID: ${moveDisplayId(move)}`, margin, y);
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(move.completed_at || move.scheduled_date)}`, pageWidth - margin, y, { align: "right" });
  y += 8;
  doc.setTextColor(...DARK);
  doc.text(`Client: ${move.client_name || "—"}`, margin, y);
  y += 8;
  doc.setTextColor(...GRAY);
  doc.text(`From: ${move.from_address || "—"}`, margin, y);
  y += 6;
  doc.text(`To: ${move.to_address || "—"}`, margin, y);
  y += 12;

  setSectionLabel(doc, 9);
  doc.text("Package", margin, y);
  setBodyText(doc, 9);
  doc.text(`: ${tierLabel}`, margin + 45, y);
  y += 8;

  const crewNames = crew?.members && Array.isArray(crew.members)
    ? (crew.members as string[]).join(", ")
    : crew?.name || "—";
  const crewCount = Array.isArray(crew?.members) ? (crew.members as string[]).length : 0;
  doc.text(`Crew: ${crewNames} · ${crewCount || "N"} movers`, margin, y);
  y += 6;
  const truck = move.truck_primary || move.truck_secondary || "—";
  doc.text(`Truck: ${truck}`, margin, y);
  y += 6;
  const hours = move.actual_hours ?? move.est_hours;
  doc.text(`Duration: ${hours != null ? `${hours} hours` : "—"}`, margin, y);
  y += 14;

  setSectionLabel(doc, 9);
  doc.text("Inventory", margin, y);
  y += 6;
  setBodyText(doc, 8);
  doc.setTextColor(...DARK);
  if (inventory.length === 0) {
    doc.text("No inventory recorded.", margin, y);
    y += 8;
  } else {
    const lines = inventory.slice(0, 40).map((i) => {
      const room = i.room ? `[${i.room}] ` : "";
      const box = i.box_number ? ` #${i.box_number}` : "";
      return `${room}${i.item_name || "Item"}${box}`;
    });
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
    if (inventory.length > 40) {
      doc.setTextColor(...GRAY);
      doc.text(`… and ${inventory.length - 40} more items`, margin, y);
      y += 8;
    }
  }

  y += 6;
  setSectionLabel(doc, 9);
  doc.text("What was included", margin, y);
  y += 6;
  setBodyText(doc, 8);
  const tierKey = (move.tier_selected || "").toLowerCase().replace(/\s+/g, "_");
  doc.text(TIER_FEATURES[tierKey] || TIER_FEATURES.curated || "Moving service as agreed.", margin, y);
  y += 8;

  setSectionLabel(doc, 9);
  doc.text("Valuation coverage", margin, y);
  setBodyText(doc, 8);
  doc.text(`: ${move.valuation_tier || "Released value"}`, margin + 55, y);

  pdfFooter(doc);
  drawBottomAccentBar(doc, true);
  return Buffer.from(doc.output("arraybuffer"));
}

/** Invoice PDF — tier + add-ons, HST, payments */
function generateInvoicePDF(
  move: MoveRow,
  extraItems: ExtraRow,
  tierLabel: string,
  tierPrice: number
): Buffer {
  const doc = new jsPDF("p", "pt", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const centerX = pageWidth / 2;
  let y = 36;

  drawTopAccentBar(doc, false);
  y = pdfHeader(doc, 24, centerX);
  setHeroTitle(doc, 16);
  doc.text("Invoice", centerX, y, { align: "center" });
  y += 22;

  const invNum = invoiceNumber(move);
  const issuedDate = formatDate(move.completed_at || move.scheduled_date);
  setBodyText(doc, 10);
  doc.text(`Invoice #: ${invNum}`, margin, y);
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date issued: ${issuedDate}`, pageWidth - margin, y, { align: "right" });
  y += 10;
  doc.setTextColor(...GRAY);
  doc.text("Bill to:", margin, y);
  y += 6;
  doc.setTextColor(...DARK);
  doc.text(`${move.client_name || "—"}`, margin, y);
  y += 5;
  doc.setFontSize(9);
  if (move.client_email) doc.text(move.client_email, margin, y), (y += 5);
  if (move.client_phone) doc.text(move.client_phone, margin, y), (y += 5);
  y += 8;

  const approvedExtras = extraItems.filter((e) => (e.status ?? "approved") === "approved" && (e.fee_cents ?? 0) > 0);
  const subtotal = tierPrice + approvedExtras.reduce((s, e) => s + (Number(e.fee_cents) || 0) / 100 * (e.quantity || 1), 0);
  const hst = Math.round(subtotal * HST_RATE * 100) / 100;
  const total = subtotal + hst;
  const depositPaid = Number(move.deposit_amount ?? Math.round(tierPrice * 0.25));
  const balancePaid = Number(move.balance_amount ?? (total - depositPaid));
  const amountOwing = Math.max(0, total - depositPaid - balancePaid);

  const tableBody: (string | number)[][] = [
    [`${tierLabel} Package`, formatCurrency(tierPrice)],
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
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  setBodyText(doc, 9);
  const depositDate = formatDate(move.deposit_paid_at);
  const balanceDate = formatDate(move.balance_paid_at);
  doc.text(`Deposit paid ${depositDate}`, margin, y);
  doc.text(`-${formatCurrency(depositPaid)}`, pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.text(`Balance paid ${balanceDate}`, margin, y);
  doc.text(`-${formatCurrency(balancePaid)}`, pageWidth - margin, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Amount owing", margin, y);
  doc.text(formatCurrency(amountOwing), pageWidth - margin, y, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Thank you for choosing Yugo.", margin, y);
  y += 5;
  doc.text("Yugo Technologies Inc., Toronto ON", margin, y);

  pdfFooter(doc);
  drawBottomAccentBar(doc, false);
  return Buffer.from(doc.output("arraybuffer"));
}

/** Receipt PDF */
function generateReceiptPDF(
  move: MoveRow,
  tierLabel: string,
  depositPaid: number,
  balancePaid: number,
  cardLast4?: string | null
): Buffer {
  const doc = new jsPDF("p", "pt", "letter");
  const margin = 50;
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  let y = 36;

  drawTopAccentBar(doc, true);
  y = pdfHeader(doc, 24, centerX);
  setHeroTitle(doc, 16);
  doc.text("Payment Receipt", centerX, y, { align: "center" });
  y += 22;

  setBodyText(doc, 10);
  doc.text(`Receipt #: ${receiptNumber(move)}`, margin, y);
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.text(`Date: ${formatDate(move.balance_paid_at || move.completed_at)}`, pageWidth - margin, y, { align: "right" });
  y += 8;
  doc.setTextColor(...DARK);
  doc.text(`Client: ${move.client_name || "—"}`, margin, y);
  y += 6;
  doc.setTextColor(...GRAY);
  doc.text(`Move: ${move.from_address || "—"} → ${move.to_address || "—"}`, margin, y);
  y += 14;

  const totalPaid = depositPaid + balancePaid;
  const cardSuffix = cardLast4 ? `Card ending ${cardLast4}` : "Card";

  const tableBody: (string | number)[][] = [
    [formatDate(move.deposit_paid_at), `Deposit — ${tierLabel} move`, cardSuffix, formatCurrency(depositPaid)],
    [formatDate(move.balance_paid_at || move.completed_at), `Balance — ${tierLabel} move`, cardSuffix, formatCurrency(balancePaid)],
    ["", "Total Paid", "", formatCurrency(totalPaid)],
  ];
  const headStyles = getTableHeadStyles(true);
  autoTable(doc, {
    startY: y,
    head: [["Date", "Description", "Method", "Amount"]],
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
  doc.text("This receipt confirms full payment for your Yugo move.", margin, y);

  pdfFooter(doc);
  drawBottomAccentBar(doc, true);
  return Buffer.from(doc.output("arraybuffer"));
}

export async function generateMovePDFs(moveId: string): Promise<{ summaryUrl: string; invoiceUrl: string; receiptUrl: string }> {
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
  ] = await Promise.all([
    moveRow.crew_id
      ? admin.from("crews").select("name, members").eq("id", moveRow.crew_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("move_inventory").select("room, item_name, box_number").eq("move_id", moveId).order("room").order("item_name"),
    admin.from("extra_items").select("description, quantity, fee_cents, status").eq("job_id", moveId).eq("job_type", "move"),
  ]);

  const crewData = crew as CrewRow;
  const invList = (inventory ?? []) as InventoryRow;
  const extras = (extraItems ?? []) as ExtraRow;
  const approvedExtras = extras.filter((e) => (e.status ?? "approved") === "approved");

  const tierLabel = (moveRow.tier_selected || "Curated").replace(/_/g, " ");
  const tierKey = (moveRow.tier_selected || "curated").toLowerCase().replace(/\s+/g, "_");
  const tierPrice = Number(moveRow.estimate ?? moveRow.amount ?? 0);
  const depositPaid = Number(moveRow.deposit_amount ?? Math.round(tierPrice * 0.25));
  const balancePaid = Number(moveRow.balance_amount ?? (tierPrice - depositPaid));

  const summaryBuffer = generateMoveSummaryPDF(moveRow, crewData, invList, tierLabel);
  const invoiceBuffer = generateInvoicePDF(moveRow, extras, tierLabel, tierPrice);
  const receiptBuffer = generateReceiptPDF(moveRow, tierLabel, depositPaid, balancePaid, undefined);

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

  const summaryUrl = admin.storage.from(BUCKET).getPublicUrl(summaryPath).data.publicUrl;
  const invoiceUrl = admin.storage.from(BUCKET).getPublicUrl(invoicePath).data.publicUrl;
  const receiptUrl = admin.storage.from(BUCKET).getPublicUrl(receiptPath).data.publicUrl;

  await admin
    .from("moves")
    .update({
      summary_pdf_url: summaryUrl,
      invoice_pdf_url: invoiceUrl,
      receipt_pdf_url: receiptUrl,
    })
    .eq("id", moveId);

  await admin
    .from("move_files")
    .delete()
    .eq("move_id", moveId)
    .eq("source", "system");

  const docs = [
    { file_url: summaryUrl, file_name: `Move Summary - ${displayId}.pdf`, category: "document", source: "system" },
    { file_url: invoiceUrl, file_name: `Invoice - ${displayId}.pdf`, category: "document", source: "system" },
    { file_url: receiptUrl, file_name: `Payment Receipt - ${displayId}.pdf`, category: "document", source: "system" },
  ];
  for (const doc of docs) {
    await admin.from("move_files").insert({
      move_id: moveId,
      ...doc,
      file_type: "application/pdf",
    });
  }

  return { summaryUrl, invoiceUrl, receiptUrl };
}
