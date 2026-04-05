/**
 * Shared pre-move checklist item ids and labels (client track UI + server completion checks).
 */

export interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
}

export const PRE_MOVE_CHECKLIST: ChecklistItem[] = [
  {
    id: "appliances",
    label: "Disconnect appliances",
    detail: "Unplug and defrost fridge at least 24 hours before the move",
  },
  {
    id: "parking",
    label: "Parking arranged at both locations",
    detail: "Reserve elevator and loading dock if condo",
  },
  {
    id: "elevator",
    label: "Elevator booked (if applicable)",
    detail: "Most condos require 48-hour notice for move bookings",
  },
  {
    id: "pets_kids",
    label: "Kids and pets supervised or away",
    detail: "For everyone's safety during loading and unloading",
  },
  {
    id: "valuables",
    label: "Valuables secured separately",
    detail:
      "Jewelry, cash, medications, and important documents. Keep these with you.",
  },
  {
    id: "crew_info",
    label: "I know my crew and arrival time",
    detail: "",
  },
];

export const PRE_MOVE_CHECKLIST_TOTAL = PRE_MOVE_CHECKLIST.length;

export function isPreMoveChecklistComplete(
  checklist: Record<string, boolean> | null | undefined,
): boolean {
  for (const item of PRE_MOVE_CHECKLIST) {
    if (!checklist?.[item.id]) return false;
  }
  return true;
}

export function preMoveChecklistCounts(
  checklist: Record<string, boolean> | null | undefined,
): { done: number; total: number } {
  const total = PRE_MOVE_CHECKLIST_TOTAL;
  const done = PRE_MOVE_CHECKLIST.filter((i) => !!checklist?.[i.id]).length;
  return { done, total };
}
