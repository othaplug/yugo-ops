import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { squareClient } from "@/lib/square";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientName, amount, items, dueDate, deliveryId } = body;

    const supabase = await createClient();

    // Generate invoice number
    const invoiceNumber = `INV-${Math.floor(Math.random() * 9000) + 1000}`;

    // Try Square (skip if no access token)
    let squareInvoiceId = null;
    if (process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_ACCESS_TOKEN !== "your_sandbox_access_token_here") {
      try {
        // Create customer in Square if needed
        const { result: customerResult } = await squareClient.customersApi.searchCustomers({
          query: {
            filter: {
              emailAddress: { exact: body.email || "" },
            },
          },
        });

        let customerId = customerResult.customers?.[0]?.id;

        if (!customerId) {
          const { result: newCustomer } = await squareClient.customersApi.createCustomer({
            givenName: clientName,
            emailAddress: body.email || `${clientName.toLowerCase().replace(/\s/g, "")}@placeholder.com`,
            idempotencyKey: randomUUID(),
          });
          customerId = newCustomer.customer?.id;
        }

        // Create invoice
        const { result: invoiceResult } = await squareClient.invoicesApi.createInvoice({
          invoice: {
            locationId: process.env.SQUARE_LOCATION_ID!,
            primaryRecipient: { customerId },
            invoiceNumber,
            paymentRequests: [
              {
                requestType: "BALANCE",
                dueDate: dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                automaticPaymentSource: "NONE",
              },
            ],
          },
          idempotencyKey: randomUUID(),
        });

        squareInvoiceId = invoiceResult.invoice?.id;

        // Publish (sends email)
        if (squareInvoiceId) {
          await squareClient.invoicesApi.publishInvoice(squareInvoiceId, {
            version: invoiceResult.invoice?.version || 0,
            idempotencyKey: randomUUID(),
          });
        }
      } catch (squareError) {
        console.error("Square API error (non-fatal):", squareError);
        // Continue without Square — still save to Supabase
      }
    }

    // Save to Supabase
    const { data, error } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      client_name: clientName,
      amount,
      status: "sent",
      due_date: dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      line_items: JSON.stringify(items || [{ d: "Delivery service", q: 1, r: amount }]),
      square_invoice_id: squareInvoiceId,
    }).select().single();

    if (error) throw error;

    // Log event
    await supabase.from("status_events").insert({
      entity_type: "invoice",
      entity_id: invoiceNumber,
      event_type: "created",
      description: `Invoice ${invoiceNumber} created for ${clientName} ($${amount})`,
      icon: "💰",
    });

    return NextResponse.json({ ok: true, invoice: data });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}