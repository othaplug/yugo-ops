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
      { id: "walkthrough", text: "Do a final walkthrough: check closets, cabinets, storage", conditional: "always" },
      { id: "keys", text: "Gather all keys, fobs, garage remotes", conditional: "always" },
      { id: "access", text: "Ensure clear path from door to truck (remove obstacles)", conditional: "always" },
      { id: "phones", text: "Keep phone charged, you will receive your tracking link", conditional: "always" },
    ],
  },
];

/**
 * Extended office-relocation checklist for the standalone /checklist/[token]
 * page. Business-shaped tasks — no defrost / pets / prescriptions lines,
 * which are residential-only and read as tone-deaf on a commercial move.
 * Categorized on the same "1 Week / 2-3 Days / Move-Day Morning" cadence
 * as the residential version so the page layout matches.
 */
export const CLIENT_OFFICE_CHECKLIST: ClientChecklistCategoryDef[] = [
  {
    category: "2 Weeks Before",
    items: [
      { id: "coi", text: "Certificate of insurance on file with both buildings (your PM handles filing; confirm contacts)", conditional: "always" },
      { id: "freight_elevators", text: "Freight elevator + loading dock reserved at origin and destination (5–10 business days notice is typical)", conditional: "always" },
      { id: "floor_plan_signoff", text: "New office floor plan signed off (room-by-room, desk-by-desk placement)", conditional: "always" },
      { id: "staff_comms", text: "Announce the relocation to your team with the move date and what to expect", conditional: "always" },
    ],
  },
  {
    category: "1 Week Before",
    items: [
      { id: "it_lead", text: "IT lead identified and briefed on our crew's power-down sequence", conditional: "always" },
      { id: "server_shutdown", text: "Server / network shutdown + restart order agreed with our project manager", conditional: "always" },
      { id: "vendor_notify", text: "Notify vendors of the address change (internet, printers, mail, deliveries)", conditional: "always" },
      { id: "keys_access", text: "New-office keys, fobs, and access cards ordered and ready", conditional: "always" },
      { id: "furniture_disposal", text: "Confirm any furniture leaving the move (donation, disposal, storage) with your PM", conditional: "always" },
    ],
  },
  {
    category: "2–3 Days Before",
    items: [
      { id: "labels_distributed", text: "Colour-coded room labels distributed to staff for personal items", conditional: "always" },
      { id: "employee_personal", text: "Employees packing personal items (laptops, headphones, framed photos) — our crew handles the rest", conditional: "always" },
      { id: "sensitive_docs", text: "Sensitive documents locked or moved by executive team, not our crew", conditional: "always" },
      { id: "kitchen_perishables", text: "Break-room fridge cleared out; perishables and coffee equipment prepped", conditional: "always" },
      { id: "signage_removal", text: "Old-office signage and branded artwork identified for removal", conditional: "always" },
    ],
  },
  {
    category: "Move Day",
    items: [
      { id: "site_contact", text: "On-site contact from your team present at origin and destination", conditional: "always" },
      { id: "servers_shutdown_done", text: "Servers, printers, and network gear powered down as planned", conditional: "always" },
      { id: "final_walkthrough", text: "Walk each floor: no boxes left, no drawers full, no forgotten storage rooms", conditional: "always" },
      { id: "utilities_active", text: "Confirm power, internet, and HVAC are live at the new office", conditional: "always" },
      { id: "phones_charged", text: "PM will text you as crews arrive — keep your phone charged and on you", conditional: "always" },
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
