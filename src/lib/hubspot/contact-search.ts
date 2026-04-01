import { normalizePhone } from "@/lib/phone";

const HS_BASE = "https://api.hubapi.com/crm/v3";

export type HubSpotMatchKind = "email" | "phone" | "company_name" | "company";

export type HubSpotContactPayload = {
  hubspot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  lead_status: string;
  deal_ids: string[];
};

export function hsHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

const CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "company",
  "jobtitle",
  "hs_lead_status",
] as const;

function mapContactRow(contact: { id: string; properties?: Record<string, unknown> }): Omit<HubSpotContactPayload, "deal_ids"> {
  const p = contact.properties ?? {};
  return {
    hubspot_id: contact.id,
    first_name: (p.firstname as string) || "",
    last_name: (p.lastname as string) || "",
    email: (p.email as string) || "",
    phone: (p.phone as string) || (p.mobilephone as string) || "",
    company: (p.company as string) || "",
    title: (p.jobtitle as string) || "",
    lead_status: (p.hs_lead_status as string) || "",
  };
}

async function fetchDealIdsForContact(token: string, contactId: string): Promise<string[]> {
  try {
    const dealsRes = await fetch(`${HS_BASE}/objects/contacts/${contactId}/associations/deals`, {
      headers: hsHeaders(token),
    });
    if (!dealsRes.ok) return [];
    const dealsData = await dealsRes.json();
    return (dealsData.results ?? []).map((d: { id: string }) => d.id);
  } catch {
    return [];
  }
}

async function runContactSearch(
  token: string,
  body: Record<string, unknown>,
  limit: number,
): Promise<{ id: string; properties?: Record<string, unknown> }[]> {
  const searchRes = await fetch(`${HS_BASE}/objects/contacts/search`, {
    method: "POST",
    headers: hsHeaders(token),
    body: JSON.stringify({
      ...body,
      properties: [...CONTACT_PROPERTIES],
      limit: Math.min(Math.max(1, limit), 100),
    }),
  });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  return searchData.results ?? [];
}

async function searchContacts(
  token: string,
  body: Record<string, unknown>,
): Promise<{ id: string; properties?: Record<string, unknown> } | null> {
  const rows = await runContactSearch(token, body, 1);
  return rows[0] ?? null;
}

/** Contact rows for autosuggest (no deal fetch — keep list snappy). */
export type HubSpotContactSuggestion = Omit<HubSpotContactPayload, "deal_ids">;

/**
 * Typeahead: contacts whose `company` matches HubSpot CONTAINS_TOKEN rules.
 * Multi-word queries AND each word (length ≥ 2) as separate tokens on `company`.
 * Single string (e.g. "MyNewFloor") uses one CONTAINS_TOKEN. Min 2 characters total.
 */
export async function suggestHubSpotContactsByCompanyQuery(
  token: string,
  query: string,
  limit = 12,
): Promise<HubSpotContactSuggestion[]> {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const words = raw.split(/\s+/).filter(Boolean);
  const strongTokens = words.filter((w) => w.length >= 2);
  const filters =
    strongTokens.length > 0
      ? strongTokens.slice(0, 6).map((value) => ({
          propertyName: "company",
          operator: "CONTAINS_TOKEN",
          value,
        }))
      : [{ propertyName: "company", operator: "CONTAINS_TOKEN", value: raw }];

  const rows = await runContactSearch(token, { filterGroups: [{ filters }] }, limit);

  return rows.map((row) => mapContactRow(row));
}

export async function searchHubSpotContactByEmail(
  token: string,
  email: string,
): Promise<Omit<HubSpotContactPayload, "deal_ids"> | null> {
  const row = await searchContacts(token, {
    filterGroups: [
      {
        filters: [{ propertyName: "email", operator: "EQ", value: email.trim().toLowerCase() }],
      },
    ],
  });
  return row ? mapContactRow(row) : null;
}

/** HubSpot phone filters allow EQ only; try common stored formats (max 6 OR groups). */
export async function searchHubSpotContactByPhone(
  token: string,
  phoneRaw: string,
): Promise<Omit<HubSpotContactPayload, "deal_ids"> | null> {
  const digits = normalizePhone(phoneRaw);
  if (digits.length !== 10) return null;

  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  const formatted = `(${a}) ${b}-${c}`;
  const plus = `+1${digits}`;
  // HubSpot allows up to 6 filter groups (OR); try phone + mobile × common formats.
  const filterGroups: { filters: { propertyName: string; operator: string; value: string }[] }[] = [
    { filters: [{ propertyName: "phone", operator: "EQ", value: digits }] },
    { filters: [{ propertyName: "mobilephone", operator: "EQ", value: digits }] },
    { filters: [{ propertyName: "phone", operator: "EQ", value: formatted }] },
    { filters: [{ propertyName: "mobilephone", operator: "EQ", value: formatted }] },
    { filters: [{ propertyName: "phone", operator: "EQ", value: plus }] },
    { filters: [{ propertyName: "mobilephone", operator: "EQ", value: plus }] },
  ];

  const row = await searchContacts(token, { filterGroups });
  return row ? mapContactRow(row) : null;
}

