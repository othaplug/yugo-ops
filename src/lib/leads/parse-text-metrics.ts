/**
 * Extract weight and dimension hints from freeform lead text (forms, email paste, messages).
 */

const WEIGHT_PATTERNS: RegExp[] = [
  /(\d+(?:\.\d+)?)\s*(?:lbs?|lb\.?|pounds?)\b/gi,
  /\b(\d+(?:\.\d+)?)\s*#\b/g,
  /(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\b/gi,
];

const DIM_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:\"|″|in(?:ches?)?|')\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:\"|″|in(?:ches?)?|')(?:\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:\"|″|in(?:ches?)?|'))?/gi;

function kgToLb(kg: number): number {
  return kg * 2.20462;
}

/**
 * Returns the largest single weight in pounds found in text, or null.
 */
export function extractMaxWeightLbsFromText(text: string): number | null {
  const t = (text || "").trim();
  if (!t) return null;
  let max: number | null = null;

  for (const re of WEIGHT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const n = parseFloat(m[1]!);
      if (!Number.isFinite(n) || n <= 0) continue;
      const lb = /kg|kilo/i.test(m[0]) ? kgToLb(n) : n;
      if (max == null || lb > max) max = lb;
    }
  }

  return max != null ? Math.round(max * 10) / 10 : null;
}

/**
 * First plausible L×W×H snippet for coordinator display (not strict parsing).
 */
export function extractDimensionsSnippet(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  DIM_PATTERN.lastIndex = 0;
  const m = DIM_PATTERN.exec(t);
  if (!m) return null;
  const a = m[1];
  const b = m[2];
  const c = m[3];
  return c ? `${a}" x ${b}" x ${c}"` : `${a}" x ${b}"`;
}

export type ParsedTextMetrics = {
  maxWeightLbs: number | null;
  dimensionsSnippet: string | null;
};

export function parseLeadTextMetrics(text: string): ParsedTextMetrics {
  return {
    maxWeightLbs: extractMaxWeightLbsFromText(text),
    dimensionsSnippet: extractDimensionsSnippet(text),
  };
}
