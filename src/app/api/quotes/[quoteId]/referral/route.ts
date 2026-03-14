import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** PATCH /api/quotes/[quoteId]/referral — Link a verified referral to a quote */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { referral_id } = await req.json();

  if (!referral_id) return NextResponse.json({ error: "referral_id required" }, { status: 400 });

  const db = createAdminClient();
  const { error } = await db
    .from("quotes")
    .update({ referral_id })
    .eq("quote_id", quoteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
