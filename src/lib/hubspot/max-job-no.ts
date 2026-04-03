const HS_DEALS_SEARCH = "https://api.hubapi.com/crm/v3/objects/deals/search";

/** HubSpot pages to scan when computing max job_no (100 deals per page). */
const MAX_PAGES = 250;

/**
 * Parse HubSpot job_no into a positive integer. Expects numeric suffix only;
 * tolerates stray formatting by taking leading digits when unambiguous.
 */
export function parseHubSpotJobNoValue(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return n > 0 && n <= 999_999 ? n : 0;
  }
  const m = s.match(/(\d+)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return n > 0 && n <= 999_999 ? n : 0;
}

/**
 * Walk HubSpot deals that have job_no set and return the maximum numeric value.
 * Used so OPS quote ids never collide with job numbers already on deals.
 */
export async function fetchMaxHubSpotJobNo(token: string): Promise<number> {
  let maxSeen = 0;
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [{ propertyName: "job_no", operator: "HAS_PROPERTY" }],
        },
      ],
      properties: ["job_no"],
      limit: 100,
    };
    if (after) body.after = after;

    const res = await fetch(HS_DEALS_SEARCH, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn("[hubspot] max job_no search failed:", res.status);
      break;
    }

    const json = (await res.json()) as {
      results?: { properties?: { job_no?: string | null } }[];
      paging?: { next?: { after?: string } };
    };

    const results = json.results ?? [];
    for (const deal of results) {
      const n = parseHubSpotJobNoValue(deal.properties?.job_no);
      if (n > maxSeen) maxSeen = n;
    }

    after = json.paging?.next?.after;
    if (!after || results.length === 0) break;
  }

  return maxSeen;
}
