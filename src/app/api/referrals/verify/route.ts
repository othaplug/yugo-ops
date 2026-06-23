import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReferralTier } from "@/lib/referral-tiers";

/**
 * POST /api/referrals/verify — Validate a client referral code.
 *
 * Body: { code: string, moveSize?: string }
 *
 * The optional `moveSize` resolves the tiered discount (set 2026-06-24):
 *   2BR+ → $100   |   Studio/1BR → $50
 *
 * If moveSize is omitted, returns the maximum ($100) so the UI can show
 * "up to $100" with the tier breakdown.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { code?: string; moveSize?: string };
    const { code, moveSize } = body;
    if (!code) return NextResponse.json({ valid: false, error: "Code is required" }, { status: 400 });

    const db = createAdminClient();
    const { data: ref } = await db
      .from("client_referrals")
      .select("id, referrer_name, referred_discount, status, expires_at")
      .eq("referral_code", (code as string).toUpperCase().trim())
      .single();

    if (!ref) return NextResponse.json({ valid: false, error: "Invalid referral code" });
    if (ref.status !== "active") return NextResponse.json({ valid: false, error: "This code has already been used" });
    if (ref.expires_at && new Date(ref.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "This code has expired" });
    }

    // Tier the discount to the friend's actual move size. When unknown,
    // surface the maximum so the UI can display "up to $100".
    const tier = getReferralTier(moveSize ?? null);
    return NextResponse.json({
      valid: true,
      referrer_name: ref.referrer_name,
      discount: tier.discount,
      tier_label: tier.label,
      referral_id: ref.id,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
