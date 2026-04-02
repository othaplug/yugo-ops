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

async function runCompanySearch(
  token: string,
  body: Record<string, unknown>,
  limit: number,
): Promise<{ id: string; properties?: Record<string, unknown> }[]> {
  const searchRes = await fetch(`${HS_BASE}/objects/companies/search`, {
    method: "POST",
    headers: hsHeaders(token),
    body: JSON.stringify({
      ...body,
      properties: ["name"],
      limit: Math.min(Math.max(1, limit), 100),
    }),
  });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  return searchData.results ?? [];
}

async function fetchAssociatedContactIds(token: string, companyId: string): Promise<string[]> {
  try {
    const res = await fetch(`${HS_BASE}/objects/companies/${companyId}/associations/contacts`, {
      headers: hsHeaders(token),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: { toObjectId?: string; id?: string }[] };
    return (data.results ?? [])
      .map((r) => (r.toObjectId != null ? String(r.toObjectId) : r.id != null ? String(r.id) : ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function batchReadContacts(
  token: string,
  ids: string[],
): Promise<{ id: string; properties?: Record<string, unknown> }[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)];
  const out: { id: string; properties?: Record<string, unknown> }[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const res = await fetch(`${HS_BASE}/objects/contacts/batch/read`, {
        method: "POST",
        headers: hsHeaders(token),
        body: JSON.stringify({
          properties: [...CONTACT_PROPERTIES],
          inputs: chunk.map((id) => ({ id })),
        }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: { id?: string; properties?: Record<string, unknown> }[];
      };
      for (const r of data.results ?? []) {
        if (r.id) out.push({ id: r.id, properties: r.properties });
      }
    } catch {
      /* skip chunk */
    }
  }
  return out;
}

function mapContactRowWithCompanyFallback(
  contact: { id: string; properties?: Record<string, unknown> },
  fallbackCompany?: string,
): HubSpotContactSuggestion {
  const row = mapContactRow(contact);
  if (!row.company.trim() && fallbackCompany?.trim()) {
    return { ...row, company: fallbackCompany.trim() };
  }
  return row;
}

/** First associated company name when the contact `company` property is empty. */
export async function fetchPrimaryAssociatedCompanyName(token: string, contactId: string): Promise<string | null> {
  try {
    const assocRes = await fetch(`${HS_BASE}/objects/contacts/${contactId}/associations/companies`, {
      headers: hsHeaders(token),
    });
    if (!assocRes.ok) return null;
    const assocData = (await assocRes.json()) as { results?: { id?: string }[] };
    const companyId = assocData.results?.[0]?.id;
    if (!companyId) return null;
    const coRes = await fetch(`${HS_BASE}/objects/companies/${companyId}?properties=name`, {
      headers: hsHeaders(token),
    });
    if (!coRes.ok) return null;
    const co = (await coRes.json()) as { properties?: { name?: string } };
    const n = String(co.properties?.name || "").trim();
    return n || null;
  } catch {
    return null;
  }
}

async function enrichSuggestionCompanyFields(
  token: string,
  rows: HubSpotContactSuggestion[],
): Promise<HubSpotContactSuggestion[]> {
  const need = rows.filter((r) => !r.company.trim());
  if (need.length === 0) return rows;
  const enriched = new Map<string, string>();
  await Promise.all(
    need.map(async (r) => {
      const name = await fetchPrimaryAssociatedCompanyName(token, r.hubspot_id);
      if (name) enriched.set(r.hubspot_id, name);
    }),
  );
  if (enriched.size === 0) return rows;
  return rows.map((r) => {
    const add = enriched.get(r.hubspot_id);
    if (!add || r.company.trim()) return r;
    return { ...r, company: add };
  });
}

/** AND filters on `company` (contact property) from query tokens. */
function contactCompanyTokenFilters(query: string): { filters: { propertyName: string; operator: string; value: string }[] } {
  const raw = query.trim();
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
  return { filters };
}

/** AND filters on Company object `name` for the same tokens. */
function companyNameTokenFilters(query: string): { filters: { propertyName: string; operator: string; value: string }[] } {
  const raw = query.trim();
  const words = raw.split(/\s+/).filter(Boolean);
  const strongTokens = words.filter((w) => w.length >= 2);
  const filters =
    strongTokens.length > 0
      ? strongTokens.slice(0, 6).map((value) => ({
          propertyName: "name",
          operator: "CONTAINS_TOKEN",
          value,
        }))
      : [{ propertyName: "name", operator: "CONTAINS_TOKEN", value: raw }];
  return { filters };
}

/**
 * OR contact search: contact `company` text, first/last name, email — max 5 filter groups (HubSpot limit).
 */
function contactOrFilterGroupsForTypeahead(query: string): { filters: { propertyName: string; operator: string; value: string }[] }[] {
  const raw = query.trim();
  const lower = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean);
  const strongTokens = words.filter((w) => w.length >= 2);

  const groups: { filters: { propertyName: string; operator: string; value: string }[] }[] = [];

  groups.push(contactCompanyTokenFilters(raw));

  if (strongTokens.length >= 2) {
    const first = strongTokens[0]!;
    const last = strongTokens.slice(1).join(" ");
    groups.push({
      filters: [
        { propertyName: "firstname", operator: "CONTAINS_TOKEN", value: first },
        { propertyName: "lastname", operator: "CONTAINS_TOKEN", value: last },
      ],
    });
  } else {
    const t = strongTokens[0] || raw;
    if (t.length >= 2) {
      groups.push({ filters: [{ propertyName: "firstname", operator: "CONTAINS_TOKEN", value: t }] });
      groups.push({ filters: [{ propertyName: "lastname", operator: "CONTAINS_TOKEN", value: t }] });
    }
  }

  if (raw.includes("@")) {
    groups.push({ filters: [{ propertyName: "email", operator: "EQ", value: lower }] });
  } else if (raw.length >= 2) {
    groups.push({ filters: [{ propertyName: "email", operator: "CONTAINS_TOKEN", value: lower }] });
  }

  return groups.slice(0, 5);
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
 * Typeahead: HubSpot contacts for admin forms.
 * - Matches **Company** records by `name`, then loads **associated contacts** (fixes empty contact `company` text).
 * - Matches contact `company`, first/last name, and email (OR groups, HubSpot max 5).
 */
export async function suggestHubSpotForTypeahead(
  token: string,
  query: string,
  limit = 12,
): Promise<HubSpotContactSuggestion[]> {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const suggestedIds = new Set<string>();
  const out: HubSpotContactSuggestion[] = [];

  const companyRows = await runCompanySearch(
    token,
    { filterGroups: [companyNameTokenFilters(raw)] },
    15,
  );

  const assocChunks = await Promise.all(
    companyRows.slice(0, 10).map(async (co) => {
      const name = String((co.properties?.name as string) || "");
      const ids = await fetchAssociatedContactIds(token, co.id);
      return { ids, name };
    }),
  );

  const orderedUniqueIds: string[] = [];
  const idToCompanyName = new Map<string, string>();
  for (const { ids, name } of assocChunks) {
    for (const cid of ids) {
      if (suggestedIds.has(cid)) continue;
      suggestedIds.add(cid);
      orderedUniqueIds.push(cid);
      if (name) idToCompanyName.set(cid, name);
    }
  }

  const assocContacts = await batchReadContacts(token, orderedUniqueIds.slice(0, 80));
  const byAssocId = new Map(assocContacts.map((c) => [c.id, c]));
  for (const id of orderedUniqueIds) {
    if (out.length >= limit) break;
    const row = byAssocId.get(id);
    if (!row) continue;
    out.push(mapContactRowWithCompanyFallback(row, idToCompanyName.get(id)));
  }

  const filterGroups = contactOrFilterGroupsForTypeahead(raw);
  const contactRows = await runContactSearch(token, { filterGroups }, Math.min(100, limit * 4));
  for (const row of contactRows) {
    if (out.length >= limit) break;
    if (suggestedIds.has(row.id)) continue;
    suggestedIds.add(row.id);
    out.push(mapContactRow(row));
  }

  return enrichSuggestionCompanyFields(token, out);
}

/** @deprecated Prefer {@link suggestHubSpotForTypeahead} — behavior is identical now. */
export const suggestHubSpotContactsByCompanyQuery = suggestHubSpotForTypeahead;

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

  if (!base.company.trim()) {
    const assocName = await fetchPrimaryAssociatedCompanyName(token, base.hubspot_id);
    if (assocName) base = { ...base, company: assocName };
  }

  const contact = await resolveContactWithDeals(token, base);
  return { contact, match_kind };
}
