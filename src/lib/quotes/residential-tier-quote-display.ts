import type { TierFeature, ResidentialQuoteTierMetaMap } from "@/app/quote/[quoteId]/quote-shared";
import { TIER_META, TIER_ORDER } from "@/app/quote/[quoteId]/quote-shared";

/** platform_config keys */
export const QUOTE_RESIDENTIAL_TIER_FEATURES_KEY = "quote_residential_tier_features";
export const QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY = "quote_residential_tier_meta_overrides";

const TIER_KEYS = TIER_ORDER as unknown as readonly string[];

/** Signature tier: lines shown after “Everything in Essential, plus:” on tier cards (merged into Essential by `key` for “Your Move Includes”). */
export const DEFAULT_SIGNATURE_ADDITIONS: TierFeature[] = [
  {
    key: "wrapping",
    card: "Full protective wrapping for all furniture",
    title: "Full protective wrapping for all furniture",
    desc: "Every piece individually wrapped and padded",
    iconName: "Armchair",
  },
  {
    key: "mattress_tv",
    card: "Mattress and TV protection included",
    title: "Mattress and TV protection",
    desc: "Dedicated covers for mattresses and screens",
    iconName: "Shield",
  },
  {
    key: "placement",
    card: "Room-of-choice placement throughout the home",
    title: "Room-of-choice placement",
    desc: "Every piece placed exactly where you want it",
    iconName: "Compass",
  },
  {
    key: "wardrobe",
    card: "Wardrobe box for immediate use",
    title: "Wardrobe box for immediate use",
    desc: "Hang your clothes directly, no folding needed",
    iconName: "Shirt",
  },
  {
    key: "debris",
    card: "Debris and packaging removal at completion",
    title: "Debris and packaging removal",
    desc: "We clear away all packing materials post-move",
    iconName: "Trash2",
  },
  {
    key: "valuation",
    card: "Enhanced valuation coverage",
    title: "Enhanced valuation coverage",
    desc: "Up to $2,500 per item protection",
    iconName: "ShieldCheck",
    highlight: true,
  },
  {
    key: "assembly",
    card: "Full disassembly & reassembly",
    title: "Full disassembly & reassembly",
    desc: "Complete furniture breakdown and expert reassembly",
    iconName: "Wrench",
  },
  {
    key: "floor",
    card: "Floor & door frame protection",
    title: "Floor & door frame protection",
    desc: "Runners, booties, and corner guards throughout",
    iconName: "Home",
  },
  {
    key: "equipment",
    card: "All equipment included",
    title: "All equipment included",
    desc: "Dollies, straps, tools — nothing extra to rent",
    iconName: "Toolbox",
  },
];

/**
 * Estate tier: lines after “Everything in Signature, plus:” — canonical additive list (admin Tier feature lines).
 * No GPS or debris here; white glove covers art/antiques (no separate “premium art” line).
 */
