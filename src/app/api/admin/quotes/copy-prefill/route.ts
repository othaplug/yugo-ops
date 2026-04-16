import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * GET /api/admin/quotes/copy-prefill?quote_id=YG-12345
 * Staff-only: load a quote row (with contact) so the New Quote builder can prefill B2B edits.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const quoteId = req.nextUrl.searchParams.get("quote_id")?.trim();
  if (!quoteId) {
    return NextResponse.json({ error: "quote_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select("*, contacts:contact_id(id, name, email, phone)")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ quote });
}
