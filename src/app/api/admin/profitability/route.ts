import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { calculateMoveProfitability, calculateDeliveryProfitability, getMonthlyOverhead } from "@/lib/finance/calculateProfit";

/**
 * Profitability = cost/profit analysis, NOT revenue.
 * Tracks: labour (actual/est hours × crew), truck, fuel (distance-based), processing.
 * Supplies = $0 for deliveries. For moves, based on size from platform_config.
 * Profit = billed amount − direct costs.
 */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to params required" }, { status: 400 });
  }

  const sb = createAdminClient();
  const performedMoveStatuses = new Set(["completed", "delivered", "done", "paid"]);
  const performedDeliveryStatuses = new Set(["completed", "delivered", "done"]);
  const cancelledStatuses = new Set(["cancelled", "rejected", "draft", "pending_approval", "pending"]);
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);

  // Completed tracking sessions in range — source of truth aligned with Crew Analytics
  const [sessionsByCompleted, sessionsByStarted] = await Promise.all([
    sb.from("tracking_sessions").select("job_id, job_type, started_at, completed_at").eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`)
      .lte("completed_at", `${toDate}T23:59:59.999Z`),
    sb.from("tracking_sessions").select("job_id, job_type, started_at, completed_at").eq("status", "completed")
      .is("completed_at", null)
      .gte("started_at", `${fromDate}T00:00:00Z`)
      .lte("started_at", `${toDate}T23:59:59.999Z`),
  ]);
  const allSessions = [...(sessionsByCompleted.data ?? []), ...(sessionsByStarted.data ?? [])];
  const sessionMoveIds = [...new Set(allSessions.filter((s) => s.job_type === "move").map((s) => s.job_id))];
  const sessionDeliveryIds = [...new Set(allSessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id))];

  // Build a map of job_id → tracked hours from live session data (most recent completed session per job)
  const sessionHoursMap: Record<string, number> = {};
  for (const s of allSessions) {
    if (!s.job_id || !s.started_at) continue;
    const start = new Date(s.started_at as string).getTime();
    const end = s.completed_at ? new Date(s.completed_at as string).getTime() : Date.now();
    const hours = Math.round(((end - start) / 3_600_000) * 100) / 100;
    if (hours > 0) sessionHoursMap[s.job_id] = hours;
  }

  // select("*") — never fails on missing/renamed columns
  const [
    { data: movesByScheduled },
    { data: movesByCompletedAt },
    { data: movesPaid },
    { data: movesByTracking },
    { data: deliveriesByScheduled },
    { data: deliveriesByCompletedAt },
    { data: deliveriesByTracking },
    { data: configRows },
  ] = await Promise.all([
    sb.from("moves").select("*").gte("scheduled_date", fromDate).lte("scheduled_date", toDate).order("scheduled_date", { ascending: false }),
    sb.from("moves").select("*").not("completed_at", "is", null).gte("completed_at", `${fromDate}T00:00:00Z`).lte("completed_at", `${toDate}T23:59:59.999Z`).order("completed_at", { ascending: false }),
    sb.from("moves").select("*").eq("payment_marked_paid", true).not("payment_marked_paid_at", "is", null).gte("payment_marked_paid_at", `${fromDate}T00:00:00Z`).lte("payment_marked_paid_at", `${toDate}T23:59:59.999Z`).order("payment_marked_paid_at", { ascending: false }),
    sessionMoveIds.length > 0 ? sb.from("moves").select("*").in("id", sessionMoveIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sb.from("deliveries").select("*").gte("scheduled_date", fromDate).lte("scheduled_date", toDate).order("scheduled_date", { ascending: false }),
    sb.from("deliveries").select("*").not("completed_at", "is", null).gte("completed_at", `${fromDate}T00:00:00Z`).lte("completed_at", `${toDate}T23:59:59.999Z`).order("completed_at", { ascending: false }),
    sessionDeliveryIds.length > 0 ? sb.from("deliveries").select("*").in("id", sessionDeliveryIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    sb.from("platform_config").select("key, value"),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyRow = Record<string, any>;

  const trackingMoveIds = new Set(sessionMoveIds);
  const trackingDeliveryIds = new Set(sessionDeliveryIds);

  const seenMoves = new Set<string>();
  const mergedMoves: AnyRow[] = [];
  for (const m of [...(movesByScheduled ?? []), ...(movesByCompletedAt ?? []), ...(movesPaid ?? []), ...(movesByTracking ?? [])]) {
    if (m?.id && !seenMoves.has(m.id as string)) { seenMoves.add(m.id as string); mergedMoves.push(m as AnyRow); }
  }

  const seenDeliveries = new Set<string>();
  const mergedDeliveries: AnyRow[] = [];
  for (const d of [...(deliveriesByScheduled ?? []), ...(deliveriesByCompletedAt ?? []), ...(deliveriesByTracking ?? [])]) {
    if (d?.id && !seenDeliveries.has(d.id as string)) { seenDeliveries.add(d.id as string); mergedDeliveries.push(d as AnyRow); }
  }

  const completedMoves = mergedMoves.filter((m) =>
    trackingMoveIds.has(m.id) || m.payment_marked_paid === true || performedMoveStatuses.has((m.status || "").toLowerCase())
  );
  const completedDeliveries = mergedDeliveries.filter((d) => {
    if (trackingDeliveryIds.has(d.id)) return true;
    const status = (d.status || "").toLowerCase();
    if (cancelledStatuses.has(status)) return false;
    const billed = Number(d.admin_adjusted_price ?? d.total_price ?? d.quoted_price ?? 0);
    return performedDeliveryStatuses.has(status) && billed > 0;
  });

  // Invoice amounts for deliveries
  const deliveryIds = completedDeliveries.map((d) => d.id);
  const invoiceBilledByDelivery: Record<string, number> = {};
  if (deliveryIds.length > 0) {
    const { data: invs } = await sb.from("invoices").select("delivery_id, amount").in("delivery_id", deliveryIds).not("amount", "is", null);
    for (const inv of invs ?? []) {
      if (inv.delivery_id) invoiceBilledByDelivery[inv.delivery_id] = (invoiceBilledByDelivery[inv.delivery_id] || 0) + Number(inv.amount || 0);
    }
  }

  // Per-job cost overrides
  const allJobIds = [...completedMoves.map((m) => m.id), ...completedDeliveries.map((d) => d.id)];
  const costOverridesMap: Record<string, Record<string, number | null>> = {};
  if (allJobIds.length > 0) {
    const { data: overrideRows } = await sb
      .from("job_cost_overrides")
      .select("job_id, labour, fuel, truck, supplies, processing")
      .in("job_id", allJobIds);
    for (const ov of overrideRows ?? []) {
      costOverridesMap[ov.job_id] = ov;
    }
  }

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  const totalJobCount = completedMoves.length + completedDeliveries.length;
  const monthlyMoveCount = totalJobCount || 1;
  const targetMargin = parseFloat(config.target_gross_margin_pct ?? "40");

  /** Extract FSA (first 3 chars of Canadian postal code) from an address string */
  function extractFSA(addr: string | null | undefined): string | null {
    if (!addr) return null;
    const m = String(addr).match(/([A-Za-z]\d[A-Za-z])\s*\d[A-Za-z]\d/);
    if (m) return m[1].toUpperCase();
    // Also accept raw 6-char postal without space
    const m2 = String(addr).match(/\b([A-Za-z]\d[A-Za-z])\b/);
    return m2 ? m2[1].toUpperCase() : null;
  }

  const moveRows = completedMoves.map((m) => {
    // Prefer live session hours → stored actual_hours → est_hours
    const trackedHours = sessionHoursMap[m.id] ?? null;
    const moveCostInput = {
      estimate: Number(m.estimate ?? m.amount ?? 0) || 0,
      actual_hours: trackedHours ?? m.actual_hours ?? null,
      est_hours: m.est_hours ?? m.quoted_hours ?? null,
      actual_crew_count: m.actual_crew_count ?? null,
      est_crew_size: m.est_crew_size ?? m.crew_size ?? null,
      distance_km: m.distance_km ?? null,
      truck_primary: m.truck_primary ?? null,
      truck_secondary: m.truck_secondary ?? null,
      move_size: m.move_size ?? null,
      service_type: m.service_type ?? null,
      // Payment method determines whether processing fee applies
      balance_method: m.balance_method ?? null,
      deposit_method: m.deposit_method ?? null,
    };
    const revenue = moveCostInput.estimate;
    let costs = calculateMoveProfitability(moveCostInput, config, monthlyMoveCount);
    // Apply per-job overrides (only override fields that were explicitly set)
    const ov = costOverridesMap[m.id];
    if (ov) {
      const labour  = ov.labour   != null ? ov.labour   : costs.labour;
      const fuel    = ov.fuel     != null ? ov.fuel     : costs.fuel;
      const truck   = ov.truck    != null ? ov.truck    : costs.truck;
      const supplies = ov.supplies != null ? ov.supplies : costs.supplies;
      const processing = ov.processing != null ? ov.processing : costs.processing;
      const totalDirect = labour + fuel + truck + supplies + processing;
      const grossProfit = revenue - totalDirect;
      const netProfit = grossProfit - costs.allocatedOverhead;
      costs = {
        ...costs,
        labour: Math.round(labour),
        fuel: Math.round(fuel * 100) / 100,
        truck,
        supplies,
        processing: Math.round(processing * 100) / 100,
        totalDirect: Math.round(totalDirect),
        grossProfit: Math.round(grossProfit),
        netProfit: Math.round(netProfit),
        grossMargin: revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0,
        netMargin: revenue > 0 ? Math.round(((netProfit / revenue) * 100) * 10) / 10 : 0,
      };
    }
    // Neighbourhood: prefer from_postal, fall back to extracting FSA from from_address
    const neighbourhood =
      (m.from_postal ? String(m.from_postal).substring(0, 3).toUpperCase() : null) ??
      extractFSA(m.from_address);
    return {
      id: m.id,
      jobKind: "move" as const,
      move_code: m.move_code,
      date: m.scheduled_date || (m.completed_at ? String(m.completed_at).slice(0, 10) : null),
      client: m.client_name,
      type: m.move_type || m.service_type || "local_move",
      tier: m.tier_selected ?? null,
      revenue,
      neighbourhood,
      actual_hours: trackedHours ?? m.actual_hours ?? null,
      est_hours: m.est_hours ?? m.quoted_hours ?? null,
      hasOverride: !!ov,
      ...costs,
    };
  });

  const deliveryRows = completedDeliveries.map((d) => {
    const trackedHoursD = sessionHoursMap[d.id] ?? null;
    const revenue = invoiceBilledByDelivery[d.id] ?? Number(d.admin_adjusted_price ?? d.total_price ?? d.quoted_price ?? 0);
    // Inject tracked hours so calculateDeliveryProfitability uses them
    let costs = calculateDeliveryProfitability({ ...d, actual_hours: trackedHoursD ?? d.actual_hours ?? null }, revenue, config, monthlyMoveCount);
    // Apply per-job overrides
    const ov = costOverridesMap[d.id];
    if (ov) {
      const labour  = ov.labour   != null ? ov.labour   : costs.labour;
      const fuel    = ov.fuel     != null ? ov.fuel     : costs.fuel;
      const truck   = ov.truck    != null ? ov.truck    : costs.truck;
      const supplies = ov.supplies != null ? ov.supplies : costs.supplies;
      const processing = ov.processing != null ? ov.processing : costs.processing;
      const totalDirect = labour + fuel + truck + supplies + processing;
      const grossProfit = revenue - totalDirect;
      const netProfit = grossProfit - costs.allocatedOverhead;
      costs = {
        ...costs,
        labour: Math.round(labour),
        fuel: Math.round(fuel * 100) / 100,
        truck,
        supplies,
        processing: Math.round(processing * 100) / 100,
        totalDirect: Math.round(totalDirect),
        grossProfit: Math.round(grossProfit),
        netProfit: Math.round(netProfit),
        grossMargin: revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0,
        netMargin: revenue > 0 ? Math.round(((netProfit / revenue) * 100) * 10) / 10 : 0,
      };
    }
    // Delivery type label key
    const rawType = d.delivery_type || d.category || (d.booking_type === "day_rate" ? "day_rate" : null) || "delivery";
    // Neighbourhood from pickup address FSA
    const neighbourhood = extractFSA(d.pickup_address) ?? extractFSA(d.from_address);
    return {
      id: d.id,
      jobKind: "delivery" as const,
      move_code: d.delivery_number,
      date: d.scheduled_date || (d.completed_at ? String(d.completed_at).slice(0, 10) : null),
      client: d.customer_name || d.client_name,
      type: rawType,
      tier: null,
      revenue,
      neighbourhood,
      actual_hours: trackedHoursD ?? d.actual_hours ?? null,
      hasOverride: !!ov,
      ...costs,
    };
  });

  const rows = [...moveRows, ...deliveryRows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalDirectCost = rows.reduce((s, r) => s + r.totalDirect, 0);
  const totalGrossProfit = totalRevenue - totalDirectCost;
  const avgGrossMargin = totalRevenue > 0 ? Math.round(((totalGrossProfit / totalRevenue) * 100) * 10) / 10 : 0;
  const totalOverhead = rows.reduce((s, r) => s + r.allocatedOverhead, 0);
  const totalNetProfit = totalGrossProfit - totalOverhead;
  const avgNetMargin = totalRevenue > 0 ? Math.round(((totalNetProfit / totalRevenue) * 100) * 10) / 10 : 0;
  const avgProfitPerMove = rows.length > 0 ? Math.round(totalGrossProfit / rows.length) : 0;
  const lowMarginCount = rows.filter((r) => r.grossMargin < 25).length;

  const overhead = getMonthlyOverhead(config);
  const avgRevenue = rows.length > 0 ? totalRevenue / rows.length : 0;
  const breakEven = avgRevenue > 0 ? Math.ceil(overhead / (avgRevenue - (totalDirectCost / (rows.length || 1)))) : 0;

  return NextResponse.json({
    rows,
    summary: {
      avgGrossMargin, avgNetMargin, avgProfitPerMove, lowMarginCount,
      totalRevenue, totalDirectCost, totalGrossProfit, totalNetProfit,
      moveCount: rows.length, targetMargin,
    },
    overhead: {
      total: overhead,
      perMove: rows.length > 0 ? Math.round(overhead / rows.length) : overhead,
      breakEven,
      items: {
        software: parseFloat(config.monthly_software_cost ?? "250"),
        autoInsurance: parseFloat(config.monthly_auto_insurance ?? "1000"),
        glInsurance: parseFloat(config.monthly_gl_insurance ?? "300"),
        marketing: parseFloat(config.monthly_marketing_budget ?? "1000"),
        officeAdmin: parseFloat(config.monthly_office_admin ?? "350"),
        ownerDraw: parseFloat(config.monthly_owner_draw ?? "0"),
      },
    },
  });
}
