import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import {
  calculateMoveProfitability,
  calculateDeliveryProfitability,
  getMonthlyOverhead,
  getDailyOverheadBurn,
  movePaysCardProcessingFee,
  deliveryPaysCardProcessingFee,
} from "@/lib/finance/calculateProfit";
import { sessionJobDurationMinutes } from "@/lib/crew/session-job-duration-minutes";
import { getAppTimezone } from "@/lib/business-timezone";

/**
 * Profitability = cost/profit analysis, NOT revenue.
 * Tracks: labour (actual/est hours × crew), truck, fuel (distance-based), supplies.
 * Card processing is shown only when the client paid by card; it is a pass-through (not subtracted from margin).
 * Monthly overhead is not allocated per job; see overhead.total for company-wide reference.
 */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const singleMoveId = req.nextUrl.searchParams.get("move_id");
  const tz = getAppTimezone();

  // Single-move short-circuit: bypass the date-range queries and recompute on
  // demand using the latest tracking session for this move. Drives the move
  // detail Money tab so its margin always matches the moves list even when
  // the session was completed after the user first loaded the page.
  if (singleMoveId) {
    const sb = createAdminClient();
    const [{ data: move }, { data: sessions }, { data: configRows }, { data: ovRow }] = await Promise.all([
      sb.from("moves").select("*").eq("id", singleMoveId).maybeSingle(),
      sb.from("tracking_sessions").select("started_at, completed_at, updated_at, status, checkpoints")
        .eq("job_id", singleMoveId).eq("job_type", "move").eq("status", "completed")
        .order("updated_at", { ascending: false }).limit(1),
      sb.from("platform_config").select("key, value"),
      sb.from("move_cost_overrides").select("*").eq("move_id", singleMoveId).maybeSingle(),
    ]);
    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    const cfg: Record<string, string> = {};
    for (const r of configRows ?? []) cfg[r.key] = r.value;
    let trackedHours: number | null = null;
    if (sessions && sessions[0]) {
      // Per-business-day worked hours so a multi-day office session excludes the
      // overnight gap between days (matches the moves list).
      const h = Math.round((sessionJobDurationMinutes(sessions[0], tz) / 60) * 100) / 100;
      if (h > 0) trackedHours = h;
    }
    const m = move as Record<string, unknown> & { id: string };
    const moveCostInput = {
      estimate: Number((m as { final_amount?: number; total_price?: number; estimate?: number; amount?: number }).final_amount ?? (m as { total_price?: number }).total_price ?? (m as { estimate?: number }).estimate ?? (m as { amount?: number }).amount ?? 0) || 0,
      actual_hours: trackedHours ?? (m as { actual_hours?: number | null }).actual_hours ?? null,
      est_hours: (m as { est_hours?: number | null }).est_hours ?? null,
      est_crew_size: (m as { est_crew_size?: number | null }).est_crew_size ?? null,
      estimated_duration_minutes: (m as { estimated_duration_minutes?: number | null }).estimated_duration_minutes ?? null,
      distance_km: (m as { distance_km?: number | null }).distance_km ?? null,
      truck_primary: (m as { truck_primary?: string | null }).truck_primary ?? null,
      truck_secondary: (m as { truck_secondary?: string | null }).truck_secondary ?? null,
      move_size: (m as { move_size?: string | null }).move_size ?? null,
      service_type: (m as { service_type?: string | null }).service_type ?? null,
      balance_method: (m as { balance_method?: string | null }).balance_method ?? null,
      deposit_method: (m as { deposit_method?: string | null }).deposit_method ?? null,
      actual_labour_cost: (m as { actual_labour_cost?: number | null }).actual_labour_cost ?? null,
      actual_fuel_cost: (m as { actual_fuel_cost?: number | null }).actual_fuel_cost ?? null,
      actual_truck_cost: (m as { actual_truck_cost?: number | null }).actual_truck_cost ?? null,
      actual_supplies_cost: (m as { actual_supplies_cost?: number | null }).actual_supplies_cost ?? null,
    };
    let costs = calculateMoveProfitability(moveCostInput, cfg, 1);
    const ov = ovRow as { labour?: number | null; fuel?: number | null; truck?: number | null; supplies?: number | null; processing?: number | null } | null;
    if (ov) {
      const labour = ov.labour != null ? ov.labour : costs.labour;
      const fuel = ov.fuel != null ? ov.fuel : costs.fuel;
      const truck = ov.truck != null ? ov.truck : costs.truck;
      const supplies = ov.supplies != null ? ov.supplies : costs.supplies;
      const processing = ov.processing != null ? ov.processing : costs.processing;
      const totalDirect = labour + fuel + truck + supplies;
      const grossProfit = moveCostInput.estimate - totalDirect;
      costs = {
        ...costs,
        labour: Math.round(labour),
        fuel: Math.round(fuel * 100) / 100,
        truck,
        supplies,
        processing: Math.round(processing * 100) / 100,
        totalDirect: Math.round(totalDirect),
        grossProfit: Math.round(grossProfit),
        grossMargin: moveCostInput.estimate > 0 ? Math.round(((grossProfit / moveCostInput.estimate) * 100) * 10) / 10 : 0,
      };
    }
    const paid_with_card = movePaysCardProcessingFee({
      balance_method: moveCostInput.balance_method,
      deposit_method: moveCostInput.deposit_method,
    });
    return NextResponse.json({
      rows: [{
        id: m.id,
        jobKind: "move" as const,
        move_code: (m as { move_code?: string | null }).move_code ?? null,
        revenue: moveCostInput.estimate,
        actual_hours: trackedHours ?? (m as { actual_hours?: number | null }).actual_hours ?? null,
        est_hours: moveCostInput.est_hours,
        hasOverride: !!ov,
        paid_with_card,
        ...costs,
      }],
      summary: { targetMargin: 40 },
    });
  }

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
  const sessionSelect = "job_id, job_type, status, started_at, completed_at, updated_at, checkpoints";
  const [sessionsByCompleted, sessionsByStarted] = await Promise.all([
    sb.from("tracking_sessions").select(sessionSelect).eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`)
      .lte("completed_at", `${toDate}T23:59:59.999Z`),
    sb.from("tracking_sessions").select(sessionSelect).eq("status", "completed")
      .is("completed_at", null)
      .gte("started_at", `${fromDate}T00:00:00Z`)
      .lte("started_at", `${toDate}T23:59:59.999Z`),
  ]);
  const allSessions = [...(sessionsByCompleted.data ?? []), ...(sessionsByStarted.data ?? [])];
  const sessionMoveIds = [...new Set(allSessions.filter((s) => s.job_type === "move").map((s) => s.job_id))];
  const sessionDeliveryIds = [...new Set(allSessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id))];

  // Build a map of job_id → tracked hours from live session data. Uses
  // sessionJobDurationMinutes, which sums per-business-day work spans so a
  // multi-day office/project session doesn't count the overnight gap between
  // days (that inflated MV-30348 to 36.9h vs the real ~26h worked).
  const sessionHoursMap: Record<string, number> = {};
  for (const s of allSessions) {
    if (!s.job_id || !s.started_at) continue;
    const hours = Math.round((sessionJobDurationMinutes(s, tz) / 60) * 100) / 100;
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
    // Mirror the same pre-tax price ladder used for revenue below so a
    // delivery priced via override_price / final_price isn't accidentally
    // dropped from the profitability roll-up.
    const billed = Number(
      d.override_price ??
        d.final_price ??
        d.admin_adjusted_price ??
        d.total_price ??
        d.calculated_price ??
        d.quoted_price ??
        0,
    );
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

  const SHARE_DAY_STATUSES = new Set([
    "completed",
    "in_progress",
    "delivered",
    "done",
    "paid",
  ]);

  const scheduledDayKey = (row: { scheduled_date?: string | null }): string | null => {
    const raw = row.scheduled_date;
    if (raw == null) return null;
    const s = String(raw).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  const uniqueScheduledDays = new Set<string>();
  for (const m of completedMoves) {
    const d = scheduledDayKey(m);
    if (d) uniqueScheduledDays.add(d);
  }
  for (const d of completedDeliveries) {
    const day = scheduledDayKey(d);
    if (day) uniqueScheduledDays.add(day);
  }

  let jobsOnScheduledDay: Record<string, number> = {};
  if (uniqueScheduledDays.size > 0) {
    const sorted = [...uniqueScheduledDays].sort();
    const minDay = sorted[0]!;
    const maxDay = sorted[sorted.length - 1]!;
    const [{ data: moveDays }, { data: delivDays }] = await Promise.all([
      sb
        .from("moves")
        .select("scheduled_date, status")
        .gte("scheduled_date", minDay)
        .lte("scheduled_date", maxDay),
      sb
        .from("deliveries")
        .select("scheduled_date, status")
        .gte("scheduled_date", minDay)
        .lte("scheduled_date", maxDay),
    ]);
    for (const r of [...(moveDays ?? []), ...(delivDays ?? [])]) {
      const day = scheduledDayKey(r as { scheduled_date?: string | null });
      if (!day) continue;
      const st = String((r as { status?: string | null }).status ?? "").toLowerCase();
      if (!SHARE_DAY_STATUSES.has(st)) continue;
      jobsOnScheduledDay[day] = (jobsOnScheduledDay[day] ?? 0) + 1;
    }
  }

  const totalJobCount = completedMoves.length + completedDeliveries.length;
  const monthlyMoveCount = totalJobCount || 1;
  const targetMargin = parseFloat(config.target_gross_margin_pct ?? "40");
  // Daily overhead burn for per-row allocation. Computed once and passed
  // through so every row uses the same number. NB: deliberately uses the
  // CURRENT config snapshot — historical re-cost would require storing the
  // daily burn at completion time. For Phase 1 we accept the small drift.
  const dailyBurnForRows = getDailyOverheadBurn(config);
  const claimsReservePctForOverrides = parseFloat(
    config.overhead_claims_reserve_pct ?? "0.005",
  ) || 0;

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
      estimate: Number(m.final_amount ?? m.total_price ?? m.estimate ?? m.amount ?? 0) || 0,
      actual_hours: trackedHours ?? null,
      est_hours: m.est_hours ?? m.quoted_hours ?? null,
      est_crew_size: m.est_crew_size ?? m.crew_size ?? null,
      estimated_duration_minutes: m.estimated_duration_minutes ?? null,
      distance_km: m.distance_km ?? null,
      truck_primary: m.truck_primary ?? null,
      truck_secondary: m.truck_secondary ?? null,
      move_size: m.move_size ?? null,
      service_type: m.service_type ?? null,
      // Payment method determines whether processing fee applies
      balance_method: m.balance_method ?? null,
      deposit_method: m.deposit_method ?? null,
      // Actual-cost snapshot recorded at completion — preferred over derivation.
      actual_labour_cost: m.actual_labour_cost ?? null,
      actual_fuel_cost: m.actual_fuel_cost ?? null,
      actual_truck_cost: m.actual_truck_cost ?? null,
      actual_supplies_cost: m.actual_supplies_cost ?? null,
    };
    const revenue = moveCostInput.estimate;
    const dayStr = scheduledDayKey(m);
    const jobsOnSameDay = dayStr ? (jobsOnScheduledDay[dayStr] ?? 1) : 1;
    let costs = calculateMoveProfitability(moveCostInput, config, monthlyMoveCount, {
      jobsOnSameDay,
      dailyOverheadBurn: dailyBurnForRows,
    });
    // Apply per-job overrides (only override fields that were explicitly set)
    const ov = costOverridesMap[m.id];
    if (ov) {
      const labour = ov.labour != null ? ov.labour : costs.labour;
      const fuel = ov.fuel != null ? ov.fuel : costs.fuel;
      const truck = ov.truck != null ? ov.truck : costs.truck;
      const supplies = ov.supplies != null ? ov.supplies : costs.supplies;
      const processing = ov.processing != null ? ov.processing : costs.processing;
      const totalDirect = labour + fuel + truck + supplies;
      const grossProfit = revenue - totalDirect;
      // Override path: still subtract OH share + claims reserve so the override
      // doesn't accidentally inflate margin past true contribution.
      const ohShareOv = dailyBurnForRows > 0 ? dailyBurnForRows / Math.max(1, jobsOnSameDay) : 0;
      const claimsReserveOv = Math.round(revenue * claimsReservePctForOverrides * 100) / 100;
      const netProfit = grossProfit - ohShareOv - claimsReserveOv;
      costs = {
        ...costs,
        labour: Math.round(labour),
        fuel: Math.round(fuel * 100) / 100,
        truck,
        supplies,
        processing: Math.round(processing * 100) / 100,
        totalDirect: Math.round(totalDirect),
        allocatedOverhead: Math.round(ohShareOv),
        claimsReserve: claimsReserveOv,
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
      paid_with_card: movePaysCardProcessingFee({
        balance_method: m.balance_method ?? null,
        deposit_method: m.deposit_method ?? null,
      }),
      jobs_on_same_day: jobsOnSameDay,
      ...costs,
    };
  });

  const deliveryRows = completedDeliveries.map((d) => {
    const trackedHoursD = sessionHoursMap[d.id] ?? null;
    // Revenue MUST be pre-tax — HST is remitted to CRA, not kept as
    // revenue — otherwise every margin is inflated by ~13% and stops
    // reflecting actual profitability.
    //
    // Ordering:
    //   1. Delivery's stored pre-tax prices (operator-controlled, always
    //      excluding HST by design): override_price > final_price >
    //      admin_adjusted_price > total_price > calculated_price >
    //      quoted_price.
    //   2. Square invoice amount as a last resort. NB: Square stores
    //      HST-inclusive totals, so this branch is a fallback for
    //      deliveries with no on-row price. We prefer never to hit it —
    //      that's why every price-carrying field wins first.
    const preTax = Number(
      d.override_price ??
        d.final_price ??
        d.admin_adjusted_price ??
        d.total_price ??
        d.calculated_price ??
        d.quoted_price ??
        0,
    );
    const revenue = preTax > 0 ? preTax : (invoiceBilledByDelivery[d.id] ?? 0);
    // Inject tracked hours so calculateDeliveryProfitability uses them
    const dDay = scheduledDayKey(d as { scheduled_date?: string | null });
    const dJobsOnSameDay = dDay ? (jobsOnScheduledDay[dDay] ?? 1) : 1;
    let costs = calculateDeliveryProfitability(
      { ...d, actual_hours: trackedHoursD ?? d.actual_hours ?? null },
      revenue,
      config,
      monthlyMoveCount,
      { jobsOnSameDay: dJobsOnSameDay, dailyOverheadBurn: dailyBurnForRows },
    );
    // Apply per-job overrides
    const ov = costOverridesMap[d.id];
    if (ov) {
      const labour = ov.labour != null ? ov.labour : costs.labour;
      const fuel = ov.fuel != null ? ov.fuel : costs.fuel;
      const truck = ov.truck != null ? ov.truck : costs.truck;
      const supplies = ov.supplies != null ? ov.supplies : costs.supplies;
      const processing = ov.processing != null ? ov.processing : costs.processing;
      const totalDirect = labour + fuel + truck + supplies;
      const grossProfit = revenue - totalDirect;
      const ohShareOv = dailyBurnForRows > 0 ? dailyBurnForRows / Math.max(1, dJobsOnSameDay) : 0;
      const claimsReserveOv = Math.round(revenue * claimsReservePctForOverrides * 100) / 100;
      const netProfit = grossProfit - ohShareOv - claimsReserveOv;
      costs = {
        ...costs,
        labour: Math.round(labour),
        fuel: Math.round(fuel * 100) / 100,
        truck,
        supplies,
        processing: Math.round(processing * 100) / 100,
        totalDirect: Math.round(totalDirect),
        allocatedOverhead: Math.round(ohShareOv),
        claimsReserve: claimsReserveOv,
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
      paid_with_card: deliveryPaysCardProcessingFee({
        payment_method: d.payment_method ?? null,
        balance_method: d.balance_method ?? null,
      }),
      jobs_on_same_day: dJobsOnSameDay,
      ...costs,
    };
  });

  const rows = [...moveRows, ...deliveryRows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalDirectCost = rows.reduce((s, r) => s + r.totalDirect, 0);
  const totalGrossProfit = totalRevenue - totalDirectCost;
  const avgGrossMargin = totalRevenue > 0 ? Math.round(((totalGrossProfit / totalRevenue) * 100) * 10) / 10 : 0;
  // True totals sum each row's allocated OH share + claims reserve. With
  // per-row OH allocation now live, net != gross.
  const totalAllocatedOh = rows.reduce((s, r) => s + (r.allocatedOverhead ?? 0), 0);
  const totalClaimsReserve = rows.reduce((s, r) => s + (r.claimsReserve ?? 0), 0);
  const totalNetProfit = totalGrossProfit - totalAllocatedOh - totalClaimsReserve;
  const avgNetMargin = totalRevenue > 0
    ? Math.round(((totalNetProfit / totalRevenue) * 100) * 10) / 10
    : 0;
  const avgProfitPerMove = rows.length > 0 ? Math.round(totalGrossProfit / rows.length) : 0;
  const lowMarginCount = rows.filter((r) => r.grossMargin < 25).length;

  const overhead = getMonthlyOverhead(config);
  const dailyBurn = getDailyOverheadBurn(config);
  const workingDays = parseFloat(config.truck_working_days_per_month ?? "22") || 22;
  const avgRevenue = rows.length > 0 ? totalRevenue / rows.length : 0;
  const avgDirectPerJob = rows.length > 0 ? totalDirectCost / rows.length : 0;
  const avgGrossProfitPerJob = avgRevenue - avgDirectPerJob;
  const breakEven = avgGrossProfitPerJob > 0
    ? Math.ceil(overhead / avgGrossProfitPerJob)
    : 0;

  return NextResponse.json({
    rows,
    summary: {
      avgGrossMargin, avgNetMargin, avgProfitPerMove, lowMarginCount,
      totalRevenue, totalDirectCost, totalGrossProfit, totalNetProfit,
      totalAllocatedOh: Math.round(totalAllocatedOh),
      totalClaimsReserve: Math.round(totalClaimsReserve * 100) / 100,
      moveCount: rows.length, targetMargin,
    },
    overhead: {
      total: overhead,
      // perDay = monthly ÷ working days. The headline number under Model A.
      // perMove retained for backward-compat but downgraded to "if you spread
      // the same OH evenly across this window's completed jobs" — not the
      // figure operators should anchor on.
      perDay: dailyBurn,
      perMove: rows.length > 0 ? Math.round(overhead / rows.length) : overhead,
      workingDays,
      breakEven,
      items: {
        software: parseFloat(config.monthly_software_cost ?? "250"),
        autoInsurance: parseFloat(config.monthly_auto_insurance ?? "1000"),
        glInsurance: parseFloat(config.monthly_gl_insurance ?? "300"),
        wsib: parseFloat(config.monthly_wsib ?? "0"),
        moversLiability: parseFloat(config.monthly_movers_liability ?? "0"),
        marketing: parseFloat(config.monthly_marketing_budget ?? "1000"),
        officeAdmin: parseFloat(config.monthly_office_admin ?? "350"),
        bookkeeping: parseFloat(config.monthly_bookkeeping ?? "0"),
        phoneInternet: parseFloat(config.monthly_phone_internet ?? "0"),
        vehicleMaintenance: parseFloat(config.monthly_vehicle_maintenance ?? "0"),
        ownerDraw: parseFloat(config.monthly_owner_draw ?? "0"),
      },
      claimsReservePct: parseFloat(config.overhead_claims_reserve_pct ?? "0.005"),
    },
  });
}
