/**
 * Office move inventory catalog — the commercial equivalent of the residential
 * item_weights catalog. Each entry carries the three numbers the office quoting
 * engine needs:
 *
 *   volumeScore     — relative truck-cube / carry effort. Drives crew size,
 *                     truck count, and the load/unload transport hours. Unitless
 *                     and RELATIVE (calibrated as a set, not real cubic feet).
 *   handlingMinutes — per-unit minutes for the work Yugo does on EVERY tier:
 *                     disassembly, blanket/shrink wrap, careful carry, and
 *                     reassembly at destination. Independent of who packs.
 *   packMinutes     — per-unit minutes to PACK the item into transit-ready state
 *                     (boxing contents, crating electronics). Only billed when a
 *                     tier has Yugo doing the packing (Signature = IT only,
 *                     Priority = everything). 0 = nothing to pack (bare furniture).
 *
 * Flags drive crew minimums and which packing bucket (IT vs general) an item
 * falls into.
 *
 * CALIBRATION: these are v1 seed weights derived from the Ataccama job + standard
 * commercial inventories. They are RELATIVE and get tuned in Phase 2 so a real
 * inventory lands on the price anchors. Do not read volumeScore as cubic feet.
 */

export type OfficeItemCategory =
  | "desks"
  | "seating"
  | "it"
  | "tables"
  | "storage"
  | "lounge"
  | "lunch"
  | "decor"
  | "kitchen"
  | "boxes"
  | "misc";

export interface OfficeItemFlags {
  /** Fragile — careful handling, individual wrap (monitors, TVs, glass, plants). */
  fragile?: boolean;
  /** IT / electronic — packed by Yugo on Signature+ (the "IT/hardware" bucket). */
  itElectronic?: boolean;
  /** Needs disassembly (legs, mounts, arms) — adds handling time, not packing. */
  requiresDisassembly?: boolean;
  /** Two-person carry — forces a higher crew floor. */
  twoPerson?: boolean;
}

export interface OfficeCatalogItem {
  slug: string;
  label: string;
  category: OfficeItemCategory;
  volumeScore: number;
  handlingMinutes: number;
  packMinutes: number;
  flags?: OfficeItemFlags;
}

/**
 * Seed catalog. Ordered by category for the admin picker. Slugs are stable
 * identifiers stored on the quote's inventory list.
 */
