export type DetectedServiceType = { slug: string; confidence: number };

/**
 * Infer canonical quote `service_type` slug from free text (same vocabulary as Webflow mapping).
 * RISSD-style language maps to white_glove (no dedicated quote type yet).
 */
const PM_INQUIRY_KEYWORDS = [
  "property management",
  "tenant",
  "renovation",
  "unit turnover",
  "building",
  "condo corp",
  "superintendent",
  "suite",
  "displacement",
  "managed properties",
  "portfolio",
  "property manager",
  "landlord",
  "turnover",
];

function textLooksLikePmInquiry(text: string): boolean {
  const lower = text.toLowerCase();
  return PM_INQUIRY_KEYWORDS.some((kw) => lower.includes(kw));
}

export function detectServiceTypeFromText(message: string, inventoryText: string): DetectedServiceType | null {
  const text = `${message || ""} ${inventoryText || ""}`.toLowerCase();
  if (!text.trim()) return null;

  if (textLooksLikePmInquiry(text)) {
    return { slug: "pm_inquiry", confidence: 0.88 };
  }

  if (
    /specialty\s*transport|white\s*glove\s*delivery|freight\s*delivery|b2b\s*delivery|commercial\s*delivery|one[-\s]?off\s*delivery/i.test(
      text,
    )
  ) {
    return { slug: "b2b_oneoff", confidence: 0.82 };
  }

  if (
    /event|venue|chairs.*rent|temporary|setup.*teardown|after.*event|during.*event|restaurant.*chairs|reception|gala|ceremony/i.test(
      text,
    )
  ) {
    return { slug: "event", confidence: 0.9 };
  }

  if (
    /move.*around|rearrange|within.*same|same address|reorganize|move.*from.*room.*to.*room|shuffle|in-house|internal move/i.test(
      text,
    )
  ) {
    return { slug: "labour_only", confidence: 0.85 };
  }

  if (
    /office|desk|workstation|cubicle|commercial|business|conference|board.*room|server|it equipment/i.test(text)
  ) {
    return { slug: "office_move", confidence: 0.85 };
  }

  if (
    /(^|\b)(transport|delivery)\b.*\b(from|to|pickup|drop)/i.test(text) ||
    /\b(need|want|looking\s+for)\s+(a\s+)?(transport|delivery|mover)\b/i.test(text)
  ) {
    return { slug: "b2b_oneoff", confidence: 0.72 };
  }

  if (/single|one item|just.*one|only.*a|deliver.*one|pickup.*one|couch.*only|just.*sofa|one.*piece/i.test(text)) {
    return { slug: "single_item", confidence: 0.8 };
  }

  if (/piano|grand piano|art.*collection|antique|safe|pool table|hot tub|marble.*table/i.test(text)) {
    return { slug: "specialty", confidence: 0.85 };
  }

  if (/white glove|premium.*handling|high.*value|delicate|luxury.*delivery|fragile.*collection/i.test(text)) {
    return { slug: "white_glove", confidence: 0.8 };
  }

  if (
    /ship.*to.*facility|receive.*inspect|warehouse|from.*calgary|from.*montreal|third.*party.*carrier|day.*and.*ross|fedex.*freight|rissd/i.test(
      text,
    )
  ) {
    return { slug: "white_glove", confidence: 0.9 };
  }

  if (/bin.*rental|plastic.*bin|eco.*bin|moving.*bin|rent.*bin/i.test(text)) {
    return { slug: "bin_rental", confidence: 0.9 };
  }

  if (/bedroom|apartment|condo|house|moving from|moving to|new home|new place/i.test(text)) {
    return { slug: "local_move", confidence: 0.7 };
  }

  return null;
}
