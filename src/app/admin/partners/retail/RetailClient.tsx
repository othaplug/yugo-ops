"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency } from "@/lib/format-currency";
import { ScheduleDeliveryItem } from "../../components/ScheduleItem";
import { toTitleCase } from "@/lib/format-text";

interface Client {
  id: string;
  name: string;
  email: string | null;
  contact_name: string | null;
  deliveries_per_month: number | null;
}

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  scheduled_date: string | null;
  time_slot: string | null;
  items: unknown[] | null;
  delivery_address: string | null;
  organization_id: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  scheduled: "text-blue-600 bg-blue-500/10",
  confirmed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
  in_transit: "text-[var(--gold)] bg-[var(--gdim)]",
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  completed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
};

export default function RetailClient({
  clients,
  deliveries,
  byPartner,
}: {
  clients: Client[];
  deliveries: Delivery[];
  byPartner: Record<string, { revenue: number; owing: number; deliveryCount: number }>;
}) {
  const [activeTab, setActiveTab] = useState<"deliveries" | "partners">("deliveries");
  const [selectedPartner, setSelectedPartner] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filteredDeliveries = useMemo(() => {
    let result = deliveries;
    if (selectedPartner !== "all") {
      const client = clients.find((c) => c.id === selectedPartner);
      if (client) {
        result = result.filter((d) => d.organization_id === selectedPartner || d.client_name === client.name);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.customer_name || "").toLowerCase().includes(q) ||
          (d.delivery_number || "").toLowerCase().includes(q) ||
          (d.delivery_address || "").toLowerCase().includes(q) ||
          (d.client_name || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [deliveries, selectedPartner, search, clients]);

  const tabs = [
    { key: "deliveries" as const, label: `Deliveries (${deliveries.length})` },
    { key: "partners" as const, label: `Partners (${clients.length})` },
  ];

  return (
    <div>
      {/* Action buttons - positioned right above tabs */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                activeTab === t.key
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm"
                  : "bg-[var(--card)] text-[var(--tx3)] border border-[var(--brd)] hover:border-[var(--gold)]/50 hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/deliveries/new?type=retail"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] bg-[var(--card)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Delivery
          </Link>
          <Link
            href="/admin/clients/new?type=partner&partnerType=retail"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Add Partner
          </Link>
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {activeTab === "deliveries" && (
          <div>
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-4 border-b border-[var(--brd)]">
              <div className="relative flex-1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deliveries…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors"
                />
              </div>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors min-w-[160px]"
              >
                <option value="all">All Partners</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Deliveries list */}
            <div className="divide-y divide-[var(--brd)]/50">
              {filteredDeliveries.length === 0 ? (
                <div className="px-4 py-10 text-center text-[12px] text-[var(--tx3)]">
                  {search || selectedPartner !== "all" ? "No deliveries match your filter." : "No deliveries yet."}
                </div>
              ) : (
                filteredDeliveries.slice(0, 25).map((d) => {
                  const statusLabel = toTitleCase(d.status || "");
                  const badgeClass = STATUS_BADGE[(d.status || "").toLowerCase()] || "text-[var(--tx3)] bg-[var(--bg)]";
                  return (
                    <Link
                      key={d.id}
                      href={getDeliveryDetailPath(d)}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--tx)] truncate">{d.customer_name || d.delivery_number}</span>
                          <span className="text-[10px] text-[var(--tx3)] font-mono flex-shrink-0">{d.delivery_number}</span>
                        </div>
                        <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">
                          {d.client_name && <span className="font-medium">{d.client_name}</span>}
                          {d.delivery_address && <span> · {d.delivery_address}</span>}
                          {d.scheduled_date && <span> · {new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-[10px] text-[var(--tx3)]">
                          {Array.isArray(d.items) ? d.items.length : 0} items
                        </span>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}>
                          {statusLabel}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2" className="flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            {filteredDeliveries.length > 25 && (
              <div className="px-4 py-3 border-t border-[var(--brd)] text-center">
                <Link href="/admin/deliveries" className="text-[12px] font-semibold text-[var(--gold)] hover:underline">
                  View all {filteredDeliveries.length} deliveries →
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "partners" && (
          <div className="divide-y divide-[var(--brd)]/50">
            {clients.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] text-[var(--tx3)]">No retail partners yet.</p>
                <Link href="/admin/clients/new?type=partner&partnerType=retail" className="text-[12px] font-semibold text-[var(--gold)] hover:underline mt-1 inline-block">
                  Add your first partner
                </Link>
              </div>
            ) : (
              clients.map((c) => {
                const stats = byPartner[c.name || ""] || { revenue: 0, owing: 0, deliveryCount: 0 };
                return (
                  <Link
                    key={c.id}
                    href={`/admin/clients/${c.id}?from=retail`}
                    className="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--gold)]">
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-[var(--tx)]">{c.name}</div>
                        <div className="text-[11px] text-[var(--tx3)]">{c.contact_name} · {c.email}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-[11px] font-semibold text-[var(--tx)]">{stats.deliveryCount} deliveries</div>
                      {stats.revenue > 0 && (
                        <div className="text-[10px] text-[var(--grn)]">{formatCurrency(stats.revenue)} earned</div>
                      )}
                      {stats.owing > 0 && (
                        <div className="text-[10px] text-[var(--org)]">{formatCurrency(stats.owing)} owing</div>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
