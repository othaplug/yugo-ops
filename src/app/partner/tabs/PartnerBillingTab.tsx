"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format-currency";
import YugoLogo from "@/components/YugoLogo";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import FilterBar from "@/app/admin/components/FilterBar";

interface DashboardData {
  completedThisMonth: number;
  onTimeRate: number;
  damageClaims: number;
  outstandingAmount: number;
  outstandingDueDate: string | null;
  allDeliveries: { id: string; status: string; scheduled_date: string | null }[];
  invoices: { id: string; amount: number; status: string; created_at: string }[];
}

type MonthlyRow = {
  yearMonth: string;
  month: string;
  fullMonthLabel: string;
  deliveries: number;
  completed: number;
  onTime: string;
  onTimeRate: number;
  damage: number;
  revenue: number;
  score: string;
};

function buildMonthlyData(
  allDeliveries: DashboardData["allDeliveries"],
  invoices: DashboardData["invoices"],
  monthsBack: number
): MonthlyRow[] {
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const rows: MonthlyRow[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthDels = allDeliveries.filter((del) => {
      if (!del.scheduled_date) return false;
      return del.scheduled_date.slice(0, 7) === mKey;
    });
    const completed = monthDels.filter((del) => ["delivered", "completed"].includes((del.status || "").toLowerCase()));
    const rate = monthDels.length > 0 ? Math.round((completed.length / monthDels.length) * 100) : 100;
    const monthRevenue = invoices
      .filter((inv) => (inv.status || "").toLowerCase() === "paid" && (inv.created_at || "").slice(0, 7) === mKey)
      .reduce((s, inv) => s + Number(inv.amount || 0), 0);
    rows.push({
      yearMonth: mKey,
      month: monthNames[d.getMonth()],
      fullMonthLabel: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      deliveries: monthDels.length,
      completed: completed.length,
      onTime: `${rate}%`,
      onTimeRate: rate,
      damage: 0,
      revenue: monthRevenue,
      score: rate >= 99 ? "A+" : rate >= 95 ? "A" : rate >= 90 ? "B+" : "B",
    });
  }
  return rows;
}

const PERIOD_OPTIONS = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "24", label: "Last 24 months" },
];

const monthlyPerformanceColumns: ColumnDef<MonthlyRow>[] = [
  {
    id: "fullMonthLabel",
    label: "Month",
    accessor: (r) => r.fullMonthLabel,
    render: (r) => <span className="font-semibold text-[var(--tx)]">{r.fullMonthLabel}</span>,
    sortable: true,
    searchable: true,
  },
  {
    id: "deliveries",
    label: "Deliveries",
    accessor: (r) => r.deliveries,
    render: (r) => <span className="text-[var(--tx)]">{r.deliveries}</span>,
    sortable: true,
    align: "right",
  },
  {
    id: "completed",
    label: "Completed",
    accessor: (r) => r.completed,
    render: (r) => <span className="text-[var(--tx)]">{r.completed}</span>,
    sortable: true,
    align: "right",
  },
  {
    id: "onTime",
    label: "On-Time",
    accessor: (r) => r.onTimeRate,
    render: (r) => <span className="font-semibold text-[var(--tx)]">{r.onTime}</span>,
    sortable: true,
    align: "right",
    exportAccessor: (r) => r.onTime,
  },
  {
    id: "damage",
    label: "Damage",
    accessor: (r) => r.damage,
    render: (r) => <span className="text-[var(--tx)]">{r.damage}</span>,
    sortable: true,
    align: "right",
  },
  {
    id: "revenue",
    label: "Revenue",
    accessor: (r) => r.revenue,
    render: (r) => <span className="text-[var(--tx)] font-medium">{formatCurrency(r.revenue)}</span>,
    sortable: true,
    align: "right",
    exportAccessor: (r) => formatCurrency(r.revenue),
  },
  {
    id: "score",
    label: "Score",
    accessor: (r) => r.score,
    render: (r) => (
      <span className={`text-[12px] font-bold ${r.score.startsWith("A") ? "text-[#2D9F5A]" : "text-[var(--gold)]"}`}>
        {r.score}
      </span>
    ),
    sortable: true,
    align: "right",
  },
];

