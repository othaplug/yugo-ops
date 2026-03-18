import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const type = req.nextUrl.searchParams.get("type") || "perks";

  if (type === "referrals") {
    const { data, error } = await db
      .from("client_referrals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ referrals: data ?? [] });
  }

  if (type === "vip") {
    const { data, error } = await db
      .from("contacts")
      .select("id, name, email, phone, vip_status, lifetime_value, referral_count, created_at")
      .eq("vip_status", true)
      .order("lifetime_value", { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ contacts: data ?? [] });
  }

  // Default: perks
  const { data, error } = await db
    .from("partner_perks")
    .select("*, organizations(name)")
    .order("display_order")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ perks: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const body = await req.json();

  if (body.type === "credit_referral") {
    const { referral_id } = body;
    if (!referral_id) return NextResponse.json({ error: "referral_id required" }, { status: 400 });

    const { data, error } = await db
      .from("client_referrals")
      .update({ status: "credited", credited_at: new Date().toISOString() })
      .eq("id", referral_id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Unknown patch type" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const body = await req.json();

  /* ─── Create promotional referral code ─── */
  if (body.type === "create_referral") {
    const code = (body.code ?? "").toString().trim().toUpperCase();
    const referrerCredit = Number(body.referrer_credit ?? 100);
    const referredDiscount = Number(body.referred_discount ?? 100);
    const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const label = (body.label ?? "Promotional").toString().trim() || "Promotional";

    if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });
    if (code.length < 4) return NextResponse.json({ error: "Code must be at least 4 characters" }, { status: 400 });

    const { data: existing } = await db.from("client_referrals").select("id").eq("referral_code", code).maybeSingle();
    if (existing) return NextResponse.json({ error: "Code already exists" }, { status: 400 });

    const promoEmail = "promo@helloyugo.com";
    const { data: ref, error: refErr } = await db
      .from("client_referrals")
      .insert({
        referrer_move_id: null,
        referrer_name: label,
        referrer_email: promoEmail,
        referral_code: code,
        referrer_credit: referrerCredit,
        referred_discount: referredDiscount,
        status: "active",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 });
    return NextResponse.json(ref, { status: 201 });
  }

  /* ─── Create partner perk ─── */
  const {
    partner_id, title, description, offer_type,
    discount_value, redemption_code, redemption_url,
    valid_from, valid_until, max_redemptions, display_order,
  } = body;

  if (!title?.trim() || !offer_type) {
    return NextResponse.json({ error: "title and offer_type are required" }, { status: 400 });
  }
  if (!partner_id?.trim()) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("partner_perks")
    .insert({
      partner_id: partner_id.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      offer_type,
      discount_value: discount_value ? Number(discount_value) : null,
      redemption_code: redemption_code?.trim() || null,
      redemption_url: redemption_url?.trim() || null,
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      max_redemptions: max_redemptions ? Number(max_redemptions) : null,
      display_order: display_order ? Number(display_order) : 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
