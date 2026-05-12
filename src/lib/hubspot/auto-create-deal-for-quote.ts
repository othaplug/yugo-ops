import type { SupabaseClient } from "@supabase/supabase-js";
import { getQuoteIdPrefix, quoteNumericSuffixForHubSpot } from "@/lib/quotes/quote-id";
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";
import { findExistingOpenDealForContactEmail } from "@/lib/hubspot/find-existing-open-deal";
import { buildHubSpotDealName, serviceCategory } from "@/lib/hubspot/deal-name";
import { dealPackageType, yugoJobProperties } from "@/lib/hubspot/deal-properties";
import { buildAllYugoProperties } from "@/lib/hubspot/deal-properties-builder";
import { resolveStageFromStatus } from "@/lib/hubspot/stage-mapping";
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
  /**
   * OPS+ quote status at time of deal creation.
   * Defaults to "sent" when called from the quote send route.
   * Pass the actual status (e.g. "accepted") for backfill / retroactive creation
   * so the HubSpot stage reflects the current pipeline position.
   */
  currentStatus?: string | null;
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
    currentStatus,
  } = opts;

  const svcType = String(quote.service_type ?? "").trim();
  const svcCat = serviceCategory(svcType, false);

  if (!skipDuplicateCheck) {
    const existing = await findExistingOpenDealForContactEmail(sb, token, clientEmail, {
      serviceTypeCat: svcCat,
    });
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

  const logicalStage = resolveStageFromStatus(currentStatus ?? "sent");
  const stageId = await resolveHubSpotStageInternalId(sb, logicalStage);
  if (!stageId) {
    return null
  }

  const prefix = await getQuoteIdPrefix(sb);
  const jobNo = quoteNumericSuffixForHubSpot(quoteIdText, prefix);
  const price = essentialPrice(quote);

  const tierLabel = String(quote.recommended_tier ?? "").trim().replace(/_/g, " ") || undefined;
  const dealName = buildHubSpotDealName({
    serviceType: svcType || undefined,
    isPmMove: false,
    firstName,
    lastName,
    businessName: String(quote.b2b_business_name ?? "").trim() || undefined,
    tierLabel,
    moveSize: String(quote.move_size ?? "").trim() || undefined,
    fromAddress: String(quote.from_address ?? "").trim() || undefined,
    date: String(quote.move_date ?? "").trim() || undefined,
    fallbackCode: `Quote ${quoteIdText}`,
  });

  const contactId = await findOrCreateHubSpotContact(token, {
    email: clientEmail,
    firstName,
    lastName,
    phone: clientPhone ?? null,
  });

  // Standard HubSpot deal fields + first/last name contact mirrors. All
  // OPS+ custom properties (job_no, pick_up_address, access, service_type,
  // move_date, sub_total, taxes, etc.) flow through the single
  // buildAllDealProperties builder — keep this block lean to avoid the
  // earlier `access_from` typo (portal expects `access`) that left fields
  // empty on every new deal.
  const properties: Record<string, string> = {
    dealname: dealName,
    pipeline: pipelineId,
    dealstage: stageId,
    quote_url: quoteUrl,
    firstname: firstName,
    lastname: lastName,
    package_type: dealPackageType(svcType, false, String(quote.recommended_tier ?? "").trim()),
    ...yugoJobProperties({ jobId: quoteIdText, jobNo, serviceType: svcType }),
    ...buildAllYugoProperties({
      jobId: quoteIdText,
      jobNumber: jobNo,
      firstName,
      lastName,
      fromAddress: quote.from_address as string | null | undefined,
      toAddress: quote.to_address as string | null | undefined,
      fromAccess: quote.from_access as string | null | undefined,
      toAccess: quote.to_access as string | null | undefined,
      serviceType: svcType,
      moveDate: quote.move_date as string | null | undefined,
      moveSize: quote.move_size as string | null | undefined,
      subtotal: price,
      tierSelected: quote.recommended_tier as string | null | undefined,
      crewSize: quote.est_crew_size as number | null | undefined,
      estimatedHours: quote.est_hours as number | null | undefined,
      truckType: quote.truck_primary as string | null | undefined,
      isPmMove: false,
      businessName: (quote.b2b_business_name as string | null | undefined) ?? null,
    }),
  };
  if (price != null) properties.amount = String(price);

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

  let dealRes = await fetch(HS_DEALS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!dealRes.ok) {
    const errText = await dealRes.text();
    const isPropertyError =
      dealRes.status === 400 &&
      (errText.includes("does not exist") || errText.includes("PROPERTY_DOESNT_EXIST"));

    if (isPropertyError) {
      // Custom deal properties haven't been created in this HubSpot portal yet.
      // Fall back to standard properties only so the deal still gets created.
      console.warn(
        `[HubSpot] Custom deal properties missing for ${quoteIdText} — retrying with standard properties only. Error: ${errText.slice(0, 500)}`,
      );
      const standardBody: Record<string, unknown> = {
        properties: {
          dealname: properties.dealname,
          pipeline: properties.pipeline,
          dealstage: properties.dealstage,
          ...(properties.amount ? { amount: properties.amount } : {}),
        },
      };
      if (body.associations) standardBody.associations = body.associations;

      dealRes = await fetch(HS_DEALS, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(standardBody),
      });
    }

    if (!dealRes.ok) {
      const t = isPropertyError ? await dealRes.text() : errText;
      console.error(
        `[HubSpot] create deal failed for quote ${quoteIdText}:`,
        dealRes.status,
        t.slice(0, 2000),
      );
      return null;
    }
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
