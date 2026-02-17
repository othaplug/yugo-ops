"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../components/BackButton";
import FilterBar, { SortableHeader } from "../components/FilterBar";
import ClientsTableBody from "./ClientsTableBody";

type Client = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  deliveries_per_month?: string | number | null;
  outstanding_balance?: number | null;
};

const CLIENT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "retail", label: "Retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "designer", label: "Designer" },
  { value: "b2c", label: "Move" },
  { value: "gallery", label: "Gallery" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "partner", label: "Partner" },
  { value: "client", label: "Client" },
];

const BALANCE_OPTIONS = [
  { value: "", label: "All" },
  { value: "has", label: "Has balance" },
  { value: "none", label: "No balance" },
];

export default function ClientsPageClient({ clients: initialClients }: { clients: Client[] }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredAndSorted = useMemo(() => {
    let list = [...initialClients];

    if (typeFilter) {
      list = list.filter((c) => c.type === typeFilter);
    }
    if (statusFilter) {
      if (statusFilter === "partner") list = list.filter((c) => c.type !== "b2c");
      if (statusFilter === "client") list = list.filter((c) => c.type === "b2c");
    }
    if (balanceFilter) {
      const hasBal = (c: Client) => (c.outstanding_balance ?? 0) > 0;
      if (balanceFilter === "has") list = list.filter(hasBal);
      if (balanceFilter === "none") list = list.filter((c) => !hasBal(c));
    }

    if (sortKey) {
      list.sort((a, b) => {
        let va: string | number = "";
        let vb: string | number = "";
        if (sortKey === "name") {
          va = (a.name || "").toLowerCase();
          vb = (b.name || "").toLowerCase();
        } else if (sortKey === "type") {
          va = (a.type === "b2c" ? "Move" : a.type).toLowerCase();
          vb = (b.type === "b2c" ? "Move" : b.type).toLowerCase();
        } else if (sortKey === "contact") {
          va = (a.contact_name || a.email || "").toLowerCase();
          vb = (b.contact_name || b.email || "").toLowerCase();
        } else if (sortKey === "avg") {
          va = Number(a.deliveries_per_month) || 0;
          vb = Number(b.deliveries_per_month) || 0;
        } else if (sortKey === "owing") {
          va = Number(a.outstanding_balance) || 0;
          vb = Number(b.outstanding_balance) || 0;
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [initialClients, typeFilter, statusFilter, balanceFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const hasActiveFilters = !!(typeFilter || statusFilter || balanceFilter);
  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setBalanceFilter("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <BackButton label="Back" />
        <div className="flex gap-1.5">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + Add Client
          </Link>
          <Link
            href="/admin/revenue"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Export
          </Link>
        </div>
      </div>

      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden overflow-x-auto">
        <FilterBar
          filters={[
            {
              key: "type",
              label: "Type",
              value: typeFilter,
              options: CLIENT_TYPE_OPTIONS,
              onChange: setTypeFilter,
            },
            {
              key: "status",
              label: "Status",
              value: statusFilter,
              options: STATUS_OPTIONS,
              onChange: setStatusFilter,
            },
            {
              key: "balance",
              label: "Balance",
              value: balanceFilter,
              options: BALANCE_OPTIONS,
              onChange: setBalanceFilter,
            },
          ]}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />
        <table className="w-full border-collapse min-w-[480px]">
          <thead>
            <tr>
              <SortableHeader label="Client" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Type" sortKey="type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Contact" sortKey="contact" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="AVG DEL" sortKey="avg" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Owing" sortKey="owing" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <th className="w-10 px-3 py-2 border-b border-[var(--brd)]" aria-hidden />
            </tr>
          </thead>
          <tbody>
            <ClientsTableBody clients={filteredAndSorted} />
          </tbody>
        </table>
      </div>
    </div>
  );
}
