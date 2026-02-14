import jsPDF from "jspdf";
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
  doc.text("YUGO", 20, 30);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("PREMIUM LOGISTICS", 20, 36);

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
      `$${item.r || item.rate || 0}`,
      `$${((item.q || 1) * (item.r || 0)).toLocaleString()}`,
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
  doc.text(`Total: $${invoice.amount.toLocaleString()}`, 140, finalY + 15);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Yugo Premium Logistics • Toronto • yugo.ca", 20, 280);

  return doc;
}

export function generateDeliveryPDF(delivery: {
  delivery_number: string;
  client_name: string;
  customer_name: string;
  pickup_address: string;
  delivery_address: string;
  scheduled_date: string;
  delivery_window: string;
  items: string[];
  instructions: string;
  status: string;
}) {
  const doc = new jsPDF();

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("YUGO", 20, 30);
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("DELIVERY MANIFEST", 20, 36);

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(delivery.delivery_number, 20, 55);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Client: ${delivery.client_name}`, 20, 63);
  doc.text(`Customer: ${delivery.customer_name}`, 20, 70);
  doc.text(`Status: ${delivery.status}`, 20, 77);

  doc.text(`From: ${delivery.pickup_address}`, 20, 90);
  doc.text(`To: ${delivery.delivery_address}`, 20, 97);
  doc.text(`Date: ${delivery.scheduled_date} • ${delivery.delivery_window}`, 20, 104);

  if (delivery.items?.length) {
    autoTable(doc, {
      startY: 115,
      head: [["#", "Item"]],
      body: delivery.items.map((item, i) => [i + 1, item]),
      theme: "grid",
      headStyles: { fillColor: [201, 169, 98], textColor: [13, 13, 13] },
    });
  }

  if (delivery.instructions) {
    const y = (doc as any).lastAutoTable?.finalY || 140;
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Instructions:", 20, y + 15);
    doc.setTextColor(100);
    doc.text(delivery.instructions, 20, y + 22);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Yugo Premium Logistics • Toronto • yugo.ca", 20, 280);

  return doc;
}