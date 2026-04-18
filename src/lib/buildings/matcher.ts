import type { SupabaseClient } from "@supabase/supabase-js"

import {
  escapeIlikePattern,
  extractCanadianPostalCode,
  normalizeAddressForMatch,
} from "./normalize-address"
import type { BuildingProfileRow } from "./types"

type Db = SupabaseClient

function tokenForIlike(normalized: string): string {
  const parts = normalized.split(" ").filter(Boolean)
  const core = parts.slice(0, 6).join(" ")
  return core.length >= 6 ? core : normalized.slice(0, 40)
}

/**
 * Match institutional building profile: fuzzy address, proximity, or single postal hit.
 */
export async function matchBuildingProfile(
  sb: Db,
  address: string,
  lat?: number | null,
  lng?: number | null,
): Promise<BuildingProfileRow | null> {
  const raw = (address || "").trim()
  if (raw.length < 6) return null

  const normalized = normalizeAddressForMatch(raw)
  if (normalized.length >= 8) {
    const tok = escapeIlikePattern(tokenForIlike(normalized))
    const { data: fuzzyRows } = await sb
      .from("building_profiles")
      .select("*")
      .ilike("address", `%${tok}%`)
      .limit(1)
    const row = fuzzyRows?.[0] as BuildingProfileRow | undefined
    if (row) return row
  }

  if (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    const { data: rpcRows, error: rpcErr } = await sb.rpc("find_nearby_building", {
      search_lat: lat,
      search_lng: lng,
      radius_meters: 50,
    })
    if (!rpcErr && rpcRows?.[0]) return rpcRows[0] as BuildingProfileRow
  }

  const postal = extractCanadianPostalCode(raw)
  if (postal) {
    const { data: postalRows } = await sb
      .from("building_profiles")
      .select("*")
      .eq("postal_code", postal)
    if (postalRows?.length === 1) return postalRows[0] as BuildingProfileRow
  }

  return null
}
