import type { TierFeature, ResidentialQuoteTierMetaMap } from "@/app/quote/[quoteId]/quote-shared";
import { TIER_META, TIER_ORDER } from "@/app/quote/[quoteId]/quote-shared";

/** platform_config keys */
export const QUOTE_RESIDENTIAL_TIER_FEATURES_KEY = "quote_residential_tier_features";
export const QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY = "quote_residential_tier_meta_overrides";

const TIER_KEYS = TIER_ORDER as unknown as readonly string[];

/**
 * Default residential tier feature rows (card bullets + expanded copy).
 * Index 0 = truck, 1 = crew — hydrated on the quote page from the quote record.
 */
export const DEFAULT_RESIDENTIAL_TIER_FEATURES: Record<string, TierFeature[]> = {
  essential: [
    { card: "Dedicated moving truck", title: "Dedicated moving truck", desc: "Climate-protected, equipped for your move", iconName: "Truck" },
    { card: "Professional crew of [N]", title: "Professional crew of [N]", desc: "Licensed, insured, background-checked movers", iconName: "Users" },
    { card: "Protective wrapping for key furniture", title: "Protective wrapping for key furniture", desc: "Key pieces wrapped in quilted moving blankets", iconName: "Armchair" },
    { card: "Basic disassembly & reassembly", title: "Basic disassembly & reassembly", desc: "We take it apart and put it back together", iconName: "Wrench" },
    { card: "Floor & entryway protection", title: "Floor & entryway protection", desc: "Runners, booties, and corner guards throughout", iconName: "Home" },
    { card: "All standard equipment included", title: "All standard equipment included", desc: "Dollies, straps, tools, nothing extra to rent", iconName: "Toolbox" },
    { card: "Standard valuation coverage", title: "Standard valuation coverage", desc: "Basic protection for your belongings", iconName: "Shield" },
    { card: "Real-time GPS tracking", title: "Real-time GPS tracking", desc: "Follow your move live from any device", iconName: "MapPin" },
  ],
  signature: [
    { card: "Dedicated moving truck", title: "Dedicated moving truck", desc: "Climate-protected, equipped for your move", iconName: "Truck" },
    { card: "Professional crew of [N]", title: "Professional crew of [N]", desc: "Licensed, insured, background-checked movers", iconName: "Users" },
    { card: "Full protective wrapping for all furniture", title: "Full protective wrapping for all furniture", desc: "Every piece individually wrapped and padded", iconName: "Armchair" },
    { card: "Basic disassembly & reassembly", title: "Basic disassembly & reassembly", desc: "We take it apart and put it back together", iconName: "Wrench" },
    { card: "Floor & door frame protection", title: "Floor & door frame protection", desc: "Runners, booties, and corner guards throughout", iconName: "Home" },
    { card: "Mattress and TV protection included", title: "Mattress and TV protection", desc: "Dedicated covers for mattresses and screens", iconName: "Shield" },
    { card: "Room-of-choice placement throughout the home", title: "Room-of-choice placement", desc: "Every piece placed exactly where you want it", iconName: "Compass" },
    { card: "Wardrobe box for immediate use", title: "Wardrobe box for immediate use", desc: "Hang your clothes directly, no folding needed", iconName: "Shirt" },
    { card: "Debris and packaging removal at completion", title: "Debris and packaging removal", desc: "We clear away all packing materials post-move", iconName: "Trash2" },
    { card: "All equipment included", title: "All equipment included", desc: "Dollies, straps, tools, nothing extra to rent", iconName: "Toolbox" },
    { card: "Enhanced valuation coverage", title: "Enhanced valuation coverage", desc: "Up to $2,500 per item protection", iconName: "ShieldCheck" },
    { card: "Real-time GPS tracking", title: "Real-time GPS tracking", desc: "Follow your move live from any device", iconName: "MapPin" },
  ],
  estate: [
    { card: "Dedicated moving truck", title: "Dedicated moving truck", desc: "Climate-protected, equipped for your move", iconName: "Truck" },
    { card: "Professional crew of [N]", title: "Professional crew of [N]", desc: "Licensed, insured, background-checked movers", iconName: "Users" },
    { card: "Dedicated move coordinator from booking to final placement", title: "Dedicated move coordinator", desc: "One point of contact from booking through final placement", iconName: "UserCircle" },
    { card: "Pre-move walkthrough with room-by-room plan", title: "Pre-move walkthrough", desc: "Documented room-by-room plan before we touch anything", iconName: "ClipboardCheck" },
    { card: "Full furniture wrapping and protection throughout", title: "Full furniture wrapping", desc: "Every piece individually wrapped and padded", iconName: "Armchair" },
    { card: "Full disassembly & precision reassembly", title: "Full disassembly & precision reassembly", desc: "Complete furniture breakdown and expert reassembly", iconName: "Wrench" },
    { card: "Floor and property protection throughout", title: "Floor and property protection", desc: "Runners, booties, and corner guards throughout", iconName: "Home" },
    { card: "All packing materials and supplies included", title: "All packing materials and supplies included", desc: "Boxes, wrapping, and all protection materials provided", iconName: "Suitcase" },
    { card: "White glove handling for furniture, art, and high-value items", title: "White glove handling", desc: "Specialist-level care for your most valued possessions", iconName: "Star" },
    { card: "Precision placement in every room", title: "Precision placement in every room", desc: "Every piece placed exactly where you want it", iconName: "Compass" },
    { card: "Full replacement valuation coverage", title: "Full replacement valuation coverage", desc: "Maximum protection for your most valuable items", iconName: "ShieldCheck" },
    { card: "Wardrobe box for immediate use", title: "Wardrobe box for immediate use", desc: "Hang your clothes directly, no folding needed", iconName: "Shirt" },
    { card: "Debris and packaging removal at completion", title: "Debris and packaging removal", desc: "We clear away all packing materials post-move", iconName: "Trash2" },
    { card: "Pre-move inventory planning and oversight", title: "Pre-move inventory planning", desc: "Full inventory documented before and after your move", iconName: "FrameCorners" },
    { card: "30-day post-move concierge support", title: "30-day concierge support", desc: "Post-move support and questions answered within 30 days", iconName: "Clock" },
    { card: "Real-time GPS tracking", title: "Real-time GPS tracking", desc: "Follow your move live from any device", iconName: "MapPin" },
    { card: "Exclusive partner offers & perks", title: "Exclusive partner offers & perks", desc: "Access to partner discounts and member benefits", iconName: "Gift" },
  ],
};

