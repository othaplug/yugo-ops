import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/** Temporary debug endpoint — reveals what data profitability sees for a given range */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const from = req.nextUrl.searchParams.get("from") ?? new Date().toISOString().slice(0, 7) + "-01";
  const to = req.nextUrl.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);

  const sb = createAdminClient();

  const [
    { data: sessionsByCompleted, error: e1 },
    { data: sessionsByStarted, error: e2 },
    { data: movesByScheduled, error: e3 },
    { data: movesByCompleted, error: e4 },
    { data: movesPaid, error: e5 },
    { data: dlvByScheduled, error: e6 },
    { data: dlvByCompleted, error: e7 },
    { data: recentMoves, error: e8 },
    { data: recentDlv, error: e9 },
  ] = await Promise.all([
    sb.from("tracking_sessions").select("id, job_id, job_type, status, started_at, completed_at")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`)
      .lte("completed_at", `${toDate}T23:59:59.999Z`),
    sb.from("tracking_sessions").select("id, job_id, job_type, status, started_at, completed_at")
      .eq("status", "completed")
      .is("completed_at", null)
      .gte("started_at", `${fromDate}T00:00:00Z`)
      .lte("started_at", `${toDate}T23:59:59.999Z`),
    sb.from("moves").select("id, move_code, scheduled_date, completed_at, status, payment_marked_paid, estimate, final_amount")
      .gte("scheduled_date", fromDate).lte("scheduled_date", toDate),
    sb.from("moves").select("id, move_code, scheduled_date, completed_at, status, payment_marked_paid, estimate, final_amount")
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`).lte("completed_at", `${toDate}T23:59:59.999Z`),
    sb.from("moves").select("id, move_code, status, payment_marked_paid, payment_marked_paid_at, estimate, final_amount")
      .eq("payment_marked_paid", true)
      .not("payment_marked_paid_at", "is", null)
      .gte("payment_marked_paid_at", `${fromDate}T00:00:00Z`).lte("payment_marked_paid_at", `${toDate}T23:59:59.999Z`),
    sb.from("deliveries").select("id, delivery_number, scheduled_date, completed_at, status, total_price, admin_adjusted_price")
      .gte("scheduled_date", fromDate).lte("scheduled_date", toDate),
    sb.from("deliveries").select("id, delivery_number, scheduled_date, completed_at, status, total_price, admin_adjusted_price")
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`).lte("completed_at", `${toDate}T23:59:59.999Z`),
    // Most recent 10 moves with any status to understand data shape
    sb.from("moves").select("id, move_code, scheduled_date, completed_at, payment_marked_paid, payment_marked_paid_at, status, estimate, final_amount")
      .order("scheduled_date", { ascending: false }).limit(10),
    // Most recent 10 deliveries
    sb.from("deliveries").select("id, delivery_number, scheduled_date, completed_at, status, total_price, admin_adjusted_price")
      .order("scheduled_date", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    range: { from: fromDate, to: toDate },
    errors: { e1, e2, e3, e4, e5, e6, e7, e8, e9 },
    counts: {
      sessionsByCompleted: sessionsByCompleted?.length ?? 0,
      sessionsByStarted: sessionsByStarted?.length ?? 0,
      movesByScheduled: movesByScheduled?.length ?? 0,
      movesByCompleted: movesByCompleted?.length ?? 0,
      movesPaid: movesPaid?.length ?? 0,
      dlvByScheduled: dlvByScheduled?.length ?? 0,
      dlvByCompleted: dlvByCompleted?.length ?? 0,
    },
    sessionsByCompleted,
    sessionsByStarted,
    movesByScheduled,
    movesByCompleted,
    movesPaid,
    dlvByScheduled,
    dlvByCompleted,
    recentMoves,
    recentDlv,
  });
}
