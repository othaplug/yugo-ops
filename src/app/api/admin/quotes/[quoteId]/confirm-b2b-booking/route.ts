/**
 * POST /api/admin/quotes/[quoteId]/confirm-b2b-booking
 *
 * Admin-side "Confirm booking (invoice)" for a B2B commercial-delivery quote.
 * Approves on the client's behalf with NO card taken: marks the quote
 * accepted / invoiced and creates the delivery at $0. The invoice is raised
 * after the job is completed (the delivery completion hook), matching the
 * client self-serve path (`accept-b2b-invoice`). Admin-authed; the client
 * name/email come from the quote's contact.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import { runPostPaymentActionsB2BDelivery } from "@/lib/automations/post-payment";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { quoteId } = await params;
  if (!quoteId) return NextResponse.json({ error: "Quote id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select(
      "id, quote_id, status, service_type, selected_tier, selected_addons, factors_applied, contacts:contact_id(name, email, phone)",
    )
    .eq("quote_id", quoteId)
    .single();
  if (qErr || !quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  if (!isB2BDeliveryQuoteServiceType(String(quote.service_type ?? ""))) {
    return NextResponse.json(
      { error: "This action is only for commercial delivery quotes." },
      { status: 400 },
    );
  }

  // Idempotent: a delivery already exists for this quote, just report it.
  const { data: existingDel } = await admin
    .from("deliveries")
    .select("id, delivery_number")
    .eq("source_quote_id", quote.id)
    .maybeSingle();
  if (existingDel) {
    return NextResponse.json({
      success: true,
      already: true,
      delivery_id: existingDel.id,
      delivery_number: existingDel.delivery_number,
    });
  }

  const contact = quote.contacts as { name?: string; email?: string } | null;
  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const clientName =
    contact?.name?.trim() ||
    (typeof factors.b2b_business_name === "string" ? factors.b2b_business_name : "") ||
    "Client";
  const clientEmail = contact?.email?.trim() || "";
  if (!clientEmail) {
    return NextResponse.json(
      { error: "The client has no email on file. Add a contact email before confirming." },
      { status: 400 },
    );
  }

  // Mark the quote accepted + invoiced (no card), mirroring accept-b2b-invoice.
  await admin
    .from("quotes")
    .update({
      status: "accepted",
      payment_status: "invoiced",
      selected_tier: quote.selected_tier ?? "custom",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  let delivery: { deliveryId: string; deliveryNumber: string };
  try {
    delivery = await createDeliveryFromB2BQuote({
      quoteId: quote.quote_id,
      depositAmount: 0,
      selectedTier: quote.selected_tier ?? null,
      selectedAddons: (quote.selected_addons as unknown[]) ?? [],
      clientName,
      clientEmail,
    });
  } catch (e) {
    console.error("[confirm-b2b-booking] delivery creation failed", e);
    return NextResponse.json({ error: "Could not create the delivery." }, { status: 500 });
  }

  try {
    await issueDeliveryTrackingTokens(delivery.deliveryId);
    await sendB2BTrackingNotifications(delivery.deliveryId);
  } catch (e) {
    console.error("[confirm-b2b-booking] tracking notify failed", e);
  }

  const capturedId = delivery.deliveryId;
  const capturedNumber = delivery.deliveryNumber;
  after(async () => {
    try {
      await runPostPaymentActionsB2BDelivery({
        quoteId: quote.quote_id,
        deliveryId: capturedId,
        deliveryNumber: capturedNumber,
        paymentId: "invoice-booking",
        amount: 0,
      });
    } catch (e) {
      console.error("[confirm-b2b-booking] post-payment", e);
    }
  });

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "b2b_booking_confirmed",
    resourceType: "quote",
    resourceId: quote.quote_id,
    details: { delivery_number: delivery.deliveryNumber, invoiced: true, by: "admin" },
  });

  return NextResponse.json({
    success: true,
    delivery_id: delivery.deliveryId,
    delivery_number: delivery.deliveryNumber,
  });
}
