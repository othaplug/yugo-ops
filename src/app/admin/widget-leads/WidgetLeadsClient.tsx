"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";

interface Lead {
  id: string;
  lead_number: string;
  name: string;
  email: string;
  phone: string | null;
  move_size: string;
  from_postal: string;
  to_postal: string;
  move_date: string | null;
  flexible_date: boolean;
  widget_estimate_low: number | null;
  widget_estimate_high: number | null;
  status: string;
  created_at: string;
}

const SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1BR",
  "2br": "2BR",
  "3br": "3BR",
  "4br": "4BR",
  "5br_plus": "5+",
};

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "quote_sent", label: "Quote Sent" },
  { value: "booked", label: "Booked" },
  { value: "lost", label: "Lost" },
];

function statusBadge(status: string): string {
  switch (status) {
    case "new": return "bg-[var(--gold)]/15 text-[var(--gold)]";
    case "contacted": return "bg-[#3B82F6]/15 text-[#3B82F6]";
    case "quote_sent": return "bg-purple-500/15 text-purple-500";
    case "booked": return "bg-[var(--grn)]/15 text-[var(--grn)]";
    case "lost": return "bg-[var(--red)]/15 text-[var(--red)]";
    default: return "bg-[var(--brd)] text-[var(--tx3)]";
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function WidgetLeadsClient({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = leads;
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.lead_number.toLowerCase().includes(q) ||
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, statusFilter, search]);

  const newCount = leads.filter((l) => l.status === "new").length;

  const handleStatusUpdate = useCallback(async (leadId: string, newStatus: string) => {
    setUpdatingId(leadId);
    try {
      await fetch("/api/admin/widget-leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, status: newStatus }),
      });
      router.refresh();
    } finally {
      setUpdatingId(null);
    }
  }, [router]);

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--tx)]">Widget Leads</h1>
          <p className="text-[13px] text-[var(--tx3)]">
            Quote requests from the instant quote widget
            {newCount > 0 && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--gold)]/15 text-[var(--gold)]">{newCount} new</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Lead #</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Size</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">From → To</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Estimate</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--tx3)]">
                    {leads.length === 0 ? "No widget leads yet" : "No leads match your filters"}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--gold)]">{l.lead_number}</td>
                    <td className="px-4 py-3 text-[var(--tx)] font-medium">{l.name}</td>
                    <td className="px-4 py-3 text-[var(--tx2)]">{l.email}</td>
                    <td className="px-4 py-3 text-[var(--tx2)]">{SIZE_LABELS[l.move_size] || l.move_size}</td>
                    <td className="px-4 py-3 text-[var(--tx2)]">
                      {l.from_postal?.toUpperCase()} → {l.to_postal?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-[var(--tx)] font-medium">
                      {l.widget_estimate_low && l.widget_estimate_high
                        ? `${formatCurrency(l.widget_estimate_low)}–${formatCurrency(l.widget_estimate_high)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusUpdate(l.id, e.target.value)}
                        disabled={updatingId === l.id}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border-0 outline-none cursor-pointer ${statusBadge(l.status)}`}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
