import { SupabaseClient } from "@supabase/supabase-js";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";
import { resolveQuoteInvoiceDueDays } from "@/lib/b2b-invoice-terms";

export type SendOneOffInvoiceResult =
  | {
      status: "created";
      invoiceId: string;
      invoiceNumber: string;
      squareInvoiceId: string;
      squareInvoiceUrl: string | null;
    }
  | { status: "skipped"; reason: string; invoiceId?: string; squareInvoiceUrl?: string | null }
  | { status: "error"; reason: string };

/**
 * Create AND publish (send) the enriched Square invoice for a B2B one-off
 * delivery, then record it in `invoices`. This is the single source of truth
 * for one-off delivery invoicing — the per-delivery "Send Square invoice"
 * button and the bulk "Send invoices" action both call it, so every invoice
 * carries the same enriched content (service description from the vertical,
 * line items, pickup/delivery addresses, honoured net terms, ops invoice
 * number). Never emits a stripped-down invoice.
 *
 * Idempotent: an existing invoice for the delivery is returned as `skipped`.
 * Never throws — all failure modes come back as a typed result so a bulk
 * caller can report per-row outcomes.
 */
export async function sendB2BOneOffDeliveryInvoice(
  admin: SupabaseClient,
  deliveryUuid: string,
): Promise<SendOneOffInvoiceResult> {
  try {
    const { data: existing } = await admin
      .from("invoices")
      .select("id, square_invoice_url, status")
      .eq("delivery_id", deliveryUuid)
      .maybeSingle();

    if (existing) {
      return {
        status: "skipped",
        reason: "Invoice already exists",
        invoiceId: existing.id,
        squareInvoiceUrl: existing.square_invoice_url,
      };
    }

    const { data: delivery, error: delErr } = await admin
      .from("deliveries")
      .select("*")
      .eq("id", deliveryUuid)
      .single();

    if (delErr || !delivery) {
      return { status: "error", reason: "Delivery not found" };
    }

    if (delivery.booking_type !== "one_off" || delivery.organization_id) {
      return {
        status: "skipped",
        reason: "Partner-billed (invoiced via statements)",
      };
    }

    const contactEmail = (delivery.contact_email || "").trim() || null;
    if (!contactEmail) {
      return { status: "skipped", reason: "No business contact email" };
    }

    const amount = effectiveDeliveryPrice(delivery);
    if (amount <= 0) {
      return { status: "skipped", reason: "No price set" };
    }

    const bizName =
      (delivery.business_name || delivery.client_name || delivery.customer_name || "Business").trim();
    const customerName = (delivery.customer_name || bizName).trim();
    const addr = (delivery.delivery_address || delivery.pickup_address || "").trim();

    const invoiceNumber = opsInvoiceNumberForSquareJob({
      jobType: "delivery",
      referenceCode: delivery.delivery_number,
    });

    // Honour the invoice term sold on the quote (net_15 / net_30 / on_completion);
    // fall back to due-on-receipt only when no explicit term was set.
    const jobDueDays = await resolveQuoteInvoiceDueDays(
      admin,
      (delivery as { source_quote_id?: string | null }).source_quote_id,
    );
    const dueDays = jobDueDays != null ? jobDueDays : 0;
    const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const deliveryDateRaw =
      (delivery as { scheduled_date?: string | null; created_at?: string | null }).scheduled_date ??
      (delivery as { created_at?: string | null }).created_at ??
      null;
    const deliveryDate = deliveryDateRaw ? new Date(deliveryDateRaw) : new Date();

    const rawLineItems = (delivery as { b2b_line_items?: unknown }).b2b_line_items;
    const b2bLineItems = Array.isArray(rawLineItems)
      ? (rawLineItems as Array<Record<string, unknown>>).map((row) => ({
          description: typeof row.description === "string" ? row.description : null,
          quantity:
            typeof row.quantity === "number"
              ? row.quantity
              : Number(row.quantity ?? row.qty ?? 1),
        }))
      : null;
    const vertical = (delivery as { vertical_code?: string | null }).vertical_code || null;

    const squareResult = await createAndPublishSquareInvoice({
      deliveryId: deliveryUuid,
      deliveryNumber: delivery.delivery_number || deliveryUuid.slice(0, 8),
      customerName,
      deliveryAddress: addr,
      amount,
      orgEmail: contactEmail,
      orgName: bizName,
      contactName: bizName,
      invoiceDueDays: dueDays,
      invoiceDueDayOfMonth: null,
      jobType: "delivery",
      partnerVertical: vertical,
      billingPeriodStart: deliveryDate,
      billingPeriodEnd: deliveryDate,
      sourceMove: {
        from_address: (delivery as { pickup_address?: string | null }).pickup_address ?? null,
        to_address: addr,
        b2b_vertical_code: vertical,
        b2b_line_items: b2bLineItems,
        company_name: bizName || null,
        client_name: customerName,
      },
    });

    if (!squareResult) {
      return {
        status: "error",
        reason: "Square invoice could not be created (check Square config)",
      };
    }

    const { data: invoice, error: insertErr } = await admin
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        delivery_id: deliveryUuid,
        organization_id: null,
        client_name: bizName,
        amount,
        status: "sent",
        due_date: dueDate,
        square_invoice_id: squareResult.squareInvoiceId,
        square_invoice_url: squareResult.squareInvoiceUrl,
      })
      .select("id")
      .single();

    if (insertErr || !invoice) {
      return { status: "error", reason: insertErr?.message || "Failed to record invoice" };
    }

    return {
      status: "created",
      invoiceId: invoice.id,
      invoiceNumber,
      squareInvoiceId: squareResult.squareInvoiceId,
      squareInvoiceUrl: squareResult.squareInvoiceUrl,
    };
  } catch (e) {
    return { status: "error", reason: e instanceof Error ? e.message : "Unexpected error" };
  }
}
