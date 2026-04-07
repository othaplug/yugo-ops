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
  ] = await Promise.all([
    admin
      .from("partner_statements")
      .select(
        "id, statement_number, period_start, period_end, delivery_count, subtotal, hst, total, due_date, payment_terms, status, paid_amount, paid_at, created_at, pdf_url",
      )
      .eq("partner_id", orgId)
      .order("created_at", { ascending: false })
      .limit(36),
    admin.from("organizations").select("billing_email, payment_terms, billing_anchor_day").eq("id", orgId).single(),
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
  ]);

  const invs = invoices ?? [];
  const outstandingInvs = invs.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstandingAmount = outstandingInvs.reduce((s, i) => s + Number(i.amount || 0), 0);
  const outstandingDueDate =
    outstandingInvs.length > 0
      ? outstandingInvs.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0]?.due_date ||
        null
      : null;

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
    invoices: invs,
    allMoves: moves ?? [],
    outstandingAmount,
    outstandingDueDate,
    damageClaims: 0,
    billingTerms,
    nextStatementDate,
  });
}
