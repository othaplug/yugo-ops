import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import type { Currency } from "square";

/** Revenue for a move row — total_price > amount > estimate. */
function moveRevenue(m: {
  total_price?: number | null;
  amount?: number | null;
  estimate?: number | null;
  final_amount?: number | null;
}): number {
  const fa = m.final_amount != null ? Number(m.final_amount) : null;
  const tp = m.total_price != null ? Number(m.total_price) : null;
  const am = m.amount != null ? Number(m.amount) : null;
  const es = m.estimate != null ? Number(m.estimate) : null;
  return fa ?? tp ?? am ?? es ?? 0;
}

/**
 * Calculate billing-cycle due date.
 * - On or before 15th of month  → due on 15th of CURRENT month
 * - 16th onward                  → due on the last day of CURRENT month (≈ 30th)
 *
 * Returns ISO yyyy-mm-dd.
 */
function calcDueDate(now: Date = new Date()): string {
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (day <= 15) {
    return new Date(y, m, 15).toISOString().slice(0, 10);
  }
  // Last calendar day of the current month
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, lastDay).toISOString().slice(0, 10);
}

/**
 * POST /api/admin/partners/[partnerId]/generate-invoice
 *
 * Builds a single partner_invoices row for all unbilled completed PM moves on
 * this partner, then publishes a real Square invoice (multiple line items, one
 * per move) with the calculated billing-cycle due date.
 *
 * Body (optional): { dryRun?: boolean }  — when true, returns the draft DB row
 *                                          but skips Square.
 *
 * Response:
 *   {
 *     invoice_id, invoice_number, status, due_date, total_amount, move_count,
 *     square_invoice_id?, square_invoice_url?
 *   }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;
  const sb = createAdminClient();

  // 1. Resolve partner
  const { data: org } = await sb
    .from("organizations")
    .select("id, name, legal_name, contact_name, email, billing_email")
    .eq("id", partnerId)
    .maybeSingle();
  if (!org) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }
  const recipientEmail =
    (org.billing_email && String(org.billing_email).trim()) ||
    (org.email && String(org.email).trim()) ||
    null;

  // 2. Fetch all unbilled completed PM moves for this partner
  const { data: moves, error: movesError } = await sb
    .from("moves")
    .select(
      "id, move_code, client_name, tenant_name, scheduled_date, total_price, amount, estimate, final_amount, from_address, to_address",
    )
    .eq("organization_id", partnerId)
    .eq("is_pm_move", true)
    .in("status", ["completed", "delivered", "paid"])
    .is("invoice_id", null)
    .order("scheduled_date", { ascending: true });

  if (movesError) {
    return NextResponse.json({ error: movesError.message }, { status: 500 });
  }
  if (!moves || moves.length === 0) {
    return NextResponse.json(
      { error: "No unbilled completed PM moves for this partner" },
      { status: 409 },
    );
  }

  // 3. Period start/end + invoice number
  const sortedDates = moves
    .map((m) => String(m.scheduled_date || "").trim())
    .filter(Boolean)
    .sort();
  const periodStart = sortedDates[0] || new Date().toISOString().slice(0, 10);
  const periodEnd = sortedDates[sortedDates.length - 1] || periodStart;
  const dueDate = calcDueDate();
  const totalAmount =
    Math.round(moves.reduce((s, m) => s + moveRevenue(m), 0) * 100) / 100;
  if (totalAmount <= 0) {
    return NextResponse.json(
      { error: "All linked moves resolved to $0 — refusing to invoice" },
      { status: 422 },
    );
  }
  const orgCode = partnerId.slice(0, 4).toUpperCase();
  const cycleTag = dueDate.replaceAll("-", "").slice(2, 8); // YYMMDD
  const invoiceNumber = `INV-${orgCode}-${cycleTag}`;

  // 4. Create the local partner_invoices row (status = draft)
  const { data: invoice, error: insertErr } = await sb
    .from("partner_invoices")
    .insert({
      organization_id: partnerId,
      invoice_number: invoiceNumber,
      status: "draft",
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      due_date: dueDate,
      notes: `${moves.length} PM move${moves.length === 1 ? "" : "s"} — billing cycle through ${dueDate}`,
    })
    .select()
    .single();

  if (insertErr || !invoice) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create invoice row" },
      { status: 500 },
    );
  }

  // 5. Link the moves
  const linkRes = await sb
    .from("moves")
    .update({ invoice_id: invoice.id })
    .in(
      "id",
      moves.map((m) => m.id),
    );
  if (linkRes.error) {
    // Roll back the invoice row
    await sb.from("partner_invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ error: linkRes.error.message }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      status: "draft",
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      move_count: moves.length,
      moves: moves.map((m) => ({
        id: m.id,
        move_code: m.move_code,
        scheduled_date: m.scheduled_date,
        amount: moveRevenue(m),
      })),
    });
  }

  // 6. Build + publish Square invoice with one line item per move + HST.
  const accessToken = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return NextResponse.json(
      {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        status: "draft",
        due_date: dueDate,
        total_amount: totalAmount,
        move_count: moves.length,
        warning: "Square not configured — invoice saved locally only",
      },
      { status: 200 },
    );
  }

  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) {
    return NextResponse.json(
      {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        status: "draft",
        due_date: dueDate,
        total_amount: totalAmount,
        move_count: moves.length,
        warning: "Square location not configured — invoice saved locally only",
      },
      { status: 200 },
    );
  }

  const currency = "CAD" as Currency;
  const idem = (suffix: string) => `${suffix}-pminv-${invoice.id}`;
  const displayCompany = (org.legal_name || org.name || "Partner").trim();

  try {
    // 6a. Find or create Square customer
    let squareCustomerId: string | null = null;
    if (recipientEmail) {
      try {
        const searchRes = await squareClient.customers.search({
          query: { filter: { emailAddress: { exact: recipientEmail } } },
        });
        if (searchRes.customers && searchRes.customers.length > 0) {
          squareCustomerId = searchRes.customers[0].id ?? null;
        }
      } catch {
        // fall through to create
      }
    }
    if (!squareCustomerId) {
      const customerRes = await squareClient.customers.create({
        idempotencyKey: idem("customer"),
        givenName: (org.contact_name || displayCompany).slice(0, 100),
        emailAddress: recipientEmail || undefined,
        companyName: displayCompany.slice(0, 255),
      });
      squareCustomerId = customerRes.customer?.id ?? null;
    }

    // 6b. Create Order — one line item per move + HST 13% line
    const lineItems = moves.map((m) => {
      const tenant =
        (m.tenant_name && String(m.tenant_name).trim()) ||
        (m.client_name && String(m.client_name).trim()) ||
        "PM Move";
      const dateLabel = String(m.scheduled_date || "").slice(0, 10);
      const subtotalCents = Math.round(moveRevenue(m) * 100);
      return {
        name: `${m.move_code || "PM Move"} — ${tenant}${dateLabel ? ` (${dateLabel})` : ""}`,
        quantity: "1",
        basePriceMoney: { amount: BigInt(subtotalCents), currency },
        note: m.to_address ? `To: ${String(m.to_address).slice(0, 200)}` : undefined,
      };
    });
    const hstCents = Math.round(totalAmount * 0.13 * 100);
    lineItems.push({
      name: "HST (13%)",
      quantity: "1",
      basePriceMoney: { amount: BigInt(hstCents), currency },
      note: undefined,
    });

    const orderRes = await squareClient.orders.create({
      order: {
        locationId,
        customerId: squareCustomerId || undefined,
        pricingOptions: { autoApplyTaxes: false, autoApplyDiscounts: false },
        lineItems,
      },
      idempotencyKey: idem("order"),
    });
    const orderId = orderRes.order?.id;
    if (!orderId) {
      throw new Error("Square order creation returned no orderId");
    }

    // 6c. Create + publish invoice
    const invoiceRes = await squareClient.invoices.create({
      invoice: {
        orderId,
        locationId,
        primaryRecipient: squareCustomerId ? { customerId: squareCustomerId } : undefined,
        paymentRequests: [
          {
            requestType: "BALANCE",
            dueDate,
            automaticPaymentSource: "NONE",
          },
        ],
        deliveryMethod: recipientEmail ? "EMAIL" : "SHARE_MANUALLY",
        invoiceNumber,
        title: `Yugo+ Property Management — ${displayCompany}`,
        description: `Billing cycle ${periodStart} – ${periodEnd}. ${moves.length} move${moves.length === 1 ? "" : "s"}.`,
        acceptedPaymentMethods: {
          card: true,
          bankAccount: false,
          squareGiftCard: false,
        },
      },
      idempotencyKey: idem("invoice"),
    });
    const sqInv = invoiceRes.invoice;
    if (!sqInv?.id) {
      throw new Error("Square invoice creation returned no id");
    }
    await squareClient.invoices.publish({
      invoiceId: sqInv.id,
      version: sqInv.version ?? 0,
      idempotencyKey: idem("publish"),
    });

    // 7. Update local row
    const squareUrl = (sqInv as { publicUrl?: string }).publicUrl ?? null;
    await sb
      .from("partner_invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        square_invoice_id: sqInv.id,
        square_invoice_url: squareUrl,
      })
      .eq("id", invoice.id);

    return NextResponse.json({
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      status: "sent",
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      move_count: moves.length,
      square_invoice_id: sqInv.id,
      square_invoice_url: squareUrl,
    });
  } catch (err) {
    console.error("[generate-invoice] Square publish failed:", err);
    // Local row already exists; flag the failure but don't roll back the moves link.
    return NextResponse.json(
      {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        status: "draft",
        due_date: dueDate,
        total_amount: totalAmount,
        move_count: moves.length,
        error: err instanceof Error ? err.message : "Square publish failed",
      },
      { status: 502 },
    );
  }
}
