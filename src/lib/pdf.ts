import jsPDF from "jspdf";
import { formatCurrency } from "./format-currency";
import { formatPhone } from "./phone";
import autoTable from "jspdf-autotable";

export function generateInvoicePDF(invoice: {
  invoice_number: string;
  client_name: string;
  amount: number;
  due_date: string;
  line_items: any[];
}) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("OPS+", 20, 30);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Invoice", 20, 36);

  // Invoice info
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(invoice.invoice_number, 20, 55);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Client: ${invoice.client_name}`, 20, 63);
  doc.text(`Due: ${invoice.due_date}`, 20, 70);

  // Line items table
  const items = typeof invoice.line_items === "string"
    ? JSON.parse(invoice.line_items)
    : invoice.line_items || [];

  autoTable(doc, {
    startY: 80,
    head: [["Description", "Qty", "Rate", "Total"]],
    body: items.map((item: any) => [
      item.d || item.description || "",
      item.q || item.quantity || 1,
      formatCurrency(item.r ?? item.rate ?? 0),
      formatCurrency((item.q || 1) * (item.r || 0)),
    ]),
    theme: "grid",
    headStyles: { fillColor: [201, 169, 98], textColor: [13, 13, 13], fontStyle: "bold" },
    styles: { fontSize: 10 },
  });

  // Total
  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text(`Total: ${formatCurrency(invoice.amount)}`, 140, finalY + 15);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("OPS+ • opsplus.co", 20, 280);

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
  const gold = [201, 169, 98] as [number, number, number];
  const dark = [13, 13, 13] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("OPS+", 20, 22);
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Project Overview", 20, 28);

  // Project number & status
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(delivery.delivery_number, 20, 42);
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Status: ${delivery.status}`, 100, 42);
  if (delivery.special_handling) {
    doc.setTextColor(245, 158, 11);
    doc.text("Special Handling Required", 130, 42);
  }

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(20, 48, 190, 48);

  let y = 58;

  // Customer Information
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gray);
  doc.text("CUSTOMER INFORMATION", 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text(`Name: ${delivery.customer_name}`, 20, y);
  y += 5;
  if (delivery.customer_email) {
    doc.text(`Email: ${delivery.customer_email}`, 20, y);
    y += 5;
  }
  if (delivery.customer_phone) {
    doc.text(`Phone: ${formatPhone(delivery.customer_phone)}`, 20, y);
    y += 5;
  }
  doc.text(`Client: ${delivery.client_name}`, 20, y);
  y += 10;

  // Delivery Details
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gray);
  doc.text("DELIVERY DETAILS", 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text(`Scheduled: ${delivery.scheduled_date}${delivery.delivery_window ? ` • ${delivery.delivery_window}` : ""}`, 20, y);
  y += 6;
  doc.text(`Pickup: ${delivery.pickup_address || "Not specified"}`, 20, y);
  y += 5;
  doc.text(`Delivery: ${delivery.delivery_address || "Not specified"}`, 20, y);
  y += 10;

  // Items
  const items = delivery.items || [];
  if (items.length > 0) {
    const itemRows = items.map((item, i) => {
      const name = typeof item === "string" ? item : (item as { name: string; qty?: number })?.name || "";
      const qty = typeof item === "object" && (item as { qty?: number })?.qty != null ? (item as { qty: number }).qty : 1;
      return [i + 1, name, String(qty)];
    });
    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Qty"]],
      body: itemRows,
      theme: "grid",
      headStyles: { fillColor: gold, textColor: dark, fontStyle: "bold" },
      styles: { fontSize: 9 },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Pricing
  if (delivery.quoted_price != null) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gray);
    doc.text("PRICING", 20, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(`Quoted: $${Number(delivery.quoted_price).toFixed(2)}`, 20, y);
    y += 10;
  }

  // Instructions
  if (delivery.instructions) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gray);
    doc.text("SPECIAL INSTRUCTIONS", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(delivery.instructions, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 5;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("OPS+ • opsplus.co", 20, 285);

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
  const gold = [201, 169, 98] as [number, number, number];
  const dark = [13, 13, 13] as [number, number, number];
  const gray = [100, 100, 100] as [number, number, number];
  const red = [220, 38, 38] as [number, number, number];
  const green = [22, 163, 74] as [number, number, number];

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("OPS+", 20, 22);
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Client Sign-Off Receipt", 20, 28);

  // Job info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(data.displayId, 20, 42);
  doc.setFontSize(9);
  doc.setTextColor(...gray);
  doc.text(`Type: ${data.jobType}`, 100, 42);

  doc.setDrawColor(220, 220, 220);
  doc.line(20, 48, 190, 48);

  let y = 58;

  // Sign-off details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gray);
  doc.text("SIGN-OFF DETAILS", 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  doc.text(`Signed by: ${data.signedBy}`, 20, y); y += 5;
  if (data.clientName) { doc.text(`Client: ${data.clientName}`, 20, y); y += 5; }
  doc.text(`Date: ${new Date(data.signedAt).toLocaleString("en-US")}`, 20, y); y += 5;
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
    doc.text(`Damage report deadline: ${new Date(data.damageReportDeadline).toLocaleString("en-US")}`, 20, y);
    y += 8;
  }

  // Confirmations table
  if (data.confirmations.length > 0) {
    const body = data.confirmations.map((c) => [c.label, c.valueLabel ?? (c.value ? "Yes" : "No")]);
    autoTable(doc, {
      startY: y,
      head: [["Confirmation", "Status"]],
      body,
      theme: "grid",
      headStyles: { fillColor: gold, textColor: dark, fontStyle: "bold" },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 25, halign: "center" },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 1) {
          const val = (hookData.row.raw as string[])?.[1];
          const color = val === "Yes" ? green : val === "N/A" ? gray : red;
          (hookData.cell.styles as { textColor?: number[] }).textColor = color;
        }
      },
    });
    y = (doc as any).lastAutoTable?.finalY + 8;
  }

  // Feedback & exceptions
  if (data.feedbackNote) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...gray);
    doc.text("FEEDBACK", 20, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(data.feedbackNote, 170);
    doc.text(lines, 20, y); y += lines.length * 4 + 5;
  }

  if (data.exceptions) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...red);
    doc.text("EXCEPTIONS / ISSUES", 20, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    const lines = doc.splitTextToSize(data.exceptions, 170);
    doc.text(lines, 20, y); y += lines.length * 4 + 5;
  }

  // Escalation warning
  if (data.escalationTriggered && data.escalationReason) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...red);
    doc.text("ESCALATION TRIGGERED", 20, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.escalationReason, 170);
    doc.text(lines, 20, y); y += lines.length * 4 + 5;
  }

  // Discrepancy flags
  if (data.discrepancyFlags && data.discrepancyFlags.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(245, 158, 11);
    doc.text("DISCREPANCY FLAGS", 20, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    data.discrepancyFlags.forEach((f) => {
      const lines = doc.splitTextToSize(`• ${f}`, 170);
      doc.text(lines, 20, y); y += lines.length * 4 + 2;
    });
  }

  // Legal footer
  if (y > 265) { doc.addPage(); y = 20; }
  y = Math.max(y + 5, 270);
  doc.setFontSize(7);
  doc.setTextColor(...gray);
  doc.text(
    "By signing, the client confirms all items were received as described. Concealed damage must be reported within 24 hours.",
    20, y, { maxWidth: 170 }
  );
  doc.text("OPS+ • opsplus.co", 20, 285);

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
    const crewName = (r.crews as { name?: string })?.name || "Team";
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
  doc.text("EOD • opsplus.co", 20, 285);

  return doc;
}