function parseTierFeatureRow(item: unknown): TierFeature | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (
    typeof o.card !== "string" ||
    typeof o.title !== "string" ||
    typeof o.desc !== "string" ||
    typeof o.iconName !== "string"
  ) {
    return null;
  }
  return { card: o.card, title: o.title, desc: o.desc, iconName: o.iconName };
}

/** Merge platform JSON over code defaults. Invalid or empty JSON falls back to defaults. */
export function mergeResidentialTierFeaturesFromConfig(raw: string | null | undefined): Record<string, TierFeature[]> {
  const defaults = DEFAULT_RESIDENTIAL_TIER_FEATURES;
  if (!raw?.trim()) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
  const p = parsed as Record<string, unknown>;
  const out: Record<string, TierFeature[]> = { ...defaults };
  for (const tier of TIER_ORDER) {
    const arr = p[tier];
    if (!Array.isArray(arr)) continue;
    const cleaned: TierFeature[] = [];
    for (const item of arr) {
      const row = parseTierFeatureRow(item);
      if (row) cleaned.push(row);
    }
    if (cleaned.length >= 3) out[tier] = cleaned;
  }
  return out;
}

/** Deep-merge tagline + footer (Best for) per tier over TIER_META. */
export function mergeResidentialTierMetaFromConfig(raw: string | null | undefined): ResidentialQuoteTierMetaMap {
  if (!raw?.trim()) return TIER_META;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return TIER_META;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return TIER_META;
  const p = parsed as Record<string, unknown>;
  const out: ResidentialQuoteTierMetaMap = { ...TIER_META };
  for (const tier of TIER_ORDER) {
    const block = p[tier];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const b = block as Record<string, unknown>;
    const base = TIER_META[tier];
    if (!base) continue;
    out[tier] = {
      ...base,
      ...(typeof b.tagline === "string" ? { tagline: b.tagline } : {}),
      ...(typeof b.footer === "string" ? { footer: b.footer } : {}),
    };
  }
  return out;
}

/** Editable tier card copy (tagline + “Best for” footer) in admin UI. */
export type ResidentialTierMetaFormRow = { tagline: string; footer: string };

export function tierMetaFormFromMerged(map: ResidentialQuoteTierMetaMap): Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow> {
  return {
    essential: { tagline: map.essential.tagline, footer: map.essential.footer ?? "" },
    signature: { tagline: map.signature.tagline, footer: map.signature.footer ?? "" },
    estate: { tagline: map.estate.tagline, footer: map.estate.footer ?? "" },
  };
}

