export const metadata = { title: "Tips" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import TipsClient from "./TipsClient";

export default async function TipsPage() {
  const db = createAdminClient();
  const { data: tips } = await db
    .from("tips")
    .select(
      "id, move_id, delivery_id, job_type, method, service_type, tier, neighbourhood, crew_id, crew_name, client_name, amount, processing_fee, net_amount, charged_at, moves(move_code), deliveries(delivery_number)",
    )
    .order("charged_at", { ascending: false })
    .limit(200);

  const allTips = (tips || []).map((row) => {
    const m = row.moves as { move_code?: string | null } | null | undefined;
    const del = row.deliveries as { delivery_number?: string | null } | null | undefined;
    const { moves: _m, deliveries: _d, ...rest } = row as typeof row & {
      moves?: unknown;
      deliveries?: unknown;
    };
    return {
      ...rest,
      move_code: m?.move_code ?? null,
      delivery_number: del?.delivery_number ?? null,
    };
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

  const svcMap: Record<string, { count: number; total: number }> = {};
  for (const t of allTips) {
    const key =
      (t.service_type && String(t.service_type).trim()) || "Unspecified";
    if (!svcMap[key]) svcMap[key] = { count: 0, total: 0 };
    const net = Number(t.net_amount ?? t.amount ?? 0);
    svcMap[key]!.count += 1;
    svcMap[key]!.total += net;
  }
  const serviceTypeBreakdown = Object.entries(svcMap)
    .map(([label, v]) => ({
      label,
      count: v.count,
      total: v.total,
      avg: v.count > 0 ? v.total / v.count : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <TipsClient
      tips={allTips.slice(0, 100)}
      totalTips={totalTips}
      avgTip={avgTip}
      tipCount={tipCount}
      crewAllocations={crewAllocations}
      serviceTypeBreakdown={serviceTypeBreakdown}
    />
  );
}