export default function PartnerBillingTab({
  data,
  orgName,
  onViewInvoices,
}: {
  data: DashboardData;
  orgName: string;
  onViewInvoices?: () => void;
}) {
  const [periodMonths, setPeriodMonths] = useState("6");

  const monthlyData = useMemo(
    () => buildMonthlyData(data.allDeliveries, data.invoices, Number(periodMonths) || 6),
    [data.allDeliveries, data.invoices, periodMonths]
  );

  const totalDeliveries = data.allDeliveries.length;
  const totalCompleted = data.allDeliveries.filter((d) => ["delivered", "completed"].includes((d.status || "").toLowerCase())).length;
  const overallOnTime = totalDeliveries > 0 ? ((totalCompleted / totalDeliveries) * 100).toFixed(1) : "100";
  const totalPaid = data.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + Number(i.amount), 0);

  const periodLabel = periodMonths === "24" ? "Last 24 months" : periodMonths === "12" ? "Last 12 months" : "Last 6 months";

  const exportReport = () => {
    const rows = [["Month", "Deliveries", "Completed", "On-Time %", "Damage Claims", "Revenue", "Score"]];
    monthlyData.forEach((row) => {
      rows.push([
        row.fullMonthLabel,
        String(row.deliveries),
        String(row.completed),
        row.onTime,
        String(row.damage),
        formatCurrency(row.revenue),
        row.score,
      ]);
    });
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Total Deliveries", String(totalDeliveries)]);
    rows.push(["On-Time Rate", `${overallOnTime}%`]);
    rows.push(["Total Revenue", String(totalRevenue)]);
    rows.push(["Total Paid", String(totalPaid)]);
    rows.push(["Outstanding", String(data.outstandingAmount)]);

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-report-${periodLabel.replace(/\s+/g, "-").toLowerCase()}-${orgName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasNoDeliveries = totalDeliveries === 0;

  return (
    <div className="space-y-8">
      {/* Empty state when no deliveries yet */}
      {hasNoDeliveries && (
        <div className="py-4 text-center">
          <p className="text-[14px] font-semibold text-[var(--tx)]">No deliveries yet</p>
          <p className="text-[12px] text-[var(--tx3)] mt-1">
            Performance metrics and monthly data will appear here once you have completed jobs.
          </p>
        </div>
      )}

      {/* Service Level Performance */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-[var(--tx)] font-hero">Service Level Performance</h3>
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#C9A962] hover:text-[#8B6914] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Report ({periodLabel})
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-[var(--brd)]/30">
          <SLACircle value={`${overallOnTime}%`} label="On-Time Rate" sublabel="Industry avg: 82%" />
          <SLACircle value={`${data.damageClaims > 0 ? ((data.damageClaims / Math.max(totalDeliveries, 1)) * 100).toFixed(1) : "0"}%`} label="Damage Rate" sublabel={`${data.damageClaims} incident${data.damageClaims !== 1 ? "s" : ""} in ${totalDeliveries} deliveries`} />
          <SLACircle value={formatCurrency(totalPaid)} label="Total Paid" sublabel={`of ${formatCurrency(totalRevenue)} billed`} accent />
          <SLACircle value={String(totalDeliveries)} label="Total Deliveries" sublabel={`${totalCompleted} completed`} />
        </div>
      </div>

      {/* Monthly Performance Table — sort, pagination, search, filter (same as admin tables) */}
      <div>
        <h3 className="text-[20px] font-bold text-[var(--tx)] font-hero mb-3">Monthly Performance</h3>
        <FilterBar
          filters={[
            {
              key: "period",
              label: "Period",
              value: periodMonths,
              options: PERIOD_OPTIONS,
              onChange: (v) => setPeriodMonths(v),
            },
          ]}
          hasActiveFilters={periodMonths !== "6"}
          onClear={() => setPeriodMonths("6")}
        />
        <DataTable<MonthlyRow>
          data={monthlyData}
          columns={monthlyPerformanceColumns}
          keyField="yearMonth"
          tableId="partner-monthly-performance"
          searchable
          searchPlaceholder="Search by month…"
          pagination
          defaultPerPage={10}
          perPageOptions={[6, 10, 12, 25]}
          exportable
          exportFilename={`monthly-performance-${orgName.replace(/\s+/g, "-").toLowerCase()}`}
          columnToggle
          emptyMessage="No monthly data"
          emptySubtext="Deliveries will appear here once scheduled."
        />
      </div>

      {/* Industry Comparison */}
      <div>
        <h3 className="text-[26px] font-bold text-[var(--tx)] font-hero mb-3 flex items-center gap-2">
          <YugoLogo size={18} variant="black" />
          <span>vs Industry Standards</span>
        </h3>
        <div className="pt-4 border-t border-[var(--brd)]/30">
          <ComparisonCard label="On-Time Delivery" yugoValue={`${overallOnTime}%`} industryValue="82%" />
          <ComparisonCard
            label="Damage Rate"
            yugoValue={`${data.damageClaims > 0 ? ((data.damageClaims / Math.max(totalDeliveries, 1)) * 100).toFixed(2) : "0"}%`}
            industryValue="3.2%"
          />
          <ComparisonCard label="Response Time" yugoValue="< 15 min" industryValue="4+ hrs" accent yugoSublabel="Target" />
        </div>
      </div>

      {/* Revenue breakdown */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[20px] font-bold text-[var(--tx)] font-hero">Revenue Summary</h3>
          {onViewInvoices && (
            <button
              type="button"
              onClick={onViewInvoices}
              className="text-[12px] font-semibold text-[#C9A962] hover:text-[#8B6914] transition-colors"
            >
              View all invoices →
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-[var(--brd)]/30">
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Total Billed</div>
            <div className="text-[24px] font-bold text-[var(--tx)] font-hero">{formatCurrency(totalRevenue)}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Paid</div>
            <div className="text-[24px] font-bold text-[#2D9F5A] font-hero">{formatCurrency(totalPaid)}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Outstanding</div>
            <div className="text-[24px] font-bold text-[var(--red)] font-hero">{formatCurrency(data.outstandingAmount)}</div>
            {data.outstandingDueDate && (
              <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                Due {new Date(data.outstandingDueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SLACircle({ value, label, sublabel, accent }: { value: string; label: string; sublabel: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{label}</div>
      <div className={`text-[24px] font-bold font-hero ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"}`}>{value}</div>
      <div className="text-[11px] text-[var(--tx3)] mt-0.5">{sublabel}</div>
    </div>
  );
}

function ComparisonCard({
  label,
  yugoValue,
  industryValue,
  accent,
  yugoSublabel,
}: {
  label: string;
  yugoValue: string;
  industryValue: string;
  accent?: boolean;
  yugoSublabel?: string;
}) {
  return (
    <div className="py-3 border-b border-[var(--brd)]/30 last:border-0">
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">{label}</div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className={`text-[24px] font-bold font-hero ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"}`}>{yugoValue}</span>
          <div className="mt-0.5 flex items-center gap-1.5">
            <YugoLogo size={12} variant="black" />
            {yugoSublabel && (
              <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--tx3)]">{yugoSublabel}</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[16px] font-bold text-[var(--tx3)]">{industryValue}</span>
          <div className="text-[10px] text-[var(--tx3)]">Industry</div>
        </div>
      </div>
    </div>
  );
}
