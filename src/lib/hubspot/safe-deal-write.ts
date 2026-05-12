/**
 * Safe wrapper for every HubSpot deal create/update.
 *
 * Why this exists: we lost weeks of OPS+ data because callers wrote raw
 * slugs (`access: "ground_floor"`, `service_type: "local_move"`,
 * `move_size: "1br"`) to enum properties whose portal enum values are
 * `"Ground floor"` / `"Local Move"` / `"1BR"`. HubSpot rejects the whole
 * payload with HTTP 400 on a single bad enum value, so a typo in one
 * field would silently wipe the entire write.
 *
 * Every deal write in OPS+ MUST go through one of these two functions.
 * Each:
 *   1. Strips empty strings / nullish values so partial updates never
 *      wipe data ("missing" is HubSpot's "no change", "" is "set blank").
 *   2. Logs a warning when a known enum property receives a value not in
 *      the portal's allowed-values set — and removes that field from
 *      the payload so other properties still write through.
 *   3. Returns the HubSpot Response so callers can decide retry / abort.
 *
 * Enum tables come from the portal property definitions (verified live
 * via `/crm/v3/properties/deals/<name>` on 2026-05-12). Mirror any new
 * portal options here whenever the owner adds dropdown values.
 */

const HS_DEAL_BASE = "https://api.hubapi.com/crm/v3/objects/deals"

/** Each tuple is (property internal name, set of allowed enum values). */
const ENUM_PORTAL_VALUES: Record<string, ReadonlySet<string>> = {
  access: new Set([
    "Ground floor",
    "Elevator",
    "Basement",
    "Second floor",
    "Third floor+",
    "Combinaton (Ground floor & Second floor)",
  ]),
  access_to: new Set([
    "Ground floor",
    "Elevator",
    "Basement",
    "Second floor",
    "Third floor+",
    "Combinaton (Ground floor & Second floor)",
  ]),
  move_size: new Set([
    "Small",
    "Studio",
    "1BR",
    "1BR + Den",
    "2BR",
    "2BR + Den",
    "3BR",
    "4BR+",
    "Commercial",
    "Specialty",
    "Single Item",
  ]),
  service_type: new Set([
    "Local Move",
    "Long-Distance Move",
    "Office Move",
    "Specialty Move",
    "White Glove Move",
    "Home Delivery",
    "White Glove Delivery",
    "Other",
    "Event Services",
    "Single Item",
  ]),
  dealtype: new Set(["newbusiness", "existingbusiness"]),
  lost_reason: new Set([
    "Too Expensive",
    "Chose Competitor",
    "Date Unavailable",
    "Scope Changed",
    "No Response",
    "Timing",
    "Other",
    "DIY",
  ]),
}

/**
 * Drop empty values and check enum constraints. Any enum value that
 * isn't in the portal's allowed set is logged and removed (so the rest
 * of the payload still writes — the alternative is HubSpot 400-ing the
 * entire request).
 */
export function sanitizeDealProperties(props: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(props)) {
    if (raw === null || raw === undefined) continue
    const value = typeof raw === "string" ? raw : String(raw)
    if (!value || !value.trim()) continue
    const trimmed = value.trim()
    const allowed = ENUM_PORTAL_VALUES[key]
    if (allowed && !allowed.has(trimmed)) {
      console.warn(
        `[hubspot] sanitizeDealProperties: skipping ${key}="${trimmed}" ` +
          `(not in portal enum). Update the slug→enum map in ` +
          `deal-properties-builder.ts or add the option in HubSpot.`,
      )
      continue
    }
    out[key] = trimmed
  }
  return out
}

/** PATCH a deal with sanitized properties. Logs body when HubSpot returns non-2xx. */
export async function safePatchDeal(
  token: string,
  dealId: string,
  properties: Record<string, unknown>,
): Promise<Response> {
  const sanitized = sanitizeDealProperties(properties)
  if (Object.keys(sanitized).length === 0) {
    // Synthesize a 204 — nothing to write, no error to report.
    return new Response(null, { status: 204 })
  }
  const res = await fetch(`${HS_DEAL_BASE}/${dealId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: sanitized }),
  })
  if (!res.ok) {
    const text = await res.clone().text().catch(() => "")
    console.error(
      `[hubspot] safePatchDeal failed: deal=${dealId} status=${res.status} ` +
        `props=${JSON.stringify(Object.keys(sanitized))} body=${text.slice(0, 400)}`,
    )
  }
  return res
}

/** POST a new deal with sanitized properties. */
export async function safeCreateDeal(
  token: string,
  body: { properties: Record<string, unknown>; associations?: unknown },
): Promise<Response> {
  const sanitized = sanitizeDealProperties(body.properties)
  const payload: Record<string, unknown> = { properties: sanitized }
  if (body.associations) payload.associations = body.associations
  const res = await fetch(HS_DEAL_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.clone().text().catch(() => "")
    console.error(
      `[hubspot] safeCreateDeal failed: status=${res.status} ` +
        `props=${JSON.stringify(Object.keys(sanitized))} body=${text.slice(0, 400)}`,
    )
  }
  return res
}
