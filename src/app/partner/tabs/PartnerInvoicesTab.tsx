"use client";

import { useState } from "react";
import { MagnifyingGlass, DownloadSimple, ArrowSquareOut } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";
import { getDisplayLabel } from "@/lib/displayLabels";

interface Invoice {
  id: string;
  invoice_number: string | null;
  client_name: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  delivery_id?: string | null;
  square_invoice_url?: string | null;
  square_receipt_url?: string | null;
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
        <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">No invoices yet</p>
        <p className="text-[12px] text-[var(--tx3)] mt-1">Invoices will appear here once they are generated.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="border-t border-[var(--brd)]/30 pt-6 mb-6">
        <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50">Total Invoices</div>
            <div className="text-[20px] font-bold text-[var(--tx)] mt-0.5">{invoices.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50">Outstanding</div>
            <div className="text-[20px] font-bold text-red-500 mt-0.5">{formatCurrency(totalOutstanding)}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50">Total Paid</div>
            <div className="text-[20px] font-bold text-emerald-500 mt-0.5">{formatCurrency(totalPaid)}</div>
          </div>
        </div>
      </div>

      {/* Search + Filter + Download */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass size={15} color="#6B6B6B" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="w-full rounded-lg border border-[var(--brd)] bg-[var(--card)] py-2 pl-10 pr-3 text-[12px] text-[var(--tx)] transition-colors placeholder:text-[var(--tx3)] focus:border-[var(--gold)] focus:outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] bg-[var(--card)] focus:border-[var(--gold)] focus:outline-none transition-colors"
        >
          <option value="all">All</option>
          <option value="paid">Paid</option>
          <option value="sent">Sent</option>
          <option value="overdue">Overdue</option>
          <option value="draft">Draft</option>
        </select>
        <button
          onClick={downloadCSV}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] hover:border-[#C9A962] transition-colors"
        >
          <DownloadSimple size={14} />
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/50 mb-4">Invoices</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--brd)]/30">
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)]">Invoice</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)] hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)]">Due</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)]">Amount</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)]">Status</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider capitalize text-[var(--tx3)] hidden sm:table-cell"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const badgeClass = STATUS_BADGE[(inv.status || "").toLowerCase()] || "bg-gray-50 text-gray-600";
                return (
                  <tr key={inv.id} className="border-b border-[var(--brd)]/30 last:border-0 hover:bg-[var(--bg)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[var(--tx)]">
                        {inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}
                      </div>
                      {inv.delivery_id && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5">Delivery</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--tx3)] hidden sm:table-cell">
                      {inv.created_at ? new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--tx3)]">
                      {inv.due_date ? new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[var(--tx)] text-right">
                      {formatCurrency(inv.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize ${badgeClass}`}>
                        {getDisplayLabel(inv.status, "payment")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {inv.square_invoice_url && (
                          <a
                            href={inv.square_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#C9A962]/10 text-[#C9A962] hover:bg-[#C9A962]/20 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ArrowSquareOut size={10} />
                            View
                          </a>
                        )}
                        {inv.status === "paid" && inv.square_receipt_url && (
                          <a
                            href={inv.square_receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Receipt
                          </a>
                        )}
                      </div>
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