export const DEFAULT_ESTATE_ADDITIONS: TierFeature[] = [
  {
    key: "coordinator",
    card: "Dedicated move coordinator from booking to final placement",
    title: "Dedicated move coordinator",
    desc: "One point of contact from booking through final placement",
    iconName: "UserCircle",
  },
  {
    key: "walkthrough",
    card: "Pre-move walkthrough with room-by-room plan",
    title: "Pre-move walkthrough",
    desc: "Documented room-by-room plan before we touch anything",
    iconName: "ClipboardCheck",
  },
  {
    key: "wrapping",
    card: "Full furniture wrapping and protection throughout",
    title: "Full furniture wrapping and protection throughout",
    desc: "Every piece individually wrapped, padded, and protected",
    iconName: "Armchair",
  },
  {
    key: "assembly",
    card: "Complex disassembly & precision reassembly",
    title: "Complex disassembly & precision reassembly",
    desc: "Complete furniture breakdown and expert reassembly",
    iconName: "Wrench",
  },
  {
    key: "floor",
    card: "Floor and property protection throughout",
    title: "Floor and property protection throughout",
    desc: "Premium runners, booties, and corner guards at every touchpoint",
    iconName: "Home",
  },
  {
    key: "packing",
    card: "All packing materials and supplies included",
    title: "All packing materials and supplies included",
    desc: "Boxes, wrapping, and all protection materials provided",
    iconName: "Suitcase",
  },
  {
    key: "white_glove",
    card: "White glove handling for furniture, art, and high-value items",
    title: "White glove handling",
    desc: "Specialist-level care for your most valued possessions",
    iconName: "Star",
    highlight: true,
  },
  {
    key: "art",
    card: "Premium art and antique handling",
    title: "Premium art and antique handling",
    desc: "Museum-grade care for fine art, antiques, and specialty pieces",
    iconName: "FrameCorners",
  },
  {
    key: "placement",
    card: "Precision placement in every room",
    title: "Precision placement in every room",
    desc: "Every piece positioned exactly where you envision it",
    iconName: "Compass",
  },
  {
    key: "valuation",
    card: "Full replacement valuation coverage",
    title: "Full replacement valuation coverage",
    desc: "Maximum protection for your most valuable items",
    iconName: "ShieldCheck",
    highlight: true,
  },
  {
    key: "equipment",
    card: "All equipment included",
    title: "All equipment included",
    desc: "Professional-grade dollies, straps, tools, and specialty equipment",
    iconName: "Toolbox",
  },
  {
    key: "inventory",
    card: "Pre-move inventory planning and oversight",
    title: "Pre-move inventory planning",
    desc: "Full inventory documented before and after your move",
    iconName: "FrameCorners",
  },
  {
    key: "concierge",
    card: "30-day post-move concierge support",
    title: "30-day concierge support",
    desc: "Post-move support and questions answered within 30 days",
    iconName: "Clock",
  },
  {
    key: "perks",
    card: "Exclusive partner offers & perks",
    title: "Exclusive partner offers and perks",
    desc: "Access to partner discounts and member benefits",
    iconName: "Gift",
  },
];

const DEFAULT_ESSENTIAL: TierFeature[] = [
  {
    key: "truck",
    card: "Dedicated Moving Truck",
    title: "Dedicated Moving Truck",
    desc: "Climate-protected, equipped for your move",
    iconName: "Truck",
  },
  {
    key: "crew",
    card: "Professional crew of [N]",
    title: "Professional crew of [N]",
    desc: "Licensed, insured, background-checked movers",
    iconName: "Users",
  },
  {
    key: "wrapping",
    card: "Protective wrapping for key furniture",
    title: "Protective wrapping for key furniture",
    desc: "Key pieces wrapped in quilted moving blankets",
    iconName: "Armchair",
  },
  {
    key: "assembly",
    card: "Basic disassembly & reassembly",
    title: "Basic disassembly & reassembly",
    desc: "We take it apart and put it back together",
    iconName: "Wrench",
  },
  {
    key: "floor",
    card: "Floor & entryway protection",
    title: "Floor & entryway protection",
    desc: "Runners, booties, and corner guards throughout",
    iconName: "Home",
  },
  {
    key: "equipment",
    card: "All standard equipment included",
    title: "All standard equipment included",
    desc: "Dollies, straps, tools — nothing extra to rent",
    iconName: "Toolbox",
  },
  {
    key: "valuation",
    card: "Standard valuation coverage",
    title: "Standard valuation coverage",
    desc: "Basic protection for your belongings",
    iconName: "Shield",
  },
  {
    key: "tracking",
    card: "Real-time GPS tracking",
    title: "Real-time GPS tracking",
    desc: "Follow your move live from any device",
    iconName: "MapPin",
  },
];

/** Canonical storage shape for platform_config (additive Signature/Estate). */
export type ResidentialTierFeaturesStorage = {
  essential: TierFeature[];
  signature: TierFeature[] | { additions: TierFeature[] };
  estate: TierFeature[] | { additions: TierFeature[] };
};

export const DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE: ResidentialTierFeaturesStorage = {
  essential: DEFAULT_ESSENTIAL,
  signature: { additions: DEFAULT_SIGNATURE_ADDITIONS },
  estate: { additions: DEFAULT_ESTATE_ADDITIONS },
};

