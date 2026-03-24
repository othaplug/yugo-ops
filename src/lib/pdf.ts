import jsPDF from "jspdf";
import { formatCurrency } from "./format-currency";
import { formatPhone } from "./phone";
import autoTable from "jspdf-autotable";
import {
  WINE,
  GOLD,
  DARK,
  GRAY,
  GRAY_LIGHT,
  CREAM_BG,
  GREEN,
  drawYugoHeader,
  drawYugoFooter,
  drawTopAccentBar,
  drawBottomAccentBar,
  getTableHeadStyles,
  TABLE_ALT_ROW,
  setBodyText,
  setSectionLabel,
  drawPageTemplate,
  drawSectionHeading,
  MARGIN,
} from "./pdf-brand";

export function generateInvoicePDF(invoice: {
  invoice_number: string;
  client_name: string;
  amount: number;
  due_date: string;
  line_items: any[];
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  drawTopAccentBar(doc, true);
  let y = drawYugoHeader(doc, { yStart: 24, centerX });
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text("Invoice", centerX, y, { align: "center" });
  y += 20;

  setBodyText(doc, 12);
  doc.text(invoice.invoice_number, 20, y);
  doc.setTextColor(...GRAY);
  doc.setFontSize(10);
  doc.text(`Client: ${invoice.client_name}`, 20, y + 8);
  doc.text(`Due: ${invoice.due_date}`, 20, y + 16);
  y += 28;

  const items = typeof invoice.line_items === "string"
    ? JSON.parse(invoice.line_items)
    : invoice.line_items || [];

  const headStyles = getTableHeadStyles(true);
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Total"]],
    body: items.map((item: any) => [
      item.d || item.description || "",
      item.q || item.quantity || 1,
      formatCurrency(item.r ?? item.rate ?? 0),
      formatCurrency((item.q || 1) * (item.r || 0)),
    ]),
    theme: "plain",
    headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(`Total: ${formatCurrency(invoice.amount)}`, 140, finalY + 15);

  drawYugoFooter(doc, { y: 278 });
  drawBottomAccentBar(doc, true);
  return doc;
}

export function generateDeliveryPDF(delivery: {
  delivery_number: string;
  client_name: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  pickup_address: string;
  delivery_address: string;
  scheduled_date: string;
  delivery_window: string;
  items: (string | { name: string; qty?: number })[];
  instructions: string;
  status: string;
  quoted_price?: number;
  special_handling?: boolean;
}) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = drawPageTemplate(doc, { useWineBar: true });

  // Document title
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text("Delivery Order", pageWidth / 2, y, { align: "center" });
  y += 6;

  // Delivery number + status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(delivery.delivery_number, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Status: ${delivery.status}`, 115, y);
  if (delivery.special_handling) {
    doc.setTextColor(245, 158, 11);
    doc.text("Special Handling Required", 155, y);
  }
  y += 10;

  // Customer + Delivery columns
  y = drawSectionHeading(doc, "Customer", MARGIN, y, 85);
  setBodyText(doc, 9);
  doc.text(delivery.customer_name, MARGIN, y); y += 5;
  if (delivery.customer_email) { doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(delivery.customer_email, MARGIN, y); y += 4; }
  if (delivery.customer_phone) { doc.text(formatPhone(delivery.customer_phone), MARGIN, y); y += 4; }
  setBodyText(doc, 8); doc.setTextColor(...GRAY);
  doc.text(`Partner: ${delivery.client_name}`, MARGIN, y); y += 10;

  y = drawSectionHeading(doc, "Delivery Details", MARGIN, y, 170);
  setBodyText(doc, 9);
  doc.text(`Scheduled: ${delivery.scheduled_date}${delivery.delivery_window ? `  ·  ${delivery.delivery_window}` : ""}`, MARGIN, y); y += 5;
  const pickupLines = doc.splitTextToSize(`Pickup:  ${delivery.pickup_address || "Not specified"}`, 170);
  doc.text(pickupLines, MARGIN, y); y += pickupLines.length * 4 + 3;
  const delivLines = doc.splitTextToSize(`Delivery:  ${delivery.delivery_address || "Not specified"}`, 170);
  doc.text(delivLines, MARGIN, y); y += delivLines.length * 4 + 8;

  // Items table
  const items = delivery.items || [];
  if (items.length > 0) {
    const itemRows = items.map((item, i) => {
      const name = typeof item === "string" ? item : (item as { name: string; qty?: number })?.name || "";
      const qty = typeof item === "object" && (item as { qty?: number })?.qty != null ? (item as { qty: number }).qty : 1;
      return [i + 1, name, String(qty)];
    });
    const headStyles = getTableHeadStyles(true);
    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Qty"]],
      body: itemRows,
      theme: "plain",
      headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: TABLE_ALT_ROW },
      columnStyles: { 0: { cellWidth: 15 }, 2: { cellWidth: 20, halign: "center" } },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Pricing
  if (delivery.quoted_price != null) {
    y = drawSectionHeading(doc, "Pricing", MARGIN, y, 170);
    setBodyText(doc, 10);
    doc.setFont("helvetica", "bold");
    doc.text(`Quoted: $${Number(delivery.quoted_price).toFixed(2)}`, MARGIN, y);
    y += 10;
  }

  // Instructions
  if (delivery.instructions) {
    if (y > 240) { doc.addPage(); y = 30; }
    y = drawSectionHeading(doc, "Special Instructions", MARGIN, y, 170);
    setBodyText(doc, 9);
    const lines = doc.splitTextToSize(delivery.instructions, 170);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4 + 5;
  }

  return doc;
}

