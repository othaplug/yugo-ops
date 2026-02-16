"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Badge from "../components/Badge";
import InvoiceActions from "./InvoiceActions";

type SortKey = "date" | "amount" | "client" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "client", label: "Client" },
  { value: "status", label: "Status" },
];

export default function InvoicesTable({ invoices }: { invoices: any[] }) {
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const list = [...(invoices || [])];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") {
        const da = new Date(a.created_at || a.due_date || 0).getTime();
        const db = new Date(b.created_at || b.due_date || 0).getTime();
        cmp = da - db;
      } else if (sortBy === "amount") {
        cmp = Number(a.amount) - Number(b.amount);
      } else if (sortBy === "client") {
        cmp = (a.client_name || "").localeCompare(b.client_name || "");
      } else {
        cmp = (a.status || "").localeCompare(b.status || "");
      }
      return asc ? cmp : -cmp;
    });
    return list;
  }, [invoices, sortBy, asc]);

  return (
    <>
      <div className="px-4 py-2 border-b border-[var(--brd)] flex items-center justify-end gap-2">
        <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Sort by</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAsc((a) => !a)}
          className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
        >
          {asc ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Invoice</th>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Client</th>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Amount</th>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Due</th>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">Status</th>
            <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((inv) => (
            <tr key={inv.id} className="hover:bg-[var(--gdim)] transition-colors">
              <td className="px-4 py-2.5 text-[10px] font-semibold font-mono border-b border-[var(--brd)]">
                {inv.invoice_number}
              </td>
              <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">
                <Link href="/admin/clients" className="hover:text-[var(--gold)] transition-colors">
                  {inv.client_name}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[10px] font-bold border-b border-[var(--brd)]">
                ${Number(inv.amount).toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">
                {inv.due_date}
              </td>
              <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                <Badge status={inv.status} />
              </td>
              <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                <InvoiceActions invoiceId={inv.id} status={inv.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
