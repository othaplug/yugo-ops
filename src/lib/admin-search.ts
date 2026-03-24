import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeliveryDetailPath, getMoveDetailPath, isUuid } from "@/lib/move-code";

export interface AdminSearchResult {
  type: string;
  name: string;
  sub?: string;
  href: string;
}

/** Strip characters that break PostgREST `or=(...)` filter parsing. */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%*,]/g, " ").replace(/\s+/g, " ").trim();
}

function ilikePattern(term: string): string {
  const t = sanitizeSearchTerm(term);
  if (t.length < 2) return "";
  const escaped = t.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

/** PostgREST `or` filter for ilike; `pattern` must be `%…%` with LIKE special chars escaped. */
function orIlike(columns: string[], pattern: string): string {
  return columns.map((c) => `${c}.ilike.${pattern}`).join(",");
}

/**
 * Command bar / sidebar search: server-side match on codes, names, and addresses
 * so e.g. DLV-0255 and PRJ-0007 resolve without loading entire tables.
 */
export async function runAdminEntitySearch(supabase: SupabaseClient, q: string, maxResults = 12): Promise<AdminSearchResult[]> {
  const pattern = ilikePattern(q);
  if (!pattern) return [];

  const all: AdminSearchResult[] = [];
  const seen = new Set<string>();
  const push = (r: AdminSearchResult) => {
    const k = `${r.type}:${r.href}`;
    if (seen.has(k)) return;
    seen.add(k);
    all.push(r);
  };

  const trimmed = q.trim();
  const uuid = isUuid(trimmed) ? trimmed : null;

  const uuidPromiseAll = uuid
    ? Promise.all([
        supabase.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address").eq("id", uuid).maybeSingle(),
        supabase.from("projects").select("id, project_number, project_name, end_client_name, site_address").eq("id", uuid).maybeSingle(),
        supabase.from("moves").select("id, move_code, client_name, from_address, to_address, status").eq("id", uuid).maybeSingle(),
        supabase.from("quotes").select("id, quote_id, client_name, service_type, from_address, to_address").eq("id", uuid).maybeSingle(),
        supabase.from("organizations").select("id, name, contact_name, email").eq("id", uuid).maybeSingle(),
      ])
    : Promise.resolve(null);

  const orDelivery = orIlike(
    ["delivery_number", "customer_name", "client_name", "pickup_address", "delivery_address"],
    pattern,
  );
  const orProject = orIlike(["project_number", "project_name", "end_client_name", "site_address", "description"], pattern);
  const orMove = orIlike(["move_code", "client_name", "from_address", "to_address"], pattern);
  const orQuote = orIlike(["quote_id", "client_name", "from_address", "to_address"], pattern);
  const orOrg = orIlike(["name", "contact_name", "email", "address", "phone"], pattern);
  const orInvoice = orIlike(["invoice_number", "client_name"], pattern);

  const [uuidRows, rowResults] = await Promise.all([
    uuidPromiseAll,
    Promise.all([
      supabase.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address").or(orDelivery).limit(15),
      supabase.from("projects").select("id, project_number, project_name, end_client_name, site_address, description").or(orProject).limit(15),
      supabase.from("moves").select("id, move_code, client_name, from_address, to_address, status").or(orMove).limit(15),
      supabase.from("quotes").select("id, quote_id, client_name, service_type, from_address, to_address").or(orQuote).limit(15),
      supabase.from("organizations").select("id, name, contact_name, email, address, phone").or(orOrg).limit(15),
      supabase.from("invoices").select("id, invoice_number, client_name, amount").or(orInvoice).limit(10),
    ]),
  ]);

  if (uuidRows) {
    const [dRes, pRes, mRes, qRes, cRes] = uuidRows;
    if (dRes.data) {
      const d = dRes.data;
      push({
        type: "Delivery",
        name: `${d.delivery_number || "Delivery"}, ${d.customer_name || d.client_name || "Delivery"}`,
        sub: [d.pickup_address, d.delivery_address].filter(Boolean).join(" → ") || undefined,
        href: getDeliveryDetailPath(d),
      });
    }
    if (pRes.data) {
      const p = pRes.data;
      push({
        type: "Project",
        name: `${p.project_number}, ${p.project_name}`,
        sub: p.end_client_name || p.site_address || undefined,
        href: `/admin/projects/${p.id}`,
      });
    }
    if (mRes.data) {
      const m = mRes.data;
      push({
        type: "Move",
        name: `${m.move_code || "Move"}, ${m.client_name}`,
        sub: m.from_address ? `${m.from_address.split(",")[0]} → ${m.to_address?.split(",")[0]}` : undefined,
        href: getMoveDetailPath(m),
      });
    }
    if (qRes.data) {
      const qu = qRes.data;
      push({
        type: "Quote",
        name: `${qu.quote_id ?? "Quote"}, ${qu.client_name}`,
        sub: qu.service_type?.replace(/_/g, " "),
        href: `/admin/quotes/${qu.quote_id ?? qu.id}`,
      });
    }
    if (cRes.data) {
      const c = cRes.data;
      push({
        type: "Client",
        name: c.name,
        sub: c.contact_name || c.email || undefined,
        href: `/admin/clients/${c.id}`,
      });
    }
  }

  const [
    { data: deliveries },
    { data: projects },
    { data: moves },
    { data: quotes },
    { data: clients },
    { data: invoices },
  ] = rowResults;

  for (const d of deliveries || []) {
    push({
      type: "Delivery",
      name: `${d.delivery_number || "Delivery"}, ${d.customer_name || d.client_name || "Delivery"}`,
      sub: [d.pickup_address, d.delivery_address].filter(Boolean).join(" → ") || undefined,
      href: getDeliveryDetailPath(d),
    });
  }
  for (const p of projects || []) {
    push({
      type: "Project",
      name: `${p.project_number}, ${p.project_name}`,
      sub: p.end_client_name || p.site_address || undefined,
      href: `/admin/projects/${p.id}`,
    });
  }
  for (const m of moves || []) {
    push({
      type: "Move",
      name: `${m.move_code || "Move"}, ${m.client_name}`,
      sub: m.from_address ? `${m.from_address.split(",")[0]} → ${m.to_address?.split(",")[0]}` : undefined,
      href: getMoveDetailPath(m),
    });
  }
  for (const qu of quotes || []) {
    push({
      type: "Quote",
      name: `${qu.quote_id ?? "Quote"}, ${qu.client_name}`,
      sub: qu.service_type?.replace(/_/g, " "),
      href: `/admin/quotes/${qu.quote_id ?? qu.id}`,
    });
  }
  for (const c of clients || []) {
    push({
      type: "Client",
      name: c.name,
      sub: c.contact_name || c.email || undefined,
      href: `/admin/clients/${c.id}`,
    });
  }
  for (const inv of invoices || []) {
    push({
      type: "Invoice",
      name: `${inv.invoice_number}, ${inv.client_name}`,
      href: "/admin/invoices",
    });
  }

  return all.slice(0, maxResults);
}
