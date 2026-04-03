"use client";

import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatAdminCreatedAt } from "@/lib/date-format";
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

interface CrewAllocation {
  id: string;
  name: string;
  total: number;
  count: number;
  avg: number;
  highest: number;
}

export default function TipsClient({
  tips,
  totalTips,
  avgTip,
  tipCount,
  crewAllocations = [],
}: {
  tips: Tip[];
  totalTips: number;
  avgTip: number;
  tipCount: number;
  crewAllocations?: CrewAllocation[];
}) {
  const columns: ColumnDef<Tip>[] = [
    {
      id: "client_name",
      label: "Client Name",
      accessor: (r) => r.client_name,
      render: (r) => (
        <span className="font-bold text-[var(--tx)]">{r.client_name || "-"}</span>
      ),
      searchable: true,
    },
    {
      id: "crew_name",
      label: "Crew",
      accessor: (r) => r.crew_name,
      render: (r) => r.crew_name || "-",
      searchable: true,
    },
    {
      id: "charged_at",
      label: "Create date",
      accessor: (r) => r.charged_at,
      render: (r) => formatAdminCreatedAt(r.charged_at),
      sortable: true,
      exportAccessor: (r) => formatAdminCreatedAt(r.charged_at),
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
          : "-",
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
      <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Finance</p>
      <h1 className="admin-page-hero text-[var(--tx)] mb-8">Tips</h1>

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Total Collected" value={formatCurrency(totalTips)} sub={`${tipCount} gratuities`} accent />
        <KpiCard label="Average Tip" value={formatCurrency(avgTip)} sub="per completed move" />
        <KpiCard label="Total Count" value={String(tipCount)} sub="all time" />
      </div>

      {crewAllocations.length > 0 && (
        <>
          <SectionDivider label="Crew Tip Allocation" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {crewAllocations.slice(0, 6).map((crew, i) => (
              <div
                key={crew.id}
                className="rounded-xl border border-[var(--brd)] p-4 bg-[var(--card)]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: i === 0 ? "rgba(201,169,98,0.15)" : "var(--bg)",
                      color: i === 0 ? "var(--gold)" : "var(--tx3)",
                      border: "1px solid var(--brd)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[var(--tx)] truncate">{crew.name}</p>
                    <p className="text-[10px] text-[var(--tx3)]">{crew.count} gratuities</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[15px] font-bold text-[var(--gold)]">{formatCurrency(crew.total)}</p>
                    <p className="text-[9px] text-[var(--tx3)] uppercase tracking-wide">Total</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[var(--tx)]">{formatCurrency(crew.avg)}</p>
                    <p className="text-[9px] text-[var(--tx3)] uppercase tracking-wide">Avg</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-[#22c55e]">{formatCurrency(crew.highest)}</p>
                    <p className="text-[9px] text-[var(--tx3)] uppercase tracking-wide">Best</p>
                  </div>
                </div>
                {/* Proportion bar */}
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--brd)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((crew.total / (crewAllocations[0]?.total || 1)) * 100)}%`,
                      background: "var(--gold)",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionDivider label="Recent Tips" />
      <DataTable<Tip>
        data={tips}
        columns={columns}
        keyField="id"
        tableId="tips"
        defaultSortCol="charged_at"
        defaultSortDir="desc"
        searchable
        searchPlaceholder="Search by client or crew…"
        pagination
        exportable
        exportFilename="yugo-tips"
        columnToggle
        emptyMessage="No tips yet. Tips appear here after clients leave gratuities on completed moves"
      />
    </div>
  );
}