function parseContactName(contactName: string): { first: string; last: string } {
  const parts = contactName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

/** Company + first/last name on the same contact (AND). Tries exact company first, then tokenized company. */
export async function searchHubSpotContactByCompanyAndName(
  token: string,
  company: string,
  contactName: string,
): Promise<Omit<HubSpotContactPayload, "deal_ids"> | null> {
  const co = company.trim();
  const { first, last } = parseContactName(contactName);
  if (co.length < 2 || first.length < 2) return null;

  const nameFilters: { propertyName: string; operator: string; value: string }[] = [
    { propertyName: "firstname", operator: "EQ", value: first },
  ];
  if (last.length >= 1) {
    nameFilters.push({ propertyName: "lastname", operator: "EQ", value: last });
  }

  let row = await searchContacts(token, {
    filterGroups: [{ filters: [{ propertyName: "company", operator: "EQ", value: co }, ...nameFilters] }],
  });
  if (row) return mapContactRow(row);

  row = await searchContacts(token, {
    filterGroups: [{ filters: [{ propertyName: "company", operator: "CONTAINS_TOKEN", value: co }, ...nameFilters] }],
  });
  return row ? mapContactRow(row) : null;
}

export async function searchHubSpotContactByCompanyExact(
  token: string,
  company: string,
): Promise<Omit<HubSpotContactPayload, "deal_ids"> | null> {
  const co = company.trim();
  if (co.length < 2) return null;

  let row = await searchContacts(token, {
    filterGroups: [{ filters: [{ propertyName: "company", operator: "EQ", value: co }] }],
  });
  if (row) return mapContactRow(row);

  row = await searchContacts(token, {
    filterGroups: [{ filters: [{ propertyName: "company", operator: "CONTAINS_TOKEN", value: co }] }],
  });
  return row ? mapContactRow(row) : null;
}

export async function resolveContactWithDeals(
  token: string,
  row: Omit<HubSpotContactPayload, "deal_ids">,
): Promise<HubSpotContactPayload> {
  const deal_ids = await fetchDealIdsForContact(token, row.hubspot_id);
  return { ...row, deal_ids };
}

export type HubSpotDedupInput = {
  email?: string;
  phone?: string;
  company?: string;
  contact_name?: string;
};

/**
 * Priority: email → phone → company+name → company-only.
 * Returns null if HubSpot is disabled or nothing matches.
 */
export async function dedupeHubSpotContact(
  token: string,
  input: HubSpotDedupInput,
): Promise<{ contact: HubSpotContactPayload; match_kind: HubSpotMatchKind } | null> {
  const email = (input.email || "").trim().toLowerCase();
  const hasEmail = email.includes("@");
  const phone = input.phone || "";
  const company = (input.company || "").trim();
  const contactName = (input.contact_name || "").trim();

  const hasPhone = normalizePhone(phone).length === 10;
  const hasCompany = company.length >= 2;
  const hasContactName = contactName.length >= 2;
  /** Avoid noisy single-token company matches (e.g. "Inc"). */
  const hasCompanyForLooseMatch = company.trim().length >= 3;

  if (!hasEmail && !hasPhone && !(hasCompany && hasContactName) && !hasCompanyForLooseMatch) {
    return null;
  }

  let match_kind: HubSpotMatchKind | null = null;
  let base: Omit<HubSpotContactPayload, "deal_ids"> | null = null;

  if (hasEmail) {
    base = await searchHubSpotContactByEmail(token, email);
    if (base) match_kind = "email";
  }

  if (!base && hasPhone) {
    base = await searchHubSpotContactByPhone(token, phone);
    if (base) match_kind = "phone";
  }

  if (!base && hasCompany && hasContactName) {
    base = await searchHubSpotContactByCompanyAndName(token, company, contactName);
    if (base) match_kind = "company_name";
  }

  if (!base && hasCompanyForLooseMatch) {
    base = await searchHubSpotContactByCompanyExact(token, company);
    if (base) match_kind = "company";
  }

  if (!base || !match_kind) return null;

  const contact = await resolveContactWithDeals(token, base);
  return { contact, match_kind };
}