/**
 * Collapse the same perk under different tier wording when merging Essential + Signature + Estate
 * (e.g. “All standard equipment” vs “All equipment included”, repeated GPS / debris / wardrobe in legacy DB).
 */
export function inclusionDedupeKey(f: TierFeature): string {
  const c = f.card.trim().toLowerCase();
  const t = f.title.trim().toLowerCase();
  const blob = `${c} ${t}`;

  if (blob.includes("real-time") && blob.includes("gps")) return "__gps_tracking";
  if (blob.includes("gps") && (blob.includes("track") || blob.includes("tracking"))) return "__gps_tracking";

  if (blob.includes("dedicated moving truck") || (blob.includes("truck") && blob.includes("dedicated"))) {
    return "__dedicated_truck";
  }
  if (
    (blob.includes("professional") && blob.includes("crew")) ||
    (blob.includes("professional") && blob.includes("movers"))
  ) {
    return "__professional_crew";
  }

  if (blob.includes("wardrobe box")) return "__wardrobe_box";

  if (blob.includes("debris") && blob.includes("packaging")) return "__debris_packaging_removal";

  // Whole-property floor line (Estate) vs entryway / general floor protection (Essential + Signature)
  if (blob.includes("floor") && blob.includes("property")) return "__floor_property_throughout";
  if (blob.includes("floor") && (blob.includes("entryway") || blob.includes("protection"))) {
    return "__floor_protection_interior";
  }

  if (blob.includes("valuation")) return "__valuation_moving";

  if (
    blob.includes("wrapping") &&
    blob.includes("furniture") &&
    !blob.includes("for key furniture") &&
    !blob.includes("protective wrapping for key")
  ) {
    return "__full_furniture_wrapping";
  }

  if (
    (blob.includes("all ") || blob.includes("standard ")) &&
    blob.includes("equipment") &&
    (blob.includes("included") || blob.includes("rent") || blob.includes("dollies"))
  ) {
    return "__equipment_included";
  }

  if (blob.includes("basic disassembly") && blob.includes("reassembly")) return "__basic_disassembly_reassembly";
  if (
    blob.includes("reassembly") &&
    (blob.includes("complex disassembly") ||
      blob.includes("full disassembly") ||
      blob.includes("precision reassembly"))
  ) {
    return "__premium_disassembly";
  }

  if (blob.includes("white glove")) return "__white_glove_handling";
  if (blob.includes("premium handling") && (blob.includes("art") || blob.includes("antique"))) {
    return "__white_glove_handling";
  }

  if (
    blob.includes("precision placement") ||
    (blob.includes("precision") && blob.includes("every room")) ||
    blob.includes("room-of-choice") ||
    blob.includes("room of choice") ||
    (blob.includes("placement") && blob.includes("throughout the home"))
  ) {
    return "__furniture_placement";
  }

  return c;
}

/**
 * When `key` is set on a row, higher tiers replace lower tiers on that key (resolved inclusions).
 * Otherwise fall back to heuristic `inclusionDedupeKey` for legacy JSON without keys.
 */
export function featureMergeKey(f: TierFeature): string {
  const k = f.key?.trim();
  if (k) return k.toLowerCase();
  return inclusionDedupeKey(f);
}

/** Plain-text include line → same semantic key as `inclusionDedupeKey` (quote PDF / API tier lists). */
export function inclusionDedupeKeyFromLine(line: string): string {
  return inclusionDedupeKey({ card: line, title: line, desc: "", iconName: "Dot" });
}

/** Merge tier include strings: same semantic key → keep the later row (higher tier wins). */
export function mergeResidentialIncludeLinesDeduped(base: string[], extra: string[]): string[] {
  const out = [...base];
  const keyToIndex = new Map<string, number>();
  out.forEach((line, i) => keyToIndex.set(inclusionDedupeKeyFromLine(line), i));
  for (const line of extra) {
    const k = inclusionDedupeKeyFromLine(line);
    if (keyToIndex.has(k)) {
      out[keyToIndex.get(k)!] = line;
    } else {
      keyToIndex.set(k, out.length);
      out.push(line);
    }
  }
  return out;
}

