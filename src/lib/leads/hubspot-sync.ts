import type { SupabaseClient } from "@supabase/supabase-js";

type LeadLike = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  hubspot_contact_id?: string | null;
  hubspot_deal_id?: string | null;
  source?: string | null;
  source_detail?: string | null;
  service_type?: string | null;
  move_size?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  preferred_date?: string | null;
  message?: string | null;
  estimated_value?: number | null;
  priority?: string | null;
  recommended_tier?: string | null;
  urgency_score?: number | null;
  complexity_score?: number | null;
  intelligence_summary?: string | null;
  has_specialty?: boolean | null;
  completeness_path?: string | null;
  completeness_score?: number | null;
  fields_missing?: unknown;
  clarifications_needed?: unknown;
};

const HS_BASE = "https://api.hubapi.com";

async function hsFetch(path: string, token: string, init?: RequestInit) {
  return fetch(`${HS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    },
  });
}

/** Best-effort: create or update HubSpot contact + deal; persist IDs on lead row. */
export async function syncLeadToHubSpot(sb: SupabaseClient, lead: LeadLike): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  const email = (lead.email || "").trim().toLowerCase();
  const phone = (lead.phone || "").trim();
  const first = (lead.first_name || "").trim();
  const last = (lead.last_name || "").trim();

  try {
    let contactId = (lead.hubspot_contact_id || "").trim() || null;

    if (!contactId && email) {
      const searchRes = await hsFetch("/crm/v3/objects/contacts/search", token, {
        method: "POST",
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
          properties: ["email", "firstname", "lastname"],
          limit: 1,
        }),
      });
      const searchJson = (await searchRes.json()) as { results?: { id: string }[] };
      contactId = searchJson.results?.[0]?.id ?? null;
    }

    const contactProps: Record<string, string> = {};
    if (email) contactProps.email = email;
    if (phone) contactProps.phone = phone;
    if (first) contactProps.firstname = first;
    if (last) contactProps.lastname = last;
    contactProps.lead_source = (lead.source || "other").replace(/_/g, " ");
    if (lead.message) contactProps.message = lead.message.slice(0, 5000);

    if (contactId) {
      await hsFetch(`/crm/v3/objects/contacts/${contactId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ properties: contactProps }),
      });
    } else if (email || phone) {
      const createRes = await hsFetch("/crm/v3/objects/contacts", token, {
        method: "POST",
        body: JSON.stringify({ properties: contactProps }),
      });
      const created = (await createRes.json()) as { id?: string };
      contactId = created.id ?? null;
    }

    if (!contactId) return;

    let dealId = (lead.hubspot_deal_id || "").trim() || null;
    const pipelineId = (process.env.HUBSPOT_LEADS_PIPELINE_ID || "").trim();
    const stageId = (process.env.HUBSPOT_LEADS_DEAL_STAGE_ID || "").trim();

    if (pipelineId && stageId) {
      const dealName = `Lead ${lead.id.slice(0, 8)} — ${first || email || phone || "Yugo"}`;
      const dealProps: Record<string, string> = {
        dealname: dealName.slice(0, 255),
        pipeline: pipelineId,
        dealstage: stageId,
      };
      if (lead.estimated_value != null) dealProps.amount = String(lead.estimated_value);
      if (lead.service_type) dealProps.service_type = lead.service_type;
      if (lead.move_size) dealProps.move_size = lead.move_size;
      if (lead.from_address) dealProps.pick_up_address = lead.from_address;
      if (lead.to_address) dealProps.drop_off_address = lead.to_address;
      if (lead.preferred_date) dealProps.move_date = lead.preferred_date;
      const intelParts: string[] = [];
      if (lead.source_detail) intelParts.push(lead.source_detail);
      if (lead.intelligence_summary) intelParts.push(`Yugo intelligence: ${lead.intelligence_summary}`);
      if (lead.completeness_path) {
        const miss = Array.isArray(lead.fields_missing)
          ? (lead.fields_missing as string[]).join(", ")
          : "";
        const clar = Array.isArray(lead.clarifications_needed)
          ? (lead.clarifications_needed as string[]).join(" | ")
          : "";
        intelParts.push(
          [
            `Completeness: ${lead.completeness_path}`,
            lead.completeness_score != null ? `score ${lead.completeness_score}` : "",
            miss ? `missing: ${miss}` : "",
            clar ? `notes: ${clar.slice(0, 500)}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
      if (!lead.intelligence_summary && (lead.priority || lead.recommended_tier)) {
        intelParts.push(
          [
            lead.priority ? `Priority: ${lead.priority}` : "",
            lead.recommended_tier ? `Recommended: ${lead.recommended_tier}` : "",
            lead.urgency_score != null ? `Urgency: ${lead.urgency_score}` : "",
            lead.complexity_score != null ? `Complexity: ${lead.complexity_score}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      }
      const desc = intelParts.filter(Boolean).join("\n\n").slice(0, 65000);
      if (desc) dealProps.description = desc;

      if (!dealId) {
        const dealRes = await hsFetch("/crm/v3/objects/deals", token, {
          method: "POST",
          body: JSON.stringify({ properties: dealProps }),
        });
        const dealJson = (await dealRes.json()) as { id?: string };
        dealId = dealJson.id ?? null;
      } else {
        await hsFetch(`/crm/v3/objects/deals/${dealId}`, token, {
          method: "PATCH",
          body: JSON.stringify({ properties: dealProps }),
        });
      }

      if (dealId && contactId) {
        await hsFetch("/crm/v4/associations/deals/contacts/batch/create", token, {
          method: "POST",
          body: JSON.stringify({
            inputs: [{ from: { id: dealId }, to: { id: contactId }, type: "deal_to_contact" }],
          }),
        }).catch(() => {});
      }
    }

    await sb
      .from("leads")
      .update({
        hubspot_contact_id: contactId,
        hubspot_deal_id: dealId,
      })
      .eq("id", lead.id);
  } catch (e) {
    console.warn("[leads] HubSpot sync failed:", e);
  }
}
