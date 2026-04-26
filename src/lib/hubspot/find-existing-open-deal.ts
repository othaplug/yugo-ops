import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";

const HS_CONTACTS_SEARCH = "https://api.hubapi.com/crm/v3/objects/contacts/search";

/**
 * If the contact has a HubSpot deal that is not closed won/lost, return it so we can skip creating another deal.
 * Returns null when duplicate check cannot run (no email, no closed-stage config, or no matching deals).
 */
export async function findExistingOpenDealForContactEmail(
  sb: SupabaseClient,
  token: string,
  email: string,
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
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealname,dealstage`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dealRes.ok) continue;
    const deal = (await dealRes.json()) as {
      properties?: { dealname?: string; dealstage?: string };
    };
    const stage = String(deal.properties?.dealstage ?? "").trim();
    if (closed.has(stage)) continue;
    return {
      dealId,
      dealName: String(deal.properties?.dealname ?? "").trim(),
      dealStageId: stage,
    };
  }
  return null;
}
