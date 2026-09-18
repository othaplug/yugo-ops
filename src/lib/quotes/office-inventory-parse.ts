/**
 * Office bulk-inventory parser. Maps freeform lines ("4x metal shelves",
 * "1 kitchen unit (3 cabinets)", "server rack") onto office catalog slugs.
 *
 * Two jobs:
 *   1. Extract a quantity + a label from each line (forgiving on order,
 *      separators, plurals, and trailing parentheticals).
 *   2. Resolve the label to a catalog slug via specificity-ordered keyword
 *      rules — the MOST specific rule wins, so "monitor arm" never resolves to
 *      "monitor", "kitchen cabinet" never to a generic "cabinet", "glass coffee
 *      table" never to "table".
 *
 * Nothing is silently dropped: a line whose label matches no rule becomes a
 * CUSTOM medium item carrying the operator's own label, so the quote still
 * reflects it (and the admin can retype/resize it). The list of auto-created
 * customs is returned so the UI can say what happened.
 */

import type { OfficeInventoryLine } from "@/lib/quotes/office-inventory-labour";

type Rule = { test: RegExp; slug: string };

// Ordered MOST-SPECIFIC → most-generic. First match wins. When adding a slug,
// put multi-word / qualified forms above the bare noun they contain.
const RULES: Rule[] = [
  // ── Desks ──
  { test: /reception\s*desk|front\s*desk|welcome\s*desk/i, slug: "reception_desk" },
  { test: /l[-\s]?shaped|corner\s*desk|return\s*desk/i, slug: "desk_lshaped" },
  { test: /standing\s*desk|sit[-\s]?stand|height[-\s]?adjustable\s*desk|electric\s*desk/i, slug: "standing_desk" },
  { test: /exec(?:utive)?\s*desk/i, slug: "desk_executive" },
  { test: /writing\s*desk|compact\s*desk|small\s*desk|study\s*desk/i, slug: "desk_compact" },
  { test: /pedestal|under[-\s]?desk\s*drawer|mobile\s*drawer/i, slug: "desk_pedestal" },
  { test: /\bdesks?\b|workstation/i, slug: "desk_standard" },

  // ── IT (monitor arm before monitor; server rack before generic) ──
  { test: /monitor\s*(?:arm|mount|stand)|desk\s*arm|screen\s*arm/i, slug: "monitor_arm" },
  { test: /\bmonitors?\b|\bscreens?\b|\bdisplays?\b/i, slug: "monitor" },
  { test: /desktop|\bcpu\b|\btower\b|\bpc\b|workstation\s*computer/i, slug: "desktop_computer" },
  { test: /laptop|macbook|notebook\s*computer|docking/i, slug: "laptop" },
  { test: /desk\s*phone|\bvoip\b|handset|telephone|\bphones?\b/i, slug: "desk_phone" },
  { test: /\btvs?\b|television|flat\s*screen/i, slug: "tv" },
  { test: /projector|soundbar|\bspeakers?\b|\bav\b|audio[-\s]?visual/i, slug: "av_equipment" },
  { test: /server|it\s*rack|network\s*rack|data\s*rack|comms?\s*rack/i, slug: "server_rack" },
  { test: /\bups\b|battery\s*backup|uninterruptible/i, slug: "ups_battery" },
  { test: /printer|copier|scanner|plotter|multifunction/i, slug: "printer_copier" },

  // ── Seating (specific chairs before bare "chair") ──
  { test: /exec(?:utive)?\s*chair|specialty\s*chair|ergonomic\s*chair|manager'?s?\s*chair|leather\s*chair/i, slug: "specialty_chair" },
  { test: /guest\s*chair|visitor\s*chair|stack(?:able|ing)?\s*chair|side\s*chair/i, slug: "guest_chair" },
  { test: /arm\s*chair|armchair|accent\s*chair|tub\s*chair/i, slug: "armchair" },
  { test: /high[-\s]?top|bar\s*stool|\bstools?\b/i, slug: "hightop_chair" },
  { test: /office\s*chair|task\s*chair|desk\s*chair|\bchairs?\b|seat(?:ing)?/i, slug: "office_chair" },

  // ── Tables (qualified before bare "table") ──
  { test: /boardroom|meeting\s*table|conference\s*table/i, slug: "boardroom_table" },
  { test: /training\s*table|folding\s*table|flip\s*table|flip[-\s]?top/i, slug: "training_table" },
  { test: /standing\s*(?:meeting|huddle)?\s*table|huddle\s*table|high\s*table/i, slug: "standing_meeting_table" },

  // ── Storage (lateral/filing/metal/wood/bookcase before generic shelf/cabinet) ──
  { test: /lateral\s*(?:file|filing|cabinet)/i, slug: "lateral_file" },
  { test: /fil(?:e|ing)\s*cabinet|filing\b/i, slug: "filing_cabinet" },
  { test: /metal\s*shel|steel\s*shel|wire\s*shel|rack(?:ing)?\s*shel|industrial\s*shel|storage\s*rack/i, slug: "shelving_metal" },
  { test: /wood(?:en)?\s*shel|timber\s*shel/i, slug: "shelving_wood" },
  { test: /book\s*case|bookcase|book\s*shel|bookshelf/i, slug: "bookcase" },
  { test: /\bshel(?:f|ves|ving)\b/i, slug: "shelving_metal" },
  { test: /credenza|sideboard|buffet/i, slug: "credenza" },
  { test: /locker/i, slug: "locker_unit" },
  { test: /wardrobe|coat\s*closet|coat\s*rack|garment/i, slug: "wardrobe" },
  { test: /dresser|chest\s*of\s*drawers|drawer\s*chest/i, slug: "dresser" },
  { test: /\bsafe\b|vault|fireproof/i, slug: "safe" },
  { test: /storage\s*drawer|drawer\s*unit|\bdrawers?\b/i, slug: "storage_drawer" },
  { test: /kitchen\s*cabinet|kitchen\s*unit|kitchenette|cabinetry|cupboard/i, slug: "kitchen_cabinet" },
  { test: /storage\s*cabinet|supply\s*cabinet|metal\s*cabinet|\bcabinets?\b/i, slug: "storage_cabinet" },

  // ── Lounge ──
  { test: /sectional/i, slug: "sectional_sofa" },
  { test: /couch|sofa|loveseat|settee/i, slug: "couch" },
  { test: /ottoman|pouffe|foot\s*stool|footstool/i, slug: "ottoman" },
  { test: /glass\s*(?:coffee\s*)?table/i, slug: "coffee_table_glass" },
  { test: /coffee\s*table/i, slug: "coffee_table" },
  { test: /end\s*table|side\s*table|nightstand|night\s*stand|bedside/i, slug: "side_table" },
  { test: /bench|lounge/i, slug: "lounge_seating" },

  // ── Lunch / break ──
  { test: /lunch\s*table|cafe\s*table|cafeteria\s*table|dining\s*table|kitchen\s*table|break\s*table/i, slug: "lunch_table" },
  { test: /full[-\s]?size\s*fridge|large\s*fridge|refrigerator|\bfridge\b/i, slug: "fridge_full" },
  { test: /dishwasher/i, slug: "dishwasher" },
  { test: /water\s*cooler|water\s*dispenser/i, slug: "water_cooler" },

  // ── Decor ──
  { test: /floor\s*lamp|torchiere|\blamps?\b/i, slug: "floor_lamp" },
  { test: /\bplants?\b|greenery|\btree\b/i, slug: "plant" },
  { test: /art(?:work)?|painting|framed|picture\s*frame|poster|canvas/i, slug: "artwork" },
  { test: /mirror/i, slug: "mirror" },
  { test: /\brugs?\b|carpet|\bmats?\b/i, slug: "rug" },
  { test: /signage|\bsigns?\b|logo\s*wall|brand\s*wall/i, slug: "signage" },

  // ── Kitchen ──
  { test: /coffee\s*machine|espresso|coffee\s*maker/i, slug: "coffee_machine" },
  { test: /microwave|kettle|toaster|blender|small\s*appliance|\bappliances?\b/i, slug: "appliance_small" },
  { test: /kitchen|dishes|cutlery|pantry|glassware|mugs?/i, slug: "kitchen_box" },

  // ── Boxes ──
  { test: /file\s*box|banker'?s?\s*box|archive\s*box|records?\s*box/i, slug: "file_box" },
  { test: /wardrobe\s*box/i, slug: "wardrobe_box" },
  { test: /\bboxe?s?\b|carton|\btotes?\b|\bbins?\b/i, slug: "box" },

  // ── Misc ──
  { test: /white\s*board|whiteboard|glass\s*board|pin\s*board|cork\s*board|bulletin/i, slug: "whiteboard" },
  { test: /cubicle|partition|divider|panel/i, slug: "cubicle_panel" },
  { test: /easel|flip\s*chart|flipchart/i, slug: "easel_flipchart" },
  { test: /pallet|\bcrate\b|\bskid\b/i, slug: "pallet" },
  { test: /\bgym\b|treadmill|peloton|dumbbell|\bweights?\b|fitness|exercise/i, slug: "gym_equipment" },

  // ── Generic tables last (any leftover "table") ──
  { test: /\btables?\b/i, slug: "small_table" },
];

export function matchOfficeSlug(label: string): string | null {
  const l = label.toLowerCase();
  for (const r of RULES) if (r.test.test(l)) return r.slug;
  return null;
}

function cleanLabel(raw: string): string {
  // Drop a trailing parenthetical note like "(3 cabinets)" and collapse space.
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .slice(0, 48);
}

export interface OfficeBulkParseResult {
  lines: OfficeInventoryLine[];
  /** Freeform lines that could not be read at all (no quantity/label found). */
  unrecognized: string[];
  /** Labels matched to a catalog slug. */
  matched: { label: string; slug: string; quantity: number }[];
  /** Labels with no rule → auto-created as custom medium items. */
  customCreated: { label: string; quantity: number }[];
}

/**
 * Parse a freeform block into office inventory lines. Matched labels sum by
 * slug; unmatched-but-readable labels become distinct custom medium items.
 */
export function parseOfficeBulkInventory(text: string): OfficeBulkParseResult {
  const bySlug = new Map<string, number>();
  const matched: { label: string; slug: string; quantity: number }[] = [];
  const customCreated: { label: string; quantity: number }[] = [];
  const unrecognized: string[] = [];
  const customLines: OfficeInventoryLine[] = [];
  let customCounter = 0;

  for (const rawLine of text.split(/\r?\n|;/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // "4x metal shelves", "4 - metal shelves", "metal shelves x4", "shelves: 4".
    const m =
      line.match(/^(\d+)\s*(?:x|×|\*|-|:)?\s*(.+)$/i) ||
      line.match(/^(.+?)\s*(?:x|×|:|-)?\s*(\d+)\s*$/i);
    if (!m) {
      unrecognized.push(line);
      continue;
    }
    const qtyRaw = /^\d+$/.test(m[1]) ? m[1] : m[2];
    const labelRaw = /^\d+$/.test(m[1]) ? m[2] : m[1];
    const qty = parseInt(qtyRaw, 10);
    const label = cleanLabel(labelRaw);
    if (!qty || qty <= 0 || !label) {
      unrecognized.push(line);
      continue;
    }
    const slug = matchOfficeSlug(label);
    if (slug) {
      bySlug.set(slug, (bySlug.get(slug) ?? 0) + qty);
      matched.push({ label, slug, quantity: qty });
    } else {
      customCounter += 1;
      customLines.push({
        slug: `custom:${customCounter}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
        quantity: qty,
        custom: { label: titleCase(label), size: "custom_medium" },
      });
      customCreated.push({ label: titleCase(label), quantity: qty });
    }
  }

  const lines: OfficeInventoryLine[] = [];
  for (const [slug, quantity] of bySlug) lines.push({ slug, quantity });
  lines.push(...customLines);

  return { lines, unrecognized, matched, customCreated };
}
