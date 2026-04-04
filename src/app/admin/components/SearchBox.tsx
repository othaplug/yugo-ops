"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/AppIcons";
import { X } from "@phosphor-icons/react";
import { runAdminEntitySearch } from "@/lib/admin-search";

const TYPE_ICONS: Record<string, string> = {
  Move: "mapPin",
  Quote: "fileText",
  Delivery: "truck",
  Project: "projects",
  Client: "users",
  Invoice: "dollarSign",
  Contact: "users",
  Nav: "mapPin",
};

const TYPE_COLORS: Record<string, string> = {
  Move: "var(--blue)",
  Quote: "var(--grn)",
  Delivery: "var(--gold)",
  Project: "#C026D3",
  Client: "var(--pur)",
  Invoice: "var(--grn)",
  Contact: "var(--org)",
  Nav: "var(--tx2)",
};

/** Sidebar nav items + settings for command-centre search */
const NAV_SEARCH_ITEMS: { name: string; href: string; keywords: string[] }[] = [
  {
    name: "Command Center",
    href: "/admin",
    keywords: ["dashboard", "home", "command", "centre", "center"],
  },
  {
    name: "Activity",
    href: "/admin/activity",
    keywords: ["activity", "feed", "status", "events", "log"],
  },
  {
    name: "Jobs",
    href: "/admin/deliveries",
    keywords: ["projects", "deliveries", "jobs", "b2b", "all"],
  },
  {
    name: "Reports",
    href: "/admin/reports",
    keywords: ["reports", "analytics"],
  },
  {
    name: "Calendar",
    href: "/admin/calendar",
    keywords: ["calendar", "schedule"],
  },
  {
    name: "Tracking",
    href: "/admin/crew",
    keywords: ["tracking", "crew", "map", "live"],
  },
  {
    name: "Retail",
    href: "/admin/partners/retail",
    keywords: ["retail", "partners"],
  },
  {
    name: "Designers",
    href: "/admin/partners/designers",
    keywords: ["designers", "partners"],
  },
  {
    name: "Hospitality",
    href: "/admin/partners/hospitality",
    keywords: ["hospitality", "partners"],
  },
  {
    name: "Art Gallery",
    href: "/admin/partners/gallery",
    keywords: ["gallery", "art", "partners"],
  },
  {
    name: "Referral Partners",
    href: "/admin/partners/realtors",
    keywords: [
      "realtors",
      "referrals",
      "referral partners",
      "property manager",
      "developer",
      "commission",
    ],
  },
  { name: "All Moves", href: "/admin/moves", keywords: ["moves", "all"] },
  { name: "Quotes", href: "/admin/quotes", keywords: ["quotes"] },
  {
    name: "Invoices",
    href: "/admin/invoices",
    keywords: ["invoices", "finance"],
  },
  { name: "Revenue", href: "/admin/revenue", keywords: ["revenue", "finance"] },
  { name: "Tips", href: "/admin/tips", keywords: ["tips", "finance"] },
  {
    name: "Profitability",
    href: "/admin/finance/profitability",
    keywords: ["profitability", "finance"],
  },
  {
    name: "Contacts",
    href: "/admin/clients",
    keywords: ["contacts", "clients", "crm"],
  },
  {
    name: "Perks & Referrals",
    href: "/admin/perks",
    keywords: ["perks", "referrals", "crm"],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    keywords: ["settings", "account", "crm"],
  },
  {
    name: "Platform",
    href: "/admin/platform",
    keywords: ["platform", "admin"],
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    keywords: ["notifications"],
  },
];

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { type: string; name: string; sub?: string; href: string }[]
  >([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(
    async (q: string) => {
      if (!q || q.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      const term = q.toLowerCase();
      const all: { type: string; name: string; sub?: string; href: string }[] =
        [];

      // Nav / functions / settings — match first so they appear when typing page names
      for (const item of NAV_SEARCH_ITEMS) {
        const matchName = item.name.toLowerCase().includes(term);
        const matchKeyword = item.keywords.some(
          (k) => k.includes(term) || term.includes(k),
        );
        if (matchName || matchKeyword) {
          all.push({ type: "Nav", name: item.name, href: item.href });
        }
      }

      const entityResults = await runAdminEntitySearch(supabase, q, 20);
      for (const r of entityResults) {
        all.push({ type: r.type, name: r.name, sub: r.sub, href: r.href });
      }

      setResults(all.slice(0, 12));
      setOpen(all.length > 0);
    },
    [supabase],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <div
      ref={ref}
      className="relative w-full min-w-0 max-w-[200px] sm:max-w-[240px] md:max-w-[280px]"
    >
      <div className="flex h-9 w-full min-w-0 items-center gap-1.5 rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-2 sm:gap-2 sm:px-3 transition-colors duration-200">
        <span className="inline-flex shrink-0 items-center justify-center text-[var(--tx3)]">
          <Icon name="search" className="h-[14px] w-[14px]" />
        </span>
        <input
          type="text"
          placeholder="Search…"
          title="Search moves, deliveries, quotes, clients"
          aria-label="Search moves, deliveries, quotes, clients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="min-h-0 flex-1 border-none bg-transparent py-0 font-sans text-[12px] leading-none text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="inline-flex h-5 shrink-0 items-center justify-center text-[var(--tx3)] hover:text-[var(--tx)]"
          >
            <X
              size={12}
              weight="regular"
              className="text-current"
              aria-hidden
            />
          </button>
        ) : (
          <kbd className="hidden h-5 shrink-0 select-none items-center justify-center rounded border border-[var(--brd)] bg-transparent px-1.5 font-mono text-[10px] leading-none text-[var(--tx3)] sm:inline-flex">
            ⌘K
          </kbd>
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
              onClick={() => {
                router.push(r.href);
                setOpen(false);
                setQuery("");
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--brd)]/40 last:border-0 hover:bg-[var(--gdim)] cursor-pointer transition-colors duration-150"
            >
              <Icon
                name={TYPE_ICONS[r.type] || "search"}
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: TYPE_COLORS[r.type] || "var(--tx3)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-[var(--tx)] truncate">
                  {r.name}
                </div>
                {r.sub && (
                  <div className="text-[9px] text-[var(--tx3)] truncate">
                    {r.sub}
                  </div>
                )}
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0"
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
          <div className="text-[12px] text-[var(--tx3)]">
            No results for &ldquo;{query}&rdquo;
          </div>
        </div>
      )}
    </div>
  );
}
