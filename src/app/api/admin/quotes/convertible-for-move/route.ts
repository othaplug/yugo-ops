import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";

/**
 * GET /api/admin/quotes/convertible-for-move
 *
 * Accepted residential move quotes that do not yet have a linked move row
 * (same eligibility as POST /api/admin/quotes/recover-move).
 */
export async function GET(req: Request) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const url = new URL(req.url);
  const qRaw = url.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const db = createAdminClient();

  const { data: quotes, error: qErr } = await db
    .from("quotes")
    .select(
      "id, quote_id, contact_id, service_type, status, tiers, custom_price, selected_tier, recommended_tier, move_date, from_address, to_address, created_at",
    )
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(250);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const rows = (quotes || []).filter(
    (row) => !isB2BDeliveryQuoteServiceType(String(row.service_type ?? "")),
  );

  const quoteIds = rows.map((r) => r.id).filter(Boolean);
  if (quoteIds.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  const { data: existingMoves } = await db
    .from("moves")
    .select("quote_id")
    .in("quote_id", quoteIds);

  const hasMove = new Set(
    (existingMoves || []).map((m) => m.quote_id).filter(Boolean),
  );

  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))];
  let contactMap: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await db
      .from("contacts")
      .select("id, name")
      .in("id", contactIds as string[]);
    if (contacts) {
      contactMap = Object.fromEntries(
        contacts.map((c) => [c.id, c.name || ""]),
      );
    }
  }

  let out = rows
    .filter((r) => !hasMove.has(r.id))
    .map((r) => ({
      ...r,
      client_name: contactMap[r.contact_id as string] || "",
    }));

  if (qRaw) {
    out = out.filter((r) => {
      const hay = [
        r.quote_id,
        r.client_name,
        r.from_address,
        r.to_address,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(qRaw);
    });
  }

  return NextResponse.json({ quotes: out.slice(0, 80) });
}