/**
 * Tier card “plus:” bullets: show additions whose key is new vs the resolved lower tier,
 * or any row marked `highlight` (major upgrades you still want called out on the card).
 */
export function filterTierCardAdditions(priorResolved: TierFeature[], additions: TierFeature[]): TierFeature[] {
  const priorKeys = new Set(priorResolved.map((f) => featureMergeKey(f)));
  const out: TierFeature[] = [];
  const seen = new Set<string>();
  for (const f of additions) {
    const k = featureMergeKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    if (!priorKeys.has(k) || f.highlight === true) out.push(f);
  }
  return out;
}

/** Merge `extra` into `base`; when a merge key already exists, replace with the later row (tier upgrade). */
function appendDedupedPreferLater(base: TierFeature[], extra: TierFeature[]): TierFeature[] {
  const out = base.map((f) => ({ ...f }));
  const keyToIndex = new Map<string, number>();
  out.forEach((f, i) => keyToIndex.set(featureMergeKey(f), i));
  for (const f of extra) {
    const k = featureMergeKey(f);
    if (keyToIndex.has(k)) {
      const idx = keyToIndex.get(k)!;
      out[idx] = { ...f };
    } else {
      keyToIndex.set(k, out.length);
      out.push({ ...f });
    }
  }
  return out;
}

/** Legacy full-tier arrays: one row per merge key (last occurrence wins, preserves rough order). */
function dedupeResidentialTierFeatureRows(rows: TierFeature[]): TierFeature[] {
  const lastIdx = new Map<string, number>();
  rows.forEach((f, i) => lastIdx.set(featureMergeKey(f), i));
  const out: TierFeature[] = [];
  const emitted = new Set<string>();
  rows.forEach((f, i) => {
    const k = featureMergeKey(f);
    if (lastIdx.get(k) !== i) return;
    if (emitted.has(k)) return;
    emitted.add(k);
    out.push(f);
  });
  return out;
}

/**
 * Merge saved `additions` with code defaults: canonical order, override by `card` key (case-insensitive),
 * then append rows in `parsed` whose `card` is not in defaults. Heals truncated platform_config JSON.
 */
function mergeAdditionsWithCanon(parsed: TierFeature[], canon: TierFeature[]): TierFeature[] {
  const byMergeKey = new Map<string, TierFeature>();
  const byCard = new Map<string, TierFeature>();
  for (const f of parsed) {
    byMergeKey.set(featureMergeKey(f), f);
    byCard.set(f.card.trim().toLowerCase(), f);
  }
  const canonCards = new Set(canon.map((c) => c.card.trim().toLowerCase()));
  const out: TierFeature[] = [];
  for (const c of canon) {
    const mk = featureMergeKey(c);
    let chosen = byMergeKey.get(mk) ?? byCard.get(c.card.trim().toLowerCase()) ?? c;
    if (!chosen.key?.trim() && c.key?.trim()) chosen = { ...chosen, key: c.key };
    out.push(chosen);
  }
  const seenMerge = new Set(out.map((f) => featureMergeKey(f)));
  for (const f of parsed) {
    const mk = featureMergeKey(f);
    const ck = f.card.trim().toLowerCase();
    if (seenMerge.has(mk)) continue;
    if (canonCards.has(ck)) continue;
    seenMerge.add(mk);
    out.push(f);
  }
  return out;
}

/** Expanded lists for InclusionsShowcase, hydration, etc. */
export function expandResidentialTierFeaturesStorage(s: ResidentialTierFeaturesStorage): Record<(typeof TIER_ORDER)[number], TierFeature[]> {
  const essential = dedupeResidentialTierFeatureRows(s.essential);
  const signatureFull = Array.isArray(s.signature)
    ? dedupeResidentialTierFeatureRows(s.signature)
    : dedupeResidentialTierFeatureRows(appendDedupedPreferLater(essential, s.signature.additions));
  const estateFull = Array.isArray(s.estate)
    ? dedupeResidentialTierFeatureRows(s.estate)
    : dedupeResidentialTierFeatureRows(appendDedupedPreferLater(signatureFull, s.estate.additions));
  return { essential, signature: signatureFull, estate: estateFull };
}

