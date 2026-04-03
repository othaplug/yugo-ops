import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuoteIdPrefix, quoteNumericSuffixForHubSpot } from "@/lib/quotes/quote-id";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";

const HS_CONTACTS_SEARCH = "https://api.hubapi.com/crm/v3/objects/contacts/search";
const HS_CONTACTS = "https://api.hubapi.com/crm/v3/objects/contacts";
const HS_DEALS = "https://api.hubapi.com/crm/v3/objects/deals";

/** HubSpot-defined deal→contact association type (portal-specific; override via env). */
function dealToContactAssociationTypeId(): number {
  const raw = process.env.HUBSPOT_DEAL_CONTACT_ASSOCIATION_TYPE_ID;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function tierOrServiceLabel(quote: Record<string, unknown>): string {
  const rt = (quote.recommended_tier as string)?.trim();
  if (rt) return rt.replace(/_/g, " ");
  const st = (quote.service_type as string)?.trim() || "move";
  return st.replace(/_/g, " ");
}

function essentialPrice(quote: Record<string, unknown>): number | null {
  const tiers = quote.tiers as Record<string, { price?: number }> | null | undefined;
  const t =
    tiers?.essential?.price ??
    tiers?.curated?.price ??
    tiers?.essentials?.price ??
    null;
  if (typeof t === "number" && !Number.isNaN(t)) return t;
  const cp = quote.custom_price;
  if (cp != null) {
    const n = Number(cp);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

/**
 * Find or create HubSpot contact by email; returns HubSpot contact id.
 */
export async function findOrCreateHubSpotContact(
  token: string,
  opts: { email: string; firstName: string; lastName: string; phone?: string | null },
): Promise<string | null> {
  const email = opts.email.trim().toLowerCase();
  if (!email) return null;

  const searchRes = await fetch(HS_CONTACTS_SEARCH, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      limit: 1,
    }),
  });

  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { results?: { id: string }[] };
    const id = searchData.results?.[0]?.id;
    if (id) return id;
  }

  const createRes = await fetch(HS_CONTACTS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        firstname: opts.firstName || "",
        lastname: opts.lastName || "",
        email,
        ...(opts.phone?.trim() ? { phone: opts.phone.trim() } : {}),
      },
    }),
  });

  if (!createRes.ok) {
    const t = await createRes.text();
    console.warn("[hubspot] create contact failed:", createRes.status, t);
    return null;
  }

  const contactData = (await createRes.json()) as { id?: string };
  return contactData.id ?? null;
}

/**
 * After a quote is sent from Yugo+ without a linked HubSpot deal, create a deal
 * and associate the client contact. Best-effort — returns null on failure.
 */
export async function autoCreateHubSpotDealForSentQuote(opts: {
  sb: SupabaseClient;
  quote: Record<string, unknown>;
  quoteIdText: string;
  quoteUrl: string;
  clientEmail: string;
  firstName: string;
  lastName: string;
  clientPhone?: string | null;
}): Promise<{ dealId: string } | null> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return null;

  const { sb, quote, quoteIdText, quoteUrl, clientEmail, firstName, lastName, clientPhone } = opts;

  const stageId = await resolveHubSpotStageInternalId(sb, "quote_sent");
  if (!stageId) {
    console.warn("[hubspot] auto-create deal skipped: hubspot_stage_quote_sent not configured");
    return null;
  }

  const prefix = await getQuoteIdPrefix(sb);
  const jobNo = quoteNumericSuffixForHubSpot(quoteIdText, prefix);
  const price = essentialPrice(quote);
  const dealName = [firstName, lastName, "—", tierOrServiceLabel(quote), "—", quote.move_date || ""]
    .filter((x) => String(x).trim().length > 0)
    .join(" ")
    .trim() || `Quote ${quoteIdText}`;

  const contactId = await findOrCreateHubSpotContact(token, {
    email: clientEmail,
    firstName,
    lastName,
    phone: clientPhone ?? null,
  });

  const properties: Record<string, string> = {
    dealname: dealName.slice(0, 200),
    dealstage: stageId,
    quote_url: quoteUrl,
    service_type: String(quote.service_type || "").trim(),
    move_date: String(quote.move_date || "").trim(),
    move_size: String(quote.move_size || "").trim().toLowerCase(),
    pick_up_address: String(quote.from_address || "").trim(),
    drop_off_address: String(quote.to_address || "").trim(),
    access_from: String(quote.from_access || "").trim().toLowerCase().replace(/\s+/g, "_"),
    access_to: String(quote.to_access || "").trim().toLowerCase().replace(/\s+/g, "_"),
    firstname: firstName,
    lastname: lastName,
    package_type: String(quote.recommended_tier || "signature").trim(),
  };
  if (price != null) properties.amount = String(price);
  if (jobNo) properties.job_no = jobNo;

  const body: Record<string, unknown> = { properties };
  if (contactId) {
    body.associations = [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: dealToContactAssociationTypeId(),
          },
        ],
      },
    ];
  }

  const dealRes = await fetch(HS_DEALS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!dealRes.ok) {
    const t = await dealRes.text();
    console.warn("[hubspot] create deal failed:", dealRes.status, t);
    return null;
  }

  const dealData = (await dealRes.json()) as { id?: string };
  const dealId = dealData.id;
  if (!dealId) return null;

  return { dealId };
}
