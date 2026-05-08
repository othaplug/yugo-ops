import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { runPostPaymentActions } from "@/lib/automations/post-payment";
import { logActivity } from "@/lib/activity";
import {
  isQuoteExpiredForBooking,
  quoteExpiryBlockedStatuses,
} from "@/lib/quote-expiry";

/**
 * POST /api/admin/quotes/[quoteId]/book-external
 *
 * Records a booking that happened outside OPS+ (HubSpot, email, phone, etc.).
 * Used when a quote has a price range (unconfirmed tier) and the client booked
 * through a different channel.
 *
 * Body:
 *   tier_selected    - 'essential' | 'signature' | 'estate'
 *   deposit_amount   - tax-inclusive deposit received (number > 0)
 *   deposit_method   - 'etransfer' | 'credit_card' | 'cash' | 'cheque' | 'other'
 *   deposit_date     - ISO date string (YYYY-MM-DD)
 *   booked_via       - 'hubspot' | 'email' | 'phone' | 'in_person' | 'other'
 *   notes            - optional free-text note
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Quote id required" }, { status: 400 });
  }

  let body: {
    tier_selected?: string;
    deposit_amount?: number;
    deposit_method?: string;
    deposit_date?: string;
    booked_via?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    tier_selected,
    deposit_amount,
    deposit_method = "etransfer",
    deposit_date,
    booked_via = "other",
    notes = "",
  } = body;

  const VALID_TIERS = new Set(["essential", "signature", "estate"]);
  if (!tier_selected || !VALID_TIERS.has(tier_selected)) {
    return NextResponse.json(
      { error: "tier_selected must be essential, signature, or estate" },
      { status: 422 },
    );
  }
  if (!deposit_amount || deposit_amount <= 0) {
    return NextResponse.json(
      { error: "deposit_amount must be greater than 0" },
      { status: 422 },
    );
  }

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("id", quoteId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const status = String(quote.status || "").toLowerCase();
  if (quoteExpiryBlockedStatuses().includes(status)) {
    return NextResponse.json(
      { error: "This quote cannot be booked in its current status" },
      { status: 400 },
    );
  }
  if (isQuoteExpiredForBooking(quote)) {
    return NextResponse.json(
      { error: "Quote has expired. Reactivate or send a new quote before booking" },
      { status: 400 },
    );
  }

  const humanQuoteId = String(quote.quote_id || "").trim();
  if (!humanQuoteId) {
    return NextResponse.json({ error: "Quote is missing a quote_id" }, { status: 500 });
  }

  // Idempotent: return existing move if already booked
  const { data: existingMove } = await admin
    .from("moves")
    .select("id, move_code")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMove?.id) {
    return NextResponse.json({
      ok: true,
      already_booked: true,
      move_id: existingMove.id,
      move_code: existingMove.move_code,
    });
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const clientName = (contact?.name || "").trim();
  const clientEmail = (contact?.email || "").trim();
  if (!clientName || !clientEmail) {
    return NextResponse.json(
      { error: "Quote needs a contact with name and email" },
      { status: 400 },
    );
  }

  // Validate the selected tier has pricing data
  const tiers = quote.tiers as Record<string, { price: number; total: number }> | null;
  if (!tiers?.[tier_selected]) {
    return NextResponse.json(
      { error: `Quote does not have pricing data for tier: ${tier_selected}` },
      { status: 422 },
    );
  }

  const paymentId = `offline-external-${quoteId}-${Date.now()}`;

  try {
    const moveResult = await createMoveFromQuote({
      quoteId: humanQuoteId,
      depositAmount: deposit_amount,
      selectedTier: tier_selected,
      selectedAddons: (quote.selected_addons as never[]) ?? [],
      clientName,
      clientEmail,
      squareCustomerId: undefined,
      squareCardId: undefined,
      squarePaymentId: paymentId,
      squareReceiptUrl: null,
    });

    // Update the quote with confirmed values
    await admin
      .from("quotes")
      .update({
        status: "accepted",
        selected_tier: tier_selected,
        accepted_at: new Date().toISOString(),
        payment_error: null,
        payment_failed_at: null,
        updated_at: new Date().toISOString(),
        externally_booked: true,
        booked_via,
        booking_notes: notes || null,
      })
      .eq("id", quoteId);

    // Stamp the move with external booking metadata
    await admin
      .from("moves")
      .update({
        deposit_method,
        deposit_paid_at: deposit_date ? new Date(deposit_date).toISOString() : new Date().toISOString(),
        externally_booked: true,
        booked_via,
        booking_notes: notes || null,
      })
      .eq("id", moveResult.moveId);

    runPostPaymentActions({
      quoteId: humanQuoteId,
      moveId: moveResult.moveId,
      moveCode: moveResult.moveCode,
      paymentId,
      amount: deposit_amount,
    }).catch((err) =>
      console.error("[book-external] post-payment actions failed:", err),
    );

    await logActivity({
      entity_type: "quote",
      entity_id: quoteId,
      event_type: "offline_booking",
      description: `Externally booked via ${booked_via}. Tier: ${tier_selected}. Deposit: $${deposit_amount} (${deposit_method}). Move: ${moveResult.moveCode}`,
      icon: "payment",
    });

    return NextResponse.json({
      ok: true,
      move_id: moveResult.moveId,
      move_code: moveResult.moveCode,
    });
  } catch (e) {
    console.error("[book-external]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Booking failed. Check logs and quote data" },
      { status: 500 },
    );
  }
}
