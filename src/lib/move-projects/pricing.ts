import type { MoveProjectPayload } from "./schema";

export type MoveProjectPricingLine = { label: string; amount: number };

export function computeMoveProjectPricingPreview(
  payload: MoveProjectPayload,
  opts: { labourRatePerMoverHour: number; truckDayRate?: number; fuelFlat?: number },
): {
  labourSubtotal: number;
  truckSubtotal: number;
  fuel: number;
  totalCostEstimate: number;
  lines: MoveProjectPricingLine[];
} {
  const rate = Math.max(0, opts.labourRatePerMoverHour);
  const truckDay = Math.max(0, opts.truckDayRate ?? 0);
  const fuel = Math.max(0, opts.fuelFlat ?? 0);

  let labourSubtotal = 0;
  const lines: MoveProjectPricingLine[] = [];

  for (const ph of payload.phases) {
    let phaseLabour = 0;
    for (const d of ph.days) {
      const hrs = d.estimated_hours ?? 0;
      phaseLabour += d.crew_size * hrs * rate;
    }
    if (phaseLabour > 0) {
      labourSubtotal += phaseLabour;
      lines.push({
        label: `${ph.phase_name} (labour)`,
        amount: Math.round(phaseLabour * 100) / 100,
      });
    }
  }

  let truckSubtotal = 0;
  let truckDaySlots = 0;
  for (const ph of payload.phases) {
    for (const d of ph.days) {
      if (d.truck_type && truckDay > 0) {
        truckSubtotal += truckDay * (d.truck_count ?? 1);
        truckDaySlots += 1;
      }
    }
  }
  if (truckSubtotal > 0) {
    lines.push({
      label: `Trucks (${truckDaySlots} day${truckDaySlots === 1 ? "" : "s"})`,
      amount: Math.round(truckSubtotal * 100) / 100,
    });
  }

  if (fuel > 0) {
    lines.push({ label: "Fuel (estimate)", amount: fuel });
  }

  const totalCostEstimate = Math.round((labourSubtotal + truckSubtotal + fuel) * 100) / 100;
  return { labourSubtotal, truckSubtotal, fuel, totalCostEstimate, lines };
}

/** Suggested pre-tax price from cost + target margin (0–1). */
export function priceFromCostAndMargin(cost: number, marginTarget: number): number {
  if (cost <= 0) return 0;
  const m = Math.min(0.95, Math.max(0.05, marginTarget));
  return Math.round(cost / (1 - m));
}
