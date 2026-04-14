import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";
import { resolveDeliveryUuidFromApiPathSegment } from "@/lib/delivery-resolve-id";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";

/**
 * Creates a Square invoice for a B2B one-off delivery (no partner org), emails the business
 * contact when contact_email is present, and stores a row in invoices for admin.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  let body: { deliveryId?: string; deliveryNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawId = String(body.deliveryId || "").trim();
  const rawNumber = String(body.deliveryNumber || "").trim();
  if (!rawId && !rawNumber) {
    return NextResponse.json({ error: "deliveryId or deliveryNumber required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let deliveryUuid = rawId ? await resolveDeliveryUuidFromApiPathSegment(admin, rawId) : null;
  if (!deliveryUuid && rawNumber) {
    deliveryUuid = await resolveDeliveryUuidFromApiPathSegment(admin, rawNumber);
  }
  if (!deliveryUuid) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("invoices")
    .select("id, square_invoice_id, square_invoice_url, status")
    .eq("delivery_id", deliveryUuid)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      message: "Invoice already exists",
      id: existing.id,
      squareInvoiceUrl: existing.square_invoice_url,
      status: existing.status,
    });
  }

  /** Avoid listing columns that may not exist on all DBs; effectiveDeliveryPrice reads common price fields from row. */
  const { data: delivery, error: delErr } = await admin
    .from("deliveries")
    .select("*")
    .eq("id", deliveryUuid)
    .single();

  if (delErr || !delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  if (delivery.booking_type !== "one_off" || delivery.organization_id) {
    return NextResponse.json(
      { error: "Square invoice for B2B one-off deliveries only (no partner account on file)." },
      { status: 400 },
    );
  }

  const contactEmail = (delivery.contact_email || "").trim() || null;
  if (!contactEmail) {
    return NextResponse.json(
      { error: "Business contact email is required to send a Square invoice." },
      { status: 400 },
    );
  }

  const amount = effectiveDeliveryPrice(delivery);
  if (amount <= 0) {
    return NextResponse.json({ error: "Set a quoted or total price before sending an invoice." }, { status: 400 });
  }

  const bizName =
    (delivery.business_name || delivery.client_name || delivery.customer_name || "Business").trim();
  const customerName = (delivery.customer_name || bizName).trim();
  const addr =
    (delivery.delivery_address || delivery.pickup_address || "").trim();

  const invoiceNumber = opsInvoiceNumberForSquareJob({
    jobType: "delivery",
    referenceCode: delivery.delivery_number,
  });

  const dueDays = 14;
  const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  });

  if (!squareResult) {
    return NextResponse.json(
      { error: "Square invoice could not be created. Check SQUARE_ACCESS_TOKEN and location configuration." },
      { status: 502 },
    );
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

  if (insertErr) {
    console.error("[delivery-b2b-one-off-invoice] insert failed:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    id: invoice.id,
    invoiceNumber,
    squareInvoiceId: squareResult.squareInvoiceId,
    squareInvoiceUrl: squareResult.squareInvoiceUrl,
  });
}