export const OFFICE_INVENTORY_CATALOG: OfficeCatalogItem[] = [
  // ── Desks ──
  { slug: "standing_desk", label: "Standing desk (electric)", category: "desks", volumeScore: 2.5, handlingMinutes: 22, packMinutes: 0, flags: { requiresDisassembly: true, twoPerson: true } },
  { slug: "desk_standard", label: "Standard desk", category: "desks", volumeScore: 2.2, handlingMinutes: 15, packMinutes: 0, flags: { requiresDisassembly: true } },
  { slug: "desk_executive", label: "Executive desk", category: "desks", volumeScore: 3.5, handlingMinutes: 25, packMinutes: 0, flags: { requiresDisassembly: true, twoPerson: true } },

  // ── Seating ──
  { slug: "office_chair", label: "Office chair", category: "seating", volumeScore: 0.7, handlingMinutes: 3, packMinutes: 0 },
  { slug: "specialty_chair", label: "Specialty / executive chair", category: "seating", volumeScore: 1.0, handlingMinutes: 5, packMinutes: 0 },

  // ── IT / electronics ──
  { slug: "monitor", label: "Computer monitor", category: "it", volumeScore: 0.5, handlingMinutes: 8, packMinutes: 6, flags: { fragile: true, itElectronic: true } },
  { slug: "monitor_arm", label: "Monitor / desk arm", category: "it", volumeScore: 0.2, handlingMinutes: 5, packMinutes: 0, flags: { requiresDisassembly: true } },
  { slug: "tv", label: "Large TV (stand or wall-mount)", category: "it", volumeScore: 1.5, handlingMinutes: 18, packMinutes: 12, flags: { fragile: true, itElectronic: true, requiresDisassembly: true } },
  { slug: "server_rack", label: "Server / IT rack", category: "it", volumeScore: 2.0, handlingMinutes: 30, packMinutes: 20, flags: { fragile: true, itElectronic: true, twoPerson: true } },
  { slug: "printer_copier", label: "Printer / copier", category: "it", volumeScore: 1.4, handlingMinutes: 12, packMinutes: 10, flags: { itElectronic: true, twoPerson: true } },

  // ── Tables ──
  { slug: "boardroom_table", label: "Boardroom / meeting table", category: "tables", volumeScore: 4.0, handlingMinutes: 28, packMinutes: 0, flags: { requiresDisassembly: true, twoPerson: true } },
  { slug: "small_table", label: "Side / breakout table", category: "tables", volumeScore: 1.0, handlingMinutes: 6, packMinutes: 0 },

  // ── Storage ──
  { slug: "storage_cabinet", label: "Storage cabinet", category: "storage", volumeScore: 1.6, handlingMinutes: 8, packMinutes: 8, flags: { twoPerson: true } },
  { slug: "storage_drawer", label: "Storage drawer unit", category: "storage", volumeScore: 1.1, handlingMinutes: 5, packMinutes: 8 },
  { slug: "filing_cabinet", label: "Filing cabinet", category: "storage", volumeScore: 1.4, handlingMinutes: 6, packMinutes: 8, flags: { twoPerson: true } },

  // ── Lounge ──
  { slug: "couch", label: "Couch / sofa", category: "lounge", volumeScore: 2.8, handlingMinutes: 8, packMinutes: 0, flags: { twoPerson: true } },
  { slug: "lounge_seating", label: "Bench / lounge seating", category: "lounge", volumeScore: 1.6, handlingMinutes: 5, packMinutes: 0 },
  { slug: "coffee_table_glass", label: "Glass coffee table", category: "lounge", volumeScore: 1.2, handlingMinutes: 8, packMinutes: 4, flags: { fragile: true } },

  // ── Lunch / break area ──
  { slug: "lunch_table", label: "Lunch / cafe table", category: "lunch", volumeScore: 1.3, handlingMinutes: 8, packMinutes: 0, flags: { requiresDisassembly: true } },
  { slug: "hightop_chair", label: "High-top / stool chair", category: "lunch", volumeScore: 0.6, handlingMinutes: 3, packMinutes: 0 },

  // ── Decor ──
  { slug: "floor_lamp", label: "Floor lamp", category: "decor", volumeScore: 0.6, handlingMinutes: 5, packMinutes: 4, flags: { fragile: true } },
  { slug: "plant", label: "Office plant", category: "decor", volumeScore: 0.7, handlingMinutes: 6, packMinutes: 0, flags: { fragile: true } },
  { slug: "artwork", label: "Artwork / framed piece", category: "decor", volumeScore: 0.8, handlingMinutes: 10, packMinutes: 8, flags: { fragile: true } },

  // ── Kitchen ──
  { slug: "kitchen_box", label: "Kitchen items (per box)", category: "kitchen", volumeScore: 0.6, handlingMinutes: 2, packMinutes: 18 },
  { slug: "appliance_small", label: "Small appliance (fridge/microwave)", category: "kitchen", volumeScore: 1.2, handlingMinutes: 8, packMinutes: 6, flags: { twoPerson: true } },

  // ── Boxes ──
  { slug: "box", label: "Moving box", category: "boxes", volumeScore: 0.6, handlingMinutes: 2, packMinutes: 12 },

  // ── Misc ──
  { slug: "whiteboard", label: "Whiteboard / panel", category: "misc", volumeScore: 1.0, handlingMinutes: 6, packMinutes: 0 },
];

const BY_SLUG: Map<string, OfficeCatalogItem> = new Map(
  OFFICE_INVENTORY_CATALOG.map((i) => [i.slug, i]),
);

/** Look up a catalog item by slug. Returns null for unknown slugs. */
export function officeCatalogItem(slug: string): OfficeCatalogItem | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Catalog grouped by category for the admin inventory picker. */
export function officeCatalogByCategory(): Record<OfficeItemCategory, OfficeCatalogItem[]> {
  const out = {} as Record<OfficeItemCategory, OfficeCatalogItem[]>;
  for (const item of OFFICE_INVENTORY_CATALOG) {
    (out[item.category] ??= []).push(item);
  }
  return out;
}
