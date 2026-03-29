/**
 * Yugo quote service area: Ontario GTA-centric postal prefixes + optional geocode fallback.
 * Moves with both endpoints clearly outside this footprint are blocked unless the coordinator overrides.
 */

import { geocode } from "@/lib/mapbox/driving-distance";

export type ServiceAreaType = "local" | "long_distance" | "out_of_area" | "unknown";

export type ServiceAreaResult = {
  type: ServiceAreaType;
  serviceable: boolean;
  warning?: string;
  from_prefix: string | null;
  to_prefix: string | null;
};

type ConfigLike = Map<string, string> | Record<string, string>;

function cfgGet(config: ConfigLike, key: string): string | undefined {
  if (config instanceof Map) return config.get(key);
  return config[key];
}

function parsePrefixList(config: ConfigLike, key: string, fallback: string[]): string[] {
  const raw = cfgGet(config, key);
  if (!raw) return fallback;
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      return arr.map((x) => String(x).toUpperCase().trim()).filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

/** First letter of Canadian FSA (e.g. M5V → M, A1A → A). */
export function fsaToPostalDistrict(fsa: string | null | undefined): string | null {
  if (!fsa || fsa.length < 1) return null;
  return fsa.charAt(0).toUpperCase();
}

/**
 * Classify a pair of pickup / drop-off FSAs using configurable primary + extended prefix lists.
 * Matches coordinator spec: both outside primary+extended → out_of_area (not serviceable from Toronto base).
 */
export function checkServiceAreaFromFsas(
  fromFsa: string | null,
  toFsa: string | null,
  config: ConfigLike,
): ServiceAreaResult {
  const primary = parsePrefixList(config, "service_area_primary_prefixes", ["M", "L"]);
  const extended = parsePrefixList(config, "service_area_extended_prefixes", ["K", "N"]);

  const fromDistrict = fsaToPostalDistrict(fromFsa);
  const toDistrict = fsaToPostalDistrict(toFsa);

  const fromInPrimary = fromDistrict != null && primary.includes(fromDistrict);
  const toInPrimary = toDistrict != null && primary.includes(toDistrict);
  const fromInExtended = fromDistrict != null && extended.includes(fromDistrict);
  const toInExtended = toDistrict != null && extended.includes(toDistrict);

  if (fromInPrimary && toInPrimary) {
    return { type: "local", serviceable: true, from_prefix: fromDistrict, to_prefix: toDistrict };
  }

  if ((fromInPrimary && toInExtended) || (fromInExtended && toInPrimary)) {
    return {
      type: "long_distance",
      serviceable: true,
      warning: "Cross-zone move (primary ↔ extended service area). Long-distance pricing rules may apply.",
      from_prefix: fromDistrict,
      to_prefix: toDistrict,
    };
  }

  if ((fromInPrimary || fromInExtended) && !toInPrimary && !toInExtended) {
    return {
      type: "long_distance",
      serviceable: true,
      warning: "Destination is outside standard service area. Verify feasibility.",
      from_prefix: fromDistrict,
      to_prefix: toDistrict,
    };
  }

  if (!fromInPrimary && !fromInExtended && (toInPrimary || toInExtended)) {
    return {
      type: "long_distance",
      serviceable: true,
      warning: "Pickup is outside standard service area. Verify feasibility.",
      from_prefix: fromDistrict,
      to_prefix: toDistrict,
    };
  }

  if (!fromInPrimary && !fromInExtended && !toInPrimary && !toInExtended) {
    if (fromDistrict != null && toDistrict != null) {
      return {
        type: "out_of_area",
        serviceable: false,
        warning:
          "Both addresses are outside Yugo's Greater Toronto / Southern Ontario service area. This move cannot be serviced from the Toronto base without a special arrangement.",
        from_prefix: fromDistrict,
        to_prefix: toDistrict,
      };
    }
  }

  return {
    type: "unknown",
    serviceable: true,
    warning: "Could not determine service area from postal codes. Verify manually.",
    from_prefix: fromDistrict,
    to_prefix: toDistrict,
  };
}

/** Rough Ontario bounding box for geocode fallback when FSAs are missing. */
function isLatLngInOntario(lat: number, lng: number): boolean {
  return lat >= 41.5 && lat <= 56.5 && lng <= -74.0 && lng >= -95.5;
}

/**
 * When FSAs are missing, geocode both ends; if both resolve outside Ontario, treat as out_of_area for local ops.
 */
export async function refineServiceAreaWithGeocode(
  fromAddress: string,
  toAddress: string,
  postalResult: ServiceAreaResult,
): Promise<ServiceAreaResult> {
  if (postalResult.type !== "unknown") return postalResult;
  if (!postalResult.warning?.includes("Could not determine")) return postalResult;

  const [fromGeo, toGeo] = await Promise.all([
    geocode(fromAddress.trim()),
    geocode(toAddress.trim()),
  ]);
  if (!fromGeo || !toGeo) return postalResult;

  const fromOn = isLatLngInOntario(fromGeo.lat, fromGeo.lng);
  const toOn = isLatLngInOntario(toGeo.lat, toGeo.lng);

  if (!fromOn && !toOn) {
    return {
      type: "out_of_area",
      serviceable: false,
      warning:
        "Both addresses appear to be outside Ontario relative to the Toronto operating base. This move cannot be serviced from the Toronto base without a special arrangement.",
      from_prefix: postalResult.from_prefix,
      to_prefix: postalResult.to_prefix,
    };
  }

  return postalResult;
}

export async function evaluateServiceAreaForQuote(
  fromAddress: string,
  toAddress: string,
  config: ConfigLike,
): Promise<ServiceAreaResult> {
  const extractFsa = (addr: string) => {
    const m = addr.match(/\b([A-Z]\d[A-Z])\s*\d[A-Z]\d\b/i);
    return m ? m[1].toUpperCase() : null;
  };
  const fromFsa = extractFsa(fromAddress);
  const toFsa = extractFsa(toAddress);
  const base = checkServiceAreaFromFsas(fromFsa, toFsa, config);
  if (base.type === "unknown" && !fromFsa && !toFsa) {
    return refineServiceAreaWithGeocode(fromAddress, toAddress, base);
  }
  return base;
}
