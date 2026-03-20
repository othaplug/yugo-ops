/**
 * Abbreviate US state and Canadian province names in comma-separated addresses
 * for compact client-facing display (e.g. "Ontario" → "ON").
 */

const REGION_MAP: Record<string, string> = {
  // Canada — provinces & territories
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "northwest territories": "NT",
  "nova scotia": "NS",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  québec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
  // United States
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  "district of columbia": "DC",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

function abbrevSegment(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) return segment;

  const lower = trimmed.toLowerCase();

  // "Ontario M5A 1M3" or "OH 43215" — take leading words before postal/ZIP
  const zipLike = /\b([A-Z0-9]{3}\s?[A-Z0-9]{3}|\d{5}(-\d{4})?)\s*$/i;
  const withoutZip = trimmed.replace(zipLike, "").trim();
  const core = withoutZip || trimmed;

  const coreLower = core.toLowerCase();

  // Try longest multi-word keys first (simple scan)
  for (const [full, abbr] of Object.entries(REGION_MAP)) {
    if (coreLower === full || coreLower.startsWith(`${full} `)) {
      const rest = core.slice(full.length).trim();
      return rest ? `${abbr} ${rest}` : abbr;
    }
  }

  // Single-token match: "Ohio" at start of segment
  const firstWord = core.split(/\s+/)[0];
  if (firstWord) {
    const fw = firstWord.toLowerCase();
    const ab = REGION_MAP[fw];
    if (ab) {
      const rest = core.slice(firstWord.length).trim();
      return rest ? `${ab} ${rest}` : ab;
    }
  }

  return segment;
}

export function abbreviateAddressRegions(address: string): string {
  if (!address || !address.trim()) return address;
  const parts = address.split(",").map((p) => p.trim());
  return parts.map((p) => abbrevSegment(p)).join(", ");
}
