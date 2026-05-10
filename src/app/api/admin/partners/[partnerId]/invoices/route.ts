import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** Revenue for a move row — admin_adjusted > total_price > amount > estimate */
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

const INVOICEABLE_STATUSES = ["completed", "delivered"];

/**
 * GET /api/admin/partners/[partnerId]/invoices
 * Returns the invoice list for a PM org, with move count per invoice.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const supabase = createAdminClient();

  const { data: invoices, error } = await supabase
    .from("partner_invoices")
    .select("*")
    .eq("organization_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(48);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach move counts
  const ids = (invoices ?? []).map((i) => i.id);
  let moveCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: moves } = await supabase
      .from("moves")
      .select("invoice_id")
      .in("invoice_id", ids);
    for (const m of moves ?? []) {
      if (m.invoice_id) moveCounts[m.invoice_id] = (moveCounts[m.invoice_id] || 0) + 1;
    }
  }

  const result = (invoices ?? []).map((inv) => ({
    ...inv,
    move_count: moveCounts[inv.id] || 0,
  }));

  // Aging
  const today = new Date().toISOString().slice(0, 10);
  const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
  for (const inv of result) {
    if (!["sent", "overdue"].includes(inv.status)) continue;
    const outstanding = Number(inv.total_amount);
    const daysPast = Math.floor(
      (new Date(today).getTime() - new Date(inv.period_end).getTime()) / 86_400_000,
    );
    if (daysPast <= 0) aging.current += outstanding;
    else if (daysPast <= 30) aging.days30 += outstanding;
    else if (daysPast <= 60) aging.days60 += outstanding;
    else aging.days90 += outstanding;
  }

  return NextResponse.json({ invoices: result, aging });
}

/**
 * POST /api/admin/partners/[partnerId]/invoices
 * Generate a new invoice from unbilled completed moves in a date range.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const body = await req.json();
  const { period_start, period_end, notes } = body as {
    period_start: string;
    period_end: string;
    notes?: string;
  };

  if (!period_start || !period_end) {
    return NextResponse.json({ error: "period_start and period_end are required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", partnerId)
    .maybeSingle();

  if (!org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  // Find unbilled completed moves in the period
  const { data: moves, error: movesError } = await supabase
    .from("moves")
    .select("id, move_code, client_name, from_address, to_address, scheduled_date, completed_at, total_price, amount, estimate, move_size")
    .eq("organization_id", partnerId)
    .in("status", INVOICEABLE_STATUSES)
    .is("invoice_id", null)
    .gte("scheduled_date", period_start)
    .lte("scheduled_date", period_end)
    .order("scheduled_date", { ascending: true });

  if (movesError) return NextResponse.json({ error: movesError.message }, { status: 500 });

  if (!moves || moves.length === 0) {
    return NextResponse.json(
      { error: "No unbilled completed moves in this period" },
      { status: 400 },
    );
  }

  const totalAmount = moves.reduce((sum, m) => sum + moveRevenue(m), 0);
  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7).replace("-", "");
  const orgCode = partnerId.slice(0, 4).toUpperCase();
  const invoiceNumber = `INV-${orgCode}-${monthStr}`;

  const { data: invoice, error: insertError } = await supabase
    .from("partner_invoices")
    .insert({
      organization_id: partnerId,
      invoice_number: invoiceNumber,
      status: "draft",
      period_start,
      period_end,
      total_amount: Math.round(totalAmount * 100) / 100,
      notes: notes || null,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Link moves to invoice
  const moveIds = moves.map((m) => m.id);
  await supabase
    .from("moves")
    .update({ invoice_id: invoice.id })
    .in("id", moveIds);

  return NextResponse.json({ invoice: { ...invoice, move_count: moves.length } });
}

/**
 * PATCH /api/admin/partners/[partnerId]/invoices
 * Update invoice status (e.g. draft → sent, sent → paid).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const body = await req.json();
  const { invoice_id, status, paid_at } = body as {
    invoice_id: string;
    status: string;
    paid_at?: string;
  };

  if (!invoice_id || !status) {
    return NextResponse.json({ error: "invoice_id and status are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const update: Record<string, unknown> = { status };
  if (status === "sent" && !paid_at) update.sent_at = new Date().toISOString();
  if (status === "paid") update.paid_at = paid_at ?? new Date().toISOString();

  const { error } = await supabase
    .from("partner_invoices")
    .update(update)
    .eq("id", invoice_id)
    .eq("organization_id", partnerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
