import { hsHeaders } from "@/lib/hubspot/contact-search";

const HS_CONTACTS = "https://api.hubapi.com/crm/v3/objects/contacts";

export type UpsertPartnerContactInput = {
  email: string;
  firstname: string;
  lastname?: string;
  company: string;
  phone: string;
  jobtitle?: string;
  businessType: string;
};

/**
 * Find contact by email, PATCH with partner fields, or POST a new contact.
 * Handles duplicate-email create failures by falling back to search + patch.
 */
export async function upsertHubSpotPartnerContact(
  token: string,
  input: UpsertPartnerContactInput,
): Promise<string | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const properties: Record<string, string> = {
    email,
    firstname: input.firstname.trim() || email.split("@")[0] || "Partner",
    company: input.company.trim() || "",
    phone: (input.phone || "").trim(),
    yugo_partner_status: "active",
    yugo_partner_type: input.businessType,
  };
  const ln = (input.lastname || "").trim();
  if (ln) properties.lastname = ln;
  const jt = (input.jobtitle || "").trim();
  if (jt) properties.jobtitle = jt;

  async function findByEmail(): Promise<string | null> {
    const searchRes = await fetch(`${HS_CONTACTS}/search`, {
      method: "POST",
      headers: hsHeaders(token),
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["email"],
        limit: 1,
      }),
    });
    if (!searchRes.ok) return null;
    const j = (await searchRes.json()) as { results?: { id: string }[] };
    return j.results?.[0]?.id ?? null;
  }

  let contactId = await findByEmail();

  if (contactId) {
    const patchRes = await fetch(`${HS_CONTACTS}/${contactId}`, {
      method: "PATCH",
      headers: hsHeaders(token),
      body: JSON.stringify({ properties }),
    });
    return patchRes.ok ? contactId : null;
  }

  const createRes = await fetch(HS_CONTACTS, {
    method: "POST",
    headers: hsHeaders(token),
    body: JSON.stringify({ properties }),
  });

  if (createRes.ok) {
    const created = (await createRes.json()) as { id?: string };
    return created.id ?? null;
  }

  // Duplicate or race: contact may exist now
  contactId = await findByEmail();
  if (!contactId) return null;
  const patchRes = await fetch(`${HS_CONTACTS}/${contactId}`, {
    method: "PATCH",
    headers: hsHeaders(token),
    body: JSON.stringify({ properties }),
  });
  return patchRes.ok ? contactId : null;
}
