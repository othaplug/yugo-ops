/** Words ignored when matching all tokens against item names */
const STOP_WORDS = new Set([
  "small",
  "large",
  "big",
  "little",
  "old",
  "new",
  "the",
  "a",
  "an",
]);

export function parseQuantityFromLine(text: string): { name: string; qty: number } {
  const t = text.trim();
  const leadingNum = t.match(/^(\d+)\s+(.+)/);
  if (leadingNum) {
    return { name: leadingNum[2].trim(), qty: parseInt(leadingNum[1], 10) };
  }
  const trailingNum = t.match(/(.+?)\s*[x×]\s*(\d+)/i);
  if (trailingNum) {
    const qty = parseInt(trailingNum[2], 10);
    const name = trailingNum[1].trim();
    const idx = trailingNum.index ?? 0;
    const after = t.slice(idx + trailingNum[0].length);
    const looksLikeDimensions =
      /^\s*["']/.test(after) ||
      /^\s*["']?\s*(?:deep|wide|high|long|tall)\b/i.test(after) ||
      /^\s*(?:cm|mm|in\.|in\b|ft\.|ft\b)\b/i.test(after) ||
      (/\d\s*["']/.test(t) && qty > 8) ||
      (qty > 24 && /\b(wide|deep|high|tall|long|sectional|sofa|desk|table)\b/i.test(t));
    if (!looksLikeDimensions && qty >= 1 && qty <= 99) {
      return { name, qty };
    }
  }
  return { name: t, qty: 1 };
}

export type ItemWeightLike = {
  slug: string;
  item_name: string;
  weight_score?: number;
  active?: boolean;
};

/** Fuzzy filter: substring or all significant words appear in item name */
export function fuzzyFilterItemWeights<T extends ItemWeightLike>(query: string, items: T[]): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return items.filter((w) => w.active !== false);
  const words = q.split(/\s+/).filter(Boolean);
  const sigWords = words.filter((w) => !STOP_WORDS.has(w));
  const needle = sigWords.length ? sigWords : words;
  const pool = items.filter((w) => w.active !== false);
  const scored = pool.filter((w) => {
    const name = w.item_name.toLowerCase();
    if (name.includes(q)) return true;
    return needle.every((wd) => name.includes(wd));
  });
  return scored.sort((a, b) => {
    const an = a.item_name.toLowerCase().includes(q) ? 0 : 1;
    const bn = b.item_name.toLowerCase().includes(q) ? 0 : 1;
    return an - bn;
  });
}

const FRAGILE_KW = [
  "marble",
  "glass",
  "crystal",
  "porcelain",
  "mirror",
  "antique",
  "art",
  "sculpture",
];

export function nameImpliesFragile(name: string): boolean {
  const n = name.toLowerCase();
  return FRAGILE_KW.some((k) => n.includes(k));
}

export type MatchConfidence = "high" | "medium" | "low";

export function matchPastedLineToItem<T extends ItemWeightLike>(
  parsedName: string,
  items: T[],
): { item: T | null; confidence: MatchConfidence } {
  const lower = parsedName.toLowerCase().trim();
  const words = lower.split(/\s+/).filter((w) => !STOP_WORDS.has(w) && w.length > 1);
  let best: T | null = null;
  let bestScore = 0;
  const pool = items.filter((w) => w.active !== false);
  for (const w of pool) {
    const name = w.item_name.toLowerCase();
    const slug = w.slug.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (name.includes(word)) score += 2;
      if (slug.includes(word)) score += 1;
    }
    if (name.includes(lower)) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = w;
    }
  }
  if (!best || bestScore < 2) return { item: null, confidence: "low" };
  if (bestScore >= 8 || best.item_name.toLowerCase().includes(lower)) {
    return { item: best, confidence: "high" };
  }
  if (bestScore >= 4) return { item: best, confidence: "medium" };
  return { item: best, confidence: "low" };
}
