import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/referrals/verify — Validate a client referral code */
export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
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

    return NextResponse.json({
      valid: true,
      referrer_name: ref.referrer_name,
      discount: ref.referred_discount,
      referral_id: ref.id,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