export type ResidentialTierFeatureBundle = {
  full: Record<(typeof TIER_ORDER)[number], TierFeature[]>;
  /** Bullets after the “plus” line on tier cards (empty when using legacy full-array layout). */
  cardAdditions: { signature: TierFeature[]; estate: TierFeature[] };
  useAdditiveCards: { signature: boolean; estate: boolean };
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
  const row: TierFeature = { card: o.card, title: o.title, desc: o.desc, iconName: o.iconName };
  if (typeof o.key === "string" && o.key.trim()) row.key = o.key.trim();
  if (o.highlight === true) row.highlight = true;
  return row;
}

function parseAdditionsArray(arr: unknown): TierFeature[] | null {
  if (!Array.isArray(arr)) return null;
  const out: TierFeature[] = [];
  for (const item of arr) {
    const row = parseTierFeatureRow(item);
    if (!row) return null;
    out.push(row);
  }
  return out;
}

/**
 * Parse platform JSON into storage. Legacy: `signature` / `estate` as full arrays.
 * Invalid tiers fall back to defaults for that tier.
 */
export function parseResidentialTierFeaturesStorage(raw: string | null | undefined): ResidentialTierFeaturesStorage {
  const d = DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE;
  if (!raw?.trim()) return d;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return d;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return d;
  const p = parsed as Record<string, unknown>;

  let essential = d.essential;
  if (Array.isArray(p.essential)) {
    const cleaned: TierFeature[] = [];
    for (const item of p.essential) {
      const row = parseTierFeatureRow(item);
      if (row) cleaned.push(row);
    }
    if (cleaned.length >= 3) {
      essential = cleaned.map((row) => {
        if (row.key?.trim()) return row;
        const match = DEFAULT_ESSENTIAL.find((def) => def.card.trim().toLowerCase() === row.card.trim().toLowerCase());
        return match?.key ? { ...row, key: match.key } : row;
      });
    }
  }

  let signature: ResidentialTierFeaturesStorage["signature"] = d.signature;
  if (p.signature !== undefined) {
    if (Array.isArray(p.signature)) {
      const cleaned: TierFeature[] = [];
      for (const item of p.signature) {
        const row = parseTierFeatureRow(item);
        if (row) cleaned.push(row);
      }
      if (cleaned.length >= 3) signature = cleaned;
    } else if (p.signature && typeof p.signature === "object" && !Array.isArray(p.signature)) {
      const adds = parseAdditionsArray((p.signature as { additions?: unknown }).additions);
      if (adds) signature = { additions: mergeAdditionsWithCanon(adds, DEFAULT_SIGNATURE_ADDITIONS) };
    }
  }

  let estate: ResidentialTierFeaturesStorage["estate"] = d.estate;
  if (p.estate !== undefined) {
    if (Array.isArray(p.estate)) {
      const cleaned: TierFeature[] = [];
      for (const item of p.estate) {
        const row = parseTierFeatureRow(item);
        if (row) cleaned.push(row);
      }
      if (cleaned.length >= 3) estate = cleaned;
    } else if (p.estate && typeof p.estate === "object" && !Array.isArray(p.estate)) {
      const adds = parseAdditionsArray((p.estate as { additions?: unknown }).additions);
      if (adds) estate = { additions: mergeAdditionsWithCanon(adds, DEFAULT_ESTATE_ADDITIONS) };
    }
  }

  return { essential, signature, estate };
}

