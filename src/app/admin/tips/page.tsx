export const metadata = { title: "Tips" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import TipsClient from "./TipsClient";

export default async function TipsPage() {
  const db = createAdminClient();
  const { data: tips } = await db
    .from("tips")
    .select("id, move_id, crew_id, crew_name, client_name, amount, processing_fee, net_amount, charged_at, moves(move_code)")
    .order("charged_at", { ascending: false })
    .limit(200);

  const allTips = (tips || []).map((row) => {
    const m = row.moves as { move_code?: string | null } | null | undefined;
    const { moves: _drop, ...rest } = row as typeof row & { moves?: unknown };
    return { ...rest, move_code: m?.move_code ?? null };
  });
  const totalTips = allTips.reduce((s, t) => s + Number(t.amount || 0), 0);
  const tipCount = allTips.length;
  const avgTip = tipCount > 0 ? totalTips / tipCount : 0;

  // Aggregate by crew
  const crewMap: Record<string, { name: string; total: number; count: number; highest: number }> = {};
  for (const t of allTips) {
    const key = t.crew_id || "unknown";
    if (!crewMap[key]) {
      crewMap[key] = { name: t.crew_name || "Unknown", total: 0, count: 0, highest: 0 };
    }
    const net = Number(t.net_amount ?? t.amount ?? 0);
    crewMap[key]!.total += net;
    crewMap[key]!.count += 1;
    if (net > crewMap[key]!.highest) crewMap[key]!.highest = net;
  }

  const crewAllocations = Object.entries(crewMap)
    .map(([id, v]) => ({ id, ...v, avg: v.count > 0 ? v.total / v.count : 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <TipsClient
      tips={allTips.slice(0, 100)}
      totalTips={totalTips}
      avgTip={avgTip}
      tipCount={tipCount}
      crewAllocations={crewAllocations}
    />
  );
}
