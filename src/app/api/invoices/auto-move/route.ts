import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";
import { resolveB2BInvoiceCustomerName } from "@/lib/b2b-invoice-customer-name";
import { serverDebug } from "@/lib/server-log";

/**
 * Internal endpoint — fire-and-forget from crew signoff when a move is completed.
 * Creates a Square invoice for partner (B2B) moves on per-job billing; skips b2c and monthly statements.
 */
export async function POST(req: NextRequest) {
  let body: { moveId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { moveId } = body;
  if (!moveId) {
    return NextResponse.json({ error: "moveId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("invoices")
    .select("id, square_invoice_id, square_invoice_url")
    .eq("move_id", moveId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ message: "Invoice already exists", id: existing.id });
  }

  const { data: move, error: moveErr } = await admin
    .from("moves")
    .select(
      "id, move_code, client_name, organization_id, to_address, delivery_address, amount, estimate",
    )
    .eq("id", moveId)
    .single();

  if (moveErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  if (!move.organization_id) {
    return NextResponse.json({ message: "Move has no organization", skipped: true });
  }

  const { data: org } = await admin
    .from("organizations")
    .select(
      "name, email, contact_name, type, invoice_due_days, invoice_due_day_of_month, billing_method",
    )
    .eq("id", move.organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ message: "Organization not found", skipped: true });
  }
  if (org.type === "b2c") {
    return NextResponse.json({ message: "Invoices only for partner moves", skipped: true });
  }

  const billingMethod = (org.billing_method || "per_delivery").trim().toLowerCase();
  if (billingMethod === "monthly_statement") {
    return NextResponse.json({
      message: "Partner billed on monthly statement — per-move invoice skipped",
      skipped: true,
    });
  }

  const amount = Number(move.amount ?? move.estimate ?? 0);
  const serviceAddress = (move.to_address || move.delivery_address || "").trim();
  const orgEmail = org.email ?? null;
  const clientName = resolveB2BInvoiceCustomerName({
    client_name: move.client_name,
    organizationName: org.name,
  });
  const contactName = org.contact_name ?? null;
  const refCode = (move.move_code || moveId).slice(0, 32);

  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true });
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(4, "0")}`;

  let squareInvoiceId: string | null = null;
  let squareInvoiceUrl: string | null = null;

  if (amount > 0) {
    const result = await createAndPublishSquareInvoice({
      deliveryId: moveId,
      deliveryNumber: refCode,
      customerName: clientName,
      deliveryAddress: serviceAddress,
      amount,
      orgEmail,
      orgName: clientName,
      contactName,
      invoiceDueDays: org.invoice_due_days === 15 ? 15 : 30,
      invoiceDueDayOfMonth:
        org.invoice_due_day_of_month === 15 || org.invoice_due_day_of_month === 30
          ? org.invoice_due_day_of_month
          : null,
      jobType: "move",
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
      move_id: moveId,
      delivery_id: null,
      organization_id: move.organization_id ?? null,
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
    console.error("[auto-move-invoice] insert failed:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  serverDebug(`[auto-move-invoice] Created invoice ${invoiceNumber} for move ${moveId}`, {
    squareInvoiceId,
    squareInvoiceUrl,
  });

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber,
    squareInvoiceId,
    squareInvoiceUrl,
  });
}
