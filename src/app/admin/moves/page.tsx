import { createAdminClient } from "@/lib/supabase/admin";
import { pickLatestTrackingSession, resolveAdminMoveListDisplayStatus } from "@/lib/move-status";
import AllMovesV3Client from "./AllMovesV3Client";
import { calculateMoveProfitability } from "@/lib/finance/calculateProfit";

export const metadata = { title: "Moves" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

function threeBandMarginFlag(pct: number): "green" | "yellow" | "red" {
  if (pct >= 35) return "green";
  if (pct >= 25) return "yellow";
  return "red";
}

export default async function AllMovesPage() {
  const db = createAdminClient();

  const movesSelect =
    // Keep this select compatible with older DB schemas (avoid newer columns that may not exist yet)
    // actual_hours, est_hours, etc. are used to recalculate margin for completed moves (matches profitability panel)
    // organizations join is used as a display-side fallback so PM-partner moves render as "PM Move" even
    // if their is_pm_move flag wasn't set at creation time (older create-route code paths).
    // pm_reason_code added 2026-06-28 so the list label renders "PM Reno
    // Move-In" / "PM Reno Move-Out" / "PM Suite Transfer" instead of a
    // generic "PM Move" — Oche caught two same-building rows (MV-30331 /
    // MV-30332) where the wrong reason had been saved and the bare label
    // gave no way to spot the data error.
    "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, final_amount, total_price, status, move_type, service_type, tier_selected, neighbourhood_tier, crew_id, created_at, margin_percent, margin_flag, est_margin_percent, contract_id, is_pm_move, pm_reason_code, organization_id, organizations:organization_id(vertical, type), est_hours, est_crew_size, estimated_duration_minutes, distance_km, truck_primary, truck_secondary, move_size, balance_method, deposit_method, actual_labour_cost, actual_fuel_cost, actual_truck_cost, actual_supplies_cost";

  const minimalMovesSelect =
    // Fallback if extended columns are missing in an older DB schema
    "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, final_amount, total_price, status, move_type, service_type, tier_selected, crew_id, created_at";

  const [movesResp, quotesResp] = await Promise.all([
    db.from("moves").select(movesSelect).order("created_at", { ascending: false }),
    db
      .from("quotes")
      .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, sent_at, created_at, from_address, to_address")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let movesRaw = movesResp.data;
  if (!movesRaw && movesResp.error) {
    // If a column is missing in the current DB schema, retry with minimal columns
    const retry = await db
      .from("moves")
      .select(minimalMovesSelect)
      .order("created_at", { ascending: false });
    movesRaw = ((retry.data || []).map((m) => ({
      ...m,
      margin_percent: null,
      margin_flag: null,
      est_margin_percent: null,
      contract_id: null,
      is_pm_move: false,
    })) as unknown) as typeof movesResp.data;
  }

  const quotes = quotesResp.data;

  // Resolve contact names for recent quotes
  const contactIds = (quotes || []).map((q) => q.contact_id).filter(Boolean);
  let contactMap: Record<string, string> = {};
  if (contactIds.length > 0) {
    const { data: contacts } = await db
      .from("contacts")
      .select("id, name")
      .in("id", contactIds);
    if (contacts) {
      contactMap = Object.fromEntries(contacts.map((c) => [c.id, c.name || ""]));
    }
  }

  // Resolve crew names
  const moves = (movesRaw || []).filter((m) => {
    const st = String(m.service_type ?? "").toLowerCase();
    const mt = String(m.move_type ?? "").toLowerCase();
    return st !== "bin_rental" && mt !== "bin_rental";
  });

  const crewIds = [...new Set(moves.map((m) => m.crew_id).filter(Boolean))];
  let crewMap: Record<string, string> = {};
  if (crewIds.length > 0) {
    const { data: crews } = await db.from("crews").select("id, name").in("id", crewIds);
    if (crews) {
      crewMap = Object.fromEntries(crews.map((c) => [c.id, c.name || ""]));
    }
  }

  const moveIdList = moves.map((m) => m.id).filter(Boolean) as string[];
  const latestSessionByMoveId: Record<string, { status: string; updated_at: string; created_at: string }> = {};
  // Actual tracked hours per move — used to recalculate margin for completed moves
  const sessionHoursMap: Record<string, number> = {};
  if (moveIdList.length > 0) {
    const { data: sessionRows } = await db
      .from("tracking_sessions")
      .select("job_id, status, created_at, updated_at, started_at, completed_at")
      .eq("job_type", "move")
      .in("job_id", moveIdList);
    const byJob = new Map<string, typeof sessionRows>();
    for (const row of sessionRows || []) {
      const r = row as { job_id?: string };
      const jid = String(r.job_id || "");
      if (!jid) continue;
      const list = byJob.get(jid) || [];
      list.push(row);
      byJob.set(jid, list);
    }
    for (const [jid, rows] of byJob) {
      const best = pickLatestTrackingSession(rows as { created_at?: string; updated_at?: string; status?: string }[]);
      if (best) {
        latestSessionByMoveId[jid] = {
          status: String((best as { status?: string }).status || ""),
          created_at: String((best as { created_at?: string }).created_at || ""),
          updated_at: String((best as { updated_at?: string }).updated_at || ""),
        };
        // Compute tracked hours from the best session (mirrors profitability API logic)
        const b = best as { started_at?: string; completed_at?: string; created_at?: string; updated_at?: string; status?: string };
        const startRaw = b.started_at || b.created_at;
        const endRaw = b.completed_at || (String(b.status || "") === "completed" ? b.updated_at : null);
        if (startRaw && endRaw) {
          const startMs = new Date(startRaw).getTime();
          const endMs = new Date(endRaw).getTime();
          const h = Math.round(((endMs - startMs) / 3_600_000) * 100) / 100;
          if (h > 0) sessionHoursMap[jid] = h;
        }
      }
    }
  }

  // Always load platform_config — needed for both completed-move recalculation and est margin fallback
  const config: Record<string, string> = {};
  {
    const { data: cfgRows } = await db.from("platform_config").select("key, value");
    for (const r of cfgRows ?? []) config[r.key] = r.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movesForClient = (moves as any[]).map((m) => {
    const display_status = resolveAdminMoveListDisplayStatus(
      m.status,
      latestSessionByMoveId[m.id]?.status ?? null,
    );
    // Always recompute from the shared calculateMoveProfitability
    // (2026-07-06 fix — MV-30348 pill showed stale 55 % vs 69.7 %
    // on the profitability page and move detail panel for the same
    // move). Root cause: previous logic only recomputed when
    // display_status was "completed" or "delivered". "paid" moves
    // (payment flag, not lifecycle) fell through to
    // `est_margin_percent` while `margin_percent` kept whatever was
    // stamped in the DB — often stale by months. Pill rendered the
    // stale DB value.
    //
    // calculateMoveProfitability handles both completed and non-
    // completed cases: with actual_labour_cost snapshot it uses
    // real numbers; without, it derives from est_hours × crew ×
    // loaded rate. Same function the profitability route uses, so
    // all three surfaces (list, profitability page, move detail
    // panel) agree by construction.
    //
    // NB: jobsOnSameDay isn't passed here (single-job path). If a
    // move shared its day with another, its truck cost on the
    // profitability page is divided by that count → higher margin
    // there vs here. Follow-up refinement: compute jobsOnSameDay
    // per row like /api/admin/profitability does. Not blocking the
    // current fix — for solo-day moves (majority) numbers match
    // exactly.
    const effectivePrice = Number(m.final_amount ?? m.total_price ?? m.estimate ?? 0);

    let margin_percent: number | null = null;
    let est_margin_percent: number | null = m.est_margin_percent ?? null;

    if (effectivePrice > 0) {
      const trackedHours = sessionHoursMap[m.id] ?? null;
      const costs = calculateMoveProfitability(
        {
          estimate: effectivePrice,
          actual_hours: trackedHours ?? null,
          est_hours: m.est_hours ?? null,
          est_crew_size: m.est_crew_size ?? null,
          estimated_duration_minutes: m.estimated_duration_minutes ?? null,
          distance_km: m.distance_km ?? null,
          truck_primary: m.truck_primary ?? null,
          truck_secondary: m.truck_secondary ?? null,
          move_size: m.move_size ?? null,
          service_type: m.service_type ?? null,
          balance_method: m.balance_method ?? null,
          deposit_method: m.deposit_method ?? null,
          actual_labour_cost: m.actual_labour_cost ?? null,
          actual_fuel_cost: m.actual_fuel_cost ?? null,
          actual_truck_cost: m.actual_truck_cost ?? null,
          actual_supplies_cost: m.actual_supplies_cost ?? null,
        },
        config,
        1,
      );
      margin_percent = costs.grossMargin;
      if (est_margin_percent == null) est_margin_percent = margin_percent;
    }

    // margin_percent is now always freshly computed above (no stale DB
    // fallback), so prefer it for the flag. Falls back to est_ only if
    // effectivePrice was 0 (no revenue → no margin computed).
    const pctForFlag = margin_percent ?? est_margin_percent;
    const margin_flag = pctForFlag != null ? threeBandMarginFlag(Number(pctForFlag)) : (m.margin_flag ?? null);

    return {
      ...m,
      margin_percent,
      est_margin_percent,
      margin_flag,
      display_status,
    };
  });

  return (
    <AllMovesV3Client
      moves={movesForClient}
      recentQuotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
      crewMap={crewMap}
    />
  );
}
