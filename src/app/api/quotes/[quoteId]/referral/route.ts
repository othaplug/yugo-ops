import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReferralTier } from "@/lib/referral-tiers";

/**
 * Attach a verified referral_id to a quote AND lock the row's tier
 * amounts to the friend's actual move size (set 2026-06-24).
 *
 * Before this change the row defaulted to $100/$100 and the engine could
 * apply $50 at quote time, leaving an admin-facing audit trail that
 * disagreed with what was charged. Now the row reflects the actual tier
 * the friend qualified for, so the admin "credit the referrer" workflow
 * pays out the correct amount without manual math.
 *
 * Accepts PUT (legacy callers) and PATCH (QuotePageClient).
 */
async function handleAttach(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const { quoteId } = await params;
    const { referral_id } = await req.json();

    if (!quoteId || !referral_id) {
      return NextResponse.json({ error: "quoteId and referral_id are required" }, { status: 400 });
    }

    const db = createAdminClient();

    const { data: ref } = await db
      .from("client_referrals")
      .select("id, status, expires_at")
      .eq("id", referral_id)
      .single();

    if (!ref) return NextResponse.json({ error: "Referral not found" }, { status: 404 });
    if (ref.status !== "active") return NextResponse.json({ error: "Referral already used" }, { status: 409 });
    if (ref.expires_at && new Date(ref.expires_at) < new Date()) {
      return NextResponse.json({ error: "Referral has expired" }, { status: 410 });
    }

    // Lock the tier amounts to the friend's actual move size.
    const { data: quote } = await db
      .from("quotes")
      .select("move_size")
      .eq("quote_id", quoteId)
      .maybeSingle();
    const tier = getReferralTier(quote?.move_size ?? null);

    const { error } = await db
      .from("quotes")
      .update({ referral_id })
      .eq("quote_id", quoteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Best-effort: align the referral row so admin payouts match what the
    // friend gets. Doesn't block the attach if it fails.
    await db
      .from("client_referrals")
      .update({
        referred_discount: tier.discount,
        referrer_credit: tier.credit,
      })
      .eq("id", referral_id);

    return NextResponse.json({ ok: true, tier_label: tier.label });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save referral" },
      { status: 500 }
    );
  }
}

export const PUT = handleAttach;
export const PATCH = handleAttach;
