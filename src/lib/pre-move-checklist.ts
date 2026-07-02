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

/**
 * Office relocation pre-move checklist. Business-shaped tasks — no
 * defrost-fridge / kids-and-pets / jewelry lines that leaked residential
 * language onto commercial bookings.
 */
export const PRE_MOVE_OFFICE_CHECKLIST: ChecklistItem[] = [
  {
    id: "coi",
    label: "Certificate of insurance on file with both buildings",
    detail:
      "Your project manager files the COI directly with property management. Confirm your contact if requested.",
  },
  {
    id: "building_access",
    label: "Freight elevator and loading dock reserved",
    detail:
      "Both origin and destination buildings, for the full move window. Most buildings need 5–10 business days notice.",
  },
  {
    id: "it_shutdown",
    label: "IT power-down sequence agreed with your team",
    detail:
      "Joint call between our crew and your IT lead so servers, network, and workstations shut down and restart in the right order.",
  },
  {
    id: "floor_plan",
    label: "Floor plan for the new office signed off",
    detail:
      "Room-by-room and desk-by-desk plan so placement matches what your team expects.",
  },
  {
    id: "employee_personal",
    label: "Employees notified to pack personal items",
    detail:
      "Laptops, headphones, framed photos — anything they want with them. Our crew handles the rest.",
  },
  {
    id: "pm_intro",
    label: "I know my project manager and move schedule",
    detail: "",
  },
];

export const PRE_MOVE_OFFICE_CHECKLIST_TOTAL =
  PRE_MOVE_OFFICE_CHECKLIST.length;

export function isPreMoveChecklistComplete(
  checklist: Record<string, boolean> | null | undefined,
  variant: "residential" | "office" = "residential",
): boolean {
  const items =
    variant === "office" ? PRE_MOVE_OFFICE_CHECKLIST : PRE_MOVE_CHECKLIST;
  for (const item of items) {
    if (!checklist?.[item.id]) return false;
  }
  return true;
}

export function preMoveChecklistCounts(
  checklist: Record<string, boolean> | null | undefined,
  variant: "residential" | "office" = "residential",
): { done: number; total: number } {
  const items =
    variant === "office" ? PRE_MOVE_OFFICE_CHECKLIST : PRE_MOVE_CHECKLIST;
  const done = items.filter((i) => !!checklist?.[i.id]).length;
  return { done, total: items.length };
}
