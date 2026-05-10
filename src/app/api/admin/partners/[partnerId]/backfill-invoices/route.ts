import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** Revenue for a move row — total_price > amount > estimate */
function moveRevenue(m: {
  total_price?: number | null;
  amount?: number | null;
  estimate?: number | null;
}): number {
  const tp = m.total_price != null ? Number(m.total_price) : null;
  const am = m.amount != null ? Number(m.amount) : null;
  const es = m.estimate != null ? Number(m.estimate) : null;
  return tp ?? am ?? es ?? 0;
}

/**
 * POST /api/admin/partners/[partnerId]/backfill-invoices
 *
 * Finds all completed moves for the partner that have no invoice_id,
 * groups them by calendar month, and creates a partner_invoices record
 * for each month. Returns the list of created invoices.
 *
 * No Square sending — creates DB records only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", partnerId)
    .maybeSingle();

  if (!org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  // Fetch all unbilled completed moves for this partner
  const { data: moves, error: movesError } = await supabase
    .from("moves")
    .select(
      "id, move_code, client_name, scheduled_date, total_price, amount, estimate",
    )
    .eq("organization_id", partnerId)
    .in("status", ["completed", "delivered", "paid"])
    .is("invoice_id", null)
    .order("scheduled_date", { ascending: true });

  if (movesError) {
    return NextResponse.json({ error: movesError.message }, { status: 500 });
  }

  if (!moves || moves.length === 0) {
    return NextResponse.json({
      created: [],
      message: "No unbilled completed moves found",
    });
  }

  // Group moves by calendar month (YYYY-MM)
  const byMonth: Record<
    string,
    (typeof moves)[number][]
  > = {};

  for (const m of moves) {
    const month = String(m.scheduled_date || "").slice(0, 7);
    if (!month) continue;
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(m);
  }

  const orgCode = partnerId.slice(0, 4).toUpperCase();
  const created: {
    invoice_id: string;
    invoice_number: string;
    period_start: string;
    period_end: string;
    total_amount: number;
    move_count: number;
    moves: { id: string; move_code: string | null; scheduled_date: string | null }[];
  }[] = [];

  for (const [month, monthMoves] of Object.entries(byMonth).sort()) {
    const [year, mo] = month.split("-").map(Number);
    if (!year || !mo) continue;

    const periodStart = `${month}-01`;
    const lastDay = new Date(year, mo, 0).getDate();
    const periodEnd = `${month}-${String(lastDay).padStart(2, "0")}`;
    const totalAmount =
      Math.round(monthMoves.reduce((s, m) => s + moveRevenue(m), 0) * 100) / 100;
    const monthTag = month.replace("-", "");
    const invoiceNumber = `INV-${orgCode}-${monthTag}`;

    const { data: invoice, error: insertError } = await supabase
      .from("partner_invoices")
      .insert({
        organization_id: partnerId,
        invoice_number: invoiceNumber,
        status: "draft",
        period_start: periodStart,
        period_end: periodEnd,
        total_amount: totalAmount,
        notes: `Backfilled — ${monthMoves.length} move${monthMoves.length === 1 ? "" : "s"}`,
      })
      .select()
      .single();

    if (insertError) {
      // Skip duplicate invoice_number; don't fail the whole backfill
      continue;
    }

    // Link all moves in this month to the invoice
    await supabase
      .from("moves")
      .update({ invoice_id: invoice.id })
      .in(
        "id",
        monthMoves.map((m) => m.id),
      );

    created.push({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      move_count: monthMoves.length,
      moves: monthMoves.map((m) => ({
        id: m.id,
        move_code: m.move_code,
        scheduled_date: m.scheduled_date,
      })),
    });
  }

  return NextResponse.json({ created, total_invoices_created: created.length });
}
