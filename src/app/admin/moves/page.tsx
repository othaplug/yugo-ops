import { createAdminClient } from "@/lib/supabase/admin";
import { pickLatestTrackingSession, resolveAdminMoveListDisplayStatus } from "@/lib/move-status";
import AllMovesClient from "./AllMovesClient";
import { calcEstimatedCost, calcEstimatedMarginPct } from "@/lib/pricing/engine";

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
    "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at, margin_percent, margin_flag, est_margin_percent";

  const minimalMovesSelect =
    // Absolute minimum required for `AllMovesClient` to render meaningful rows
    "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at";

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
  if (moveIdList.length > 0) {
    const { data: sessionRows } = await db
      .from("tracking_sessions")
      .select("job_id, status, created_at, updated_at")
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
      }
    }
  }

  const needsMarginFill = moves.some((m) => {
    const display = resolveAdminMoveListDisplayStatus(
      m.status,
      latestSessionByMoveId[m.id]?.status ?? null,
    );
    const isCompleted = ["completed", "delivered", "paid"].includes(String(display || "").toLowerCase());
    if (isCompleted) return m.margin_percent == null && Number(m.estimate || 0) > 0;
    return m.est_margin_percent == null && Number(m.estimate || 0) > 0;
  });

  let config: Record<string, string> = {};
  if (needsMarginFill) {
    const { data: cfgRows } = await db.from("platform_config").select("key, value");
    for (const r of cfgRows ?? []) config[r.key] = r.value;
  }

  const movesForClient = moves.map((m) => {
    const display_status = resolveAdminMoveListDisplayStatus(
      m.status,
      latestSessionByMoveId[m.id]?.status ?? null,
    );
    const isCompleted = ["completed", "delivered", "paid"].includes(String(display_status || "").toLowerCase());

    let margin_percent = m.margin_percent ?? null;
    let est_margin_percent = m.est_margin_percent ?? null;

    if (Object.keys(config).length > 0 && Number(m.estimate || 0) > 0) {
      // Fallback: estimate margin from config defaults so the table always shows margins,
      // even when the DB schema doesn't yet have the richer profitability inputs.
      if (est_margin_percent == null) {
        const hours = 4;
        const crew = 2;
        const truck = "sprinter";
        const distanceKm = 20;
        const cost = calcEstimatedCost(
          {
            actualEstimatedHours: hours,
            crew,
            recommendedTruck: truck,
            distanceKm,
            tier: String(m.tier_selected || "essential"),
            moveSize: "2br",
          },
          config,
        );
        est_margin_percent = calcEstimatedMarginPct(Number(m.estimate || 0), cost);
      }

      // If we don't have an actual recorded margin for completed moves, at least show the estimate.
      if (isCompleted && margin_percent == null) margin_percent = est_margin_percent;
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
    <AllMovesClient
      moves={movesForClient}
      recentQuotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
      crewMap={crewMap}
    />
  );
}