export function buildResidentialTierFeatureBundle(raw: string | null | undefined): ResidentialTierFeatureBundle {
  const storage = parseResidentialTierFeaturesStorage(raw);
  const full = expandResidentialTierFeaturesStorage(storage);
  const useAdditiveCards = {
    signature: !Array.isArray(storage.signature),
    estate: !Array.isArray(storage.estate),
  };
  const essentialRows = dedupeResidentialTierFeatureRows(storage.essential);
  const sigAdds =
    useAdditiveCards.signature && !Array.isArray(storage.signature) ? storage.signature.additions : [];
  const estAdds = useAdditiveCards.estate && !Array.isArray(storage.estate) ? storage.estate.additions : [];
  const cardAdditions = {
    signature:
      useAdditiveCards.signature && !Array.isArray(storage.signature)
        ? filterTierCardAdditions(essentialRows, sigAdds)
        : [],
    estate:
      useAdditiveCards.estate && !Array.isArray(storage.estate)
        ? filterTierCardAdditions(full.signature, estAdds)
        : [],
  };
  return { full, cardAdditions, useAdditiveCards };
}

/** Quote API / PDF include lines: row 0 = truck, row 1 = crew from live quote data; rest = feature titles. */
export function hydrateResidentialIncludeTitles(
  rows: TierFeature[],
  truckLabel: string,
  crewLine: string,
): string[] {
  return rows.map((f, i) => {
    if (i === 0) return truckLabel;
    if (i === 1) return crewLine;
    return f.title;
  });
}

function tierFeatureContentEqual(a: TierFeature, b: TierFeature): boolean {
  return (
    a.card === b.card &&
    a.title === b.title &&
    a.desc === b.desc &&
    a.iconName === b.iconName &&
    a.key === b.key &&
    a.highlight === b.highlight
  );
}

/**
 * Rows present in `upperResolved` that are new or upgraded vs `lowerResolved` (same merge key, different content).
 * Used when converting legacy full Signature/Estate arrays into additive `{ additions }` storage.
 */
export function additionsRelativeToLowerTier(
  lowerResolved: TierFeature[],
  upperResolved: TierFeature[],
): TierFeature[] {
  const lowerByKey = new Map(lowerResolved.map((f) => [featureMergeKey(f), f]));
  const out: TierFeature[] = [];
  for (const f of upperResolved) {
    const k = featureMergeKey(f);
    const match = lowerByKey.get(k);
    if (!match || !tierFeatureContentEqual(match, f)) out.push(f);
  }
  return out;
}

/**
 * Merge platform JSON over code defaults → expanded tier lists (backward compatible).
 * @deprecated Prefer `buildResidentialTierFeatureBundle` when you need card additions / layout flags.
 */
export function mergeResidentialTierFeaturesFromConfig(raw: string | null | undefined): Record<string, TierFeature[]> {
  return expandResidentialTierFeaturesStorage(parseResidentialTierFeaturesStorage(raw));
}

/** Built-in expanded lists (same as empty platform_config). */
export const DEFAULT_RESIDENTIAL_TIER_FEATURES: Record<string, TierFeature[]> = expandResidentialTierFeaturesStorage(
  DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE,
);

/** Deep-merge tagline + footer + inclusionsIntro per tier over TIER_META. */
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
      ...(typeof b.inclusionsIntro === "string" ? { inclusionsIntro: b.inclusionsIntro } : {}),
    };
  }
  return out;
}

/** Editable tier card copy in admin UI. */
export type ResidentialTierMetaFormRow = { tagline: string; footer: string; inclusionsIntro: string };

export function tierMetaFormFromMerged(map: ResidentialQuoteTierMetaMap): Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow> {
  return {
    essential: {
      tagline: map.essential.tagline,
      footer: map.essential.footer ?? "",
      inclusionsIntro: map.essential.inclusionsIntro ?? "",
    },
    signature: {
      tagline: map.signature.tagline,
      footer: map.signature.footer ?? "",
      inclusionsIntro: map.signature.inclusionsIntro ?? "",
    },
    estate: {
      tagline: map.estate.tagline,
      footer: map.estate.footer ?? "",
      inclusionsIntro: map.estate.inclusionsIntro ?? "",
    },
  };
}

