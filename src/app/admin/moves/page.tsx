import { createAdminClient } from "@/lib/supabase/admin";
import { pickLatestTrackingSession, resolveAdminMoveListDisplayStatus } from "@/lib/move-status";
import AllMovesV3Client from "./AllMovesV3Client";
import { calcEstimatedCost, calcEstimatedMarginPct } from "@/lib/pricing/engine";
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
    "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, final_amount, total_price, status, move_type, service_type, tier_selected, neighbourhood_tier, crew_id, created_at, margin_percent, margin_flag, est_margin_percent, contract_id, is_pm_move, actual_hours, est_hours, actual_crew_count, est_crew_size, distance_km, truck_primary, truck_secondary, move_size, balance_method, deposit_method";

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
    // `paid` is a payment flag, NOT an operational stage — a move can be
    // paid in advance and still be scheduled for a future date. Only treat
    // a move as completed for actual-cost recalculation when it has truly
    // been executed. See lib/move-status.ts → getStatusLabel: "paid" is
    // intentionally surfaced as "Scheduled" to operators.
    const isCompleted = ["completed", "delivered"].includes(String(display_status || "").toLowerCase());

    const effectivePrice = Number(m.final_amount ?? m.total_price ?? m.estimate ?? 0);

    let margin_percent: number | null = m.margin_percent ?? null;
    let est_margin_percent: number | null = m.est_margin_percent ?? null;

    if (effectivePrice > 0) {
      if (isCompleted) {
        // Recalculate from actual data so the list always matches the profitability panel.
        // Prefer live tracked hours; fall back to stored actual_hours, then est_hours.
        const trackedHours = sessionHoursMap[m.id] ?? null;
        const costs = calculateMoveProfitability(
          {
            estimate: effectivePrice,
            actual_hours: trackedHours ?? m.actual_hours ?? null,
            est_hours: m.est_hours ?? null,
            actual_crew_count: m.actual_crew_count ?? null,
            est_crew_size: m.est_crew_size ?? null,
            distance_km: m.distance_km ?? null,
            truck_primary: m.truck_primary ?? null,
            truck_secondary: m.truck_secondary ?? null,
            move_size: m.move_size ?? null,
            service_type: m.service_type ?? null,
            balance_method: m.balance_method ?? null,
            deposit_method: m.deposit_method ?? null,
          },
          config,
          1,
        );
        margin_percent = costs.grossMargin;
        if (est_margin_percent == null) est_margin_percent = margin_percent;
      } else if (est_margin_percent == null) {
        // Non-completed moves: use lightweight estimate from config defaults for the preview badge
        const cost = calcEstimatedCost(
          {
            actualEstimatedHours: Number(m.est_hours ?? 4) || 4,
            crew: Number(m.est_crew_size ?? 2) || 2,
            recommendedTruck: m.truck_primary ?? "sprinter",
            distanceKm: Number(m.distance_km ?? 20) || 20,
            tier: String(m.tier_selected || "essential"),
            moveSize: m.move_size ?? "2br",
          },
          config,
        );
        est_margin_percent = calcEstimatedMarginPct(effectivePrice, cost);
      }
    }

    const pctForFlag = isCompleted ? margin_percent : est_margin_percent;
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
