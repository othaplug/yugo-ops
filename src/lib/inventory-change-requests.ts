/**
 * Client inventory change requests — pricing + truck assessment (shared by track API + admin).
 */

import {
  calculateExtraItemPrice,
  fragileItemNameHint,
  weightTierFromLegacyScore,
} from "@/lib/pricing/extra-item-surcharges";

export const TRUCK_CAPACITIES: Record<string, number> = {
  sprinter: 20,
  "16ft": 35,
  "20ft": 55,
  "24ft": 65,
  "26ft": 80,
};

export type CustomWeightClass = "light" | "medium" | "heavy" | "extra_heavy";

const CUSTOM_SCORE: Record<CustomWeightClass, number> = {
  light: 0.5,
  medium: 1.0,
  heavy: 2.0,
  extra_heavy: 3.0,
};

export function scoreForCustomClass(c: string | null | undefined): number {
  const k = (c || "medium").toLowerCase() as CustomWeightClass;
  return CUSTOM_SCORE[k] ?? 1.0;
}

export function calcLineCharge(weightScore: number, quantity: number, perScoreRate: number): number {
  const q = Math.max(1, Math.floor(quantity) || 1);
  return Math.round(Number(weightScore) * perScoreRate * q);
}

/** Dollar surcharge for an extra catalog line (custom items = $0 until coordinator prices). */
export function surchargeForAddedLine(row: ItemAddedInput): number {
  if (row.is_custom) return 0;
  const q = Math.max(1, Math.floor(row.quantity) || 1);
  const ws = Number(row.weight_score) || 1;
  return calculateExtraItemPrice(
    row.item_name,
    weightTierFromLegacyScore(ws),
    q,
    fragileItemNameHint(row.item_name),
  );
}

export function creditForRemovedLine(row: ItemRemovedInput): number {
  const q = Math.max(1, Math.floor(row.quantity) || 1);
  const ws = Number(row.weight_score) || 1;
  return calculateExtraItemPrice(
    row.item_name,
    weightTierFromLegacyScore(ws),
    q,
    fragileItemNameHint(row.item_name),
  );
}

export function normalizeTruckKey(raw: string | null | undefined): keyof typeof TRUCK_CAPACITIES {
  const s = (raw || "16ft").toLowerCase().replace(/\s+/g, "");
  if (s.includes("sprinter")) return "sprinter";
  if (s.includes("26")) return "26ft";
  if (s.includes("24")) return "24ft";
  if (s.includes("20")) return "20ft";
  if (s.includes("16")) return "16ft";
  return "16ft";
}

export function truckCapacityForMove(truckPrimary: string | null | undefined): number {
  const k = normalizeTruckKey(truckPrimary);
  return TRUCK_CAPACITIES[k] ?? 35;
}

export function nextTruckSize(current: string | null | undefined): string {
  const k = normalizeTruckKey(current);
  const order: (keyof typeof TRUCK_CAPACITIES)[] = ["sprinter", "16ft", "20ft", "24ft", "26ft"];
  const i = order.indexOf(k);
  if (i < 0 || i >= order.length - 1) return "26ft";
  return order[i + 1];
}

export type TruckAssessment = {
  current_score: number;
  new_score: number;
  current_truck: string;
  truck_capacity: number;
  fits: boolean;
  recommendation: string | null;
};

export function buildTruckAssessment(params: {
  inventoryScore: number;
  truckPrimary: string | null | undefined;
  addedScore: number;
  removedScore: number;
}): TruckAssessment {
  const current = Number(params.inventoryScore) || 0;
  const added = Number(params.addedScore) || 0;
  const removed = Number(params.removedScore) || 0;
  const newScore = Math.max(0, current + added - removed);
  const currentTruck = normalizeTruckKey(params.truckPrimary);
  const cap = TRUCK_CAPACITIES[currentTruck] ?? 35;
  const fits = newScore <= cap;
  return {
    current_score: Math.round(current * 10) / 10,
    new_score: Math.round(newScore * 10) / 10,
    current_truck: currentTruck,
    truck_capacity: cap,
    fits,
    recommendation: fits
      ? null
      : `Upgrade to ${nextTruckSize(params.truckPrimary)} (${TRUCK_CAPACITIES[nextTruckSize(params.truckPrimary)]} capacity)`,
  };
}

export type ItemAddedInput = {
  item_name: string;
  item_slug?: string | null;
  weight_score: number;
  quantity: number;
  is_custom?: boolean;
  custom_weight_class?: string | null;
};

export type ItemRemovedInput = {
  move_inventory_id: string;
  item_name: string;
  item_slug?: string | null;
  weight_score: number;
  quantity: number;
};

export function summarizePricing(
  itemsAdded: ItemAddedInput[],
  itemsRemoved: ItemRemovedInput[],
  _perScoreRate: number,
): { addedLines: ItemAddedInput[]; removedLines: ItemRemovedInput[]; autoDelta: number; addedScore: number; removedScore: number } {
  let autoDelta = 0;
  let addedScore = 0;
  let removedScore = 0;
  const addedLines: ItemAddedInput[] = [];
  for (const row of itemsAdded) {
    const q = Math.max(1, Math.floor(row.quantity) || 1);
    const ws = Number(row.weight_score) || 1;
    const line = { ...row, quantity: q, weight_score: ws };
    const surcharge = surchargeForAddedLine(line);
    autoDelta += surcharge;
    addedScore += ws * q;
    addedLines.push(line);
  }
  const removedLines: ItemRemovedInput[] = [];
  for (const row of itemsRemoved) {
    const q = Math.max(1, Math.floor(row.quantity) || 1);
    const ws = Number(row.weight_score) || 1;
    const line = { ...row, quantity: q, weight_score: ws };
    const credit = creditForRemovedLine(line);
    autoDelta -= credit;
    removedScore += ws * q;
    removedLines.push(line);
  }
  return { addedLines, removedLines, autoDelta, addedScore, removedScore };
}

export function formatItemsForStorage(
  added: ItemAddedInput[],
  removed: ItemRemovedInput[],
  perScoreRate: number,
): {
  items_added: Record<string, unknown>[];
  items_removed: Record<string, unknown>[];
} {
  const { addedLines, removedLines } = summarizePricing(added, removed, perScoreRate);
  return {
    items_added: addedLines.map((r) => ({
      item_name: r.item_name,
      item_slug: r.item_slug ?? null,
      weight_score: r.weight_score,
      quantity: r.quantity,
      surcharge: r.is_custom ? null : surchargeForAddedLine(r),
      pending_coordinator_pricing: !!r.is_custom,
      is_custom: !!r.is_custom,
      custom_weight_class: r.custom_weight_class ?? null,
    })),
    items_removed: removedLines.map((r) => ({
      move_inventory_id: r.move_inventory_id,
      item_name: r.item_name,
      item_slug: r.item_slug ?? null,
      weight_score: r.weight_score,
      quantity: r.quantity,
      credit: -creditForRemovedLine(r),
    })),
  };
}
