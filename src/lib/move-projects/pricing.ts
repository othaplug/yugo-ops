import type { MoveProjectPayload } from "./schema";

export type MoveProjectPricingLine = { label: string; amount: number };

export type MoveProjectPricingOpts = {
  labourRatePerMoverHour: number;
  truckDayRate?: number;
  fuelFlat?: number;
  /** Commercial: price per workstation seat */
  workstationRatePerSeat?: number;
  serverRoomFlat?: number;
  boardroomFlatEach?: number;
  breakRoomFlat?: number;
  receptionFlat?: number;
};

function officeCommercialBlock(
  payload: MoveProjectPayload,
  opts: MoveProjectPricingOpts,
): { subtotal: number; lines: MoveProjectPricingLine[] } {
  const office = payload.office_profile;
  const isOffice =
    (typeof payload.project_type === "string" && payload.project_type.startsWith("office")) ||
    !!office?.workstation_count;
  if (!isOffice || !office) return { subtotal: 0, lines: [] };

  const wsRate = Math.max(0, opts.workstationRatePerSeat ?? 85);
  const lines: MoveProjectPricingLine[] = [];
  let subtotal = 0;

  const ws = Math.max(0, Number(office.workstation_count) || 0);
  if (ws > 0 && wsRate > 0) {
    const amt = ws * wsRate;
    subtotal += amt;
    lines.push({
      label: `Workstations (${ws} × $${wsRate})`,
      amount: Math.round(amt * 100) / 100,
    });
  }

  const srv = Math.max(0, opts.serverRoomFlat ?? 2500);
  if (office.server_room === true && srv > 0) {
    subtotal += srv;
    lines.push({ label: "Server room (specialty)", amount: srv });
  }

  const br = Math.max(0, Number(office.boardroom_count) || 0);
  const brEach = Math.max(0, opts.boardroomFlatEach ?? 600);
  if (br > 0 && brEach > 0) {
    const amt = br * brEach;
    subtotal += amt;
    lines.push({
      label: `Boardroom${br > 1 ? "s" : ""} (${br} × $${brEach})`,
      amount: Math.round(amt * 100) / 100,
    });
  }

  const brk = Math.max(0, opts.breakRoomFlat ?? 800);
  if (office.break_room === true && brk > 0) {
    subtotal += brk;
    lines.push({ label: "Kitchen / break room", amount: brk });
  }

  const rec = Math.max(0, opts.receptionFlat ?? 600);
  if (office.reception === true && rec > 0) {
    subtotal += rec;
    lines.push({ label: "Reception / common", amount: rec });
  }

  return { subtotal: Math.round(subtotal * 100) / 100, lines };
}

export function computeMoveProjectPricingPreview(
  payload: MoveProjectPayload,
  opts: MoveProjectPricingOpts,
): {
  labourSubtotal: number;
  truckSubtotal: number;
  fuel: number;
  officeCommercialSubtotal: number;
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

  const officeBlock = officeCommercialBlock(payload, opts);
  const officeCommercialSubtotal = officeBlock.subtotal;
  lines.push(...officeBlock.lines);

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

  const totalCostEstimate =
    Math.round((labourSubtotal + officeCommercialSubtotal + truckSubtotal + fuel) * 100) / 100;
  return {
    labourSubtotal,
    truckSubtotal,
    fuel,
    officeCommercialSubtotal,
    totalCostEstimate,
    lines,
  };
}

/** Suggested pre-tax price from cost + target margin (0–1). */
export function priceFromCostAndMargin(cost: number, marginTarget: number): number {
  if (cost <= 0) return 0;
  const m = Math.min(0.95, Math.max(0.05, marginTarget));
  return Math.round(cost / (1 - m));
}
