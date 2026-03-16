import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";

/**
 * Internal endpoint — called fire-and-forget by the crew signoff route
 * when a delivery is completed. Creates a Square invoice and records it
 * in the invoices table so it appears in the partner portal and admin.
 */
export async function POST(req: NextRequest) {
  let body: { deliveryId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { deliveryId } = body;
  if (!deliveryId) {
    return NextResponse.json({ error: "deliveryId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency — skip if invoice already exists for this delivery
  const { data: existing } = await admin
    .from("invoices")
    .select("id, square_invoice_id, square_invoice_url")
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Invoice already exists", id: existing.id });
  }

  // Fetch delivery details
  const { data: delivery, error: delErr } = await admin
    .from("deliveries")
    .select(
      "id, delivery_number, customer_name, client_name, organization_id, delivery_address, admin_adjusted_price, total_price, quoted_price, items"
    )
    .eq("id", deliveryId)
    .single();

  if (delErr || !delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (!delivery.organization_id) {
    return NextResponse.json({ message: "Delivery has no organization", skipped: true });
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name, email, contact_name, type, invoice_due_days, invoice_due_day_of_month")
    .eq("id", delivery.organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ message: "Organization not found", skipped: true });
  }
  if (org.type === "b2c") {
    return NextResponse.json({ message: "Invoices only for B2B partners", skipped: true });
  }

  const amount = Number(
    delivery.admin_adjusted_price ?? delivery.total_price ?? delivery.quoted_price ?? 0
  );

  const orgEmail = org.email ?? null;
  const orgName = org.name || delivery.client_name || "Partner";
  const contactName = org.contact_name ?? null;
  // Client = B2B partner (the entity being billed)
  const clientName = orgName;

  // Generate an invoice number
  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true });
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Attempt Square invoice creation (non-blocking on failure)
  let squareInvoiceId: string | null = null;
  let squareInvoiceUrl: string | null = null;

  if (amount > 0) {
    const result = await createAndPublishSquareInvoice({
      deliveryId,
      deliveryNumber: delivery.delivery_number || deliveryId.slice(0, 8),
      customerName: clientName,
      deliveryAddress: delivery.delivery_address || "",
      amount,
      orgEmail,
      orgName,
      contactName,
      invoiceDueDays: org.invoice_due_days === 15 ? 15 : 30,
      invoiceDueDayOfMonth: org.invoice_due_day_of_month === 15 || org.invoice_due_day_of_month === 30 ? org.invoice_due_day_of_month : null,
    });
    if (result) {
      squareInvoiceId = result.squareInvoiceId;
      squareInvoiceUrl = result.squareInvoiceUrl;
    }
  }

  const dueDate = (() => {
    const now = new Date();
    const dayOfMonth = org.invoice_due_day_of_month;
    if (dayOfMonth === 15 || dayOfMonth === 30) {
      let due = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
      if (dayOfMonth === 30) {
        const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
        due = new Date(due.getFullYear(), due.getMonth(), Math.min(30, lastDay));
      }
      return due.toISOString().slice(0, 10);
    }
    const days = org.invoice_due_days === 15 ? 15 : 30;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  })();

  const { data: invoice, error: insertErr } = await admin
    .from("invoices")
    .insert({
      invoice_number: invoiceNumber,
      delivery_id: deliveryId,
      organization_id: delivery.organization_id ?? null,
      client_name: clientName,
      amount,
      status: amount > 0 ? "sent" : "draft",
      due_date: dueDate,
      square_invoice_id: squareInvoiceId,
      square_invoice_url: squareInvoiceUrl,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[auto-delivery-invoice] insert failed:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  console.log(
    `[auto-delivery-invoice] Created invoice ${invoiceNumber} for delivery ${deliveryId}`,
    { squareInvoiceId, squareInvoiceUrl }
  );

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber,
    squareInvoiceId,
    squareInvoiceUrl,
  });
}
