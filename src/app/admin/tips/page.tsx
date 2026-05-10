export const metadata = { title: "Tips" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import TipsClient from "./TipsClient";

export default async function TipsPage() {
  const db = createAdminClient();
  const { data: tips, error: tipsErr } = await db
    .from("tips")
    .select(
      "id, move_id, delivery_id, job_type, method, service_type, tier, neighbourhood, crew_id, crew_name, client_name, amount, processing_fee, net_amount, charged_at, moves(move_code, service_type, is_pm_move, tenant_name, client_name), deliveries(delivery_number, delivery_type, vertical_code)",
    )
    .order("charged_at", { ascending: false })
    .limit(200);
  if (tipsErr) {
    console.error("[tips/page] Query failed:", tipsErr.message);
  }

  const allTips = (tips || []).map((row) => {
    const m = row.moves as {
      move_code?: string | null;
      service_type?: string | null;
      is_pm_move?: boolean | null;
      tenant_name?: string | null;
      client_name?: string | null;
    } | null | undefined;
    const del = row.deliveries as { delivery_number?: string | null; delivery_type?: string | null; vertical_code?: string | null } | null | undefined;
    const delServiceType =
      (del?.delivery_type && String(del.delivery_type).trim()) ||
      (del?.vertical_code && String(del.vertical_code).trim()) ||
      null;
    const { moves: _m, deliveries: _d, ...rest } = row as typeof row & {
      moves?: unknown;
      deliveries?: unknown;
    };

    // Resolve service_type: prefer tip row value, fall back to joined move/delivery
    const resolvedServiceType =
      (rest.service_type && String(rest.service_type).trim()) ||
      (m?.service_type && String(m.service_type).trim()) ||
      delServiceType ||
      null;

    // For PM moves, override b2b_oneoff service_type to "pm_move"
    const effectiveServiceType =
      m?.is_pm_move && resolvedServiceType
        ? "pm_move"
        : resolvedServiceType;

    // Resolve client_name: for PM moves the displayable name lives on the linked move's
    // tenant_name (preferred) or falls back to the move's client_name.
    const pmDisplayName =
      m?.is_pm_move
        ? (m.tenant_name && m.tenant_name.trim()) ||
          (m.client_name && m.client_name.trim()) ||
          null
        : null;
    const resolvedClientName = pmDisplayName || rest.client_name;

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
