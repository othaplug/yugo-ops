/**
 * Labour pay estimates for Reports → Crew pay tab.
 * Aligns with profitability modelling: crew × hours × platform crew_hourly_cost,
 * or stored moves.actual_labour_cost when present.
 */

export type MoveLabourRow = {
  actual_labour_cost?: number | null;
  actual_hours?: number | null;
  est_hours?: number | null;
  actual_crew_count?: number | null;
  est_crew_size?: number | null;
  crew_count?: number | null;
};

export type DeliveryLabourRow = {
  actual_hours?: number | null;
  actual_crew_count?: number | null;
  booking_type?: string | null;
};

export function labourCostForMove(m: MoveLabourRow, crewHourly: number): number {
  const stored = Number(m.actual_labour_cost);
  if (Number.isFinite(stored) && stored > 0) {
    return Math.round(stored * 100) / 100;
  }
  const hours = Number(m.actual_hours ?? m.est_hours ?? 4) || 4;
  const crew = Number(m.actual_crew_count ?? m.est_crew_size ?? m.crew_count ?? 2) || 2;
  return Math.round(crew * hours * crewHourly * 100) / 100;
}

export function labourCostForDelivery(d: DeliveryLabourRow, crewHourly: number): number {
  const isDayRate = (d.booking_type || "").toLowerCase() === "day_rate";
  const defaultHours = isDayRate ? 8 : 4;
  const hours = Number(d.actual_hours ?? defaultHours) || defaultHours;
  const crew = Number(d.actual_crew_count ?? 2) || 2;
  return Math.round(crew * hours * crewHourly * 100) / 100;
}
