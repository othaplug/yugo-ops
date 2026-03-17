"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/AppIcons";
import { getDeliveryDetailPath, getMoveDetailPath } from "@/lib/move-code";

const TYPE_ICONS: Record<string, string> = {
  Move: "truck",
  Quote: "fileText",
  Delivery: "package",
  Client: "users",
  Invoice: "dollarSign",
  Contact: "users",
  Nav: "mapPin",
};

const TYPE_COLORS: Record<string, string> = {
  Move: "var(--blue)",
  Quote: "var(--grn)",
  Delivery: "var(--gold)",
  Client: "var(--pur)",
  Invoice: "var(--grn)",
  Contact: "var(--org)",
  Nav: "var(--tx2)",
};

/** Sidebar nav items + settings for command-centre search */
const NAV_SEARCH_ITEMS: { name: string; href: string; keywords: string[] }[] = [
  { name: "Command Center", href: "/admin", keywords: ["dashboard", "home", "command", "centre", "center"] },
  { name: "Jobs", href: "/admin/deliveries", keywords: ["projects", "deliveries", "jobs", "b2b", "all"] },
  { name: "Reports", href: "/admin/reports", keywords: ["reports", "analytics"] },
  { name: "Calendar", href: "/admin/calendar", keywords: ["calendar", "schedule"] },
  { name: "Tracking", href: "/admin/crew", keywords: ["tracking", "crew", "map", "live"] },
  { name: "Retail", href: "/admin/partners/retail", keywords: ["retail", "partners"] },
  { name: "Designers", href: "/admin/partners/designers", keywords: ["designers", "partners"] },
  { name: "Hospitality", href: "/admin/partners/hospitality", keywords: ["hospitality", "partners"] },
  { name: "Art Gallery", href: "/admin/partners/gallery", keywords: ["gallery", "art", "partners"] },
  { name: "Realtors", href: "/admin/partners/realtors", keywords: ["realtors", "partners"] },
  { name: "All Moves", href: "/admin/moves", keywords: ["moves", "all"] },
  { name: "Quotes", href: "/admin/quotes", keywords: ["quotes"] },
  { name: "Invoices", href: "/admin/invoices", keywords: ["invoices", "finance"] },
  { name: "Revenue", href: "/admin/revenue", keywords: ["revenue", "finance"] },
  { name: "Tips", href: "/admin/tips", keywords: ["tips", "finance"] },
  { name: "Profitability", href: "/admin/finance/profitability", keywords: ["profitability", "finance"] },
  { name: "Contacts", href: "/admin/clients", keywords: ["contacts", "clients", "crm"] },
  { name: "Perks & Referrals", href: "/admin/perks", keywords: ["perks", "referrals", "crm"] },
  { name: "Settings", href: "/admin/settings", keywords: ["settings", "account", "crm"] },
  { name: "Platform", href: "/admin/platform", keywords: ["platform", "admin"] },
  { name: "Notifications", href: "/admin/notifications", keywords: ["notifications"] },
];

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: string; name: string; sub?: string; href: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const term = q.toLowerCase();
    const all: { type: string; name: string; sub?: string; href: string }[] = [];

    // Nav / functions / settings — match first so they appear when typing page names
    for (const item of NAV_SEARCH_ITEMS) {
      const matchName = item.name.toLowerCase().includes(term);
      const matchKeyword = item.keywords.some((k) => k.includes(term) || term.includes(k));
      if (matchName || matchKeyword) {
        all.push({ type: "Nav", name: item.name, href: item.href });
      }
    }

    const [
      { data: deliveries },
      { data: clients },
      { data: invoices },
      { data: moves },
      { data: quotes },
    ] = await Promise.all([
      supabase.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, dropoff_address"),
      supabase.from("organizations").select("id, name, contact_name, email, address, phone"),
      supabase.from("invoices").select("id, invoice_number, client_name, amount"),
      supabase.from("moves").select("id, move_code, client_name, from_address, to_address, status"),
      supabase.from("quotes").select("id, quote_id, client_name, status, service_type, from_address, to_address"),
    ]);

    // Clients / organizations (highest priority - show first)
    (clients || []).forEach((c) => {
      const s = `${c.name} ${c.contact_name || ""} ${c.email || ""} ${c.address || ""} ${c.phone || ""}`.toLowerCase();
      if (s.includes(term)) {
        all.push({
          type: "Client",
          name: c.name,
          sub: c.contact_name || c.email || undefined,
          href: `/admin/clients/${c.id}`,
        });
      }
    });

    // Moves
    (moves || []).forEach((m) => {
      const s = `${m.move_code || ""} ${m.client_name || ""} ${m.from_address || ""} ${m.to_address || ""}`.toLowerCase();
      if (s.includes(term)) {
        all.push({
          type: "Move",
          name: `${m.move_code || "Move"} — ${m.client_name}`,
          sub: m.from_address ? `${m.from_address?.split(",")[0]} → ${m.to_address?.split(",")[0]}` : undefined,
          href: getMoveDetailPath(m),
        });
      }
    });

    // Quotes
    (quotes || []).forEach((q) => {
      const s = `${q.quote_id || ""} ${q.client_name || ""} ${q.from_address || ""} ${q.to_address || ""}`.toLowerCase();
      if (s.includes(term)) {
        all.push({
          type: "Quote",
          name: `${q.quote_id || "Quote"} — ${q.client_name}`,
          sub: q.service_type?.replace(/_/g, " "),
          href: `/admin/quotes/${q.quote_id || q.id}`,
        });
      }
    });

    // Deliveries
    (deliveries || []).forEach((d) => {
      const s = `${d.delivery_number} ${d.customer_name || ""} ${d.client_name || ""} ${d.pickup_address || ""} ${d.dropoff_address || ""}`.toLowerCase();
      if (s.includes(term)) {
        all.push({
          type: "Delivery",
          name: `${d.delivery_number} — ${d.customer_name || d.client_name || "Delivery"}`,
          sub: d.client_name || undefined,
          href: getDeliveryDetailPath(d),
        });
      }
    });

    // Invoices
    (invoices || []).forEach((i) => {
      const s = `${i.invoice_number} ${i.client_name}`.toLowerCase();
      if (s.includes(term)) {
        all.push({
          type: "Invoice",
          name: `${i.invoice_number} — ${i.client_name}`,
          href: `/admin/invoices`,
        });
      }
    });

    setResults(all.slice(0, 12));
    setOpen(all.length > 0);
  }, [supabase]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 h-9 bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 w-full transition-colors duration-200">
        <span className="text-[var(--tx3)] shrink-0"><Icon name="search" className="w-[14px] h-[14px]" /></span>
        <input
          type="text"
          placeholder="Search moves, quotes, clients, pages, settings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="flex-1 min-w-0 bg-transparent border-none text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none font-sans"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
            className="text-[var(--tx3)] hover:text-[var(--tx)] shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 w-full sm:w-[440px] top-full mt-1 max-h-[420px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-[14px] shadow-xl z-50 animate-fade-up">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] border-b border-[var(--brd)]">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
          {results.map((r, idx) => (
            <div
              key={r.href + r.name + idx}
              onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--brd)]/40 last:border-0 hover:bg-[var(--gdim)] cursor-pointer transition-colors duration-150"
            >
              <Icon
                name={TYPE_ICONS[r.type] || "search"}
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: TYPE_COLORS[r.type] || "var(--tx3)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{r.name}</div>
                {r.sub && <div className="text-[9px] text-[var(--tx3)] truncate">{r.sub}</div>}
              </div>
              <span
                className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  color: TYPE_COLORS[r.type] || "var(--tx3)",
                  backgroundColor: `${TYPE_COLORS[r.type]}18` || "var(--gdim)",
                }}
              >
                {r.type}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 w-full sm:w-[440px] top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-[14px] shadow-xl z-50 animate-fade-up px-4 py-6 text-center">
          <div className="text-[12px] text-[var(--tx3)]">No results for &ldquo;{query}&rdquo;</div>
        </div>
      )}
    </div>
  );
}
