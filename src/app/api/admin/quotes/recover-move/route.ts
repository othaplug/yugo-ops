import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import { requireStaff } from "@/lib/api-auth";

/**
 * POST /api/admin/quotes/recover-move
 *
 * Creates a move from an accepted quote that has no linked move yet.
 * Used to recover from payment-succeeded-but-move-creation-failed scenarios.
 */
export async function POST(req: Request) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { quoteId } = await req.json();
  if (!quoteId) {
    return NextResponse.json({ error: "quoteId is required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: quote, error: quoteErr } = await db
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", quoteId)
    .single();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (quote.status !== "accepted") {
    return NextResponse.json(
      { error: "Quote must be accepted before creating a move" },
      { status: 400 },
    );
  }

  const svc = String(quote.service_type ?? "");

  if (isB2BDeliveryQuoteServiceType(svc)) {
    const { data: existingDel } = await db
      .from("deliveries")
      .select("id, delivery_number")
      .eq("source_quote_id", quote.id)
      .maybeSingle();
    if (existingDel) {
      return NextResponse.json({
        success: true,
        delivery_id: existingDel.id,
        delivery_number: existingDel.delivery_number,
        message: "Delivery already exists",
      });
    }
  } else {
    const { data: existingList } = await db
      .from("moves")
      .select("id, move_code, created_at")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: true })
      .limit(1);

    const existing = existingList?.[0];
    if (existing) {
      return NextResponse.json({
        success: true,
        move_id: existing.id,
        move_code: existing.move_code,
        message: "Move already exists",
      });
    }
  }

  const contact = quote.contacts as { name?: string; email?: string | null; phone?: string | null } | null;
  const clientEmail = contact?.email?.trim() || undefined;
  const clientName = contact?.name?.trim() || undefined;

  try {
    if (isB2BDeliveryQuoteServiceType(svc)) {
      const d = await createDeliveryFromB2BQuote({
        quoteId,
        depositAmount: Number(quote.deposit_amount ?? 0),
        selectedTier: quote.selected_tier ?? null,
        selectedAddons: quote.selected_addons ?? [],
        clientName,
        clientEmail,
        squareCustomerId: quote.square_customer_id ?? undefined,
        squareCardId: quote.square_card_id ?? undefined,
        squarePaymentId: quote.square_payment_id ?? undefined,
      });
      return NextResponse.json({
        success: true,
        delivery_id: d.deliveryId,
        delivery_number: d.deliveryNumber,
        message: "Delivery created from quote",
      });
    }

    const result = await createMoveFromQuote({
      quoteId,
      depositAmount: Number(quote.deposit_amount ?? 0),
      selectedTier: quote.selected_tier ?? null,
      selectedAddons: quote.selected_addons ?? [],
      clientName,
      clientEmail,
      squareCustomerId: quote.square_customer_id ?? undefined,
      squareCardId: quote.square_card_id ?? undefined,
      squarePaymentId: quote.square_payment_id ?? undefined,
    });

    return NextResponse.json({
      success: true,
      move_id: result.moveId,
      move_code: result.moveCode,
      tracking_url: result.trackingUrl,
      ...(result.eventGroupId
        ? {
            event_group_id: result.eventGroupId,
            related_move_count: result.relatedMoveCount,
          }
        : {}),
    });
  } catch (err) {
    console.error("[recover-move] create job from quote failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create move" },
      { status: 500 },
    );
  }
}
