import { getDisplayLabel } from "@/lib/displayLabels";

/**
 * Convert snake_case, kebab-case, or lowercase text to Title Case.
 * "piano_upright" → "Piano Upright"
 * "in_progress"  → "In Progress"
 * "walk_up_3rd"  → "Walk Up 3rd"
 */
export function toTitleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Known acronyms (lowercase keys) → always rendered ALL CAPS after sentence casing.
 * Add tokens here when lowercase API/DB values should display as abbreviations (e.g. eta → ETA).
 */
const KNOWN_ACRONYMS = new Set(
  [
    "eta",
    "etd",
    "ata",
    "pod",
    "bol",
    "ltl",
    "ftl",
    "gps",
    "crm",
    "api",
    "url",
    "uri",
    "sms",
    "mms",
    "pdf",
    "roi",
    "kpi",
    "sku",
    "upc",
    "rfid",
    "nfc",
    "vat",
    "gst",
    "hst",
    "pst",
    "est",
    "utc",
    "gmt",
    "tls",
    "ssl",
    "smtp",
    "vpn",
    "uuid",
    "imei",
    "usd",
    "cad",
    "eur",
    "gbp",
    "mxn",
    "aud",
    "nzd",
    "jpy",
    "cny",
    "chf",
    "inr",
    "b2b",
    "b2c",
    "coi",
    "doi",
    "rma",
    "erp",
    "wms",
    "tms",
    "sco",
    "lbs",
    "kg",
    "km",
    "sqft",
    "cuft",
    "mph",
    "kph",
  ].map((w) => w.toLowerCase()),
);

/**
 * Sentence case for short UI phrases:
 * - First word with letters: uppercase only its first letter; other words lowercased.
 * - Tokens that are all A–Z in the source (2–6 letters) stay ALL CAPS (ETA, NYC, US).
 * - Tokens in KNOWN_ACRONYMS render ALL CAPS even if source was mixed/lower case (eta → ETA).
 * - Leading non-letters before the first word are kept ("5 paid" → "5 Paid").
 */
export function toSentenceCase(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (!t) return "";

  const segments = t.split(/(\s+)/);
  let appliedFirstLexical = false;

  const mapSegment = (raw: string): string => {
    if (/^\s+$/.test(raw)) return raw;

    const lead = raw.match(/^[^A-Za-z0-9]*/)?.[0] ?? "";
    const trail = raw.match(/[^A-Za-z0-9]*$/)?.[0] ?? "";
    const innerStart = lead.length;
    const innerEnd = raw.length - trail.length;
    const core = innerEnd > innerStart ? raw.slice(innerStart, innerEnd) : "";

    if (!core) return raw;

    const hasLetter = /[a-z]/i.test(core);
    if (!hasLetter) return raw;

    const lower = core.toLowerCase();

    // Preserve ALL-CAPS letter-only abbreviations from source (ETA, US, NYC)
    if (/^[A-Z]{2,6}$/.test(core)) {
      appliedFirstLexical = true;
      return lead + core + trail;
    }

    if (KNOWN_ACRONYMS.has(lower)) {
      if (!appliedFirstLexical) appliedFirstLexical = true;
      return lead + lower.toUpperCase() + trail;
    }

    if (!appliedFirstLexical) {
      appliedFirstLexical = true;
      const m = lower.match(/^([^a-z]*)([a-z])(.*)$/);
      if (!m) return lead + lower + trail;
      return lead + m[1] + m[2].toUpperCase() + m[3] + trail;
    }

    return lead + lower + trail;
  };

  return segments.map(mapSegment).join("");
}

/**
 * Public-facing access label: map known DB keys (e.g. loading_dock) to copy; title-case unknowns.
 */
export function formatAccessForDisplay(access: string | null | undefined): string | null {
  if (!access || !access.trim()) return null;
  const label = getDisplayLabel(access.trim(), "access");
  return label.trim() ? label : null;
}

/**
 * Format address for display: omit "Canada" / "CA" at the end for Canadian addresses.
 * "203 Bentworth Ave, North York, Ontario M6A 1P9, Canada" → "203 Bentworth Ave, North York, Ontario M6A 1P9"
 */
export function formatAddressForDisplay(address: string | null | undefined): string {
  if (!address || !address.trim()) return "";
  let out = address.trim();
  out = out.replace(/,?\s*Canada\s*$/i, "").replace(/,?\s*CA\s*$/i, "").trim();
  return out.replace(/,+\s*$/, "").trim() || address.trim();
}
