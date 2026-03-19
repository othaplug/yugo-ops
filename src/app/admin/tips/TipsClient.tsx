"use client";

import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

interface Tip {
  id: string;
  move_id: string;
  crew_id: string;
  crew_name: string | null;
  client_name: string | null;
  amount: number;
  processing_fee: number | null;
  net_amount: number | null;
  charged_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default function TipsClient({
  tips,
  totalTips,
  avgTip,
  tipCount,
}: {
  tips: Tip[];
  totalTips: number;
  avgTip: number;
  tipCount: number;
}) {
  const columns: ColumnDef<Tip>[] = [
    {
      id: "client_name",
      label: "Client Name",
      accessor: (r) => r.client_name,
      render: (r) => (
        <span className="font-bold text-[var(--tx)]">{r.client_name || "—"}</span>
      ),
      searchable: true,
    },
    {
      id: "crew_name",
      label: "Crew",
      accessor: (r) => r.crew_name,
      render: (r) => r.crew_name || "—",
      searchable: true,
    },
    {
      id: "charged_at",
      label: "Date",
      accessor: (r) => r.charged_at,
      render: (r) => formatDate(r.charged_at),
      sortable: true,
      exportAccessor: (r) => formatDate(r.charged_at),
    },
    {
      id: "amount",
      label: "Amount",
      accessor: (r) => r.amount,
      render: (r) => (
        <span className="font-bold text-[var(--gold)] font-heading">
          {formatCurrency(r.amount)}
        </span>
      ),
      sortable: true,
      align: "right",
      exportAccessor: (r) => formatCurrency(r.amount),
    },
    {
      id: "processing_fee",
      label: "Fee",
      accessor: (r) => r.processing_fee,
      render: (r) =>
        r.processing_fee != null && Number(r.processing_fee) > 0
          ? formatCurrency(Number(r.processing_fee))
          : "—",
      sortable: true,
      align: "right",
      exportAccessor: (r) =>
        r.processing_fee != null && Number(r.processing_fee) > 0
          ? formatCurrency(Number(r.processing_fee))
          : "",
    },
  ];

  return (
    <div className="max-w-[1000px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Finance</p>
      <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none mb-8">Tips</h1>

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Total Collected" value={formatCurrency(totalTips)} sub={`${tipCount} gratuities`} accent />
        <KpiCard label="Average Tip" value={formatCurrency(avgTip)} sub="per completed move" />
        <KpiCard label="Total Count" value={String(tipCount)} sub="all time" />
      </div>

      <SectionDivider label="Recent Tips" />
      <DataTable<Tip>
        data={tips}
        columns={columns}
        keyField="id"
        tableId="tips"
        searchable
        searchPlaceholder="Search by client or crew…"
        pagination
        exportable
        exportFilename="yugo-tips"
        columnToggle
        emptyMessage="No tips yet, tips appear here after clients leave gratuities on completed moves."
      />
    </div>
  );
}
