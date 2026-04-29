import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/quotes/copy-prefill?quote_id=YG-12345
 * GET /api/admin/quotes/copy-prefill?uuid=<quotes.id uuid>
 *
 * Staff-only: load a quote row (with contact) so the New Quote builder can prefill B2B edits
 * or Create Move can inherit scope fields.
 */
export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const quoteIdDisplay = req.nextUrl.searchParams.get("quote_id")?.trim();
  const quoteUuid = req.nextUrl.searchParams.get("uuid")?.trim();

  if (!quoteIdDisplay && !quoteUuid) {
    return NextResponse.json(
      { error: "quote_id or uuid is required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  let q = admin.from("quotes").select("*, contacts:contact_id(id, name, email, phone)");

  if (quoteUuid && UUID_REGEX.test(quoteUuid)) {
    q = q.eq("id", quoteUuid);
  } else if (quoteIdDisplay) {
    q = q.eq("quote_id", quoteIdDisplay);
  } else {
    return NextResponse.json({ error: "Invalid uuid" }, { status: 400 });
  }

  const { data: quote, error: qErr } = await q.maybeSingle();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ quote });
}
