import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** Billing + monthly performance inputs for PM portal (mirrors partner portal-data slices). */
export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const [
    { data: statements },
    { data: org },
    { data: contract },
    { data: invoices },
    { data: moves },
    { data: partnerInvoices },
  ] = await Promise.all([
    admin
      .from("partner_statements")
      .select(
        "id, statement_number, period_start, period_end, delivery_count, subtotal, hst, total, due_date, payment_terms, status, paid_amount, paid_at, created_at, pdf_url",
      )
      .eq("partner_id", orgId)
      .order("created_at", { ascending: false })
      .limit(36),
    admin.from("organizations").select("billing_email, payment_terms, billing_anchor_day, billing_terms_days").eq("id", orgId).single(),
    admin
      .from("partner_contracts")
      .select("payment_terms, end_date")
      .eq("partner_id", orgId)
      .in("status", ["active", "negotiating", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("invoices")
      .select("id, invoice_number, client_name, amount, status, due_date, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    admin
      .from("moves")
      .select("id, status, scheduled_date")
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .order("scheduled_date", { ascending: false })
      .limit(2000),
    // PM partner invoices (new billing system)
    admin
      .from("partner_invoices")
      .select(
        "id, invoice_number, status, period_start, period_end, due_date, total_amount, sent_at, paid_at, created_at, square_invoice_id, square_invoice_url, notes",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(36),
  ]);

  const invs = invoices ?? [];
  const pmInvs = partnerInvoices ?? [];

  // Outstanding: prefer partner_invoices if they exist, else fall back to invoices table
  const outstandingSource = pmInvs.length > 0 ? pmInvs : invs;
  const outstandingInvs = outstandingSource.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstandingAmount = outstandingInvs.reduce(
    (s, i) => s + Number((i as Record<string, unknown>).total_amount ?? (i as Record<string, unknown>).amount ?? 0),
    0,
  );
  const outstandingDueDate = (() => {
    if (outstandingInvs.length === 0) return null;
    const sorted = [...outstandingInvs].sort((a, b) => {
      const av =
        ((a as Record<string, unknown>).due_date as string | undefined) ||
        ((a as Record<string, unknown>).period_end as string | undefined) ||
        "";
      const bv =
        ((b as Record<string, unknown>).due_date as string | undefined) ||
        ((b as Record<string, unknown>).period_end as string | undefined) ||
        "";
      return av.localeCompare(bv);
    });
    const first = sorted[0] as Record<string, unknown>;
    return (
      (first?.due_date as string | null) ??
      (first?.period_end as string | null) ??
      null
    );
  })();

  const billingTerms =
    (contract?.payment_terms as string | undefined) ||
    (org?.payment_terms as string | undefined) ||
    "Net 30";

  const anchor = Number(org?.billing_anchor_day) || 1;
  const next = new Date();
  if (next.getDate() >= anchor) next.setMonth(next.getMonth() + 1);
  next.setDate(anchor);
  const nextStatementDate = next.toISOString().slice(0, 10);

  return NextResponse.json({
    statements: statements ?? [],
    partnerInvoices: pmInvs,
    invoices: invs,
    allMoves: moves ?? [],
    outstandingAmount,
    outstandingDueDate,
    damageClaims: 0,
    billingTerms,
    nextStatementDate,
  });
}
