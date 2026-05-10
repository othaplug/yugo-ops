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
      "id, move_id, delivery_id, job_type, method, service_type, tier, neighbourhood, crew_id, crew_name, client_name, amount, processing_fee, net_amount, charged_at, moves(move_code, service_type, is_pm_move, first_name, last_name), deliveries(delivery_number, service_type)",
    )
    .order("charged_at", { ascending: false })
    .limit(200);

  const allTips = (tips || []).map((row) => {
    const m = row.moves as {
      move_code?: string | null;
      service_type?: string | null;
      is_pm_move?: boolean | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null | undefined;
    const del = row.deliveries as { delivery_number?: string | null; service_type?: string | null } | null | undefined;
    const { moves: _m, deliveries: _d, ...rest } = row as typeof row & {
      moves?: unknown;
      deliveries?: unknown;
    };

    // Resolve service_type: prefer tip row value, fall back to joined move/delivery
    const resolvedServiceType =
      (rest.service_type && String(rest.service_type).trim()) ||
      (m?.service_type && String(m.service_type).trim()) ||
      (del?.service_type && String(del.service_type).trim()) ||
      null;

    // For PM moves, override b2b_oneoff service_type to "pm_move"
    const effectiveServiceType =
      m?.is_pm_move && resolvedServiceType
        ? "pm_move"
        : resolvedServiceType;

    // Resolve client_name: for PM moves prefer first_name + last_name from linked move
    const tenantName =
      m?.is_pm_move && (m.first_name || m.last_name)
        ? [m.first_name, m.last_name].filter(Boolean).join(" ")
        : null;
    const resolvedClientName = tenantName || rest.client_name;

    return {
      ...rest,
      client_name: resolvedClientName,
      service_type: effectiveServiceType,
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
