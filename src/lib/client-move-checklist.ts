/**
 * Extended move-day checklist (token page). Stored in moves.extended_checklist_progress.
 * Conditional keys match move fields from the server.
 */
export type ChecklistConditional =
  | "always"
  | "elevator"
  | "parking"
  | "tier_essential_only"
  | "tier_signature_estate";

export interface ClientChecklistItemDef {
  id: string;
  text: string;
  conditional: ChecklistConditional;
}

export interface ClientChecklistCategoryDef {
  category: string;
  items: ClientChecklistItemDef[];
}

export const CLIENT_MOVE_CHECKLIST: ClientChecklistCategoryDef[] = [
  {
    category: "1 Week Before",
    items: [
      { id: "elevator", text: "Book elevator with building management", conditional: "elevator" },
      { id: "parking", text: "Arrange parking permit if needed", conditional: "parking" },
      { id: "utilities", text: "Set up utilities transfer / new account", conditional: "always" },
      { id: "address", text: "Update address with CRA, bank, subscriptions", conditional: "always" },
      { id: "prescriptions", text: "Refill prescriptions and pack medications separately", conditional: "always" },
    ],
  },
  {
    category: "2–3 Days Before",
    items: [
      { id: "fridge", text: "Defrost fridge and freezer (24 hours before)", conditional: "always" },
      {
        id: "drawers",
        text: "Empty dresser drawers (lightweight items can stay on Signature / Estate)",
        conditional: "always",
      },
      { id: "disconnect", text: "Disconnect washer, dryer, and gas appliances", conditional: "always" },
      { id: "valuables", text: "Set aside jewelry, medications, important documents, cash", conditional: "always" },
      { id: "pets", text: "Arrange pet care or transport for move day", conditional: "always" },
      { id: "cleaning", text: "Arrange cleaning for old home (if needed)", conditional: "always" },
    ],
  },
  {
    category: "Move Day Morning",
    items: [
      { id: "essentials_bag", text: "Pack an essentials bag (chargers, toiletries, change of clothes, snacks)", conditional: "always" },
      { id: "walkthrough", text: "Do a final walkthrough — check closets, cabinets, storage", conditional: "always" },
      { id: "keys", text: "Gather all keys, fobs, garage remotes", conditional: "always" },
      { id: "access", text: "Ensure clear path from door to truck (remove obstacles)", conditional: "always" },
      { id: "phones", text: "Keep phone charged — you will receive your tracking link", conditional: "always" },
    ],
  },
];

export function drawerItemText(tierLower: string): string {
  if (tierLower === "essential" || tierLower === "curated" || tierLower === "essentials") {
    return "Empty dresser drawers";
  }
  return "Dressers: lightweight items can stay; empty heavy or fragile items";
}

export function filterChecklistItems(
  defs: ClientChecklistCategoryDef[],
  ctx: {
    hasElevatorHint: boolean;
    parkingReminderLikely: boolean;
    tierLower: string;
  },
): ClientChecklistCategoryDef[] {
  const tier = ctx.tierLower;
  return defs
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((it) => {
        switch (it.conditional) {
          case "always":
            return true;
          case "elevator":
            return ctx.hasElevatorHint;
          case "parking":
            return ctx.parkingReminderLikely;
          case "tier_essential_only":
            return tier === "essential" || tier === "curated" || tier === "essentials";
          case "tier_signature_estate":
            return tier === "signature" || tier === "estate" || tier === "premier";
          default:
            return true;
        }
      }),
    }))
    .filter((c) => c.items.length > 0);
}
