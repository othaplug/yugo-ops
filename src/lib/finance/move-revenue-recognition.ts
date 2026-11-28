import type { SupabaseClient } from "@supabase/supabase-js";
import { contractTaxFromMove } from "@/lib/format-currency";

/**
 * ONE definition of move revenue recognition, shared by the Command Center
 * dashboard (src/lib/admin/command-center-data.ts) and the Profitability P&L
 * (src/app/api/admin/profitability/route.ts) so the two surfaces can never
 * disagree about which moves count, which day they count on, or how much.
 *
 * Basis (operator decision): revenue is recognized when service STARTS — the
 * client pays in full before the move begins, so the revenue is earned once the
 * crew starts (packing), attributed to the first service day. A move counts once
 * it has started (a completed tracking session), is paid, or is completed.
 */

type MoveLike = Record<string, unknown>;

/** Terminal/paid statuses that count without needing a tracking session. */
export const MOVE_PERFORMED_STATUSES = new Set(["completed", "delivered", "done", "paid"]);

/** Pre-tax revenue recognized for a move — the single source of truth. */
export function moveRecognizedRevenuePreTax(m: MoveLike): number {
  return Math.round(contractTaxFromMove(m as Parameters<typeof contractTaxFromMove>[0]).preTax);
}

/**
 * Whether a move's revenue is recognized yet:
 *   - it has started (a completed tracking session → `startedMoveIds`), OR
 *   - payment_marked_paid === true, OR
 *   - status is completed / delivered / done / paid.
 */
export function isMoveRevenueRecognized(m: MoveLike, startedMoveIds: Set<string>): boolean {
  if (m?.id && startedMoveIds.has(String(m.id))) return true;
  if (m?.payment_marked_paid === true) return true;
  return MOVE_PERFORMED_STATUSES.has(String(m?.status ?? "").toLowerCase());
}

/**
 * Recognition DAY ('YYYY-MM-DD') = the move's first service day (pack/start) for
 * multi-day moves, else scheduled_date, else completed_at, else payment date.
 * Compared on the YYYY-MM-DD substring so date-only columns don't time-zone-slip.
 */
export function moveRecognitionDay(m: MoveLike, firstServiceDayById: Map<string, string>): string | null {
  const first = m?.id ? firstServiceDayById.get(String(m.id)) : undefined;
  for (const v of [first, m?.scheduled_date, m?.completed_at, m?.payment_marked_paid_at]) {
    if (v == null) continue;
    const s = String(v).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

/** Earliest non-cancelled project-day date per move (the pack/start day). */
export async function loadFirstServiceDays(
  db: SupabaseClient,
  moveIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(moveIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await db
    .from("move_project_days")
    .select("move_id, date, status")
    .in("move_id", ids);
  for (const d of (data ?? []) as { move_id?: string | null; date?: string | null; status?: string | null }[]) {
    const mid = d?.move_id ? String(d.move_id) : "";
    const day = String(d?.date || "").slice(0, 10);
    if (!mid || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (String(d?.status || "").toLowerCase() === "cancelled") continue;
    const cur = map.get(mid);
    if (!cur || day < cur) map.set(mid, day);
  }
  return map;
}

/** Move ids with at least one completed tracking session (work has started). */
export async function loadStartedMoveIds(
  db: SupabaseClient,
  moveIds: string[],
): Promise<Set<string>> {
  const set = new Set<string>();
  const ids = [...new Set(moveIds.filter(Boolean))];
  if (ids.length === 0) return set;
  const { data } = await db
    .from("tracking_sessions")
    .select("job_id, status")
    .eq("job_type", "move")
    .eq("status", "completed")
    .in("job_id", ids);
  for (const s of (data ?? []) as { job_id?: string | null }[]) {
    if (s?.job_id) set.add(String(s.job_id));
  }
  return set;
}
