import { createAdminClient } from "@/lib/supabase/admin";
import { pickLatestTrackingSession, resolveAdminMoveListDisplayStatus } from "@/lib/move-status";
import AllMovesClient from "./AllMovesClient";

export const metadata = { title: "Moves" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AllMovesPage() {
  const db = createAdminClient();

  const [{ data: movesRaw }, { data: quotes }] = await Promise.all([
    db
      .from("moves")
      .select(
        "id, move_code, client_name, client_email, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at, margin_percent, margin_flag, est_margin_percent",
      )
      .order("created_at", { ascending: false }),
    db
      .from("quotes")
      .select("id, quote_id, contact_id, service_type, status, tiers, custom_price, sent_at, created_at, from_address, to_address")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

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

  const movesForClient = moves.map((m) => ({
    ...m,
    display_status: resolveAdminMoveListDisplayStatus(
      m.status,
      latestSessionByMoveId[m.id]?.status ?? null,
    ),
  }));

  return (
    <AllMovesClient
      moves={movesForClient}
      recentQuotes={(quotes || []).map((q) => ({ ...q, client_name: contactMap[q.contact_id] || "" }))}
      crewMap={crewMap}
    />
  );
}