/** True when form matches built-in TIER_META (save as empty platform_config override). */
export function tierMetaEqualToDefaults(form: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow>): boolean {
  for (const tier of TIER_ORDER) {
    const base = TIER_META[tier];
    const row = form[tier];
    if (!row || !base) return false;
    if (row.tagline !== base.tagline) return false;
    if ((row.footer ?? "") !== (base.footer ?? "")) return false;
  }
  return true;
}

export function serializeTierMetaOverrides(
  form: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow>,
): string {
  return JSON.stringify(
    {
      essential: { tagline: form.essential.tagline, footer: form.essential.footer },
      signature: { tagline: form.signature.tagline, footer: form.signature.footer },
      estate: { tagline: form.estate.tagline, footer: form.estate.footer },
    },
    null,
    2,
  );
}

/**
 * Parse admin JSON for tier meta overrides. Merges onto `baseForm` (defaults to code TIER_META).
 * Omitted tiers in JSON keep the corresponding values from `baseForm`.
 */
export function parseAdminTierMetaJson(
  raw: string,
  baseForm?: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow>,
): { ok: true; value: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow> } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "JSON cannot be empty" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Expected an object" };
  }
  const p = parsed as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!TIER_KEYS.includes(key)) {
      return { ok: false, error: `Unknown tier key "${key}"` };
    }
  }
  const base = baseForm ?? tierMetaFormFromMerged(TIER_META);
  const out: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow> = {
    essential: { ...base.essential },
    signature: { ...base.signature },
    estate: { ...base.estate },
  };
  for (const tier of TIER_ORDER) {
    if (!(tier in p)) continue;
    const block = p[tier];
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return { ok: false, error: `"${tier}" must be an object` };
    }
    const b = block as Record<string, unknown>;
    if (b.tagline !== undefined && typeof b.tagline !== "string") {
      return { ok: false, error: `${tier}.tagline must be a string` };
    }
    if (b.footer !== undefined && typeof b.footer !== "string") {
      return { ok: false, error: `${tier}.footer must be a string` };
    }
    out[tier] = {
      tagline: typeof b.tagline === "string" ? b.tagline : out[tier].tagline,
      footer: typeof b.footer === "string" ? b.footer : out[tier].footer,
    };
  }
  return { ok: true, value: out };
}

export function defaultTierMetaOverridesJson(): string {
  return serializeTierMetaOverrides(tierMetaFormFromMerged(TIER_META));
}

export function defaultTierFeaturesJson(): string {
  return JSON.stringify(DEFAULT_RESIDENTIAL_TIER_FEATURES, null, 2);
}

export function cloneResidentialTierFeatures(f: Record<string, TierFeature[]>): Record<string, TierFeature[]> {
  return JSON.parse(JSON.stringify(f)) as Record<string, TierFeature[]>;
}

/** True when every tier matches built-in defaults (save as empty override). */
export function tierFeaturesEqualToDefaults(f: Record<string, TierFeature[]>): boolean {
  for (const tier of TIER_ORDER) {
    const a = f[tier];
    const b = DEFAULT_RESIDENTIAL_TIER_FEATURES[tier];
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    }
  }
  return true;
}

/** Minimum rows per tier when saving custom JSON (matches API validation). */
export const MIN_TIER_FEATURE_ROWS = 3;

/**
 * Parse admin JSON for tier features. Omitted tiers keep built-in defaults.
 * Present tiers must be arrays with at least MIN_TIER_FEATURE_ROWS valid rows.
 */
export function parseAdminTierFeaturesJson(
  raw: string,
): { ok: true; value: Record<string, TierFeature[]> } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Expected an object" };
  }
  const p = parsed as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!TIER_KEYS.includes(key)) {
      return { ok: false, error: `Unknown tier key "${key}"` };
    }
  }
  const out = cloneResidentialTierFeatures(DEFAULT_RESIDENTIAL_TIER_FEATURES);
  for (const tier of TIER_ORDER) {
    if (!(tier in p)) continue;
    const arr = p[tier];
    if (!Array.isArray(arr)) {
      return { ok: false, error: `"${tier}" must be an array` };
    }
    const cleaned: TierFeature[] = [];
    for (let i = 0; i < arr.length; i++) {
      const row = parseTierFeatureRow(arr[i]);
      if (!row) {
        return { ok: false, error: `Invalid row at "${tier}"[${i}] (need card, title, desc, iconName strings)` };
      }
      cleaned.push(row);
    }
    if (cleaned.length < MIN_TIER_FEATURE_ROWS) {
      return { ok: false, error: `"${tier}" needs at least ${MIN_TIER_FEATURE_ROWS} rows` };
    }
    out[tier] = cleaned;
  }
  return { ok: true, value: out };
}
