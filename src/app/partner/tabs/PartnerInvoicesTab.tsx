"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";

interface Invoice {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-50 text-green-700",
  sent: "bg-blue-50 text-blue-700",
  overdue: "bg-red-50 text-red-700",
  draft: "bg-gray-50 text-gray-600",
};

export default function PartnerInvoicesTab({ invoices }: { invoices: Invoice[] }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = invoices.filter((inv) => {
    if (filter !== "all" && (inv.status || "").toLowerCase() !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (inv.invoice_number || "").toLowerCase().includes(q) || (inv.client_name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const downloadCSV = () => {
    const rows = [["Invoice #", "Client", "Date", "Due", "Amount", "Status"]];
    invoices.forEach((inv) => {
      rows.push([
        inv.invoice_number || "",
        inv.client_name || "",
        inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "",
        inv.due_date || "",
        String(inv.amount || 0),
        inv.status || "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (invoices.length === 0) {
    return (
      <div className="py-12 text-center border-t border-[var(--brd)]/30 pt-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#F5F3F0] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <p className="text-[14px] font-semibold text-[#1A1A1A]">No invoices yet</p>
        <p className="text-[12px] text-[#888] mt-1">Invoices will appear here once they are generated.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="border-t border-[var(--brd)]/30 pt-6 mb-6">
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Total Invoices</div>
            <div className="text-[20px] font-bold text-[#1A1A1A] mt-0.5">{invoices.length}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Outstanding</div>
            <div className="text-[20px] font-bold text-[#D14343] mt-0.5">{formatCurrency(totalOutstanding)}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Total Paid</div>
            <div className="text-[20px] font-bold text-[#2D9F5A] mt-0.5">{formatCurrency(totalPaid)}</div>
          </div>
        </div>
      </div>

      {/* Search + Filter + Download */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E8E4DF] text-[12px] text-[#1A1A1A] placeholder-[#999] focus:border-[#C9A962] focus:outline-none transition-colors bg-white"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E8E4DF] text-[12px] font-semibold text-[#1A1A1A] bg-white focus:border-[#C9A962] focus:outline-none transition-colors"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="sent">Sent</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
        <button
          onClick={downloadCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-white border border-[#E8E4DF] text-[#1A1A1A] hover:border-[#C9A962] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Invoices</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--brd)]/30">
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Invoice</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888] hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Due</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-[#888]">Amount</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-[#888]">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const badgeClass = STATUS_BADGE[(inv.status || "").toLowerCase()] || "bg-gray-50 text-gray-600";
                return (
                  <tr key={inv.id} className="border-b border-[var(--brd)]/30 last:border-0 hover:bg-[#FAF8F5]/50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">
                      {inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#888] hidden sm:table-cell">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#888]">
                      {inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A] text-right">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${badgeClass}`}>
                        {toTitleCase(inv.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
