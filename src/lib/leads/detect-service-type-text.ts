export type DetectedServiceType = { slug: string; confidence: number };

/**
 * Infer canonical quote `service_type` slug from free text (same vocabulary as Webflow mapping).
 * RISSD-style language maps to white_glove (no dedicated quote type yet).
 */
export function detectServiceTypeFromText(message: string, inventoryText: string): DetectedServiceType | null {
  const text = `${message || ""} ${inventoryText || ""}`.toLowerCase();
  if (!text.trim()) return null;

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
