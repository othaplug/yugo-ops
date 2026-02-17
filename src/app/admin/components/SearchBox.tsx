"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/AppIcons";
import { getDeliveryDetailPath } from "@/lib/move-code";

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: string; name: string; href: string }[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const q = query.toLowerCase();
    const search = async () => {
      const all: { type: string; name: string; href: string }[] = [];
      const { data: deliveries } = await supabase.from("deliveries").select("id, delivery_number, customer_name, client_name");
      const { data: clients } = await supabase.from("organizations").select("id, name, contact_name, email");
      const { data: invoices } = await supabase.from("invoices").select("id, invoice_number, client_name, amount");

      (deliveries || []).forEach((d) => {
        const s = `${d.delivery_number} ${d.customer_name} ${d.client_name}`.toLowerCase();
        if (s.includes(q)) all.push({ type: "Delivery", name: `${d.delivery_number} — ${d.customer_name}`, href: getDeliveryDetailPath(d) });
      });
      (clients || []).forEach((c) => {
        const s = `${c.name} ${c.contact_name || ""} ${c.email || ""}`.toLowerCase();
        if (s.includes(q)) all.push({ type: "Client", name: c.name, href: `/admin/clients/${c.id}` });
      });
      (invoices || []).forEach((i) => {
        const s = `${i.invoice_number} ${i.client_name}`.toLowerCase();
        if (s.includes(q)) all.push({ type: "Invoice", name: `${i.invoice_number} — ${i.client_name}`, href: `/admin/invoices` });
      });

      setResults(all.slice(0, 8));
      setOpen(all.length > 0);
    };
    search();
  }, [query]);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <div className="flex items-center gap-2 h-9 bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 w-[180px] md:w-[220px] focus-within:border-[var(--gold)] transition-colors duration-200">
        <span className="text-[var(--tx3)] shrink-0"><Icon name="search" className="w-[14px] h-[14px]" /></span>
        <input
          type="text"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="flex-1 min-w-0 bg-transparent border-none text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none font-sans"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-[320px] max-h-[400px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-[14px] shadow-xl z-50 animate-fade-up">
          <div className="px-3 py-2 text-[11px] font-bold border-b border-[var(--brd)]">
            Search: &quot;{query}&quot; ({results.length} results)
          </div>
          {results.map((r) => (
            <div
              key={r.href + r.name}
              onClick={() => { router.push(r.href); setOpen(false); setQuery(""); }}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--brd)] last:border-0 hover:bg-[var(--gdim)] cursor-pointer transition-colors duration-200"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{r.name}</div>
                <div className="text-[9px] text-[var(--tx3)]">{r.type}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
