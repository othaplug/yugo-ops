import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";
import { resolveB2BInvoiceCustomerName } from "@/lib/b2b-invoice-customer-name";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";

/**
 * Admin-only: Generate invoices for completed/delivered deliveries
 * that don't already have one. Safe to call multiple times (idempotent).
 */
export async function POST() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const admin = createAdminClient();

  // Find all completed deliveries that have no invoice
  const { data: deliveries, error: delErr } = await admin
    .from("deliveries")
    .select(
      "id, delivery_number, business_name, customer_name, client_name, organization_id, delivery_address, admin_adjusted_price, total_price, quoted_price"
    )
    .in("status", ["delivered", "completed"])
    .not("organization_id", "is", null);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const allDeliveries = deliveries || [];

  // Get delivery IDs that already have invoices
  const { data: existingInvoices } = await admin
    .from("invoices")
    .select("delivery_id")
    .not("delivery_id", "is", null);

  const alreadyInvoiced = new Set(
    (existingInvoices || []).map((i) => i.delivery_id).filter(Boolean)
  );

  const toProcess = allDeliveries.filter((d) => !alreadyInvoiced.has(d.id));

  if (toProcess.length === 0) {
    return NextResponse.json({ message: "All deliveries already invoiced", created: 0 });
  }

  // Fetch org info in bulk — only B2B partners (exclude b2c)
  const orgIds = [...new Set(toProcess.map((d) => d.organization_id).filter(Boolean))];
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name, email, contact_name, type, invoice_due_days, invoice_due_day_of_month")
    .in("id", orgIds)
    .neq("type", "b2c");
  const orgMap = new Map((orgs || []).map((o) => [o.id, o]));

  // Filter to only deliveries with B2B orgs
  const b2bToProcess = toProcess.filter((d) => orgMap.has(d.organization_id));

  const results: { deliveryId: string; invoiceId: string; invoiceNumber: string }[] = [];
  const errors: { deliveryId: string; error: string }[] = [];

  for (const delivery of b2bToProcess) {
    try {
      const org = orgMap.get(delivery.organization_id);
      const orgEmail = org?.email ?? null;
      const orgName = org?.name || delivery.client_name || "Partner";
      const contactName = org?.contact_name ?? null;
      const clientName = resolveB2BInvoiceCustomerName({
        business_name: delivery.business_name,
        client_name: delivery.client_name,
        customer_name: delivery.customer_name,
        organizationName: org?.name,
      });
      const amount = Number(
        delivery.admin_adjusted_price ?? delivery.total_price ?? delivery.quoted_price ?? 0
      );

      const invoiceNumber = opsInvoiceNumberForSquareJob({
        jobType: "delivery",
        referenceCode: delivery.delivery_number,
      });

      let squareInvoiceId: string | null = null;
      let squareInvoiceUrl: string | null = null;

      if (amount > 0) {
        const result = await createAndPublishSquareInvoice({
          deliveryId: delivery.id,
          deliveryNumber: delivery.delivery_number || delivery.id.slice(0, 8),
          customerName: clientName,
          deliveryAddress: delivery.delivery_address || "",
          amount,
          orgEmail,
          orgName: clientName,
          contactName,
        });
        if (result) {
          squareInvoiceId = result.squareInvoiceId;
          squareInvoiceUrl = result.squareInvoiceUrl;
        }
      }

      const now = new Date();
      const dayOfMonth = org?.invoice_due_day_of_month;
      const dueDate =
        dayOfMonth === 15 || dayOfMonth === 30
          ? (() => {
              let due = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
              if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
              if (dayOfMonth === 30) {
                const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
                due = new Date(due.getFullYear(), due.getMonth(), Math.min(30, lastDay));
              }
              return due.toISOString().slice(0, 10);
            })()
          : new Date(now.getTime() + (org?.invoice_due_days === 15 ? 15 : 30) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: invoice, error: insertErr } = await admin
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          delivery_id: delivery.id,
          organization_id: delivery.organization_id,
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
        errors.push({ deliveryId: delivery.id, error: insertErr.message });
      } else {
        results.push({ deliveryId: delivery.id, invoiceId: invoice.id, invoiceNumber });
      }
    } catch (err) {
      errors.push({ deliveryId: delivery.id, error: String(err) });
    }
  }

  return NextResponse.json({
    created: results.length,
    errors: errors.length,
    skipped: toProcess.length - b2bToProcess.length,
    results,
    ...(errors.length > 0 ? { errorDetails: errors } : {}),
  });
}
