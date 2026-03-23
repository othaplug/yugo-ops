import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { partnerId } = await params;
  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, email, billing_email, payment_terms, billing_anchor_day, billing_method")
    .eq("id", partnerId)
    .single();

  if (!org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { data: statements } = await supabase
    .from("partner_statements")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(24);

  // Aging summary
  const today = new Date().toISOString().slice(0, 10);
  const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
  for (const s of statements ?? []) {
    if (!["sent", "viewed", "overdue", "partial"].includes(s.status)) continue;
    const outstanding = Number(s.total) - Number(s.paid_amount || 0);
    const dueDate = new Date(s.due_date);
    const daysPastDue = Math.floor((new Date(today).getTime() - dueDate.getTime()) / 86400000);
    if (daysPastDue <= 0) aging.current += outstanding;
    else if (daysPastDue <= 30) aging.days30 += outstanding;
    else if (daysPastDue <= 60) aging.days60 += outstanding;
    else aging.days90 += outstanding;
  }

  return NextResponse.json({ org, statements: statements ?? [], aging });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { partnerId } = await params;
  const body = await req.json();
  const { period_start, period_end } = body;

  const supabase = createAdminClient();
  const { data: partner } = await supabase
    .from("organizations")
    .select("id, name, payment_terms")
    .eq("id", partnerId)
    .single();
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, delivery_number, completed_at, price, item_description")
    .eq("partner_id", partnerId)
    .eq("status", "completed")
    .gte("completed_at", period_start + "T00:00:00Z")
    .lte("completed_at", period_end + "T23:59:59Z")
    .is("statement_id", null);

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ error: "No unbilled deliveries in this period" }, { status: 400 });
  }

  const subtotal = deliveries.reduce((s, d) => s + (Number(d.price) || 0), 0);
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  const total = subtotal + hst;

  const terms = partner.payment_terms || "net_30";
  // Due date = today (statement date). The billing cycle IS the payment window.
  const dueDate = new Date();

  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7).replace("-", "");
  const partnerCode = partnerId.slice(0, 4).toUpperCase();
  const statementNumber = `STM-${partnerCode}-${monthStr}-M`;

  const { data: stmt, error } = await supabase
    .from("partner_statements")
    .insert({
      partner_id: partnerId,
      statement_number: statementNumber,
      period_start,
      period_end,
      deliveries: deliveries.map((d) => ({
        id: d.id,
        number: d.delivery_number,
        date: d.completed_at,
        price: d.price,
        description: d.item_description,
      })),
      delivery_count: deliveries.length,
      subtotal,
      hst,
      total,
      due_date: dueDate.toISOString().slice(0, 10), // due on statement date
      payment_terms: terms,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("deliveries")
    .update({ statement_id: stmt.id })
    .in("id", deliveries.map((d) => d.id));

  return NextResponse.json({ statement: stmt });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { partnerId } = await params;
  const { statement_id, status, paid_at, paid_amount } = await req.json();

  if (!statement_id || !status) {
    return NextResponse.json({ error: "statement_id and status required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const update: Record<string, unknown> = { status };
  if (paid_at) update.paid_at = paid_at;
  if (paid_amount != null) update.paid_amount = paid_amount;

  const { error } = await supabase
    .from("partner_statements")
    .update(update)
    .eq("id", statement_id)
    .eq("partner_id", partnerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
