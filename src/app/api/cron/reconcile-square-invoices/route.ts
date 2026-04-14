import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileUnpaidSquareInvoices } from "@/lib/reconcile-square-invoices";

/**
 * Vercel Cron: poll Square for invoices still "sent"/"overdue" in Ops and mark paid when Square is PAID.
 * Does not rely on webhooks.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const result = await reconcileUnpaidSquareInvoices(supabase, { limit: 100 });

  return NextResponse.json({ ok: true, ...result });
}
