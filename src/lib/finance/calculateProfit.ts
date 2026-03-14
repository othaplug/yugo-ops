export interface MoveCosts {
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  processing: number;
  totalDirect: number;
  allocatedOverhead: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

function cfg(config: Record<string, string>, key: string, fallback = 0): number {
  return parseFloat(config[key] ?? "") || fallback;
}

export function calculateMoveProfitability(
  move: {
    actual_hours?: number | null;
    est_hours?: number | null;
    actual_crew_count?: number | null;
    est_crew_size?: number | null;
    crew_count?: number | null;
    distance_km?: number | null;
    truck_primary?: string | null;
    truck_secondary?: string | null;
    move_size?: string | null;
    service_type?: string | null;
    final_amount?: number | null;
    estimate?: number | null;
    tip_amount?: number | null;
  },
  config: Record<string, string>,
  monthlyMoveCount: number,
): MoveCosts {
  const hours = Number(move.actual_hours ?? move.est_hours ?? 4) || 4;
  const crewSize = Number(move.actual_crew_count ?? move.est_crew_size ?? move.crew_count ?? 2) || 2;
  const labour = crewSize * hours * cfg(config, "crew_hourly_cost", 25);

  const distanceKm = Number(move.distance_km ?? 5) || 5;
  const fuel = distanceKm * 2 * cfg(config, "fuel_cost_per_km", 0.35);

  const truckType = move.truck_primary ?? "sprinter";
  const truckCost = cfg(config, `truck_daily_cost_${truckType}`, 90);
  const truck2Cost = move.truck_secondary
    ? cfg(config, `truck_daily_cost_${move.truck_secondary}`, 0)
    : 0;
  const truck = truckCost + truck2Cost;

  const svc = move.service_type ?? "local_move";
  let suppliesKey = `supplies_cost_${move.move_size ?? "studio"}`;
  if (svc === "office_move") suppliesKey = "supplies_cost_office";
  else if (svc === "single_item") suppliesKey = "supplies_cost_single_item";
  const supplies = cfg(config, suppliesKey, 30);

  const revenue = Number(move.final_amount ?? move.estimate ?? 0) || 0;
  const processing =
    revenue * cfg(config, "payment_processing_pct", 0.029) +
    cfg(config, "payment_processing_flat", 0.3);

  const totalDirect = labour + fuel + truck + supplies + processing;

  const monthlyOverhead =
    cfg(config, "monthly_software_cost", 250) +
    cfg(config, "monthly_auto_insurance", 1000) +
    cfg(config, "monthly_gl_insurance", 300) +
    cfg(config, "monthly_marketing_budget", 1000) +
    cfg(config, "monthly_office_admin", 350) +
    cfg(config, "monthly_owner_draw", 0);
  const allocatedOverhead = monthlyMoveCount > 0 ? monthlyOverhead / monthlyMoveCount : monthlyOverhead;

  const grossProfit = revenue - totalDirect;
  const netProfit = grossProfit - allocatedOverhead;
  const grossMargin = revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0;
  const netMargin = revenue > 0 ? Math.round(((netProfit / revenue) * 100) * 10) / 10 : 0;

  return {
    labour: Math.round(labour),
    fuel: Math.round(fuel * 100) / 100,
    truck,
    supplies,
    processing: Math.round(processing * 100) / 100,
    totalDirect: Math.round(totalDirect),
    allocatedOverhead: Math.round(allocatedOverhead),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    grossMargin,
    netMargin,
  };
}

export function getMonthlyOverhead(config: Record<string, string>): number {
  return (
    cfg(config, "monthly_software_cost", 250) +
    cfg(config, "monthly_auto_insurance", 1000) +
    cfg(config, "monthly_gl_insurance", 300) +
    cfg(config, "monthly_marketing_budget", 1000) +
    cfg(config, "monthly_office_admin", 350) +
    cfg(config, "monthly_owner_draw", 0)
  );
}
