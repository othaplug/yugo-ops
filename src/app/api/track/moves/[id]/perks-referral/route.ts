import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("id, client_email, status")
    .eq("id", moveId)
    .single();

  if (!move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const [perksRes, referralRes] = await Promise.all([
    admin
      .from("partner_perks")
      .select("id, title, description, offer_type, discount_value, redemption_code, redemption_url, valid_until, partner_id")
      .eq("is_active", true)
      .or("valid_until.is.null,valid_until.gte." + new Date().toISOString().split("T")[0])
      .order("display_order", { ascending: true })
      .limit(6),
    move.client_email
      ? admin
          .from("client_referrals")
          .select("id, referral_code, referrer_credit, referred_discount, status, used_at, created_at")
          .eq("referrer_email", move.client_email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return NextResponse.json({
    perks: perksRes.data ?? [],
    referral: referralRes.data ?? null,
  });
}
