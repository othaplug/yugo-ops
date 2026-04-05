"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
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

function statusSelectClass(status: string): string {
  switch (status) {
    case "new":
      return "text-[#2C3E2D] dark:text-[var(--tx2)]";
    case "contacted":
      return "text-[var(--blue)]";
    case "quote_sent":
      return "text-purple-500 dark:text-[var(--pur)]";
    case "booked":
      return "text-[var(--grn)]";
    case "lost":
      return "text-[var(--red)]";
    default:
      return "text-[var(--tx3)]";
  }
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

  const contactedCount = leads.filter((l) => l.status === "contacted" || l.status === "quote_sent").length;
  const bookedCount = leads.filter((l) => l.status === "booked").length;

  const kpiItems: {
    key: string;
    label: string;
    sub: string;
    value: number;
    emphasize?: boolean;
    accent?: boolean;
  }[] = [
    { key: "total", label: "Total", sub: "All time", value: leads.length },
    {
      key: "new",
      label: "New",
      sub: "Awaiting contact",
      value: newCount,
      emphasize: newCount > 0,
    },
    {
      key: "progress",
      label: "In progress",
      sub: "Contacted or quoted",
      value: contactedCount,
    },
    {
      key: "booked",
      label: "Booked",
      sub: "Converted",
      value: bookedCount,
      accent: bookedCount > 0,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-10 space-y-2 sm:mb-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]/55">
          Sales
        </p>
        <h1 className="admin-page-hero text-[var(--tx)]">Widget Leads</h1>
      </header>

      <section
        className="mb-10 overflow-hidden rounded-2xl bg-[var(--brd)]/[0.28] p-px shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-[var(--brd)]/35 dark:shadow-none"
        aria-label="Lead summary"
      >
        <dl className="grid grid-cols-2 gap-px sm:grid-cols-4">
          {kpiItems.map(({ key, label, sub, value, emphasize, accent }) => (
            <div key={key} className="bg-[var(--card)] px-4 py-4 sm:px-5 sm:py-5">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/65">
                {label}
              </dt>
              <dd
                className={`mt-1.5 font-heading text-2xl font-semibold tabular-nums tracking-tight ${
                  emphasize
                    ? "text-[var(--red)]"
                    : accent
                      ? "text-[var(--grn)]"
                      : "text-[var(--tx)]"
                }`}
              >
                {value}
              </dd>
              <p className="mt-1 text-[10px] text-[var(--tx3)]/75">{sub}</p>
            </div>
          ))}
        </dl>
      </section>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]/55">
          Leads
        </p>
        <input
          type="search"
          placeholder="Search name, email, or lead #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border-0 bg-[var(--bg2)] px-3.5 py-2.5 text-[13px] text-[var(--tx)] shadow-[inset_0_0_0_1px_var(--brd)] placeholder:text-[var(--tx3)]/55 focus:shadow-[inset_0_0_0_1px_#2C3E2D33] focus:outline-none dark:focus:shadow-[inset_0_0_0_1px_var(--brd)]"
        />
      </div>

      <div
        className="-mx-4 mb-6 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:flex-wrap sm:gap-2 sm:px-0 sm:pb-0"
        role="toolbar"
        aria-label="Filter by status"
      >
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setStatusFilter(o.value)}
            className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
              statusFilter === o.value
                ? "bg-[var(--tx)] text-[var(--bg2)] dark:bg-[var(--tx2)] dark:text-[var(--bg)]"
                : "bg-transparent text-[var(--tx2)] shadow-[inset_0_0_0_1px_var(--brd)] hover:bg-[var(--hover)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <section aria-label="Lead list">
        <div className="overflow-x-auto rounded-2xl bg-[var(--card)] shadow-[0_1px_0_rgba(0,0,0,0.04)] ring-1 ring-[var(--brd)]/40 dark:shadow-none dark:ring-[var(--brd)]/50">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[var(--brd)]/50 text-left">
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Lead #
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Size
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  <span className="inline-flex items-center gap-1">
                    From
                    <ArrowRight size={12} weight="bold" aria-hidden className="opacity-50" />
                    To
                  </span>
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Estimate
                </th>
                <th
                  scope="col"
                  className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)]/70"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--tx2)]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-[15px] text-[var(--tx3)]/85"
                  >
                    {leads.length === 0
                      ? "No widget leads yet."
                      : "No leads match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-[var(--brd)]/[0.35] transition-colors last:border-b-0 hover:bg-[var(--hover)]/80"
                  >
                    <td className="px-4 py-3.5 font-semibold text-[#2C3E2D] dark:text-[var(--tx2)]">
                      {l.lead_number}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--tx)]">
                      {l.name}
                    </td>
                    <td className="px-4 py-3.5">{l.email}</td>
                    <td className="px-4 py-3.5">
                      {SIZE_LABELS[l.move_size] || l.move_size}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        {l.from_postal?.toUpperCase()}
                        <ArrowRight
                          size={12}
                          weight="bold"
                          aria-hidden
                          className="shrink-0 opacity-40"
                        />
                        {l.to_postal?.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-[var(--tx)]">
                      {l.widget_estimate_low && l.widget_estimate_high
                        ? `${formatCurrency(l.widget_estimate_low)}–${formatCurrency(l.widget_estimate_high)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={l.status}
                        onChange={(e) => handleStatusUpdate(l.id, e.target.value)}
                        disabled={updatingId === l.id}
                        className={`max-w-[160px] cursor-pointer rounded-md border-0 bg-[var(--bg2)] py-1.5 pl-2 pr-7 text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[inset_0_0_0_1px_var(--brd)] outline-none ${statusSelectClass(l.status)}`}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
