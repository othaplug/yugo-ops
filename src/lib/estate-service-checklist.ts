/**
 * Estate tier: client-visible checklist of Yugo-delivered milestones (track page).
 * Separate from {@link PRE_MOVE_CHECKLIST} (homeowner prep).
 */

import type { EstateDayPlan } from "@/lib/quotes/estate-schedule";

export interface EstateServiceChecklistItem {
  id: string;
  label: string;
  detail: string;
}

/** Stable ids persisted in `moves.estate_service_checklist` JSONB. */
export const ESTATE_SERVICE_CHECKLIST_IDS = [
  "estate_walkthrough",
  "estate_packing",
  "estate_move",
  "estate_unpacking",
] as const;

export type EstateServiceChecklistId = (typeof ESTATE_SERVICE_CHECKLIST_IDS)[number];

const ID_SET = new Set<string>(ESTATE_SERVICE_CHECKLIST_IDS);

export function isAllowedEstateServiceChecklistItem(id: string): boolean {
  return ID_SET.has(id);
}

export function buildEstateServiceChecklistItems(
  plan: EstateDayPlan,
): EstateServiceChecklistItem[] {
  const packing = plan.packDay
    ? {
        label: "Packing materials & visit",
        detail:
          "Everything we need arrives before pack day, coordinated with your schedule — then a dedicated visit to pack, label, and protect before move day.",
      }
    : {
        label: "Packing & protection",
        detail:
          "Materials and full packing support are coordinated as part of your Estate visit — no loose ends before the truck rolls.",
      };

  const items: EstateServiceChecklistItem[] = [
    {
      id: "estate_walkthrough",
      label: "Pre-move walkthrough",
      detail:
        "Your coordinator introduces themselves and your priorities, then we schedule and complete a room-by-room walkthrough — access, fragile pieces, and special handling on record.",
    },
    {
      id: "estate_packing",
      label: packing.label,
      detail: packing.detail,
    },
    {
      id: "estate_move",
      label: "Move day confirmed",
      detail:
        "Crew, vehicle, and arrival window are locked in. You receive your detailed itinerary ahead of the big day, then loading, transit, and careful delivery to your new home.",
    },
  ];

  if (plan.unpackIncluded) {
    items.push({
      id: "estate_unpacking",
      label: "Unpacking & placement",
      detail:
        "We unpack and place pieces where you want them so you can settle in without living out of boxes.",
    });
  }

  return items;
}

export function isEstateServiceChecklistComplete(
  checklist: Record<string, boolean> | null | undefined,
  plan: EstateDayPlan,
): boolean {
  for (const item of buildEstateServiceChecklistItems(plan)) {
    if (!checklist?.[item.id]) return false;
  }
  return true;
}
