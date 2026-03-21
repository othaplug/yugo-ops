"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icons } from "./SidebarIcons";
import { getDeliveryDetailPath, getMoveDetailPath } from "@/lib/move-code";
import { MagnifyingGlass, User, Truck, FileText, CaretRight } from "@phosphor-icons/react";

const QUICK_NAV: { group: string; items: { name: string; href: string; Icon: () => ReactElement }[] }[] = [
  {
    group: "Operations",
    items: [
      { name: "Command Center", href: "/admin", Icon: Icons.home },
      { name: "Dispatch", href: "/admin/dispatch", Icon: Icons.dispatch },
      { name: "Calendar", href: "/admin/calendar", Icon: Icons.calendar },
      { name: "Live Tracking", href: "/admin/crew", Icon: Icons.mapPin },
    ],
  },
  {
    group: "Partners",
    items: [
      { name: "All Partners", href: "/admin/partners", Icon: Icons.users },
      { name: "Partner Health", href: "/admin/partners/health", Icon: Icons.barChart },
      { name: "Realtors & referrals", href: "/admin/partners/realtors", Icon: Icons.handshake },
      { name: "Jobs", href: "/admin/deliveries", Icon: Icons.briefcase },
    ],
  },
  {
    group: "Moves",
    items: [
      { name: "All Moves", href: "/admin/moves", Icon: Icons.path },
      { name: "Quotes", href: "/admin/quotes", Icon: Icons.quoteClipboard },
      { name: "Widget Leads", href: "/admin/widget-leads", Icon: Icons.zap },
    ],
  },
  {
    group: "Finance",
    items: [
      { name: "Invoices", href: "/admin/invoices", Icon: Icons.fileText },
      { name: "Revenue", href: "/admin/revenue", Icon: Icons.dollarSign },
      { name: "Tips", href: "/admin/tips", Icon: Icons.creditCard },
      { name: "Claims", href: "/admin/claims", Icon: Icons.shield },
    ],
  },
  {
    group: "CRM",
    items: [
      { name: "Contacts", href: "/admin/clients", Icon: Icons.userCheck },
      { name: "Change Requests", href: "/admin/change-requests", Icon: Icons.clipboardList },
      { name: "Perks & Referrals", href: "/admin/perks", Icon: Icons.gift },
    ],
  },
];

const ALL_NAV_ITEMS = QUICK_NAV.flatMap((g) => g.items);

const TYPE_COLORS: Record<string, string> = {
  Move: "var(--blue)",
  Quote: "var(--grn)",
  Delivery: "var(--gold)",
  Client: "var(--pur)",
  Invoice: "var(--grn)",
  Nav: "var(--tx2)",
};

interface Result {
  type: string;
  name: string;
  sub?: string;
  href: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setSearching(false);
      // Small delay to avoid focus fighting with keyboard event
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    const term = q.toLowerCase();
    const all: Result[] = [];

    // Nav pages first
    for (const item of ALL_NAV_ITEMS) {
      if (item.name.toLowerCase().includes(term)) {
        all.push({ type: "Nav", name: item.name, href: item.href });
      }
    }

    const [
      { data: clients },
      { data: moves },
      { data: quotes },
      { data: deliveries },
    ] = await Promise.all([
      supabase.from("organizations").select("id, name, contact_name, email").limit(30),
      supabase.from("moves").select("id, move_code, client_name, from_address, to_address, status").limit(30),
      supabase.from("quotes").select("id, quote_id, client_name, service_type, from_address, to_address").limit(30),
      supabase.from("deliveries").select("id, delivery_number, customer_name, client_name, pickup_address, dropoff_address").limit(30),
    ]);

