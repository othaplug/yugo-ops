import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";

/**
 * B2B one-off quotes with payment method "invoice" — confirm booking without card.
 * Sets quote payment_status to invoiced and creates move(s) with $0 deposit recorded.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      quoteId,
      clientName,
      clientEmail,
      selectedTier,
      selectedAddons,
    } = body as {
      quoteId: string;
      clientName: string;
      clientEmail: string;
      selectedTier?: string | null;
      selectedAddons?: unknown[];
    };

    if (!quoteId?.trim() || !clientName?.trim() || !clientEmail?.trim()) {
      return NextResponse.json({ error: "quoteId, clientName, and clientEmail required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: quote, error: qErr } = await admin
      .from("quotes")
      .select("id, quote_id, status, factors_applied, service_type")
      .eq("quote_id", quoteId.trim())
      .single();

    if (qErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status === "accepted") {
      return NextResponse.json({ error: "Quote already accepted" }, { status: 409 });
    }

    const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
    const pay = factors.b2b_payment_method;
    if (pay !== "invoice") {
      return NextResponse.json({ error: "This quote is not configured for invoice booking" }, { status: 400 });
    }

    const st = quote.service_type;
    if (st !== "b2b_delivery" && st !== "b2b_oneoff") {
      return NextResponse.json({ error: "Invoice booking is only available for B2B deliveries" }, { status: 400 });
    }

    await admin
      .from("quotes")
      .update({
        status: "accepted",
        payment_status: "invoiced",
        selected_tier: selectedTier ?? "custom",
        selected_addons: selectedAddons ?? [],
        accepted_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    const moveResult = await createMoveFromQuote({
      quoteId: quote.quote_id,
      depositAmount: 0,
      selectedTier: selectedTier ?? null,
      selectedAddons: selectedAddons ?? [],
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
    });

    return NextResponse.json({
      success: true,
      move_id: moveResult.moveId,
      tracking_url: moveResult.trackingUrl,
    });
  } catch (e) {
    console.error("[accept-b2b-invoice]", e);
    return NextResponse.json({ error: "Failed to confirm booking" }, { status: 500 });
  }
}
