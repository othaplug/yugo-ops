"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  client_email: string;
  move_id: string | null;
  delivery_id: string | null;
  items: { name: string }[];
  total_claimed_value: number;
  approved_amount: number | null;
  status: string;
  valuation_tier: string;
  crew_team: string | null;
  submitted_at: string;
  resolved_at: string | null;
  created_at: string;
}

interface Stats {
  openCount: number;
  reviewCount: number;
  resolvedCount: number;
  totalPaidOut: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially Approved" },
  { value: "denied", label: "Denied" },
  { value: "settled", label: "Settled" },
  { value: "closed", label: "Closed" },
];

function statusBadge(status: string): string {
  switch (status) {
    case "submitted": return "bg-[var(--gold)]/15 text-[var(--gold)]";
    case "under_review": return "bg-[#3B82F6]/15 text-[#3B82F6]";
    case "approved": return "bg-[var(--grn)]/15 text-[var(--grn)]";
    case "partially_approved": return "bg-amber-500/15 text-amber-500";
    case "denied": return "bg-[var(--red)]/15 text-[var(--red)]";
    case "settled": case "closed": return "bg-[var(--brd)] text-[var(--tx3)]";
    default: return "bg-[var(--brd)] text-[var(--tx3)]";
  }
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ClaimsListClient({ claims, stats }: { claims: Claim[]; stats: Stats }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = claims;
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.claim_number.toLowerCase().includes(q) ||
          c.client_name.toLowerCase().includes(q) ||
          c.client_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [claims, statusFilter, search]);

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--tx)]">Claims</h1>
          <p className="text-[13px] text-[var(--tx3)]">Damage claims and valuation protection payouts</p>
        </div>
        <Link
          href="/admin/claims/new"
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
        >
          + New Claim
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open Claims" value={stats.openCount} color="var(--gold)" />
        <StatCard label="Under Review" value={stats.reviewCount} color="#3B82F6" />
        <StatCard label="Resolved (30d)" value={stats.resolvedCount} color="var(--grn)" />
        <StatCard label="Paid Out (30d)" value={formatCurrency(stats.totalPaidOut)} color="var(--tx)" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search claims..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none"
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
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Claim #</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Items</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Claimed</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Approved</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--tx3)] text-[11px] uppercase tracking-wider">Crew</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--tx3)]">
                    {claims.length === 0 ? "No claims yet" : "No claims match your filters"}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/claims/${c.id}`} className="font-semibold text-[var(--gold)] hover:underline">
                        {c.claim_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--tx2)]">
                      {new Date(c.submitted_at || c.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[var(--tx)] font-medium">{c.client_name}</div>
                      <div className="text-[11px] text-[var(--tx3)]">{c.client_email}</div>
                    </td>
                    <td className="px-4 py-3 text-[var(--tx2)]">
                      {Array.isArray(c.items) ? c.items.length : 0} item{(Array.isArray(c.items) ? c.items.length : 0) !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 text-[var(--tx)] font-medium">{formatCurrency(c.total_claimed_value)}</td>
                    <td className="px-4 py-3 text-[var(--tx2)]">
                      {c.approved_amount != null ? formatCurrency(c.approved_amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--tx2)]">{c.crew_team || "—"}</td>
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

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-4">
      <p className="text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