export interface SignOffReceiptData {
  jobId: string;
  jobType: string;
  displayId: string;
  clientName?: string;
  signedBy: string;
  signedAt: string;
  signedLat?: number | null;
  signedLng?: number | null;
  satisfactionRating?: number | null;
  npsScore?: number | null;
  wouldRecommend?: boolean | null;
  damageReportDeadline?: string | null;
  confirmations: { label: string; value: boolean; valueLabel?: string }[];
  feedbackNote?: string | null;
  exceptions?: string | null;
  escalationTriggered?: boolean;
  escalationReason?: string | null;
  discrepancyFlags?: string[];
}

export function generateSignOffReceiptPDF(data: SignOffReceiptData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const red = [220, 38, 38] as [number, number, number];
  const green = [22, 163, 74] as [number, number, number];

  let y = drawPageTemplate(doc, { useWineBar: true });

  // Document title
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text("Client Sign-Off Receipt", pageWidth / 2, y, { align: "center" });
  y += 6;

  // Job reference
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(data.displayId, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Type: ${data.jobType}`, 115, y);
  y += 10;

  // Sign-off details
  y = drawSectionHeading(doc, "Sign-Off Details", MARGIN, y, 170);
  setBodyText(doc, 9);
  doc.text(`Signed by: ${data.signedBy}`, MARGIN, y); y += 5;
  if (data.clientName) { doc.text(`Client: ${data.clientName}`, MARGIN, y); y += 5; }
  doc.text(`Date: ${new Date(data.signedAt).toLocaleString("en-US")}`, MARGIN, y); y += 5;
  if (data.signedLat != null && data.signedLng != null) {
    doc.text(`Location: ${data.signedLat.toFixed(5)}, ${data.signedLng.toFixed(5)}`, 20, y); y += 5;
  }
  if (data.satisfactionRating != null) {
    doc.text(`Satisfaction: ${data.satisfactionRating}/5`, 20, y); y += 5;
  }
  if (data.npsScore != null) {
    const npsCategory = data.npsScore <= 6 ? "Detractor" : data.npsScore <= 8 ? "Passive" : "Promoter";
    doc.text(`NPS Score: ${data.npsScore}/10 (${npsCategory})`, 20, y); y += 5;
  }
  if (data.wouldRecommend != null) {
    doc.text(`Would recommend: ${data.wouldRecommend ? "Yes" : "No"}`, 20, y); y += 5;
  }
  y += 3;

  // Damage report deadline
  if (data.damageReportDeadline) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...red);
    doc.text(`Damage report deadline: ${new Date(data.damageReportDeadline).toLocaleString("en-US")}`, MARGIN, y);
    y += 8;
  }

  // Confirmations table
  if (data.confirmations.length > 0) {
    const headStyles = getTableHeadStyles(true);
    const body = data.confirmations.map((c) => [c.label, c.valueLabel ?? (c.value ? "Yes" : "No")]);
    autoTable(doc, {
      startY: y,
      head: [["Confirmation", "Status"]],
      body,
      theme: "plain",
      headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: TABLE_ALT_ROW },
      columnStyles: {
        1: { cellWidth: 25, halign: "center" },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 1) {
          const val = (hookData.row.raw as string[])?.[1];
          const color = val === "Yes" ? green : val === "N/A" ? GRAY : red;
          (hookData.cell.styles as { textColor?: number[] }).textColor = color;
        }
      },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Feedback & exceptions
  if (data.feedbackNote) {
    if (y > 250) { doc.addPage(); y = 30; }
    y = drawSectionHeading(doc, "Feedback", MARGIN, y, 170);
    setBodyText(doc, 9);
    const lines = doc.splitTextToSize(data.feedbackNote, 170);
    doc.text(lines, MARGIN, y); y += lines.length * 4 + 5;
  }

  if (data.exceptions) {
    if (y > 250) { doc.addPage(); y = 30; }
    y = drawSectionHeading(doc, "Exceptions / Issues", MARGIN, y, 170);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...red);
    const lines = doc.splitTextToSize(data.exceptions, 170);
    doc.text(lines, MARGIN, y); y += lines.length * 4 + 5;
  }

  // Escalation warning
  if (data.escalationTriggered && data.escalationReason) {
    if (y > 245) { doc.addPage(); y = 30; }
    y = drawSectionHeading(doc, "Escalation Triggered", MARGIN, y, 170);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...red);
    const lines = doc.splitTextToSize(data.escalationReason, 170);
    doc.text(lines, MARGIN, y); y += lines.length * 4 + 5;
  }

  // Discrepancy flags
  if (data.discrepancyFlags && data.discrepancyFlags.length > 0) {
    if (y > 245) { doc.addPage(); y = 30; }
    y = drawSectionHeading(doc, "Discrepancy Flags", MARGIN, y, 170);
    setBodyText(doc, 9);
    data.discrepancyFlags.forEach((f) => {
      const lines = doc.splitTextToSize(`• ${f}`, 170);
      doc.text(lines, MARGIN, y); y += lines.length * 4 + 2;
    });
  }

  // Legal disclaimer
  if (y > 258) { doc.addPage(); y = 30; }
  y = Math.max(y + 6, 258);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    "By signing, the client confirms all items were received as described. Concealed damage must be reported within 24 hours.",
    MARGIN, y, { maxWidth: 170 },
  );

  return doc;
}

/* ─── Premium Move Invoice ─── */

export interface MoveInvoiceData {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  moveCode: string;
  fromAddress: string;
  toAddress: string;
  scheduledDate: string;
  completedDate: string;
  estimate: number;
  depositPaid: number;
  balanceDue: number;
  extraItems: { description: string; quantity: number; feeCents: number }[];
  changeFees: { description: string; feeCents: number }[];
  hstRate?: number;
}

export function generateMoveInvoicePDF(data: MoveInvoiceData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;
  const hstRate = data.hstRate ?? 0.13;

  drawTopAccentBar(doc, false);
  let y = drawYugoHeader(doc, { yStart: 24, centerX });
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text("Invoice", centerX, y, { align: "center" });
  y += 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...GOLD);
  doc.text("INVOICE", 155, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(data.invoiceNumber, 155, 29);
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Date: ${data.completedDate}`, 155, 35);

  doc.setDrawColor(...GRAY_LIGHT);
  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);
  y = 52;

  setSectionLabel(doc, 8);
  doc.text("BILL TO", 20, y);
  doc.text("MOVE DETAILS", 115, y);
  y += 6;

  setBodyText(doc, 9);
  doc.text(data.clientName, 20, y);
  doc.text(`Move: ${data.moveCode}`, 115, y);
  y += 5;
  if (data.clientEmail) { doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(data.clientEmail, 20, y); }
  doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text(`Scheduled: ${data.scheduledDate}`, 115, y);
  y += 5;
  if (data.clientPhone) { doc.text(formatPhone(data.clientPhone), 20, y); }
  doc.text(`Completed: ${data.completedDate}`, 115, y);
  y += 10;

  setSectionLabel(doc, 8);
  doc.text("FROM", 20, y);
  doc.text("TO", 115, y);
  y += 5;
  setBodyText(doc, 8);
  const fromLines = doc.splitTextToSize(data.fromAddress || "—", 80);
  const toLines = doc.splitTextToSize(data.toAddress || "—", 80);
  doc.text(fromLines, 20, y);
  doc.text(toLines, 115, y);
  y += Math.max(fromLines.length, toLines.length) * 4 + 8;

  // Line items table
  const lineItems: (string | number)[][] = [];
  lineItems.push(["Moving Service", "1", formatCurrency(data.estimate), formatCurrency(data.estimate)]);

  for (const extra of data.extraItems) {
    if (extra.feeCents > 0) {
      lineItems.push([
        `Extra: ${extra.description}`,
        String(extra.quantity),
        formatCurrency(extra.feeCents / 100),
        formatCurrency((extra.feeCents / 100) * extra.quantity),
      ]);
    }
  }
  for (const change of data.changeFees) {
    if (change.feeCents > 0) {
      lineItems.push([
        `Change: ${change.description}`,
        "1",
        formatCurrency(change.feeCents / 100),
        formatCurrency(change.feeCents / 100),
      ]);
    }
  }

  const headStyles = getTableHeadStyles(true);
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: lineItems,
    theme: "plain",
    headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE, cellPadding: { top: 4, bottom: 4, left: 6, right: 6 } },
    bodyStyles: { fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 35, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
    alternateRowStyles: { fillColor: TABLE_ALT_ROW },
  });

  y = (doc as any).lastAutoTable?.finalY + 8;

  const subtotal = data.estimate +
    data.extraItems.reduce((s, e) => s + (e.feeCents > 0 ? (e.feeCents / 100) * e.quantity : 0), 0) +
    data.changeFees.reduce((s, c) => s + (c.feeCents > 0 ? c.feeCents / 100 : 0), 0);
  const hst = Math.round(subtotal * hstRate * 100) / 100;
  const total = subtotal + hst;

  const summaryX = 130;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Subtotal", summaryX, y);
  doc.setTextColor(...DARK);
  doc.text(formatCurrency(subtotal), 185, y, { align: "right" });
  y += 5;

  doc.setTextColor(...GRAY);
  doc.text(`HST (${(hstRate * 100).toFixed(0)}%)`, summaryX, y);
  doc.setTextColor(...DARK);
  doc.text(formatCurrency(hst), 185, y, { align: "right" });
  y += 5;

  doc.setDrawColor(...GRAY_LIGHT);
  doc.line(summaryX, y, 190, y);
  y += 5;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("Total", summaryX, y);
  doc.text(formatCurrency(total), 185, y, { align: "right" });
  y += 8;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Deposit Paid: ${formatCurrency(data.depositPaid)}`, summaryX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  if (data.balanceDue > 0) doc.setTextColor(209, 67, 67);
  else doc.setTextColor(45, 159, 90);
  doc.text(`Balance Due: ${formatCurrency(data.balanceDue)}`, summaryX, y);
  y += 12;

  doc.setDrawColor(...GRAY_LIGHT);
  doc.line(20, 272, 190, 272);
  drawYugoFooter(doc, { y: 278 });
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Thank you for choosing Yugo. Payment is due upon receipt unless otherwise arranged.", 20, 283);
  drawBottomAccentBar(doc, false);
  return doc;
}

/* ─── Move Snapshot (Move-In-Review) ─── */

export interface MoveSnapshotData {
  moveCode: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  fromAddress: string;
  toAddress: string;
  scheduledDate: string;
  completedDate: string;
  moveType?: string;
  serviceType?: string;
  tierSelected?: string;
  crewName?: string;
  crewMembers?: string[];
  vehicleType?: string;
  estimate: number;
  depositPaid: number;
  balanceDue: number;
  checkpoints: { status: string; timestamp: string; note?: string | null }[];
  inventoryCount: number;
  extraItems: { description: string; quantity: number; status: string; feeCents?: number }[];
  changeRequests: { type: string; details: string; status: string; feeCents?: number }[];
  incidents: { type: string; description: string; severity?: string }[];
  signOff?: {
    signedBy: string;
    signedAt: string;
    satisfactionRating?: number | null;
    npsScore?: number | null;
    feedbackNote?: string | null;
    exceptions?: string | null;
  } | null;
  photosCount: number;
}

export function generateMoveSnapshotPDF(data: MoveSnapshotData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  drawTopAccentBar(doc, true);
  let y = drawYugoHeader(doc, { yStart: 24, centerX });
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WINE);
  doc.text("Move Snapshot", centerX, y, { align: "center" });
  y += 18;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(data.moveCode, 155, y - 8);
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text("COMPLETED", 155, y - 2);
  doc.setTextColor(...GRAY);
  doc.text(data.completedDate, 155, y + 4);

  doc.setDrawColor(...GRAY_LIGHT);
  doc.line(20, y + 12, 190, y + 12);
  y += 22;

  function sectionHeader(title: string) {
    if (y > 260) { doc.addPage(); y = 20; }
    setSectionLabel(doc, 8);
    doc.text(title, 20, y);
    y += 6;
  }

  function infoLine(label: string, value: string, x = 20) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.text(label, x, y);
    doc.setTextColor(...DARK);
    doc.text(value, x + 42, y);
    y += 5;
  }

  // Client info
  sectionHeader("CLIENT INFORMATION");
  infoLine("Name", data.clientName);
  if (data.clientEmail) infoLine("Email", data.clientEmail);
  if (data.clientPhone) infoLine("Phone", formatPhone(data.clientPhone));
  y += 3;

  // Move details
  sectionHeader("MOVE DETAILS");
  infoLine("From", data.fromAddress || "—");
  infoLine("To", data.toAddress || "—");
  infoLine("Scheduled", data.scheduledDate);
  infoLine("Completed", data.completedDate);
  if (data.serviceType) infoLine("Service", data.serviceType);
  if (data.tierSelected) infoLine("Package", data.tierSelected);
  if (data.vehicleType) infoLine("Vehicle", data.vehicleType);
  infoLine("Items", String(data.inventoryCount));
  if (data.photosCount > 0) infoLine("Photos", String(data.photosCount));
  y += 3;

  // Crew info
  sectionHeader("CREW");
  infoLine("Team", data.crewName || "—");
  if (data.crewMembers && data.crewMembers.length > 0) {
    infoLine("Members", data.crewMembers.join(", "));
  }
  y += 3;

  // Financial summary
  sectionHeader("FINANCIAL SUMMARY");
  infoLine("Estimate", formatCurrency(data.estimate));
  infoLine("Deposit Paid", formatCurrency(data.depositPaid));
  infoLine("Balance Due", formatCurrency(data.balanceDue));
  y += 3;

  // Timeline
  if (data.checkpoints.length > 0) {
    sectionHeader("MOVE TIMELINE");
    const cpRows = data.checkpoints.map((cp) => {
      const time = new Date(cp.timestamp).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      });
      const statusLabel = cp.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return [time, statusLabel, cp.note || ""];
    });
    const headStyles = getTableHeadStyles(true);
    autoTable(doc, {
      startY: y,
      head: [["Time", "Status", "Note"]],
      body: cpRows,
      theme: "plain",
      headStyles: { ...headStyles, fillColor: CREAM_BG, textColor: WINE, fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 50 } },
      alternateRowStyles: { fillColor: TABLE_ALT_ROW },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Extra items
  if (data.extraItems.length > 0) {
    sectionHeader("EXTRA ITEMS");
    const extraRows = data.extraItems.map((e) => [
      e.description,
      String(e.quantity),
      e.status.charAt(0).toUpperCase() + e.status.slice(1),
      e.feeCents ? formatCurrency(e.feeCents / 100) : "—",
    ]);
    const headStylesExtra = getTableHeadStyles(true);
    autoTable(doc, {
      startY: y,
      head: [["Item", "Qty", "Status", "Fee"]],
      body: extraRows,
      theme: "plain",
      headStyles: { ...headStylesExtra, fillColor: CREAM_BG, textColor: WINE, fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: TABLE_ALT_ROW },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Change requests
  if (data.changeRequests.length > 0) {
    sectionHeader("CHANGE REQUESTS");
    const changeRows = data.changeRequests.map((c) => [
      c.type,
      c.details,
      c.status.charAt(0).toUpperCase() + c.status.slice(1),
      c.feeCents ? formatCurrency(c.feeCents / 100) : "—",
    ]);
    const headStylesChange = getTableHeadStyles(true);
    autoTable(doc, {
      startY: y,
      head: [["Type", "Details", "Status", "Fee"]],
      body: changeRows,
      theme: "plain",
      headStyles: { ...headStylesChange, fillColor: CREAM_BG, textColor: WINE, fontSize: 7 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: TABLE_ALT_ROW },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Incidents
  if (data.incidents.length > 0) {
    sectionHeader("INCIDENTS / ISSUES");
    for (const inc of data.incidents) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(209, 67, 67);
      doc.text(`${inc.type}${inc.severity ? ` (${inc.severity})` : ""}`, 20, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(inc.description, 170);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 4;
    }
  }

  if (data.signOff) {
    sectionHeader("CLIENT SIGN-OFF");
    infoLine("Signed by", data.signOff.signedBy);
    infoLine("Signed at", new Date(data.signOff.signedAt).toLocaleString("en-US"));
    if (data.signOff.satisfactionRating != null) {
      infoLine("Satisfaction", `${data.signOff.satisfactionRating}/5`);
    }
    if (data.signOff.npsScore != null) {
      const cat = data.signOff.npsScore <= 6 ? "Detractor" : data.signOff.npsScore <= 8 ? "Passive" : "Promoter";
      infoLine("NPS Score", `${data.signOff.npsScore}/10 (${cat})`);
    }
    if (data.signOff.feedbackNote) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GRAY);
      doc.text("Feedback:", 20, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(data.signOff.feedbackNote, 170);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 4;
    }
    if (data.signOff.exceptions) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(209, 67, 67);
      doc.text("Exceptions:", 20, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(data.signOff.exceptions, 170);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 4;
    }
  }

  if (y > 265) { doc.addPage(); }
  doc.setDrawColor(...GRAY_LIGHT);
  doc.line(20, 272, 190, 272);
  drawYugoFooter(doc, { y: 278 });
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("This document is an automated summary of your move. For questions, contact Yugo support.", 20, 283);
  drawBottomAccentBar(doc, true);
  return doc;
}

/* ─── Proof of Delivery PDF ─── */

export interface PoDPDFData {
  deliveryNumber: string;
  date: string;
  address: string;
  gpsLat?: number | null;
  gpsLng?: number | null;
  crewMembers: string[];
  partnerName?: string | null;
  items: { name: string; condition: string; notes?: string }[];
  signerName: string;
  signedAt: string;
  satisfactionRating?: number | null;
  satisfactionComment?: string | null;
  signatureDataUrl?: string | null;
}

export function generatePoDPDF(data: PoDPDFData) {
  const doc = new jsPDF();
  const gold: [number, number, number] = [201, 169, 98];
  const dark: [number, number, number] = [13, 13, 13];
  const gray: [number, number, number] = [120, 120, 120];
  const green: [number, number, number] = [34, 197, 94];
  const red: [number, number, number] = [239, 68, 68];

  doc.setFillColor(...gold);
  doc.rect(0, 0, 210, 3, "F");

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Yugo", 20, 26);
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text("Proof of Delivery", 20, 33);

  if (data.partnerName) {
    doc.setFontSize(9);
    doc.setTextColor(...gold);
    doc.text(data.partnerName, 130, 22);
  }

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 38, 190, 38);

  let y = 48;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(`Delivery: ${data.deliveryNumber}`, 20, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`Date: ${data.date}`, 20, y);
  y += 5;
  doc.text(`Location: ${data.address || "—"}`, 20, y);
  y += 5;
  if (data.gpsLat != null && data.gpsLng != null) {
    doc.text(`GPS: ${Number(data.gpsLat).toFixed(4)}, ${Number(data.gpsLng).toFixed(4)}`, 20, y);
    y += 5;
  }
  if (data.crewMembers.length > 0) {
    doc.text(`Crew: ${data.crewMembers.join(", ")}`, 20, y);
    y += 5;
  }
  y += 5;

  // Items delivered
  if (data.items.length > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text("ITEMS DELIVERED", 20, y);
    y += 6;

    const conditionColors: Record<string, [number, number, number]> = {
      pristine: green,
      minor_scuff: [245, 158, 11],
      pre_existing_damage: gray,
      new_damage: red,
    };
    const conditionLabels: Record<string, string> = {
      pristine: "Pristine",
      minor_scuff: "Minor Scuff",
      pre_existing_damage: "Pre-existing",
      new_damage: "NEW DAMAGE",
    };

    const body = data.items.map((item, i) => [
      String(i + 1),
      item.name,
      conditionLabels[item.condition] || item.condition,
      item.notes || "",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Condition", "Notes"]],
      body,
      theme: "plain",
      headStyles: { fillColor: [245, 243, 240], textColor: dark, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 60 }, 2: { cellWidth: 35 } },
      alternateRowStyles: { fillColor: [252, 251, 249] },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 2) {
          const val = (hookData.row.raw as string[])?.[2]?.toLowerCase().replace(/\s/g, "_");
          const color = conditionColors[val];
          if (color) (hookData.cell.styles as { textColor?: number[] }).textColor = color;
        }
      },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Signature
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gold);
  doc.text("CUSTOMER SIGNATURE", 20, y);
  y += 6;

  if (data.signatureDataUrl && data.signatureDataUrl.startsWith("data:image")) {
    try {
      doc.addImage(data.signatureDataUrl, "PNG", 20, y, 80, 25);
      y += 28;
    } catch {
      y += 2;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.text(`Signed by: ${data.signerName}`, 20, y);
  y += 5;
  doc.text(`Date: ${data.signedAt}`, 20, y);
  y += 8;

  // Satisfaction (ASCII score line — Unicode stars often render blank in built-in PDF fonts)
  const sat = Math.round(Number(data.satisfactionRating));
  if (Number.isFinite(sat) && sat >= 1 && sat <= 5) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gold);
    doc.text("SATISFACTION", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    const filled = "*".repeat(sat);
    const empty = "-".repeat(5 - sat);
    doc.text(`Rating: ${filled}${empty} (${sat} of 5)`, 20, y);
    y += 5;
    if (data.satisfactionComment) {
      doc.setTextColor(...gray);
      const lines = doc.splitTextToSize(`"${data.satisfactionComment}"`, 170);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 3;
    }
  }

  // Footer
  if (y > 265) { doc.addPage(); }
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 272, 190, 272);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text("This is an official Proof of Delivery document. Retain for your records.", 20, 278);
  doc.text(`Generated ${new Date().toLocaleString("en-US")} • Yugo • withyugo.com`, 20, 283);

  doc.setFillColor(...gold);
  doc.rect(0, 294, 210, 3, "F");

  return doc;
}

export interface EODReportForPDF {
  id: string;
  team_id: string;
  report_date: string;
  summary?: Record<string, unknown>;
  jobs?: { jobId: string; type: string; duration: number; signOff?: boolean; hasDamage?: boolean; displayId: string; clientName: string }[];
  crew_note?: string | null;
  generated_at?: string;
  crews?: { name?: string } | null;
}

export function generateEODReportPDF(reports: EODReportForPDF[]) {
  const doc = new jsPDF();
  const gold = [201, 169, 98] as [number, number, number];
  const dark = [13, 13, 13] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("EOD", 20, 22);
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("End-of-Day Reports", 20, 28);

  let y = 40;
  reports.forEach((r, idx) => {
    const crewObj = Array.isArray(r.crews) ? r.crews[0] : r.crews;
    const crewName = (crewObj as { name?: string } | undefined)?.name || "Team";
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(`${crewName} — ${r.report_date}`, 20, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    if (r.generated_at) {
      doc.text(`Generated: ${new Date(r.generated_at).toLocaleString("en-US")}`, 20, y);
      y += 5;
    }
    const jobs = r.jobs || [];
    if (jobs.length > 0) {
      const body = jobs.map((j) => [
        j.displayId ?? j.jobId?.slice(0, 8) ?? "—",
        j.clientName ?? "—",
        j.type,
        String(j.duration ?? 0),
        j.signOff ? "Yes" : "No",
        j.hasDamage ? "Yes" : "No",
      ]);
      autoTable(doc, {
        startY: y,
        head: [["Job ID", "Client", "Type", "Min", "Signed", "Damage"]],
        body,
        theme: "grid",
        headStyles: { fillColor: gold, textColor: dark, fontStyle: "bold" },
        styles: { fontSize: 8 },
      });
      y = (doc as any).lastAutoTable?.finalY + 8;
    }
    if (r.crew_note) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...gray);
      doc.text("Crew note:", 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(r.crew_note, 170);
      doc.text(lines, 20, y);
      y += lines.length * 4 + 6;
    }
    if (idx < reports.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.line(20, y, 190, y);
      y += 10;
    }
  });

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Yugo EOD • opsplus.co", 20, 285);

  return doc;
}