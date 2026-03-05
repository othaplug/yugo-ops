"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/AppIcons";
import { getDeliveryDetailPath, getMoveDetailPath } from "@/lib/move-code";

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: string; name: string; href: string }[]>([]);
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
    const all: { type: string; name: string; href: string }[] = [];

    const [
      { data: deliveries },
      { data: clients },
      { data: invoices },
      { data: moves },
      { data: quotes },
    ] = await Promise.all([
      supabase.from("deliveries").select("id, delivery_number, customer_name, client_name"),
      supabase.from("organizations").select("id, name, contact_name, email"),
      supabase.from("invoices").select("id, invoice_number, client_name, amount"),
      supabase.from("moves").select("id, move_code, client_name, from_address, to_address, status"),
      supabase.from("quotes").select("id, quote_id, client_name, status, service_type"),
    ]);

    (moves || []).forEach((m) => {
      const s = `${m.move_code || ""} ${m.client_name || ""} ${m.from_address || ""} ${m.to_address || ""}`.toLowerCase();
      if (s.includes(term)) all.push({ type: "Move", name: `${m.move_code || "Move"} — ${m.client_name}`, href: getMoveDetailPath(m) });
    });
    (quotes || []).forEach((q) => {
      const s = `${q.quote_id || ""} ${q.client_name || ""}`.toLowerCase();
      if (s.includes(term)) all.push({ type: "Quote", name: `${q.quote_id || "Quote"} — ${q.client_name}`, href: `/admin/quotes/${q.quote_id || q.id}` });
    });
    (deliveries || []).forEach((d) => {
      const s = `${d.delivery_number} ${d.customer_name} ${d.client_name}`.toLowerCase();
      if (s.includes(term)) all.push({ type: "Delivery", name: `${d.delivery_number} — ${d.customer_name}`, href: getDeliveryDetailPath(d) });
    });
    (clients || []).forEach((c) => {
      const s = `${c.name} ${c.contact_name || ""} ${c.email || ""}`.toLowerCase();
      if (s.includes(term)) all.push({ type: "Client", name: c.name, href: `/admin/clients/${c.id}` });
    });
    (invoices || []).forEach((i) => {
      const s = `${i.invoice_number} ${i.client_name}`.toLowerCase();
      if (s.includes(term)) all.push({ type: "Invoice", name: `${i.invoice_number} — ${i.client_name}`, href: `/admin/invoices` });
    });

    setResults(all.slice(0, 10));
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

  const TYPE_ICONS: Record<string, string> = {
    Move: "truck",
    Quote: "fileText",
    Delivery: "package",
    Client: "users",
    Invoice: "dollarSign",
  };

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="flex items-center gap-2 h-9 bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 w-full focus-within:border-[var(--gold)] transition-colors duration-200">
        <span className="text-[var(--tx3)] shrink-0"><Icon name="search" className="w-[14px] h-[14px]" /></span>
        <input
          type="text"
          placeholder="Search moves, quotes, clients..."
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
        <div className="absolute left-0 w-full sm:w-[420px] top-full mt-1 max-h-[420px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-[14px] shadow-xl z-50 animate-fade-up">
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] border-b border-[var(--brd)]">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
          {results.map((r) => (
            <div
              key={r.href + r.name}
              onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--brd)]/50 last:border-0 hover:bg-[var(--gdim)] cursor-pointer transition-colors duration-200"
            >
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[var(--bg)] border border-[var(--brd)]/40 shrink-0">
                <Icon name={TYPE_ICONS[r.type] || "search"} className="w-3 h-3 text-[var(--tx3)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[var(--tx)] truncate">{r.name}</div>
                <div className="text-[9px] text-[var(--tx3)]">{r.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 w-full sm:w-[420px] top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-[14px] shadow-xl z-50 animate-fade-up px-4 py-6 text-center">
          <div className="text-[12px] text-[var(--tx3)]">No results for &ldquo;{query}&rdquo;</div>
        </div>
      )}
    </div>
  );
}
