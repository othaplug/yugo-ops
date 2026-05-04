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
  "will",
  "item",
  "needs",
  "assembly",
  "required",
  "may",
  "must",
  "can",
])

type GuardRule = { test: RegExp; slug: string; skip?: RegExp }

/** Highest-specificity substring guards so paste lines resolve before generic fuzzy scoring (global: quotes, moves, WG paste). */
const GUARD_SLUG_RULES: GuardRule[] = [
  {
    test: /\bsoundbar\b.*\bsubwoofer\b|\bsubwoofer\b.*\bsoundbar\b|\bwireless\s+subwoofer\b/i,
    slug: "soundbar-subwoofer",
  },
  { test: /\bsoundbar\b/i, slug: "soundbar" },
  { test: /\bsubwoofer\b/i, slug: "subwoofer" },
  { test: /\bbedding\s+bundle\b/i, slug: "bedding-bundle" },
  { test: /\bsheet\s+set\b/i, slug: "sheet-set" },
  { test: /\bbedding\b/i, slug: "bedding-bundle" },
  { test: /\bmattress\s+(protector|topper)\b/i, slug: "mattress-protector" },
  { test: /\bduvet\b|\bcomforter\b|\bshams?\b|\blinen\b/i, slug: "duvet" },
  { test: /\bpillow|\bpillows\b/i, slug: "pillows-set" },
  {
    test: /\bnight\s+table\b|\bnightstand\b|\bnight\s+stand\b|\bbedside\b|\bbed\s+side\b/i,
    slug: "nightstand",
  },
  {
    test: /\bside\s+table\b|\bend\s+table\b/i,
    slug: "side-end-table",
    skip: /\bcoffee\s+table\b|\bdining\s+table\b|\bconsole\s+table\b|\bkitchen\s+table\b/i,
  },
]