    (clients || []).forEach((c) => {
      if (`${c.name} ${c.contact_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(term)) {
        all.push({ type: "Client", name: c.name, sub: c.contact_name || c.email || undefined, href: `/admin/clients/${c.id}` });
      }
    });
    (moves || []).forEach((m) => {
      if (`${m.move_code ?? ""} ${m.client_name ?? ""}`.toLowerCase().includes(term)) {
        all.push({ type: "Move", name: `${m.move_code ?? "Move"} — ${m.client_name}`, sub: m.from_address ? `${m.from_address.split(",")[0]} → ${m.to_address?.split(",")[0]}` : undefined, href: getMoveDetailPath(m) });
      }
    });
    (quotes || []).forEach((q) => {
      if (`${q.quote_id ?? ""} ${q.client_name ?? ""}`.toLowerCase().includes(term)) {
        all.push({ type: "Quote", name: `${q.quote_id ?? "Quote"} — ${q.client_name}`, sub: q.service_type?.replace(/_/g, " "), href: `/admin/quotes/${q.quote_id ?? q.id}` });
      }
    });
    (deliveries || []).forEach((d) => {
      if (`${d.delivery_number} ${d.customer_name ?? ""} ${d.client_name ?? ""}`.toLowerCase().includes(term)) {
        all.push({ type: "Delivery", name: `${d.delivery_number} — ${d.customer_name ?? d.client_name ?? "Delivery"}`, href: getDeliveryDetailPath(d) });
      }
    });

    setResults(all.slice(0, 12));
    setSelectedIdx(0);
    setSearching(false);
  }, [supabase]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => search(query), 240);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  const totalItems = query.length >= 2 ? results.length : ALL_NAV_ITEMS.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, totalItems - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const href = query.length >= 2 ? results[selectedIdx]?.href : ALL_NAV_ITEMS[selectedIdx]?.href;
      if (href) { router.push(href); onClose(); }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const navigate = (href: string) => { router.push(href); onClose(); };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[13vh] px-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[4px]" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] bg-[var(--card)] border border-[var(--brd)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "cmdPaletteIn 0.16s cubic-bezier(0.34,1.4,0.64,1) both" }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--brd)]">
          {searching ? (
            <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin shrink-0" />
          ) : (
            <MagnifyingGlass weight="regular" className="w-4 h-4 text-[var(--tx3)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, moves, partners, clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--brd)] text-[10px] text-[var(--tx3)] font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results / Quick nav */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto overscroll-contain scrollbar-hide">
          {query.length >= 2 ? (
            results.length > 0 ? (
              results.map((r, idx) => (
                <div
                  key={r.href + idx}
                  data-idx={idx}
                  onClick={() => navigate(r.href)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-[var(--brd)]/30 last:border-0 ${idx === selectedIdx ? "bg-[var(--gdim)]" : "hover:bg-[var(--gdim)]/60"}`}
                >
                  <span
                    className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[11px]"
                    style={{ background: `${TYPE_COLORS[r.type] ?? "var(--tx3)"}18`, color: TYPE_COLORS[r.type] ?? "var(--tx3)" }}
                  >
                    {r.type === "Client" ? <User weight="regular" className="w-3 h-3 text-current" /> :
                      r.type === "Move" || r.type === "Delivery" ? <Truck weight="regular" className="w-3 h-3 text-current" /> :
                      r.type === "Quote" || r.type === "Invoice" ? <FileText weight="regular" className="w-3 h-3 text-current" /> :
                      <MagnifyingGlass weight="regular" className="w-3 h-3 text-current" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{r.name}</div>
                    {r.sub && <div className="text-[10px] text-[var(--tx3)] truncate">{r.sub}</div>}
                  </div>
                  <span
                    className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                    style={{ color: TYPE_COLORS[r.type] ?? "var(--tx3)", backgroundColor: `${TYPE_COLORS[r.type] ?? "var(--tx3)"}18` }}
                  >
                    {r.type}
                  </span>
                </div>
              ))
            ) : !searching ? (
              <div className="px-4 py-10 text-center text-[12px] text-[var(--tx3)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : null
          ) : (
            // Quick nav — grouped
            <div className="p-2">
              {QUICK_NAV.map((group) => (
                <div key={group.group} className="mb-3 last:mb-1">
                  <div className="px-2 py-1 text-[9px] font-bold tracking-[1.2px] uppercase text-[var(--tx3)]">
                    {group.group}
                  </div>
                  {group.items.map((item) => {
                    const flatIdx = ALL_NAV_ITEMS.findIndex((n) => n.href === item.href);
                    const isSelected = flatIdx === selectedIdx;
                    const ItemIcon = item.Icon;
                    return (
                      <div
                        key={item.href}
                        data-idx={flatIdx}
                        onClick={() => navigate(item.href)}
                        className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-[var(--gdim)] text-[var(--gold)]" : "text-[var(--tx2)] hover:bg-[var(--gdim)]/60"}`}
                      >
                        <span className={isSelected ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>
                          <ItemIcon />
                        </span>
                        <span className="text-[12px] font-medium flex-1">{item.name}</span>
                        <CaretRight weight="regular" className="w-3 h-3 opacity-25 shrink-0 text-current" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--brd)] bg-[var(--bg)]/50">
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--brd)] font-mono text-[9px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--brd)] font-mono text-[9px]">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--card)] border border-[var(--brd)] font-mono text-[9px]">ESC</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
