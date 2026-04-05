"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import CreateDeliveryDropdown from "../../components/CreateDeliveryDropdown";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency } from "@/lib/format-currency";
import { ScheduleDeliveryItem } from "../../components/ScheduleItem";
import { toTitleCase } from "@/lib/format-text";
import { MagnifyingGlass, CaretRight } from "@phosphor-icons/react";

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

export default function HospitalityClient({
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
        <div className="flex gap-6 border-b border-[var(--brd)]/40 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-1 py-3 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === t.key
                  ? "text-[var(--gold)] border-[var(--gold)]"
                  : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CreateDeliveryDropdown
            type="hospitality"
            addPartnerHref="/admin/clients/new?type=partner&partnerType=hospitality"
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-6 border-t border-[var(--brd)]/30">
        {activeTab === "deliveries" && (
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4">Deliveries</div>
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-4 mb-4 border-b border-[var(--brd)]/30">
              <div className="relative flex-1">
                <MagnifyingGlass size={15} weight="regular" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx2)]" aria-hidden />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search deliveries…"
                  className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] py-2 pl-10 pr-3 text-[12px] text-[var(--tx)] transition-colors placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]"
                />
              </div>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors min-w-[160px]"
              >
                <option value="all">All Partners</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Deliveries list */}
            <div className="divide-y divide-[var(--brd)]/30">
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
                        <CaretRight size={14} weight="regular" className="flex-shrink-0 text-[var(--tx3)]" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
            {filteredDeliveries.length > 25 && (
              <div className="px-4 py-3 border-t border-[var(--brd)] text-center">
                <Link href="/admin/deliveries" className="admin-view-all-link justify-center">
                  View all {filteredDeliveries.length} deliveries
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "partners" && (
          <div className="divide-y divide-[var(--brd)]/30">
            {clients.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-[13px] text-[var(--tx3)]">No hospitality partners yet.</p>
                <Link href="/admin/clients/new?type=partner&partnerType=hospitality" className="text-[12px] font-semibold text-[var(--gold)] hover:underline mt-1 inline-block">
                  Add your first partner
                </Link>
              </div>
            ) : (
              clients.map((c) => {
                const stats = byPartner[c.name || ""] || { revenue: 0, owing: 0, deliveryCount: 0 };
                return (
                  <Link
                    key={c.id}
                    href={`/admin/clients/${c.id}?from=hospitality`}
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
