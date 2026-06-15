import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { generateAndSendPmInvoice } from "@/lib/pm-invoicing";

/**
 * POST /api/admin/partners/[partnerId]/generate-invoice
 *
 * Builds a single partner_invoices row for all unbilled completed PM moves on
 * this partner, then publishes a real Square invoice (one line item per move)
 * with the billing-cycle due date and emails the partner a payment link.
 *
 * Self-healing: if a previous attempt left a draft because the Square publish
 * failed, clicking again resumes that draft and retries the send.
 *
 * Body (optional): { dryRun?: boolean } — skip Square, return the draft row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { partnerId } = await params;
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const sb = createAdminClient();

  const result = await generateAndSendPmInvoice(sb, partnerId, {
    dryRun: body.dryRun === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, invoice_id: result.invoice_id },
      { status: result.code },
    );
  }

  return NextResponse.json(result);
}
