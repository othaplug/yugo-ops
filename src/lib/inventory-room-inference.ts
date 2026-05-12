/**
 * Room inference for move inventory items.
 *
 * Priority:
 *   1. item_weights slug → canonical room (from DB catalog)
 *   2. Item name keyword patterns
 *   3. Fallback: "Other"
 *
 * Also handles white-glove / delivery service types which use
 * "Delivery Items" instead of room names.
 */

/** Normalize item_weights.room slug → display name */
export function catalogRoomToDisplay(room: string | null | undefined): string | null {
  switch ((room ?? "").toLowerCase()) {
    case "bedroom":     return "Bedroom";
    case "living_room": return "Living Room";
    case "kitchen":     return "Kitchen";
    case "dining":
    case "dining_room": return "Dining Room";
    case "garage":      return "Garage";
    case "kids":        return "Kids Room";
    case "bathroom":    return "Bathroom";
    case "outdoor":     return "Outdoor";
    case "office":      return "Office";
    case "specialty":   return "Specialty";
    case "other":
    case "":
    case null:
    case undefined:     return null;
    default:            return null;
  }
}

/**
 * Infer a display room name from an item's slug + name.
 * Falls back to "Other" if nothing matches.
 *
 * @param slug  - item_weights.slug value (may be null for custom items)
 * @param name  - human-readable item name / description
 * @param catalogRoom - pre-fetched item_weights.room for this slug (optional)
 */
export function inferRoomFromItem(
  slug: string | null | undefined,
  name: string | null | undefined,
  catalogRoom?: string | null,
): string {
  // 1. Catalog room from item_weights (caller can pre-fetch or pass null)
  if (catalogRoom) {
    const display = catalogRoomToDisplay(catalogRoom);
    if (display) return display;
  }

  const n = (name ?? "").toLowerCase();
  const s = (slug ?? "").toLowerCase();

  // 2. Slug-based fast path (common slugs that catalog marks as "other" but clearly belong)
  if (/\b(bed-queen|bed-king|bed-double|bed-twin|bed-frame|mattress|dresser|nightstand|wardrobe|armoire|chest-of-drawers|vanity|mirror-large|mirror-small)\b/.test(s)) {
    return "Bedroom";
  }
  if (/\b(sofa|couch|sectional|coffee-table|side-end-table|side-table|end-table|lamp-floor|lamp-table|tv-stand|bookshelf|bookcase|armchair|recliner|ottom|console-table|fireplace|display-cabinet)\b/.test(s)) {
    return "Living Room";
  }
  if (/\b(dining-table|dining-chair|bar-stool|buffet|sideboard|china-cabinet|wine-rack)\b/.test(s)) {
    return "Dining Room";
  }
  if (/\b(desk|office-chair|filing-cabinet)\b/.test(s)) {
    return "Office";
  }
  if (/\b(patio|outdoor|deck-chair|bbq|grill|bicycle|bike)\b/.test(s)) {
    return "Outdoor";
  }

  // 3. Name-based keyword fallback
  if (/\b(bed frame|bedframe|mattress|dresser|nightstand|wardrobe|armoire|chest of drawer|headboard|platform bed|bunk bed)\b/.test(n)) {
    return "Bedroom";
  }
  if (/\b(sofa|couch|sectional|loveseat|recliner|armchair|accent chair|coffee table|lamp|tv stand|entertainment unit|bookshelf|bookcase|display cabinet|console table|ottoman|pouf|fireplace)\b/.test(n)) {
    return "Living Room";
  }
  if (/\b(dining table|dining chair|bar stool|buffet|sideboard|china cabinet|hutch|bar cart|wine rack|kitchen table)\b/.test(n)) {
    return "Dining Room";
  }
  if (/\b(fridge|refrigerator|stove|range|oven|microwave|dishwasher|washer|dryer|freezer|kitchen cabinet|kitchen island|wine fridge)\b/.test(n)) {
    return "Kitchen";
  }
  if (/\b(desk|office chair|filing cabinet|monitor stand)\b/.test(n)) {
    return "Office";
  }
  if (/\b(patio|outdoor|garden|deck chair|bbq|barbecue|grill|lawn)\b/.test(n)) {
    return "Outdoor";
  }
  if (/\b(treadmill|elliptical|exercise bike|weight bench|gym|workbench|tool chest|bicycle|bike|toolbox)\b/.test(n)) {
    return "Garage";
  }
  if (/\b(crib|changing table|high chair|toy chest|kids desk|rocking chair|glider)\b/.test(n)) {
    return "Kids Room";
  }
  if (/\b(bathroom cabinet|vanity|medicine cabinet|linen cabinet)\b/.test(n)) {
    return "Bathroom";
  }
  if (/\b(side.?end table|end table|side table|night table)\b/.test(n)) {
    return "Living Room";
  }

  return "Other";
}

/** Room label for white-glove / delivery service types */
export const DELIVERY_ROOM_LABEL = "Delivery Items";

/** Returns true for service types that use delivery-style item grouping */
export function isDeliveryServiceType(serviceType: string | null | undefined): boolean {
  const s = (serviceType ?? "").toLowerCase();
  return ["white_glove", "single_item", "b2b_delivery", "b2b_oneoff", "b2b_one_off"].includes(s);
}
