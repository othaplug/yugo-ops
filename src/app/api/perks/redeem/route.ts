import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/perks/redeem — Track a perk redemption click */
export async function POST(req: NextRequest) {
  try {
    const { perk_id, client_email, move_id } = await req.json();
    if (!perk_id || !client_email) {
      return NextResponse.json({ error: "perk_id and client_email are required" }, { status: 400 });
    }

    const db = createAdminClient();

    // Verify perk exists and is active
    const { data: perk } = await db
      .from("partner_perks")
      .select("id, max_redemptions, current_redemptions, is_active, valid_until")
      .eq("id", perk_id)
      .single();

    if (!perk || !perk.is_active) {
      return NextResponse.json({ error: "Perk not found or inactive" }, { status: 404 });
    }
    if (perk.valid_until && new Date(perk.valid_until) < new Date()) {
      return NextResponse.json({ error: "Perk has expired" }, { status: 410 });
    }
    if (perk.max_redemptions && perk.current_redemptions >= perk.max_redemptions) {
      return NextResponse.json({ error: "Perk has reached maximum redemptions" }, { status: 410 });
    }

    // Insert redemption record
    await db.from("perk_redemptions").insert({
      perk_id,
      client_email,
      move_id: move_id || null,
    });

    // Increment counter
    await db
      .from("partner_perks")
      .update({ current_redemptions: (perk.current_redemptions ?? 0) + 1 })
      .eq("id", perk_id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record redemption" },
      { status: 500 }
    );
  }
}
