"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

interface StatusEvent {
  id: string;
  description: string;
  icon: string;
  created_at: string;
  entity_type: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<StatusEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  // Load notifications
  useEffect(() => {
    const loadNotifs = async () => {
      const { data } = await supabase
        .from("status_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifs(data || []);
      setUnreadCount(Math.min((data || []).length, 4));
    };
    loadNotifs();
  }, []);

  // Global search
  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) {
      setShowSearch(false);
      setSearchResults([]);
      return;
    }
    setShowSearch(true);

    const query = `%${q}%`;
    const [dels, orgs, invs, moves] = await Promise.all([
      supabase.from("deliveries").select("id, delivery_number, customer_name, client_name").or(`customer_name.ilike.${query},client_name.ilike.${query},delivery_number.ilike.${query}`).limit(5),
      supabase.from("organizations").select("id, name, type").ilike("name", query).limit(5),
      supabase.from("invoices").select("id, invoice_number, client_name, amount").or(`invoice_number.ilike.${query},client_name.ilike.${query}`).limit(5),
      supabase.from("moves").select("id, move_number, client_name").or(`client_name.ilike.${query},move_number.ilike.${query}`).limit(5),
    ]);

    const results: any[] = [];
    (dels.data || []).forEach((d) => results.push({ type: "Delivery", label: `${d.delivery_number} — ${d.customer_name} (${d.client_name})`, href: `/admin/deliveries/${d.id}` }));
    (orgs.data || []).forEach((o) => results.push({ type: "Client", label: `${o.name} — ${o.type}`, href: `/admin/clients` }));
    (invs.data || []).forEach((i) => results.push({ type: "Invoice", label: `${i.invoice_number} — ${i.client_name} ($${Number(i.amount).toLocaleString()})`, href: `/admin/invoices` }));
    (moves.data || []).forEach((m) => results.push({ type: "Move", label: `${m.move_number} — ${m.client_name}`, href: `/admin/moves/residential` }));
    setSearchResults(results);
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-40">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <div className="text-[10px] text-[var(--tx3)]">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 w-60 focus-within:border-[var(--gold)] transition-colors">
            <span className="text-[var(--tx3)] text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search everything..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              className="bg-transparent border-none text-[var(--tx)] text-[11px] outline-none w-full placeholder:text-[var(--tx3)]"
            />
          </div>

          {/* Search Results Dropdown */}
          {showSearch && (
            <div className="absolute top-full mt-1 right-0 w-80 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-lg z-50 max-h-[300px] overflow-y-auto">
              <div className="px-3 py-2 text-[10px] font-bold text-[var(--tx3)] border-b border-[var(--brd)]">
                {searchResults.length} results for &quot;{search}&quot;
              </div>
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onMouseDown={() => { router.push(r.href); setShowSearch(false); setSearch(""); }}
                  className="px-3 py-2 hover:bg-[var(--gdim)] cursor-pointer border-b border-[var(--brd)] last:border-none"
                >
                  <div className="text-[10px] font-semibold">{r.label}</div>
                  <div className="text-[8px] text-[var(--tx3)]">{r.type}</div>
                </div>
              ))}
              {searchResults.length === 0 && (
                <div className="px-3 py-4 text-center text-[10px] text-[var(--tx3)]">No results found</div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-8 h-8 rounded-lg border border-[var(--brd)] flex items-center justify-center text-sm text-[var(--tx2)] hover:bg-[var(--gdim)] hover:border-[var(--gold)] transition-all"
          >
            🔔
            {unreadCount > 0 && (
              <span className="absolute -top-[3px] -right-[3px] w-3.5 h-3.5 rounded-full bg-[var(--red)] text-white text-[7px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute top-full mt-1 right-0 w-80 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-lg z-50 max-h-[400px] overflow-y-auto">
              <div className="px-3 py-2 border-b border-[var(--brd)] flex justify-between items-center">
                <span className="text-[11px] font-bold">Notifications</span>
                <button
                  onClick={() => setUnreadCount(0)}
                  className="text-[9px] text-[var(--gold)] font-semibold"
                >
                  Mark all read
                </button>
              </div>
              {notifs.map((n, i) => (
                <div
                  key={n.id}
                  className={`flex gap-2 px-3 py-2.5 border-b border-[var(--brd)] last:border-none transition-colors ${
                    i < unreadCount ? "bg-[var(--gdim)]" : ""
                  }`}
                >
                  <div className="text-sm shrink-0 mt-0.5">{n.icon || "📋"}</div>
                  <div>
                    <div className="text-[10px] leading-snug">{n.description}</div>
                    <div className="text-[8px] text-[var(--tx3)] mt-0.5">
                      {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
              {notifs.length === 0 && (
                <div className="px-3 py-6 text-center text-[10px] text-[var(--tx3)]">No notifications</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}