export function tierMetaEqualToDefaults(form: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow>): boolean {
  for (const tier of TIER_ORDER) {
    const base = TIER_META[tier];
    const row = form[tier];
    if (!row || !base) return false;
    if (row.tagline !== base.tagline) return false;
    if ((row.footer ?? "") !== (base.footer ?? "")) return false;
    if ((row.inclusionsIntro ?? "") !== (base.inclusionsIntro ?? "")) return false;
  }
  return true;
}

export function serializeTierMetaOverrides(
  form: Record<(typeof TIER_ORDER)[number], ResidentialTierMetaFormRow>,
): string {
  return JSON.stringify(
    {
      essential: { tagline: form.essential.tagline, footer: form.essential.footer },
      signature: {
        tagline: form.signature.tagline,
        footer: form.signature.footer,
        inclusionsIntro: form.signature.inclusionsIntro,
      },
      estate: {
        tagline: form.estate.tagline,
        footer: form.estate.footer,
        inclusionsIntro: form.estate.inclusionsIntro,
      },
    },
    null,
    2,
  );
}

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
    if (b.inclusionsIntro !== undefined && typeof b.inclusionsIntro !== "string") {
      return { ok: false, error: `${tier}.inclusionsIntro must be a string` };
    }
    out[tier] = {
      tagline: typeof b.tagline === "string" ? b.tagline : out[tier].tagline,
      footer: typeof b.footer === "string" ? b.footer : out[tier].footer,
      inclusionsIntro:
        typeof b.inclusionsIntro === "string" ? b.inclusionsIntro : out[tier].inclusionsIntro,
    };
  }
  return { ok: true, value: out };
}

export function defaultTierMetaOverridesJson(): string {
  return serializeTierMetaOverrides(tierMetaFormFromMerged(TIER_META));
}

function storageJsonStable(s: ResidentialTierFeaturesStorage): string {
  return JSON.stringify(s);
}

/** True when storage matches built-in defaults (save empty override). */
export function tierFeaturesStorageEqualToDefaults(s: ResidentialTierFeaturesStorage): boolean {
  return storageJsonStable(s) === storageJsonStable(DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE);
}

/** True when expanded tier maps match built-in expanded defaults (e.g. legacy callers). */
export function tierFeaturesEqualToDefaults(f: Record<string, TierFeature[]>): boolean {
  const def = DEFAULT_RESIDENTIAL_TIER_FEATURES;
  for (const tier of TIER_ORDER) {
    const a = f[tier];
    const b = def[tier];
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
    }
  }
  return true;
}

export function defaultTierFeaturesJson(): string {
  return JSON.stringify(DEFAULT_RESIDENTIAL_TIER_FEATURES_STORAGE, null, 2);
}

export function cloneResidentialTierFeatures(f: Record<string, TierFeature[]>): Record<string, TierFeature[]> {
  return JSON.parse(JSON.stringify(f)) as Record<string, TierFeature[]>;
}

/** Minimum rows for Essential only. Signature/Estate additions may be empty. */
export const MIN_TIER_FEATURE_ROWS = 3;

export const MIN_SIGNATURE_ESTATE_ADDITION_ROWS = 0;

/**
 * Parse admin / advanced JSON into storage. Validates essential length; legacy full arrays must meet MIN rows.
 */
export function parseAdminTierFeaturesJson(
  raw: string,
): { ok: true; value: ResidentialTierFeaturesStorage } | { ok: false; error: string } {
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
  const inner = parseResidentialTierFeaturesStorage(raw);
  if (inner.essential.length < MIN_TIER_FEATURE_ROWS) {
    return { ok: false, error: `"essential" needs at least ${MIN_TIER_FEATURE_ROWS} rows` };
  }
  if (Array.isArray(inner.signature) && inner.signature.length < MIN_TIER_FEATURE_ROWS) {
    return { ok: false, error: `"signature" needs at least ${MIN_TIER_FEATURE_ROWS} rows when provided as a full array` };
  }
  if (Array.isArray(inner.estate) && inner.estate.length < MIN_TIER_FEATURE_ROWS) {
    return { ok: false, error: `"estate" needs at least ${MIN_TIER_FEATURE_ROWS} rows when provided as a full array` };
  }
  return { ok: true, value: inner };
}
