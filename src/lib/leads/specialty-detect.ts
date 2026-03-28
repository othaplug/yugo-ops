export type SpecialtyDetected = {
  type: string;
  keyword_matched: string;
  surcharge: number;
  note: string;
};

const SPECIALTY_KEYWORDS: Record<
  string,
  { keyword: RegExp; type: string; surcharge: number }
> = {
  piano: { keyword: /piano|grand piano|upright piano/i, type: "piano", surcharge: 200 },
  art: { keyword: /\bart\b|artwork|painting|sculpture|statue/i, type: "art", surcharge: 30 },
  mirror: { keyword: /mirror|full.length mirror|full-length mirror/i, type: "mirror", surcharge: 0 },
  antique: { keyword: /antique|vintage|heirloom/i, type: "antique", surcharge: 50 },
  marble: { keyword: /marble|granite|stone table/i, type: "fragile_heavy", surcharge: 0 },
  glass: { keyword: /glass|crystal|china|porcelain/i, type: "fragile", surcharge: 0 },
  safe: { keyword: /safe|vault|gun safe/i, type: "safe", surcharge: 150 },
  pool_table: { keyword: /pool table|billiard/i, type: "pool_table", surcharge: 350 },
  hot_tub: { keyword: /hot tub|spa|jacuzzi/i, type: "hot_tub", surcharge: 500 },
  wine: { keyword: /wine collection|wine cellar|wine fridge/i, type: "wine", surcharge: 200 },
  aquarium: { keyword: /aquarium|fish tank/i, type: "aquarium", surcharge: 250 },
  gym: {
    keyword: /treadmill|elliptical|gym equipment|weight bench|peloton/i,
    type: "gym",
    surcharge: 40,
  },
};

export function detectSpecialtyItems(
  inventoryText: string | null | undefined,
  specialtyText: string | null | undefined,
): SpecialtyDetected[] {
  const combined = `${inventoryText || ""} ${specialtyText || ""}`.toLowerCase();
  const detected: SpecialtyDetected[] = [];
  const seen = new Set<string>();

  for (const [key, config] of Object.entries(SPECIALTY_KEYWORDS)) {
    if (config.keyword.test(combined) && !seen.has(config.type)) {
      seen.add(config.type);
      detected.push({
        type: config.type,
        keyword_matched: key,
        surcharge: config.surcharge,
        note: `Detected "${key}" in client description`,
      });
    }
  }

  if (/fragile|delicate|careful|expensive|valuable|handle with care/i.test(combined)) {
    detected.push({
      type: "fragile_flag",
      keyword_matched: "fragile_language",
      surcharge: 0,
      note: "Client used fragile or valuable language — consider Signature or Estate",
    });
  }

  return detected;
}

/** Map detection types to quote specialty_items keys used in QuoteFormClient. */
export function mapSpecialtyToQuoteTypes(
  detected: SpecialtyDetected[],
  inventoryAndSpecialtyText: string,
): { type: string; qty: number }[] {
  const out: { type: string; qty: number }[] = [];
  const blob = inventoryAndSpecialtyText.toLowerCase();
  const has = (t: string) => detected.some((d) => d.type === t);

  if (detected.some((d) => d.keyword_matched === "piano")) {
    out.push({ type: /grand/.test(blob) ? "piano_grand" : "piano_upright", qty: 1 });
  }
  if (has("pool_table")) out.push({ type: "pool_table", qty: 1 });
  if (has("hot_tub")) out.push({ type: "hot_tub", qty: 1 });
  if (has("wine")) out.push({ type: "wine_collection", qty: 1 });
  if (has("gym")) out.push({ type: "gym_equipment_per_piece", qty: 1 });
  if (has("aquarium")) out.push({ type: "aquarium", qty: 1 });
  if (has("safe")) out.push({ type: "safe_under_300lbs", qty: 1 });
  if (has("art") || has("mirror")) out.push({ type: "artwork_per_piece", qty: 1 });
  if (has("antique")) out.push({ type: "antique_per_piece", qty: 1 });

  const dedupe = new Map<string, number>();
  for (const r of out) dedupe.set(r.type, (dedupe.get(r.type) || 0) + r.qty);
  return [...dedupe.entries()].map(([type, qty]) => ({ type, qty }));
}
