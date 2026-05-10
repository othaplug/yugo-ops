"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  DownloadSimple,
  Invoice,
  CheckCircle,
  ArrowRight,
  CaretRight,
} from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";
import YugoLogo from "@/components/YugoLogo";
import { csvField } from "@/lib/admin-csv-field"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
} from "@/design-system/admin/table"
import FilterBar from "@/app/admin/components/FilterBar";
import { WINE } from "@/app/quote/[quoteId]/quote-shared";
import {
  PartnerSectionEyebrow,
  PARTNER_TABLE_CHROME,
} from "@/components/partner/PartnerChrome";
import { InfoHint } from "@/components/ui/InfoHint";

interface PartnerInvoice {
  id: string;
  invoice_number: string;
  status: string;
  period_start: string;
  period_end: string;
  due_date?: string | null;
  total_amount: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  square_invoice_id?: string | null;
  square_invoice_url?: string | null;
  notes?: string | null;
}

interface DashboardData {
  completedThisMonth: number;
  onTimeRate: number;
  damageClaims?: number;
  outstandingAmount: number;
  outstandingDueDate: string | null;
  allDeliveries: {
    id: string;
    status: string;
    scheduled_date: string | null;
  }[];
  invoices: {
    id: string;
    amount: number;
    status: string;
    created_at: string;
  }[];
  partnerInvoices?: PartnerInvoice[];
}

interface PartnerStatement {
  id: string;
  statement_number: string;
  period_start: string;
  period_end: string;
  delivery_count: number;
  total: number;
  due_date: string;
  status: string;
  paid_amount: number;
}

