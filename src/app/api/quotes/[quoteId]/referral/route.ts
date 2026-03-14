import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** PUT /api/quotes/[quoteId]/referral — Attach a verified referral_id to a quote */
export async function PUT(
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

    // Verify the referral is still active
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

    // Link referral to quote
    const { error } = await db
      .from("quotes")
      .update({ referral_id })
      .eq("quote_id", quoteId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save referral" },
      { status: 500 }
    );
  }
}
