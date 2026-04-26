import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuoteIdPrefix, quoteNumericSuffixForHubSpot } from "@/lib/quotes/quote-id";
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";
import { findExistingOpenDealForContactEmail } from "@/lib/hubspot/find-existing-open-deal";
import type { HubSpotAutoCreateDealResult } from "@/lib/hubspot/auto-create-deal-types";

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
 * When another open deal exists for the same email, flags the quote row and returns duplicate (no POST).
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
  /** Skip open-deal check (e.g. coordinator chose "Create new deal anyway"). */
  skipDuplicateCheck?: boolean;
}): Promise<HubSpotAutoCreateDealResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    console.error("[HubSpot] HUBSPOT_ACCESS_TOKEN is not set. Cannot create deals.")
    return null
  }

  const {
    sb,
    quote,
    quoteIdText,
    quoteUrl,
    clientEmail,
    firstName,
    lastName,
    clientPhone,
    skipDuplicateCheck,
  } = opts;

  if (!skipDuplicateCheck) {
    const existing = await findExistingOpenDealForContactEmail(sb, token, clientEmail);
    if (existing) {
      const quotePk = String(quote.id ?? "").trim();
      if (quotePk) {
        await sb
          .from("quotes")
          .update({
            hubspot_duplicate_detected: true,
            hubspot_existing_deal_id: existing.dealId,
            hubspot_existing_deal_name: existing.dealName,
            hubspot_existing_deal_stage: existing.dealStageId,
          })
          .eq("id", quotePk);
      }
      return {
        status: "duplicate",
        existingDealId: existing.dealId,
        existingDealName: existing.dealName,
        existingDealStageId: existing.dealStageId,
      };
    }
  }

  const pipelineId = await resolveHubSpotPipelineId(sb);
  if (!pipelineId) {
    console.error(
      "[HubSpot] hubspot_pipeline_id is not set in platform_config and HUBSPOT_PIPELINE_ID is not set. " +
        "Deals in a custom pipeline need both pipeline and dealstage. Cannot create deal.",
    )
    return null
  }

  const stageId = await resolveHubSpotStageInternalId(sb, "quote_sent");
  if (!stageId) {
    return null
  }

  const prefix = await getQuoteIdPrefix(sb);
  const jobNo = quoteNumericSuffixForHubSpot(quoteIdText, prefix);
  const price = essentialPrice(quote);
  const dealName = [firstName, lastName, tierOrServiceLabel(quote), quote.move_date || ""]
    .filter((x) => String(x).trim().length > 0)
    .join(" · ")
    .trim() || `Quote ${quoteIdText}`;

  const contactId = await findOrCreateHubSpotContact(token, {
    email: clientEmail,
    firstName,
    lastName,
    phone: clientPhone ?? null,
  });

  const properties: Record<string, string> = {
    dealname: dealName.slice(0, 200),
    pipeline: pipelineId,
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
    console.error(
      `[HubSpot] create deal failed for quote ${quoteIdText}:`,
      dealRes.status,
      t.slice(0, 2000),
    )
    return null;
  }

  const dealData = (await dealRes.json()) as { id?: string };
  const dealId = dealData.id;
  if (!dealId) return null;

  const quotePk = String(quote.id ?? "").trim();
  if (quotePk) {
    await sb
      .from("quotes")
      .update({
        hubspot_duplicate_detected: false,
        hubspot_existing_deal_id: null,
        hubspot_existing_deal_name: null,
        hubspot_existing_deal_stage: null,
      })
      .eq("id", quotePk);
  }

  return { status: "created", dealId };
}