export function parseQuantityFromLine(text: string): { name: string; qty: number } {
  const t = text.trim()
  const leadingNum = t.match(/^(\d+)\s+(.+)/)
  if (leadingNum) {
    return { name: leadingNum[2].trim(), qty: parseInt(leadingNum[1], 10) }
  }
  const trailingNum = t.match(/(.+?)\s*[x×]\s*(\d+)/i)
  if (trailingNum) {
    const qty = parseInt(trailingNum[2], 10)
    const name = trailingNum[1].trim()
    const idx = trailingNum.index ?? 0
    const after = t.slice(idx + trailingNum[0].length)
    const looksLikeDimensions =
      /^\s*["']/.test(after) ||
      /^\s*["']?\s*(?:deep|wide|high|long|tall)\b/i.test(after) ||
      /^\s*(?:cm|mm|in\.|in\b|ft\.|ft\b)\b/i.test(after) ||
      (/\d\s*["']/.test(t) && qty > 8) ||
      (qty > 24 && /\b(wide|deep|high|tall|long|sectional|sofa|desk|table)\b/i.test(t))
    if (!looksLikeDimensions && qty >= 1 && qty <= 99) {
      return { name, qty }
    }
  }
  return { name: t, qty: 1 }
}

export type ItemWeightLike = {
  slug: string
  item_name: string
  weight_score?: number
  active?: boolean
}

/** Fuzzy filter: substring or all significant words appear in item name */
export function fuzzyFilterItemWeights<T extends ItemWeightLike>(query: string, items: T[]): T[] {
  const q = query.toLowerCase().trim()
  if (!q) return items.filter((w) => w.active !== false)
  const words = q.split(/\s+/).filter(Boolean)
  const sigWords = words.filter((w) => !STOP_WORDS.has(w))
  const needle = sigWords.length ? sigWords : words
  const pool = items.filter((w) => w.active !== false)
  const scored = pool.filter((w) => {
    const name = w.item_name.toLowerCase()
    if (name.includes(q)) return true
    return needle.every((wd) => name.includes(wd))
  })
  return scored.sort((a, b) => {
    const an = a.item_name.toLowerCase().includes(q) ? 0 : 1
    const bn = b.item_name.toLowerCase().includes(q) ? 0 : 1
    return an - bn
  })
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
]

export function nameImpliesFragile(name: string): boolean {
  const n = name.toLowerCase()
  return FRAGILE_KW.some((k) => n.includes(k))
}

export type MatchConfidence = "high" | "medium" | "low"

function findBySlug<T extends ItemWeightLike>(pool: T[], slug: string): T | undefined {
  const k = slug.toLowerCase()
  return pool.find((w) => w.slug.toLowerCase() === k)
}

function guardedSlug(lower: string): string | null {
  for (const { test, slug, skip } of GUARD_SLUG_RULES) {
    if (skip?.test(lower)) continue
    if (test.test(lower)) return slug
  }
  return null
}

/** Adjustable bases and televisions after guards (still slug-order–specific). */
function contextualSlugHints(line: string): string[] {
  const l = line.toLowerCase()
  const hints: string[] = []

  const adjustableCue =
    /\badjustable\b.*\b(base|frame)\b|\bpower\s+base\b|\badjustable\s+base\b/i.test(l)
  if (adjustableCue) {
    if (
      /\bcal\s*king\b|\bcalifornia\s+king\b|\bsplit\s+king\b|\bking\b.*\bsplit\b/i.test(l)
    ) {
      hints.push("adjustable-base-king")
    } else if (/\bking\b/i.test(l)) {
      hints.push("adjustable-base-king")
    } else if (/\bqueen\b/i.test(l)) {
      hints.push("adjustable-base-queen")
    } else if (/\btwin\s*xl\b|\bxl\b.*\btwin\b/i.test(l)) {
      hints.push("adjustable-base-twin-xl")
    } else {
      hints.push("adjustable-base-queen")
    }
  }

  const tvFurnitureCue =
    /\btv\s+stand\b|\bentertainment\s+(center|centre|unit)\b|\bmedia\s+console\b/i.test(l)
  if (tvFurnitureCue) {
    hints.push(
      "tv-stand-large",
      "tv-stand-small",
      "tv-stand",
      "tv-stand-entertainment-centre",
    )
  }

  const tvPanelCue =
    /\btv\b|\btelevision\b|\bflat\s*screen\b|\boled\b|\bqled\b|\b(?:uhd|4k)\s+tv\b/i.test(l) &&
    !tvFurnitureCue

  if (tvPanelCue) {
    const xlCue =
      /\b(?:77|83|85|86)\b|\b75\b|"?\s*7[5-9]\d?\s*"|inch.*\b(?:7[5-9]|8[0-9])\b|\btv\b.*\b(?:7[5-9]|8[0-6])\b/i.test(
        l,
      )
    const sixtyFiveCue =
      /\b(?:65|70)\b|"?\s*6[5-9]\d?\s*"|inch.*\b6[5-9]\b|\btv\b.*\b6[5-9]\b|\b6[5-9]\s*(?:inch|\")?\s*\btv\b/i.test(
        l,
      )
    if (xlCue) {
      hints.push("tv-xl", "tv-large", "tv-large-65", "tv-mounted-flat")
    } else if (sixtyFiveCue) {
      hints.push("tv-large-65", "tv-large", "tv-medium", "tv-mounted-flat")
    } else if (/\b(?:55|60|58|50|48|43|42|40)\b/.test(l)) {
      hints.push("tv-medium", "tv-large", "tv-mounted-flat", "tv-small")
    } else {
      hints.push("tv-large", "tv-medium", "tv-mounted-flat", "tv-small")
    }
  }

  const seen = new Set<string>()
  return hints.filter((s) => {
    const k = s.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function normalizeWordTokens(lower: string): string[] {
  return lower
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, "").toLowerCase())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

function slugLooksLikeTvStandish(slug: string): boolean {
  return (
    slug.includes("tv-stand") ||
    slug.includes("entertainment-centre") ||
    slug.includes("entertainment-center") ||
    slug.includes("entertainment-unit")
  )
}

export function matchPastedLineToItem<T extends ItemWeightLike>(
  parsedName: string,
  items: T[],
): { item: T | null; confidence: MatchConfidence } {
  const lower = parsedName.toLowerCase().trim()
  const pool = items.filter((w) => w.active !== false)

  const guard = guardedSlug(lower)
  if (guard) {
    const hit = findBySlug(pool, guard)
    if (hit) return { item: hit, confidence: "high" }
  }

  for (const slugHint of contextualSlugHints(lower)) {
    const hit = findBySlug(pool, slugHint)
    if (hit) return { item: hit, confidence: "high" }
  }

  const words = normalizeWordTokens(lower)
  let best: T | null = null
  let bestScore = 0
  const tvStandPhrase =
    /\btv\s+stand\b|\bentertainment\s+(center|centre|unit)\b|\bmedia\s+console\b/i.test(lower)

  for (const w of pool) {
    const name = w.item_name.toLowerCase()
    const slug = w.slug.toLowerCase()
    let score = 0
    for (const word of words) {
      if (word === "stand" && !/\btv\s+stand\b/i.test(lower)) continue
      if (word === "tv" && slugLooksLikeTvStandish(slug) && !tvStandPhrase) continue

      if (name.includes(word)) score += 2
      else if (slug.includes(word)) score += 1
    }
    if (name.includes(lower)) score += 10
    if (score > bestScore) {
      bestScore = score
      best = w
    }
  }
  if (!best || bestScore < 2) return { item: null, confidence: "low" }
  if (bestScore >= 8 || best.item_name.toLowerCase().includes(lower)) {
    return { item: best, confidence: "high" }
  }
  if (bestScore >= 4) return { item: best, confidence: "medium" }
  return { item: best, confidence: "low" }
}
