import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";
import { resolveB2BInvoiceCustomerName } from "@/lib/b2b-invoice-customer-name";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";
import { portfolioPmStatementInvoiceDueIso } from "@/lib/partners/portfolio-pm-statement-due-date";
import { serverDebug } from "@/lib/server-log";

/**
 * Internal endpoint — fire-and-forget from crew signoff when a move is completed.
 * Portfolio PM moves (is_pm_move) get an internal invoices row only (partner statement cadence).
 * Other partner moves: Square when per_delivery; skips b2c and monthly_statement by default.
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

  const { data: moveRow, error: moveErr } = await admin
    .from("moves")
    .select(
      "id, move_code, client_name, organization_id, to_address, delivery_address, amount, estimate, is_pm_move, completed_at, final_amount",
    )
    .eq("id", moveId)
    .single();

  if (moveErr || !moveRow) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const move = moveRow as typeof moveRow & {
    is_pm_move?: boolean | null;
    completed_at?: string | null;
    final_amount?: number | string | null;
  };

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

  const isPortfolioPmMove = !!move.is_pm_move;

  if (isPortfolioPmMove) {
    const amountPm = Number(move.final_amount ?? move.amount ?? move.estimate ?? 0);
    const clientNamePm = resolveB2BInvoiceCustomerName({
      client_name: move.client_name,
      organizationName: org.name,
    });
    const refCodePm = (move.move_code || moveId).slice(0, 32);
    const invoiceNumberPm = opsInvoiceNumberForSquareJob({
      jobType: "move",
      referenceCode: refCodePm,
    });
    const dueDatePm = portfolioPmStatementInvoiceDueIso(move.completed_at ?? undefined);

    const { data: invoicePm, error: insertPmErr } = await admin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumberPm,
        move_id: moveId,
        delivery_id: null,
        organization_id: move.organization_id ?? null,
        client_name: clientNamePm,
        amount: amountPm,
        status: amountPm > 0 ? "sent" : "draft",
        due_date: dueDatePm,
        square_invoice_id: null,
        square_invoice_url: null,
      })
      .select("id")
      .single();

    if (insertPmErr) {
      console.error("[auto-move-invoice] portfolio PM insert failed:", insertPmErr.message);
      return NextResponse.json({ error: insertPmErr.message }, { status: 500 });
    }

    serverDebug(`[auto-move-invoice] Created portfolio PM invoice ${invoiceNumberPm}`, {
      dueDatePm,
      moveId,
    });

    return NextResponse.json({
      id: invoicePm.id,
      invoiceNumber: invoiceNumberPm,
      portfolioPmStatement: true,
      due_date: dueDatePm,
      squareInvoiceId: null,
      squareInvoiceUrl: null,
    });
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

  const invoiceNumber = opsInvoiceNumberForSquareJob({
    jobType: "move",
    referenceCode: refCode,
  });

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
