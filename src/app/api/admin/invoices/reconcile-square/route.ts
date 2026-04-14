import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { reconcileUnpaidSquareInvoices } from "@/lib/reconcile-square-invoices";

/** POST — staff: sync invoice paid status from Square (same logic as cron). */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let limit = 100;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.min(200, Math.max(1, Math.floor(body.limit)));
    }
  } catch {
    // ignore
  }

  const supabase = createAdminClient();
  const result = await reconcileUnpaidSquareInvoices(supabase, { limit });

  return NextResponse.json({ ok: true, ...result });
}