const STMT_STATUS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "#9c9489", bg: "rgba(156,148,137,0.12)" },
  sent: { label: "Sent", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  viewed: { label: "Viewed", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  paid: { label: "Paid", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  partial: { label: "Partial", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  overdue: { label: "Overdue", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

function fmtStmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtStmtPeriod(start: string, end: string) {
  return `${new Date(start + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })} – ${fmtStmtDate(end)}`;
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

const MOVE_DONE = new Set(["delivered", "completed", "paid"]);

function buildMonthlyData(
  allDeliveries: DashboardData["allDeliveries"],
  invoices: DashboardData["invoices"],
  monthsBack: number,
): MonthlyRow[] {
  const now = new Date();
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const rows: MonthlyRow[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthDels = allDeliveries.filter((del) => {
      if (!del.scheduled_date) return false;
      return del.scheduled_date.slice(0, 7) === mKey;
    });
    const completed = monthDels.filter((del) =>
      MOVE_DONE.has((del.status || "").toLowerCase()),
    );
    const rate =
      monthDels.length > 0
        ? Math.round((completed.length / monthDels.length) * 100)
        : 100;
    const monthRevenue = invoices
      .filter(
        (inv) =>
          (inv.status || "").toLowerCase() === "paid" &&
          (inv.created_at || "").slice(0, 7) === mKey,
      )
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

export function PartnerPmStatementsTab({ orgName }: { orgName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [statements, setStatements] = useState<PartnerStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [periodMonths, setPeriodMonths] = useState("6");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/partner/pm/reporting")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setLoadError(true);
          return;
        }
        setStatements(d.statements ?? []);
        setData({
          completedThisMonth: 0,
          onTimeRate: 0,
          damageClaims: d.damageClaims ?? 0,
          outstandingAmount: Number(d.outstandingAmount) || 0,
          outstandingDueDate: d.outstandingDueDate ?? null,
          allDeliveries: d.allMoves ?? [],
          invoices: d.invoices ?? [],
          partnerInvoices: d.partnerInvoices ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-7 h-7 rounded-full border-2 border-[#5C1A33]/20 border-t-[#5C1A33] animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <p className="text-center py-20 text-[13px] text-[#5A6B5E]">
        Unable to load statements and reporting data.
      </p>
    );
  }

  return (
    <PartnerPmStatementsInner
      data={data}
      orgName={orgName}
      statements={statements}
      periodMonths={periodMonths}
      setPeriodMonths={setPeriodMonths}
    />
  );
}

function PartnerPmStatementsInner({
  data,
  orgName,
  statements,
  periodMonths,
  setPeriodMonths,
}: {
  data: DashboardData;
  orgName: string;
  statements: PartnerStatement[];
  periodMonths: string;
  setPeriodMonths: (v: string) => void;
}) {

  const monthlyData = useMemo(
    () =>
      buildMonthlyData(
        data.allDeliveries,
        data.invoices,
        Number(periodMonths) || 6,
      ),
    [data.allDeliveries, data.invoices, periodMonths],
  );

  const monthsWithData = useMemo(
    () =>
      monthlyData.filter(
        (r) => r.deliveries > 0 || r.completed > 0 || r.revenue > 0,
      ),
    [monthlyData],
  )

  const [monthlySearch, setMonthlySearch] = useState("")
  const [monthlySort, setMonthlySort] = useState<ColumnSort | null>({
    columnId: "yearMonth",
    direction: "desc",
  })
  const [monthlyView, setMonthlyView] = useState<ViewMode>("list")

  const monthlyPerformanceColumns = useMemo<ColumnDef<MonthlyRow>[]>(
    () => [
      {
        id: "yearMonth",
        shortLabel: "Month",
        header: "Month",
        accessor: (r) => `${r.yearMonth} ${r.fullMonthLabel}`,
        sortable: true,
        width: 130,
        cell: (r) => (
          <span className="font-semibold text-[var(--yu3-ink)]">{r.fullMonthLabel}</span>
        ),
      },
      {
        id: "deliveries",
        header: "Moves",
        accessor: (r) => r.deliveries,
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (r) => <span className="text-[var(--yu3-ink)]">{r.deliveries}</span>,
      },
      {
        id: "completed",
        header: "Completed",
        accessor: (r) => r.completed,
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (r) => <span className="text-[var(--yu3-ink)]">{r.completed}</span>,
      },
      {
        id: "onTime",
        header: "On-Time",
        accessor: (r) => r.onTimeRate,
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (r) => (
          <span className="font-semibold text-[var(--yu3-ink)]">{r.onTime}</span>
        ),
      },
      {
        id: "damage",
        header: "Damage",
        accessor: (r) => r.damage,
        sortable: true,
        align: "right",
        numeric: true,
        width: 80,
        cell: (r) => <span className="text-[var(--yu3-ink)]">{r.damage}</span>,
      },
      {
        id: "revenue",
        header: "Revenue",
        accessor: (r) => r.revenue,
        sortable: true,
        align: "right",
        numeric: true,
        width: 120,
        cell: (r) => (
          <span className="text-[var(--yu3-ink)] font-medium">{formatCurrency(r.revenue)}</span>
        ),
      },
      {
        id: "score",
        header: "Score",
        accessor: (r) => r.score,
        sortable: true,
        align: "right",
        width: 80,
        cell: (r) => (
          <span
            className={`text-[12px] font-bold ${r.score.startsWith("A") ? "text-[var(--yu3-success)]" : "text-[var(--yu3-ink)]"}`}
          >
            {r.score}
          </span>
        ),
      },
    ],
    [],
  )

  const onMonthlyTableExport = useCallback(() => {
    const headers = [
      "Month",
      "Moves",
      "Completed",
      "On-Time",
      "Damage",
      "Revenue",
      "Score",
    ]
    const lines = monthsWithData.map((r) =>
      [r.fullMonthLabel, String(r.deliveries), String(r.completed), r.onTime, String(r.damage), formatCurrency(r.revenue), r.score]
        .map((c) => csvField(String(c)))
        .join(","),
    )
    const csv = [headers.map(csvField).join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `monthly-performance-${orgName.replace(/\s+/g, "-").toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [monthsWithData, orgName])

  const totalDeliveries = data.allDeliveries.length
  const totalCompleted = data.allDeliveries.filter((d) =>
    MOVE_DONE.has((d.status || "").toLowerCase()),
  ).length;
  const overallOnTime =
    totalDeliveries > 0
      ? ((totalCompleted / totalDeliveries) * 100).toFixed(1)
      : "100";
  const totalPaid = data.invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + Number(i.amount), 0);

  const periodLabel =
    periodMonths === "24"
      ? "Last 24 months"
      : periodMonths === "12"
        ? "Last 12 months"
        : "Last 6 months";

  const exportReport = () => {
    const rows = [
      [
        "Month",
        "Moves",
        "Completed",
        "On-Time %",
        "Damage Claims",
        "Revenue",
        "Score",
      ],
    ];
    monthsWithData.forEach((row) => {
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
    rows.push(["Total moves", String(totalDeliveries)]);
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

  const hasNoMoves = totalDeliveries === 0;

  const unpaidStatements = statements.filter(
    (s) => !["paid", "draft"].includes(s.status),
  );
  const totalStatementOutstanding = unpaidStatements.reduce(
    (sum, s) => sum + (Number(s.total) - Number(s.paid_amount || 0)),
    0,
  );

  const partnerInvoices = data.partnerInvoices ?? [];
  const unpaidPartnerInvs = partnerInvoices.filter(
    (i) => !["paid", "draft", "void"].includes(i.status),
  );
  const totalPartnerInvOutstanding = unpaidPartnerInvs.reduce(
    (sum, i) => sum + Number(i.total_amount || 0),
    0,
  );

  return (
    <div className="space-y-0 text-[#1a1f1b]">
      {/* Partner invoices (PM billing) — shown when available */}
      {partnerInvoices.length > 0 && (
        <section className="pb-8 border-b border-[#2C3E2D]/10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <PartnerSectionEyebrow>Billing</PartnerSectionEyebrow>
              <div className="flex items-center gap-2">
                <Invoice size={18} color={WINE} weight="regular" />
                <h3 className="font-hero text-[22px] sm:text-[24px] font-normal text-[#5C1A33] leading-tight">
                  Invoices
                </h3>
              </div>
            </div>
            {totalPartnerInvOutstanding > 0 && (
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase shrink-0 px-2.5 py-1.5 border border-red-500/25 text-red-700 bg-red-500/[0.06] rounded-sm">
                {formatCurrency(totalPartnerInvOutstanding)} outstanding
              </span>
            )}
          </div>

          <div className="border-t border-[#2C3E2D]/10 overflow-x-auto -mx-1">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#2C3E2D]/10">
                  {["Invoice", "Period", "Total", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="py-3 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] first:pl-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partnerInvoices.map((inv) => {
                  const cfg = STMT_STATUS[inv.status] ?? STMT_STATUS.draft!;
                  const isPaid = inv.status === "paid";
                  return (
                    <tr key={inv.id} className="border-b border-[#2C3E2D]/5 last:border-0">
                      <td className="py-3 pr-4 text-[12px] font-mono font-semibold text-[#5C1A33]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#5A6B5E]">
                        {fmtStmtPeriod(inv.period_start, inv.period_end)}
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-semibold text-[#1a1f1b] tabular-nums">
                        {formatCurrency(Number(inv.total_amount))}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {isPaid ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle size={12} weight="fill" /> Paid
                          </span>
                        ) : inv.square_invoice_url ? (
                          <a
                            href={inv.square_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-[#5C1A33] text-white hover:opacity-90 transition-opacity"
                          >
                            Pay invoice
                          </a>
                        ) : inv.due_date ? (
                          <span className="text-[10px] text-[#5A6B5E]">
                            Due {fmtStmtDate(inv.due_date)}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Statements, show when any exist */}
      {statements.length > 0 && (
        <section className="pb-8 border-b border-[#2C3E2D]/10">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="min-w-0">
              <PartnerSectionEyebrow>Billing</PartnerSectionEyebrow>
              <div className="flex items-center gap-2">
                <Invoice size={18} color={WINE} weight="regular" />
                <h3 className="font-hero text-[22px] sm:text-[24px] font-normal text-[#5C1A33] leading-tight">
                  Statements
                </h3>
              </div>
            </div>
            {totalStatementOutstanding > 0 && (
              <span className="text-[10px] font-bold tracking-[0.08em] uppercase shrink-0 px-2.5 py-1.5 border border-red-500/25 text-red-700 bg-red-500/[0.06] rounded-sm">
                {formatCurrency(totalStatementOutstanding)} outstanding
              </span>
            )}
          </div>

          <div className="border-t border-[#2C3E2D]/10 overflow-x-auto -mx-1">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-[#2C3E2D]/10">
                  {[
                    "Statement",
                    "Period",
                    "Jobs",
                    "Total",
                    "Due",
                    "Status",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="py-3 pr-4 text-left text-[9px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] first:pl-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => {
                  const cfg = STMT_STATUS[s.status] ?? STMT_STATUS.draft!;
                  const balance = Number(s.total) - Number(s.paid_amount || 0);
                  const canPay =
                    !["paid", "draft"].includes(s.status) && balance > 0.01;
                  const isOverdue = s.status === "overdue";
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[#2C3E2D]/5 last:border-0"
                    >
                      <td className="py-3 pr-4 text-[12px] font-mono font-semibold text-[#5C1A33]">
                        {s.statement_number}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#5A6B5E]">
                        {fmtStmtPeriod(s.period_start, s.period_end)}
                      </td>
                      <td className="py-3 pr-4 text-[12px] text-[#1a1f1b] text-center tabular-nums">
                        {s.delivery_count}
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-semibold text-[#1a1f1b] tabular-nums">
                        {formatCurrency(Number(s.total))}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-[12px] font-medium ${isOverdue ? "text-red-600" : "text-[#5A6B5E]"}`}
                        >
                          {fmtStmtDate(s.due_date)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3">
                        {canPay ? (
                          <Link
                            href={`/partner/statements/${s.id}/pay`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-1.5 rounded-sm text-white bg-[#2C3E2D] hover:bg-[#243828] transition-colors"
                          >
                            Pay {formatCurrency(balance)}
                          </Link>
                        ) : s.status === "paid" ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle size={12} weight="fill" /> Paid
                          </span>
                        ) : (
                          <Link
                            href={`/partner/statements/${s.id}/pay`}
                            className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.08em] uppercase text-[#5A6B5E] hover:text-[#5C1A33] transition-colors"
                          >
                            View
                            <ArrowRight size={12} weight="bold" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state when no contract moves yet */}
      {hasNoMoves && (
        <div className="py-6 text-center border-b border-[#2C3E2D]/10">
          <PartnerSectionEyebrow>Monthly report</PartnerSectionEyebrow>
          <div className="flex items-center justify-center gap-2">
            <p className="text-[15px] font-semibold text-[#1a1f1b]">No moves yet</p>
            <InfoHint ariaLabel="When reporting data appears">
              <span>
                Performance metrics and monthly data will appear here once you have scheduled or completed moves on your
                contract.
              </span>
            </InfoHint>
          </div>
        </div>
      )}

      <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <PartnerSectionEyebrow>SLA</PartnerSectionEyebrow>
            <h3 className="font-hero text-[24px] sm:text-[26px] font-normal text-[#5C1A33] leading-tight">
              Service level performance
            </h3>
          </div>
          <button
            type="button"
            onClick={exportReport}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--tx)] border border-[#2C3E2D]/20 px-3 py-2 rounded-sm hover:bg-[#2C3E2D]/[0.04] transition-colors"
          >
            <DownloadSimple size={14} weight="bold" />
            Export ({periodLabel})
            <CaretRight size={12} weight="bold" className="opacity-60" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-[#2C3E2D]/10">
          <SLACircle
            value={`${overallOnTime}%`}
            label="On-Time Rate"
            sublabel="Industry avg: 82%"
            className="md:pr-6"
          />
          <SLACircle
            value={`${(data.damageClaims ?? 0) > 0 ? (((data.damageClaims ?? 0) / Math.max(totalDeliveries, 1)) * 100).toFixed(1) : "0"}%`}
            label="Damage Rate"
            sublabel={`${data.damageClaims ?? 0} incident${(data.damageClaims ?? 0) !== 1 ? "s" : ""} in ${totalDeliveries} moves`}
            className="md:px-6"
          />
          <SLACircle
            value={formatCurrency(totalPaid)}
            label="Total Paid"
            sublabel={`of ${formatCurrency(totalRevenue)} billed`}
            accent
            className="md:px-6"
          />
          <SLACircle
            value={String(totalDeliveries)}
            label="Total moves"
            sublabel={`${totalCompleted} completed`}
            className="md:pl-6"
          />
        </div>
      </section>

      <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
        <div className="mb-5">
          <PartnerSectionEyebrow>Reporting</PartnerSectionEyebrow>
          <h3 className="font-hero text-[24px] sm:text-[26px] font-normal text-[#5C1A33] leading-tight">
            Monthly performance
          </h3>
        </div>
        <div style={PARTNER_TABLE_CHROME} className="space-y-0">
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
            className="!bg-transparent !border-b !border-[#2C3E2D]/10 !px-0 py-3"
          />
          {monthsWithData.length > 0 ? (
            <DataTable<MonthlyRow>
              columns={monthlyPerformanceColumns}
              rows={monthsWithData}
              rowId={(r) => r.yearMonth}
              search={monthlySearch}
              onSearchChange={setMonthlySearch}
              sort={monthlySort}
              onSortChange={setMonthlySort}
              viewMode={monthlyView}
              onViewModeChange={setMonthlyView}
              searchPlaceholder="Search by month…"
              onExport={onMonthlyTableExport}
              rowHeight={52}
              emptyState={
                <p className="text-sm text-[var(--yu3-ink-2)]">
                  No monthly data. Moves will appear here once scheduled.
                </p>
              }
            />
          ) : (
            <div className="p-6 bg-[#FFFBF7] rounded-lg border border-[#2C3E2D]/10 text-center">
              <p className="text-[13px] text-[#5A6B5E] leading-relaxed">
                Monthly reports will appear after your first completed move.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-6">
          <YugoLogo size={22} variant="wine" className="shrink-0" />
          <h3 className="font-hero text-[24px] sm:text-[28px] font-normal leading-tight text-[#1a1f1b]">
            vs industry standards
          </h3>
        </div>
        <div className="divide-y divide-[#2C3E2D]/10">
          <ComparisonCard
            label="On-time completion"
            yugoValue={`${overallOnTime}%`}
            industryValue="82%"
          />
          <ComparisonCard
            label="Damage Rate"
            yugoValue={`${(data.damageClaims ?? 0) > 0 ? (((data.damageClaims ?? 0) / Math.max(totalDeliveries, 1)) * 100).toFixed(2) : "0"}%`}
            industryValue="3.2%"
          />
          <ComparisonCard
            label="Response Time"
            yugoValue="< 15 min"
            industryValue="4+ hrs"
            yugoSublabel="Target"
          />
        </div>
      </section>

      <section className="pt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <PartnerSectionEyebrow>Finance</PartnerSectionEyebrow>
            <h3 className="font-hero text-[24px] sm:text-[26px] font-normal text-[#5C1A33] leading-tight">
              Revenue summary
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0 sm:divide-x divide-[#2C3E2D]/10 pt-2">
          <div className="sm:pr-8">
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5">
              Total billed
            </div>
            <div className="text-[26px] font-normal text-[#1a1f1b] font-hero tabular-nums">
              {formatCurrency(totalRevenue)}
            </div>
          </div>
          <div className="sm:px-8">
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5">
              Paid
            </div>
            <div className="text-[26px] font-normal text-emerald-700 font-hero tabular-nums">
              {formatCurrency(totalPaid)}
            </div>
          </div>
          <div className="sm:pl-8">
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5">
              Outstanding
            </div>
            <div className="text-[26px] font-normal text-red-700 font-hero tabular-nums">
              {formatCurrency(data.outstandingAmount)}
            </div>
            {data.outstandingDueDate && (
              <div className="text-[11px] text-[#5A6B5E] mt-1.5">
                Due{" "}
                {new Date(data.outstandingDueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SLACircle({
  value,
  label,
  sublabel,
  accent,
  className = "",
}: {
  value: string;
  label: string;
  sublabel: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5">
        {label}
      </div>
      <div
        className={`text-[26px] font-normal font-hero tabular-nums leading-none ${accent ? "text-[#5C1A33]" : "text-[#1a1f1b]"}`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#5A6B5E] mt-2 leading-snug">{sublabel}</div>
    </div>
  );
}

function ComparisonCard({
  label,
  yugoValue,
  industryValue,
  yugoSublabel,
}: {
  label: string;
  yugoValue: string;
  industryValue: string;
  yugoSublabel?: string;
}) {
  return (
    <div className="py-5 first:pt-0">
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-3">
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <span className="text-[26px] font-normal font-hero tabular-nums leading-none text-[#5C1A33]">
            {yugoValue}
          </span>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5C1A33]/80">
              Yugo
            </span>
            {yugoSublabel && (
              <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E]">
                {yugoSublabel}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-[17px] font-semibold text-[#5A6B5E] tabular-nums">
            {industryValue}
          </span>
          <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mt-1.5">
            Industry
          </div>
        </div>
      </div>
    </div>
  );
}
