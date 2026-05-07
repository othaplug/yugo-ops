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
  // ── AV / Electronics ─────────────────────────────────────────────────
  {
    test: /\bsoundbar\b.*\bsubwoofer\b|\bsubwoofer\b.*\bsoundbar\b|\bwireless\s+subwoofer\b/i,
    slug: "soundbar-subwoofer",
  },
  { test: /\bsoundbar\b/i, slug: "soundbar" },
  { test: /\bsubwoofer\b/i, slug: "subwoofer" },

  // ── Bedding / soft goods (must precede "table", "stand" etc.) ─────────
  { test: /\bbedding\s+bundle\b/i, slug: "bedding-bundle" },
  { test: /\bsheet\s+set\b|\bbed\s+sheet/i, slug: "sheet-set" },
  { test: /\bbedding\b/i, slug: "bedding-bundle" },
  { test: /\bmattress\s+(protector|topper|pad|cover)\b/i, slug: "mattress-protector" },
  { test: /\bduvet\b|\bcomforter\b|\bshams?\b|\bquilt\b/i, slug: "duvet" },
  { test: /\bpillow(s|case|cover)?\b/i, slug: "pillows-set" },

  // ── Bedroom furniture ─────────────────────────────────────────────────
  {
    test: /\bnight\s+table\b|\bnightstand\b|\bnight\s+stand\b|\bbedside\b|\bbed\s+side\b/i,
    slug: "nightstand",
  },
  { test: /\badjustable\s+base\b|\bpower\s+base\b|\bmotorized\s+base\b/i, slug: "adjustable-base-queen" },

  // ── Lamps / lighting (must precede generic "table" matching) ──────────
  { test: /\btable\s+lamp(s)?\b|\bdesk\s+lamp(s)?\b/i, slug: "table-lamp" },
  { test: /\bfloor\s+lamp(s)?\b|\btorchiere\b/i, slug: "floor-lamp" },
  { test: /\bpendant\s+lamp\b|\bpendant\s+light\b/i, slug: "pendant-lamp" },
  { test: /\blamp(s)?\b/i, slug: "table-lamp" },

  // ── Cabinets (kitchen/bathroom/storage — NOT china cabinet) ───────────
  {
    test: /\bkitchen\s+cabinet(s)?\b|\bcabinet(s)?.*kitchen|\bupper\s+cabinet\b|\blower\s+cabinet\b/i,
    slug: "cabinet-kitchen",
  },
  {
    test: /\bbathroom\s+cabinet(s)?\b|\bvanity\s+cabinet\b|\bmedicine\s+cabinet\b/i,
    slug: "cabinet-bathroom",
  },
  {
    test: /\blinen\s+cabinet\b|\bstorage\s+cabinet\b|\blaundry\s+cabinet\b/i,
    slug: "cabinet-storage",
  },
  // china/display cabinet — after the specific ones so "kitchen cabinet" doesn't match here
  {
    test: /\bchina\s+cabinet\b|\bdisplay\s+cabinet\b|\bcurio\b/i,
    slug: "china-cabinet",
    skip: /\bkitchen\b|\bbathroom\b|\bvanity\b|\blinen\b|\bstorage\b/i,
  },

  // ── Art / picture frames (must precede generic "art" matching) ────────
  {
    test: /\bpicture\s+frame(s)?\b|\bphoto\s+frame(s)?\b|\bart\s+frame(s)?\b|\bframed\s+(art|photo|picture)\b/i,
    slug: "artwork-framed-medium",
  },
  { test: /\bwall\s+art\b|\bcanvas\b/i, slug: "artwork-framed-medium" },
  { test: /\bsculpture\b|\bartwork\b/i, slug: "artwork-sculpture",
    skip: /\bframe\b|\bframed\b/i },
  { test: /\bpainting(s)?\b/i, slug: "artwork-framed-large",
    skip: /\bframe\b/i },

  // ── Dining chairs (before generic "chair" matching) ───────────────────
  { test: /\bdining\s+chair(s)?\b/i, slug: "dining-chair" },
  { test: /\bbar\s+stool(s)?\b|\bcounter\s+stool(s)?\b/i, slug: "bar-stool" },

  // ── Recliners / specialty seating ─────────────────────────────────────
  { test: /\blazy\s*boy\b|\bla\s*z\s*boy\b|\brecliner\s+chair\b/i, slug: "recliner-manual" },
  { test: /\bpower\s+recliner\b|\belectric\s+recliner\b/i, slug: "recliner-power" },
  { test: /\brecliner\s+sofa\b|\breclining\s+sofa\b|\breclining\s+sectional\b/i, slug: "sectional-recliner" },
  { test: /\bsofa\s+bed\b|\bpull.?out\s+sofa\b|\bsleeper\s+sofa\b/i, slug: "sleeper-sofa" },

  // ── Fans ──────────────────────────────────────────────────────────────
  { test: /\bstanding\s+fan\b|\bfloor\s+fan\b|\btower\s+fan\b/i, slug: "standing-fan" },
  { test: /\bceiling\s+fan\b/i, slug: "ceiling-fan" },

  // ── Tables (side/end — must NOT catch dining, coffee, console, kitchen)
  {
    test: /\bside\s+table\b|\bend\s+table\b/i,
    slug: "side-table",
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
    // "small tv" / "little tv" / "tiny tv" → prefer tv-small
    const smallCue = /\bsmall\b|\blittle\b|\btiny\b|\bcompact\b|\bmini\b/i.test(l)
    const xlCue =
      /\b(?:77|83|85|86)\b|\b75\b|"?\s*7[5-9]\d?\s*"|inch.*\b(?:7[5-9]|8[0-9])\b|\btv\b.*\b(?:7[5-9]|8[0-6])\b/i.test(l)
    const sixtyFiveCue =
      /\b(?:65|70)\b|"?\s*6[5-9]\d?\s*"|inch.*\b6[5-9]\b|\btv\b.*\b6[5-9]\b|\b6[5-9]\s*(?:inch|\")?\s*\btv\b/i.test(l)
    if (smallCue && !xlCue && !sixtyFiveCue) {
      hints.push("tv-small", "tv-medium", "tv-mounted-flat")
    } else if (xlCue) {
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

/** Minimal suffix stemming so "chairs" matches "chair", "sofas" → "sofa", etc. */
function stemWord(w: string): string {
  if (w.endsWith("ves")) return w.slice(0, -3) + "f" // leaves → leaf
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y" // puppies → puppy
  if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("zes")) return w.slice(0, -2) // boxes → box
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1) // chairs → chair, sofas → sofa
  return w
}

function normalizeWordTokens(lower: string): string[] {
  return lower
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, "").toLowerCase())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .flatMap((w) => {
      const stem = stemWord(w)
      return stem !== w ? [w, stem] : [w]
    })
    .filter((w, i, arr) => arr.indexOf(w) === i) // deduplicate
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
