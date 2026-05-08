import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";
import { serviceCategory, type ServiceCategory } from "@/lib/hubspot/deal-name";

const HS_CONTACTS_SEARCH = "https://api.hubapi.com/crm/v3/objects/contacts/search";

/** Deals older than this are not considered duplicates even if still "open". */
const DUPLICATE_LOOKBACK_DAYS = 90;

/**
 * If the contact has a recent open HubSpot deal that matches the service category,
 * return it so we can skip creating another deal.
 *
 * Returns null when:
 *  - email is empty
 *  - closed-stage config is missing (cannot determine what "open" means)
 *  - no open matching deal found within the 90-day window
 *
 * @param serviceTypeCat  Category of the job being created.  When provided, only
 *                        deals in the same category (b2b / pm / residential) are
 *                        flagged as duplicates. Omit to match any category (legacy).
 */
export async function findExistingOpenDealForContactEmail(
  sb: SupabaseClient,
  token: string,
  email: string,
  opts?: { serviceTypeCat?: ServiceCategory },
): Promise<{ dealId: string; dealName: string; dealStageId: string } | null> {
  const em = email.trim().toLowerCase();
  if (!em) return null;

  const [closedWon, closedLost] = await Promise.all([
    resolveHubSpotStageInternalId(sb, "closed_won"),
    resolveHubSpotStageInternalId(sb, "closed_lost"),
  ]);
  const closed = new Set(
    [closedWon, closedLost].filter((x): x is string => !!x?.trim()),
  );
  if (closed.size === 0) return null;

  // 90-day cutoff: deals created before this timestamp are ignored
  const cutoffMs = Date.now() - DUPLICATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const searchRes = await fetch(HS_CONTACTS_SEARCH, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: em }] }],
      limit: 1,
    }),
  });

  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as { results?: { id: string }[] };
  const contactId = searchData.results?.[0]?.id;
  if (!contactId) return null;

  const assocRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}/associations/deals`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!assocRes.ok) return null;
  const assocData = (await assocRes.json()) as {
    results?: { id?: string; toObjectId?: string }[];
  };
  const dealIds = (assocData.results ?? [])
    .map((r) => String(r.toObjectId ?? r.id ?? "").trim())
    .filter((id) => id.length > 0);
  if (dealIds.length === 0) return null;

  for (const dealId of dealIds.slice(0, 25)) {
    const dealRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage,service_type,createdate`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dealRes.ok) continue;
    const deal = (await dealRes.json()) as {
      properties?: {
        dealname?: string;
        dealstage?: string;
        service_type?: string;
        createdate?: string;
      };
    };

    // Skip closed deals
    const stage = String(deal.properties?.dealstage ?? "").trim();
    if (closed.has(stage)) continue;

    // Skip deals outside the 90-day window
    const cdRaw = deal.properties?.createdate;
    if (cdRaw) {
      const createdMs = new Date(cdRaw).getTime();
      if (Number.isFinite(createdMs) && createdMs < cutoffMs) continue;
    }

    // Skip deals with a mismatched service category (B2B vs residential)
    if (opts?.serviceTypeCat) {
      const dealSt = String(deal.properties?.service_type ?? "").trim();
      // Only enforce category when the deal has a service_type stored
      if (dealSt) {
        const dealCat = serviceCategory(dealSt)
        if (dealCat !== opts.serviceTypeCat) continue;
      }
    }

    return {
      dealId,
      dealName: String(deal.properties?.dealname ?? "").trim(),
      dealStageId: stage,
    };
  }
  return null;
}
