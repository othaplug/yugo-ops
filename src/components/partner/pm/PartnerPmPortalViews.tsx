"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Buildings,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Invoice,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/client-timezone";
import { formatMoveHoursLabel } from "@/utils/format-move-hours";
import PartnerSignOut from "@/app/partner/PartnerSignOut";
import { InfoHint } from "@/components/ui/InfoHint";
import { useToast } from "@/app/admin/components/Toast";
import type { PmPortalSummary, PmProjectRow } from "@/app/partner/PartnerPropertyManagementPortal";
import { partnerWineAccountAvatarCircleClass } from "@/components/partner/PartnerChrome";
import {
  buildPmMoveHistoryPreviewBase,
  filterPmMoveHistoryPreviewRows,
  summarizePmMoveHistoryPreview,
} from "@/lib/partner-pm-portal-preview-data";
import {
  pmBodyMuted,
  pmCardTitle,
  pmKpiLabel,
  pmKpiSublabel,
  pmKpiValue,
  pmKpiValueMuted,
  pmLabelCaps,
  pmLeadTitle,
  pmLink,
  pmMeta,
  pmOverviewPanelEyebrow,
  pmOverviewRowTitle,
  pmPageTitle,
  pmFontBody,
  pmSectionTitle,
  pmStatGridValue,
  pmUiTitleCaps,
  pmSummaryStatValue,
  pmTableHead,
  pmTableText,
} from "@/components/partner/pm/pm-typography";

export type PmTabId =
  | "overview"
  | "calendar"
  | "live"
  | "buildings"
  | "schedule"
  | "projects"
  | "analytics"
  | "statements"
  ;

export function isPmTabId(s: string): s is PmTabId {
  return (
    s === "overview" ||
    s === "calendar" ||
    s === "live" ||
    s === "buildings" ||
    s === "schedule" ||
    s === "projects" ||
    s === "analytics" ||
    s === "statements"
  );
}

const PM_UNIT_TYPE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br_plus": "4+ Bedroom",
};

function formatBuildingUnitTypeLabel(raw: string) {
  const k = raw.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return PM_UNIT_TYPE_LABELS[k] || raw;
}

const PM_CARD = "rounded-xl border border-[var(--brd)] bg-[var(--card)]";
const PM_SECTION_EYE = `${pmLabelCaps} mb-2`;
const PM_TABLE_SHELL =
  "rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden";
const PM_TABLE_HEAD = `bg-[#FAF7F2] text-left ${pmTableHead}`;
const PM_ROW = "border-t border-[var(--brd)]";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-[#E0E0E0] text-[10px] font-bold tracking-[0.12em] uppercase text-[#2D3A26] bg-white hover:bg-[#F9F7F2] transition-colors rounded-none";
const BTN_SECONDARY = BTN_PRIMARY;

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending review",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  paid: "Paid",
  delivered: "Delivered",
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partial: "Partial",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  renovation: "Renovation program",
  building_upgrade: "Building upgrade",
  tenant_turnover: "Multi-unit turnover",
  office_buildout: "Office buildout",
  flood_remediation: "Flood remediation",
  staging_campaign: "Staging campaign",
  lease_up: "Lease-up",
  other: "Other program",
};

function projectTypeLabel(code: string) {
  const k = (code || "").toLowerCase();
  return PROJECT_TYPE_LABELS[k] ?? code.replace(/_/g, " ");
}

function labelStatus(key: string) {
  const k = (key || "").toLowerCase();
  return STATUS_LABELS[k] ?? key.replace(/_/g, " ");
}

function formatPhoneDisplay(raw: string | null | undefined): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return raw || "—";
}

function PmStatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status || "").toLowerCase();
  const label = labelStatus(s);
  const cls =
    s === "completed" || s === "paid" || s === "delivered"
      ? "bg-[#2C3E2D]/10 text-[var(--tx)]"
      : s === "pending_approval" || s === "draft"
        ? "bg-amber-50 text-amber-800"
        : s === "cancelled"
          ? "bg-red-50 text-red-800"
          : "bg-[#5C1A33]/8 text-[#5C1A33]";
  return (
    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sublabel,
  soft,
}: {
  label: string;
  value: string | number;
  sublabel: string;
  soft?: boolean;
}) {
  return (
    <div
      className={`text-center px-3 sm:px-6 py-1 md:border-l md:border-[#2C3E2D]/10 md:first:border-l-0 ${soft ? "opacity-[0.72]" : ""}`}
    >
      <div className={pmKpiLabel}>{label}</div>
      <div className={`mt-1.5 ${soft ? pmKpiValueMuted : pmKpiValue}`}>{value}</div>
      <div className={pmKpiSublabel}>{sublabel}</div>
    </div>
  );
}

/** Same four KPIs as the overview dashboard; rendered in the PM shell above tabs (partner portal parity). */
export function PmPortalKpiStrip({ summary }: { summary: PmPortalSummary }) {
  const mtd = formatCurrency(summary.stats.revenueThisMonth || 0);
  const upcomingN = summary.stats.upcomingScheduledCount ?? summary.upcomingMoves.length;
  const activeProjects = summary.activeProjectsCount ?? summary.projects?.length ?? 0;
  const completed = summary.stats.movesCompletedThisMonth ?? 0;
  const revenue = summary.stats.revenueThisMonth ?? 0;
  const hasActivity =
    completed > 0 || upcomingN > 0 || activeProjects > 0 || revenue > 0;

  return (
    <div className="relative mb-8">
      <div className="absolute right-0 top-0 z-10">
        <InfoHint ariaLabel="How these metrics are calculated" align="end">
          <span>
            These figures reflect your contract portfolio: moves completed this month, scheduled moves not yet
            completed, active renovation programs, and month-to-date spend billed to your contract.
            {!hasActivity && (
              <>
                {" "}
                No activity yet this month — numbers will update as work is scheduled and completed.
              </>
            )}
          </span>
        </InfoHint>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pr-8 sm:pr-10">
        <MetricCard
          label="This month"
          value={completed}
          sublabel="moves completed"
          soft={!hasActivity}
        />
        <MetricCard label="Upcoming" value={upcomingN} sublabel="moves scheduled" soft={!hasActivity} />
        <MetricCard label="Active projects" value={activeProjects} sublabel="renovation programs" soft={!hasActivity} />
        <MetricCard label="Month-to-date" value={mtd} sublabel="total spend" soft={!hasActivity} />
      </div>
    </div>
  );
}

type BuildingRow = {
  id: string;
  name: string;
  address: string;
  total_units: number | null;
  loading_dock: boolean;
  elevator: string;
  move_hours: string | null;
  parking: string;
  contact_name: string;
  contact_phone: string;
  notes: string | null;
  unit_types: string[];
  unit_counts: Record<string, string>;
  moves_this_month: number;
  upcoming_moves: number;
  total_moves: number;
  recent_moves: {
    id: string;
    date: string | null;
    unit: string | null;
    move_type: string;
    tenant_name: string | null;
    status: string | null;
    price: number;
  }[];
};

/** Overview tab — layered panels, forest accent, subtle depth */
const OV_PANEL =
  "rounded-none border border-[#E0E0E0] bg-white shadow-[0_12px_40px_-4px_rgba(45,58,38,0.12)] ring-1 ring-[#2D3A26]/[0.06]";
const OV_PANEL_TOP = "border-t-[3px] border-t-[#2D3A26]";
const OV_BTN =
  "group border border-[#E0E0E0] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF8F5_100%)] text-left w-full flex items-center gap-3 px-4 py-2.5 rounded-none shadow-[0_1px_2px_rgba(45,58,38,0.06)] hover:border-[#2D3A26]/35 hover:shadow-[0_4px_14px_rgba(45,58,38,0.1)] transition-[box-shadow,border-color] active:translate-y-px";
const OV_CLEAR =
  "flex items-center gap-3 rounded-none border border-[#C8D9C8]/80 bg-[linear-gradient(135deg,#F3F8F3_0%,#EEF4EE_100%)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]";

export function PartnerPmOverview({
  summary,
  setTab,
}: {
  summary: PmPortalSummary;
  setTab: (t: PmTabId) => void;
}) {
  const att = summary.overviewAttention ?? {
    pendingApprovalMoveCount: 0,
    overdueInvoiceCount: 0,
    buildingsIncompleteAccessCount: 0,
  };
  const terminal = new Set(["completed", "paid", "delivered", "cancelled"]);
  const openUpcoming = [...(summary.upcomingMoves ?? [])]
    .filter((m) => !terminal.has(String(m.status || "").toLowerCase()))
    .sort((a, b) => String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || "")));

  const upcomingPreview = openUpcoming.slice(0, 3);
  const projectsPreview = (summary.projects ?? []).slice(0, 2);

  const completed = summary.stats.movesCompletedThisMonth ?? 0;
  const upcomingN = summary.stats.upcomingScheduledCount ?? summary.upcomingMoves?.length ?? 0;
  const activeProjects = summary.activeProjectsCount ?? summary.projects?.length ?? 0;
  const revenue = summary.stats.revenueThisMonth ?? 0;
  const hasActivity =
    completed > 0 || upcomingN > 0 || activeProjects > 0 || revenue > 0;

  type AttKind = "moves" | "invoices" | "buildings";
  const attentionCandidates: { kind: AttKind; count: number; tab: PmTabId }[] = [];
  if (att.pendingApprovalMoveCount > 0) {
    attentionCandidates.push({
      kind: "moves",
      count: att.pendingApprovalMoveCount,
      tab: "calendar",
    });
  }
  if (att.overdueInvoiceCount > 0) {
    attentionCandidates.push({
      kind: "invoices",
      count: att.overdueInvoiceCount,
      tab: "statements",
    });
  }
  if (att.buildingsIncompleteAccessCount > 0) {
    attentionCandidates.push({
      kind: "buildings",
      count: att.buildingsIncompleteAccessCount,
      tab: "buildings",
    });
  }
  const attentionShown = attentionCandidates.slice(0, 3);
  const hasAttention = attentionShown.length > 0;
  const showComingUp = upcomingPreview.length > 0 || projectsPreview.length > 0;

  const [attentionSectionDismissed, setAttentionSectionDismissed] = useState(false);
  useEffect(() => {
    if (hasAttention) setAttentionSectionDismissed(false);
  }, [hasAttention]);
  const showAttentionSection = hasAttention || !attentionSectionDismissed;

  return (
    <div className="space-y-8">
      {showAttentionSection && (
      <section aria-labelledby="pm-overview-attention" className={`${OV_PANEL} ${OV_PANEL_TOP}`}>
        <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 id="pm-overview-attention" className={pmOverviewPanelEyebrow}>
              Needs attention
            </h2>
            {!hasAttention && (
              <button
                type="button"
                onClick={() => setAttentionSectionDismissed(true)}
                className="shrink-0 rounded-none border border-[#2D3A26]/20 p-1.5 text-[#2D3A26]/70 hover:bg-[#2D3A26]/6 hover:text-[#2D3A26] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D3A26]"
                aria-label="Dismiss needs attention panel"
              >
                <X size={18} weight="bold" aria-hidden />
              </button>
            )}
          </div>
          {!hasAttention ? (
            <div className={OV_CLEAR}>
              <CheckCircle size={22} weight="duotone" className="shrink-0 text-[#2D3A26]" aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-[#2D3A26]">All clear</p>
                <p className={`${pmBodyMuted} mt-0.5`}>No outstanding items need your action right now.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {attentionShown.map((row) => {
                const label =
                  row.kind === "moves"
                    ? row.count === 1
                      ? "1 move pending review"
                      : `${row.count} moves pending review`
                    : row.kind === "invoices"
                      ? `${row.count} overdue ${row.count === 1 ? "invoice" : "invoices"}`
                      : `${row.count} ${row.count === 1 ? "building is" : "buildings are"} missing access details`;
                const Icon =
                  row.kind === "moves" ? WarningCircle : row.kind === "invoices" ? Invoice : Buildings;
                return (
                  <button key={row.kind} type="button" className={OV_BTN} onClick={() => setTab(row.tab)}>
                    <Icon size={20} weight="regular" className="shrink-0 text-[#2D3A26]" aria-hidden />
                    <span className={`flex-1 ${pmOverviewRowTitle} text-left`}>
                      {label}
                    </span>
                    <CaretRight
                      size={14}
                      weight="bold"
                      className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {showComingUp && (
        <section aria-labelledby="pm-overview-coming-up" className={`${OV_PANEL} ${OV_PANEL_TOP}`}>
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
            <h2 id="pm-overview-coming-up" className={`${pmOverviewPanelEyebrow} mb-4`}>
              Coming up
            </h2>
            <div className="space-y-2.5">
              {upcomingPreview.length > 0 && (
                <ul className="space-y-2.5">
                  {upcomingPreview.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={OV_BTN}
                        onClick={() => setTab("calendar")}
                      >
                        <CalendarBlank size={20} weight="regular" className="shrink-0 text-[#2D3A26]" aria-hidden />
                        <span className="flex-1 min-w-0 text-left">
                          <span className={`block ${pmOverviewRowTitle} truncate`}>
                            {m.building_name || "Move"}
                            {m.unit_number ? ` · Unit ${m.unit_number}` : ""}
                          </span>
                          <span className={`block ${pmBodyMuted} truncate`}>
                            {m.scheduled_date
                              ? formatDate(m.scheduled_date, { weekday: "short", month: "short", day: "numeric" })
                              : "Date TBD"}
                            {m.scheduled_time ? ` · ${m.scheduled_time}` : ""}
                          </span>
                        </span>
                        <CaretRight
                          size={14}
                          weight="bold"
                          className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {projectsPreview.length > 0 && (
                <ul className="space-y-2.5">
                  {projectsPreview.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={OV_BTN} onClick={() => setTab("projects")}>
                        <Buildings size={20} weight="regular" className="shrink-0 text-[#2D3A26]" aria-hidden />
                        <span className="flex-1 min-w-0 text-left">
                          <span className={`block ${pmOverviewRowTitle} truncate`}>{p.project_name}</span>
                          <span className={`block ${pmBodyMuted} truncate`}>
                            {projectTypeLabel(p.project_type)}
                          </span>
                        </span>
                        <CaretRight
                          size={14}
                          weight="bold"
                          className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {!hasActivity && (
        <section aria-labelledby="pm-overview-orientation" className={`${OV_PANEL} ${OV_PANEL_TOP}`}>
          <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6 sm:pb-6">
            <h2 id="pm-overview-orientation" className={`${pmOverviewPanelEyebrow} mb-4`}>
              Suggested next steps
            </h2>
            <p className={`${pmBodyMuted} mb-5 max-w-xl`}>
              You have not recorded completed moves or spend this month yet. When you are ready:
            </p>
            <div className="flex flex-col gap-2.5">
              <button type="button" className={OV_BTN} onClick={() => setTab("schedule")}>
                <span className={`flex-1 ${pmOverviewRowTitle} text-left`}>Schedule a move</span>
                <CaretRight
                  size={14}
                  weight="bold"
                  className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                  aria-hidden
                />
              </button>
              <button type="button" className={OV_BTN} onClick={() => setTab("buildings")}>
                <span className={`flex-1 ${pmOverviewRowTitle} text-left`}>
                  Confirm building access and contacts
                </span>
                <CaretRight
                  size={14}
                  weight="bold"
                  className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                  aria-hidden
                />
              </button>
              <button type="button" className={OV_BTN} onClick={() => setTab("statements")}>
                <span className={`flex-1 ${pmOverviewRowTitle} text-left`}>Review statements and billing</span>
                <CaretRight
                  size={14}
                  weight="bold"
                  className="shrink-0 text-[#2D3A26]/40 group-hover:text-[#2D3A26] group-hover:translate-x-0.5 transition-transform"
                  aria-hidden
                />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function PartnerPmBuildingsTab({ setTab }: { setTab: (t: PmTabId) => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<BuildingRow[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/pm/buildings");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setRows(d.buildings ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "x");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!rows) return <p className={pmBodyMuted}>Loading…</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className={pmPageTitle}>Buildings</h1>
        <p className={`${pmMeta} shrink-0`}>{rows.length} properties on contract</p>
      </div>

      {rows.map((b) => {
        const ex = !!expanded[b.id];
        const panelId = `pm-building-${b.id}-panel`;
        const titleId = `pm-building-${b.id}-title`;
        return (
          <div key={b.id} className={`${PM_CARD} mb-4 overflow-hidden`}>
            <div className="p-5">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 id={titleId} className={pmCardTitle}>
                    {b.name}
                  </h3>
                  <p className={`${pmMeta} mt-1`}>{b.address}</p>
                </div>
                <button
                  type="button"
                  aria-expanded={ex}
                  aria-controls={panelId}
                  onClick={() => setExpanded((s) => ({ ...s, [b.id]: !ex }))}
                  className={`${pmLink} shrink-0 inline-flex items-center gap-1.5`}
                >
                  {ex ? "Collapse" : "Details"}
                  <CaretDown
                    size={14}
                    weight="bold"
                    className={`shrink-0 transition-transform ${ex ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
            {ex && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={titleId}
                className="border-t border-[#2C3E2D]/10"
              >
                <div className="px-5 pt-4 pb-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className={pmLabelCaps}>Units</p>
                      <p className={pmStatGridValue}>{b.total_units ?? "—"}</p>
                    </div>
                    <div>
                      <p className={pmLabelCaps}>This month</p>
                      <p className={pmStatGridValue}>{b.moves_this_month}</p>
                    </div>
                    <div>
                      <p className={pmLabelCaps}>Upcoming</p>
                      <p className={pmStatGridValue}>{b.upcoming_moves}</p>
                    </div>
                    <div>
                      <p className={pmLabelCaps}>Total moves</p>
                      <p className={pmStatGridValue}>{b.total_moves}</p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#2C3E2D]/10 px-5 py-4 bg-[#FAF7F2]/80">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className={PM_SECTION_EYE}>Access details</h4>
                    <div className={`space-y-2 ${pmTableText}`}>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Loading dock</span>
                        <span className="text-[#1a1f1b]">{b.loading_dock ? "Yes" : "No"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Move elevator</span>
                        <span className="text-[#1a1f1b]">{b.elevator}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Move hours</span>
                        <span className="text-[#1a1f1b]">{formatMoveHoursLabel(b.move_hours) || "—"}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Parking</span>
                        <span className="text-[#1a1f1b]">{b.parking}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Building contact</span>
                        <span className="text-[#1a1f1b]">{b.contact_name}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5A6B5E]">Contact phone</span>
                        <span className="text-[#1a1f1b]">{formatPhoneDisplay(b.contact_phone)}</span>
                      </div>
                    </div>
                    {b.notes && (
                      <div className="mt-3 p-2 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-950">
                        {b.notes}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className={PM_SECTION_EYE}>Unit types</h4>
                    {(() => {
                      const entries = (b.unit_types ?? []).map((t) => {
                        const c = String(b.unit_counts[t] ?? "").trim();
                        const n = parseInt(c, 10);
                        const hasNum = !Number.isNaN(n) && n > 0;
                        return { t, c, hasNum, n };
                      }).filter((x) => x.hasNum);
                      if (entries.length === 0) {
                        return (
                          <p className={pmBodyMuted}>
                            {b.total_units != null
                              ? `${b.total_units} total units (breakdown not configured)`
                              : "Unit mix not configured"}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {entries.map(({ t, n }) => (
                            <div key={t} className={`flex justify-between gap-2 ${pmTableText}`}>
                              <span className="text-[#5A6B5E]">{formatBuildingUnitTypeLabel(t)}</span>
                              <span className="text-[#1a1f1b] tabular-nums shrink-0">
                                {n} {n === 1 ? "unit" : "units"}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="mt-6">
                  <h4 className={PM_SECTION_EYE}>Recent moves</h4>
                  {b.recent_moves.length > 0 ? (
                    <div className={PM_TABLE_SHELL}>
                      <table className="w-full text-[11px] text-[#1a1f1b]">
                        <thead className={PM_TABLE_HEAD}>
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Unit</th>
                            <th className="p-2 text-left">Type</th>
                            <th className="p-2 text-left">Tenant</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.recent_moves.map((m) => (
                            <tr key={m.id} className={PM_ROW}>
                              <td className="p-2 whitespace-nowrap">
                                {m.date ? formatDate(m.date, { month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="p-2">{m.unit || "—"}</td>
                              <td className="p-2">{m.move_type}</td>
                              <td className="p-2 truncate max-w-[80px]">{m.tenant_name || "—"}</td>
                              <td className="p-2">
                                <PmStatusBadge status={m.status} />
                              </td>
                              <td className="p-2 text-right">{formatCurrency(m.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className={pmBodyMuted}>No moves recorded yet.</p>
                  )}
                </div>
                <div className="mt-4">
                  <button type="button" className={BTN_PRIMARY} onClick={() => setTab("schedule")}>
                    Schedule move at {b.name}
                    <CaretRight className="w-4 h-4" weight="bold" aria-hidden />
                  </button>
                </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type HistMove = {
  id: string;
  date: string | null;
  building_name: string;
  unit: string | null;
  move_type: string;
  tenant_name: string | null;
  status: string | null;
  price: number;
  pod_url: string | null;
  tracking_url: string | null;
};

function toHistMovesFromPreview(rows: ReturnType<typeof buildPmMoveHistoryPreviewBase>): HistMove[] {
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    building_name: r.building_name,
    unit: r.unit,
    move_type: r.move_type,
    tenant_name: r.tenant_name,
    status: r.status,
    price: r.price,
    pod_url: r.pod_url,
    tracking_url: r.tracking_url,
  }));
}

export function PartnerPmMoveHistoryTab({
  buildingOptions,
  embedded = false,
  /** Sample portal (`/partner/pm-preview`): use static rows + client-side filters (no API). */
  preview = false,
}: {
  buildingOptions: { id: string; building_name: string }[];
  /** When true, omit the page title (e.g. under Analytics sub-tabs). */
  embedded?: boolean;
  preview?: boolean;
}) {
  const { toast } = useToast();
  const [building, setBuilding] = useState("all");
  const [type, setType] = useState("all");
  const [range, setRange] = useState("this_month");
  const [moves, setMoves] = useState<HistMove[]>([]);
  const [summary, setSummary] = useState({ totalMoves: 0, totalSpend: 0, avgCost: 0, onTimeRate: null as number | null });
  const [loading, setLoading] = useState(!preview);

  const previewBase = useMemo(() => (preview ? buildPmMoveHistoryPreviewBase() : []), [preview]);

  const previewFiltered = useMemo(() => {
    if (!preview) return null;
    const filtered = filterPmMoveHistoryPreviewRows(previewBase, {
      buildingId: building,
      typeFilter: type,
      range,
    });
    return {
      moves: toHistMovesFromPreview(filtered),
      summary: summarizePmMoveHistoryPreview(filtered),
    };
  }, [preview, previewBase, building, type, range]);

  const load = useCallback(async () => {
    if (preview) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ building, type, range });
      const res = await fetch(`/api/partner/pm/move-history?${q}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setMoves(d.moves ?? []);
      setSummary(
        d.summary ?? {
          totalMoves: 0,
          totalSpend: 0,
          avgCost: 0,
          onTimeRate: null,
        },
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "x");
    } finally {
      setLoading(false);
    }
  }, [building, type, range, toast, preview]);

  useEffect(() => {
    if (!preview || !previewFiltered) return;
    setMoves(previewFiltered.moves);
    setSummary(previewFiltered.summary);
    setLoading(false);
  }, [preview, previewFiltered]);

  useEffect(() => {
    if (preview) return;
    load();
  }, [preview, load]);

  return (
    <div>
      <div
        className={`flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6 ${
          embedded ? "pt-1" : ""
        }`}
      >
        {!embedded && <h1 className={pmPageTitle}>Move history</h1>}
        <div className={`flex flex-wrap gap-2 ${embedded ? "w-full lg:justify-end" : ""}`}>
          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="text-[12px] border border-[#2C3E2D]/15 rounded-lg px-3 py-2 bg-white text-[#1a1f1b]"
          >
            <option value="all">All buildings</option>
            {buildingOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.building_name}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="text-[12px] border border-[#2C3E2D]/15 rounded-lg px-3 py-2 bg-white text-[#1a1f1b]"
          >
            <option value="all">All types</option>
            <option value="tenant_move_in">Tenant move-in</option>
            <option value="tenant_move_out">Tenant move-out</option>
            <option value="renovation">Renovation</option>
            <option value="suite_transfer">Suite transfer</option>
            <option value="emergency">Emergency</option>
          </select>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="text-[12px] border border-[#2C3E2D]/15 rounded-lg px-3 py-2 bg-white text-[#1a1f1b]"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="last_3_months">Last 3 months</option>
            <option value="this_year">This year</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      <div className={PM_TABLE_SHELL}>
        <table className="w-full text-[11px] text-[#1a1f1b]">
          <thead className={PM_TABLE_HEAD}>
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Building</th>
              <th className="p-2 text-left">Unit</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Tenant</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-right">Cost</th>
              <th className="p-2 text-center">POD</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className={`p-6 text-center ${pmBodyMuted}`}>
                  Loading…
                </td>
              </tr>
            ) : moves.length === 0 ? (
              <tr>
                <td colSpan={8} className={`p-6 text-center ${pmBodyMuted}`}>
                  No moves in this range.
                </td>
              </tr>
            ) : (
              moves.map((m) => (
                <tr key={m.id} className={`${PM_ROW} hover:bg-[#FAF7F2]/80`}>
                  <td className="p-2 whitespace-nowrap">
                    {m.date ? formatDate(m.date, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="p-2 truncate max-w-[100px]" title={m.building_name}>
                    {m.building_name}
                  </td>
                  <td className="p-2">{m.unit || "—"}</td>
                  <td className="p-2 truncate max-w-[100px]">{m.move_type}</td>
                  <td className="p-2 truncate max-w-[90px]">{m.tenant_name || "—"}</td>
                  <td className="p-2">
                    <PmStatusBadge status={m.status} />
                  </td>
                  <td className="p-2 text-right">{formatCurrency(m.price)}</td>
                  <td className="p-2 text-center">
                    {m.pod_url ? (
                      <a href={m.pod_url} className={`${pmLink} text-[11px]`} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : m.tracking_url ? (
                      <a href={m.tracking_url} className={`${pmLink} text-[11px]`}>
                        Track
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl bg-[#FAF7F2] border border-[#2C3E2D]/10">
        <div>
          <p className={pmLabelCaps}>Total moves</p>
          <p className={pmSummaryStatValue}>{summary.totalMoves}</p>
        </div>
        <div>
          <p className={pmLabelCaps}>Total spend</p>
          <p className={pmSummaryStatValue}>{formatCurrency(summary.totalSpend)}</p>
        </div>
        <div>
          <p className={pmLabelCaps}>Avg cost / move</p>
          <p className={pmSummaryStatValue}>{formatCurrency(summary.avgCost)}</p>
        </div>
        <div>
          <p className={pmLabelCaps}>On-time rate</p>
          <p className={pmSummaryStatValue}>
            {summary.onTimeRate != null ? `${summary.onTimeRate}%` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PartnerPmAccountTab() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("property_manager");
  const [inviteSending, setInviteSending] = useState(false);

  const load = useCallback(() => {
    fetch("/api/partner/pm/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) toast(d.error, "x");
        else setData(d);
      })
      .catch(() => toast("Failed to load account", "x"));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className={pmBodyMuted}>Loading…</p>;

  const company = data.company as Record<string, string>;
  const contract = data.contract as Record<string, unknown> | null;
  const rateCard = data.rateCard as {
    reasonCode?: string;
    type: string;
    studio: string;
    oneBr: string;
    twoBr: string;
    threeBr: string;
  }[];
  const portalUsers = data.portalUsers as { id: string; name: string; email: string; status: string }[];
  const coordinator = data.coordinator as {
    assigned?: boolean;
    name: string | null;
    email: string;
    phone: string;
    initials: string;
  };

  async function sendInvite() {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast("Name and email are required", "x");
      return;
    }
    setInviteSending(true);
    try {
      const res = await fetch("/api/partner/pm/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast("Invite sent — they will receive email with sign-in instructions.", "check");
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("property_manager");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setInviteSending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className={pmPageTitle}>Account</h1>
        <PartnerSignOut />
      </div>

      <section>
        <h2 className={PM_SECTION_EYE}>Company information</h2>
        <div className={`${PM_CARD} p-4 space-y-3 text-[13px] [font-family:var(--font-body)]`}>
          <div className="flex justify-between gap-2">
            <span className="text-[#5A6B5E]">Company</span>
            <span className="text-[#1a1f1b] text-right">{company.name || "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#5A6B5E]">Primary contact</span>
            <span className="text-[#1a1f1b] text-right">{company.contactName || "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#5A6B5E]">Email</span>
            <span className="text-[#1a1f1b] text-right break-all">{company.email || "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#5A6B5E]">Phone</span>
            <span className="text-[#1a1f1b] text-right">{formatPhoneDisplay(company.phone)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#5A6B5E]">Address</span>
            <span className="text-[#1a1f1b] text-right">{company.address || "—"}</span>
          </div>
        </div>
      </section>

      {contract && (
        <section>
          <h2 className={PM_SECTION_EYE}>Contract</h2>
          <div className={`${PM_CARD} p-4 space-y-3 text-[13px] [font-family:var(--font-body)]`}>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A6B5E]">Contract ID</span>
              <span className="text-[#1a1f1b]">{String(contract.contract_number || "—")}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A6B5E]">Type</span>
              <span className="text-[#1a1f1b]">{String(data.contractTypeLabel || contract.contract_type || "—")}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A6B5E]">Term</span>
              <span className="text-[#1a1f1b] text-right">
                {formatDate(String(contract.start_date), { month: "short", day: "numeric", year: "numeric" })} —{" "}
                {formatDate(String(contract.end_date), { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-[#5A6B5E]">Auto-renew</span>
              <span className="text-[#1a1f1b]">{contract.auto_renew ? "Yes" : "No"}</span>
            </div>
            {typeof contract.pdf_url === "string" && contract.pdf_url.trim() ? (
              <a href={contract.pdf_url} className={`inline-block ${pmLink} mt-1`} target="_blank" rel="noreferrer">
                Download contract PDF
              </a>
            ) : null}
          </div>
        </section>
      )}

      <section>
        <h2 className={PM_SECTION_EYE}>Your rate card</h2>
        <div className={`${PM_CARD} overflow-hidden`}>
          {rateCard.length > 0 ? (
            <>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#2C3E2D] text-white text-[10px] uppercase tracking-wider">
                    <th className="py-2 px-3 text-left">Move type</th>
                    <th className="py-2 px-2 text-center">Studio</th>
                    <th className="py-2 px-2 text-center">1 BR</th>
                    <th className="py-2 px-2 text-center">2 BR</th>
                    <th className="py-2 px-2 text-center">3 BR</th>
                  </tr>
                </thead>
                <tbody>
                  {rateCard.map((row, i) => (
                    <tr key={row.reasonCode ?? row.type} className={i % 2 === 1 ? "bg-[#FAF7F2]/80" : ""}>
                      <td className="py-2 px-3 text-[#1a1f1b]">{row.type}</td>
                      <td className="py-2 px-2 text-center">{row.studio}</td>
                      <td className="py-2 px-2 text-center">{row.oneBr}</td>
                      <td className="py-2 px-2 text-center">{row.twoBr}</td>
                      <td className="py-2 px-2 text-center">{row.threeBr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t border-[#2C3E2D]/10 text-[10px] leading-relaxed text-[#5A6B5E] [font-family:var(--font-body)]">
                Weekend, after-hours, and holiday surcharges apply per your contract. Mobilization fees may apply for same-day clusters.
              </div>
            </>
          ) : (
            <p className={`p-4 ${pmBodyMuted}`}>Your coordinator will publish rate matrix details when the contract is finalized.</p>
          )}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3">
          <h2 className={`${PM_SECTION_EYE} mb-0`}>Portal users</h2>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className={`${pmLink} text-[11px]`}
          >
            + Invite user
          </button>
        </div>
        <div className={`${PM_CARD} divide-y divide-[#2C3E2D]/10`}>
          {portalUsers.map((u) => (
            <div key={u.id} className="flex justify-between items-center p-4 gap-2">
              <div className="min-w-0">
                <p className={`${pmOverviewRowTitle} truncate`}>{u.name}</p>
                <p className={`text-[11px] text-[#5A6B5E] truncate ${pmFontBody}`}>{u.email}</p>
              </div>
              <PmStatusBadge status={u.status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className={PM_SECTION_EYE}>Your coordinator</h2>
        {coordinator.name ? (
          <div className={`${PM_CARD} p-4 flex items-center gap-4`}>
            <div className={partnerWineAccountAvatarCircleClass}>
              {coordinator.initials}
            </div>
            <div>
              <p className={pmOverviewRowTitle}>{coordinator.name}</p>
              <p className={`text-[11px] text-[#5A6B5E] ${pmFontBody}`}>
                {coordinator.phone} · {coordinator.email}
              </p>
            </div>
          </div>
        ) : (
          <div className={`${PM_CARD} p-4 space-y-2`}>
            <p className={`${pmBodyMuted} leading-relaxed`}>
              A coordinator will be assigned shortly.
            </p>
            <p className={`text-[11px] text-[#5A6B5E] leading-relaxed ${pmFontBody}`}>
              Contact us: partners@helloyugo.com · (289) 306-0583
            </p>
          </div>
        )}
      </section>

      {inviteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
          <div
            className="bg-[#FFFBF7] rounded-xl max-w-md w-full p-6 border border-[#2C3E2D]/12 shadow-xl"
            role="dialog"
            aria-labelledby="pm-invite-title"
          >
            <div className="flex items-start justify-between gap-2 mb-4">
              <h3 id="pm-invite-title" className={pmSectionTitle}>
                Invite a team member
              </h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="p-1 rounded-sm text-[#5A6B5E] hover:bg-[#2C3E2D]/8"
                aria-label="Close"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
            <p className={`${pmBodyMuted} mb-4`}>
              They will receive an email with a temporary password and a link to sign in. Access level is stored for future
              portal permissions.
            </p>
            <div className="space-y-3">
              <div>
                <label className={PM_SECTION_EYE}>Name</label>
                <input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2C3E2D]/12 bg-white text-[13px] outline-none focus:border-[#5C1A33]/35"
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className={PM_SECTION_EYE}>Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2C3E2D]/12 bg-white text-[13px] outline-none focus:border-[#5C1A33]/35"
                  placeholder="Email address"
                  autoComplete="email"
                />
              </div>
              <div>
                <label className={PM_SECTION_EYE}>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2C3E2D]/12 bg-white text-[13px] outline-none focus:border-[#5C1A33]/35"
                >
                  <option value="property_manager">Property manager (full access)</option>
                  <option value="building_manager">Building manager (assigned buildings)</option>
                  <option value="view_only">View only (reports and history)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="flex-1 py-2.5 border border-[#2C3E2D]/20 rounded-lg text-[12px] font-semibold text-[#1a1f1b] hover:bg-[#FAF7F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={inviteSending}
                onClick={() => void sendInvite()}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-bold tracking-[0.08em] uppercase bg-[#5C1A33] text-[#FFFBF7] hover:opacity-95 disabled:opacity-50"
              >
                {inviteSending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type EnrichedProject = PmProjectRow & {
  building_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  units?: { number: string; status: string }[];
  completed_moves?: number;
  total_moves?: number;
  next_move?: { unit: string | null; date: string | null } | null;
};

/** Matches schedule flow: small caps label above underline fields */
const PM_PROJECT_FORM_FIELD_LABEL =
  "block text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E] mb-1.5";
const PM_PROJECT_FIELD = "field-input-compact w-full min-w-0 bg-transparent";

const PM_PROJECT_TYPE_OPTIONS: { value: string; title: string; desc: string }[] = [
  {
    value: "renovation",
    title: "Renovation program",
    desc: "Displacement and return moves",
  },
  {
    value: "tenant_turnover",
    title: "Multi-unit turnover",
    desc: "Coordinated turnover across units",
  },
  {
    value: "building_upgrade",
    title: "Building upgrade",
    desc: "Capital or common-area work",
  },
];

export function PartnerPmProjectsTab({ setTab }: { setTab: (t: PmTabId) => void }) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<EnrichedProject[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_name: "",
    property_id: "",
    project_type: "renovation",
    start_date: "",
    end_date: "",
  });
  const [unitDraft, setUnitDraft] = useState({ unit_number: "", unit_type: "2br", outbound_date: "", return_date: "" });
  const [unitRows, setUnitRows] = useState<{ unit_number: string; unit_type: string; outbound_date: string; return_date: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/pm/projects");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setProjects(d.projects ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "x");
    }
  }, [toast]);

  const loadBuildings = useCallback(async () => {
    const res = await fetch("/api/partner/pm/buildings");
    const d = await res.json();
    if (res.ok) setBuildings((d.buildings ?? []).map((b: BuildingRow) => ({ id: b.id, name: b.name })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (showForm) loadBuildings();
  }, [showForm, loadBuildings]);

  const submitProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.project_name.trim() || !form.property_id) {
      toast("Name and building are required", "x");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/partner/pm/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          units: unitRows,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast("Project created", "check");
      setShowForm(false);
      setUnitRows([]);
      setForm((f) => ({ ...f, project_name: "" }));
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  if (!projects) return <p className={pmBodyMuted}>Loading…</p>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-6">
        <div className="flex items-start gap-2 min-w-0">
          <h1 className={pmPageTitle}>Projects</h1>
          <InfoHint ariaLabel="About projects" className="mt-1 shrink-0">
            <span>
              Track renovation programs, multi-unit turnovers, and ongoing move campaigns. Each project groups related
              moves for scheduling and reporting.
            </span>
          </InfoHint>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => setShowForm(true)}>
          New project
          <CaretRight className="w-4 h-4" weight="bold" aria-hidden />
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitProject} className="mb-8 pb-2">
          <header className="mb-8">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#5A6B5E]/80 mb-1.5">
              New project — details
            </p>
            <h2 className={pmUiTitleCaps}>Create project</h2>
            <p className={`text-[11px] text-[#5A6B5E] mt-1 ${pmFontBody}`}>
              Name your program, choose a building, and optional unit timeline.
            </p>
          </header>

          <div className="space-y-8">
            <div>
              <label htmlFor="pm-project-name" className={PM_PROJECT_FORM_FIELD_LABEL}>
                Project name
              </label>
              <input
                id="pm-project-name"
                className={PM_PROJECT_FIELD}
                value={form.project_name}
                onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
                placeholder="e.g. Lakeshore renovation 2026"
                required
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="pm-project-building" className={PM_PROJECT_FORM_FIELD_LABEL}>
                Building
              </label>
              <select
                id="pm-project-building"
                className={PM_PROJECT_FIELD}
                value={form.property_id}
                onChange={(e) => setForm((f) => ({ ...f, property_id: e.target.value }))}
                required
              >
                <option value="">Select building…</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className={PM_PROJECT_FORM_FIELD_LABEL}>Project type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PM_PROJECT_TYPE_OPTIONS.map((opt) => {
                  const active = form.project_type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, project_type: opt.value }))}
                      className={`p-3 rounded-lg border text-left transition-colors active:scale-[0.99] ${
                        active
                          ? "border-[#5C1A33] bg-[#5C1A33]/6 ring-1 ring-[#5C1A33]/20"
                          : "border-[#2C3E2D]/12 hover:border-[#5C1A33]/25 bg-white"
                      }`}
                    >
                      <p className="text-[13px] font-semibold text-[#1a1f1b]">{opt.title}</p>
                      <p className="text-[11px] text-[#5A6B5E] mt-1 leading-relaxed">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <label htmlFor="pm-project-start" className={PM_PROJECT_FORM_FIELD_LABEL}>
                  Start
                </label>
                <input
                  id="pm-project-start"
                  type="date"
                  className={PM_PROJECT_FIELD}
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="pm-project-end" className={PM_PROJECT_FORM_FIELD_LABEL}>
                  End
                </label>
                <input
                  id="pm-project-end"
                  type="date"
                  className={PM_PROJECT_FIELD}
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <p className={PM_PROJECT_FORM_FIELD_LABEL}>Units</p>
              <div className="flex flex-wrap gap-x-4 gap-y-3 items-end mb-3">
                <div className="flex-1 min-w-[7rem]">
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-1 block">
                    Unit #
                  </span>
                  <input
                    placeholder="e.g. 1204"
                    className={PM_PROJECT_FIELD}
                    value={unitDraft.unit_number}
                    onChange={(e) => setUnitDraft((d) => ({ ...d, unit_number: e.target.value }))}
                  />
                </div>
                <div className="w-full min-w-[5.5rem] sm:w-28">
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-1 block">
                    Size
                  </span>
                  <select
                    className={PM_PROJECT_FIELD}
                    value={unitDraft.unit_type}
                    onChange={(e) => setUnitDraft((d) => ({ ...d, unit_type: e.target.value }))}
                  >
                    <option value="studio">Studio</option>
                    <option value="1br">1 BR</option>
                    <option value="2br">2 BR</option>
                    <option value="3br">3 BR</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[9rem]">
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-1 block">
                    Out
                  </span>
                  <input
                    type="date"
                    className={PM_PROJECT_FIELD}
                    value={unitDraft.outbound_date}
                    onChange={(e) => setUnitDraft((d) => ({ ...d, outbound_date: e.target.value }))}
                  />
                </div>
                <div className="flex-1 min-w-[9rem]">
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] mb-1 block">
                    Return
                  </span>
                  <input
                    type="date"
                    className={PM_PROJECT_FIELD}
                    value={unitDraft.return_date}
                    onChange={(e) => setUnitDraft((d) => ({ ...d, return_date: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[#1a1f1b] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm [font-family:var(--font-body)]"
                  onClick={() => {
                    if (!unitDraft.unit_number.trim()) return;
                    setUnitRows((r) => [...r, { ...unitDraft }]);
                    setUnitDraft({ unit_number: "", unit_type: "2br", outbound_date: "", return_date: "" });
                  }}
                >
                  Add unit
                </button>
              </div>
              <ul className={`${pmMeta} space-y-1`}>
                {unitRows.map((u, i) => (
                  <li key={i}>
                    Unit {u.unit_number} — {u.unit_type} · Out {u.outbound_date || "—"} · Return{" "}
                    {u.return_date || "—"}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 mt-10 pt-4 border-t border-[#2C3E2D]/10 bg-[#FAF7F2]/95 backdrop-blur-sm -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase border border-[#2C3E2D]/25 text-[#1a1f1b] hover:bg-[#2C3E2D]/[0.04] transition-colors rounded-sm [font-family:var(--font-body)] w-full sm:w-auto"
            >
              <CaretLeft size={14} weight="bold" aria-hidden />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] active:scale-[0.98] disabled:opacity-50 transition-[transform,colors] rounded-sm [font-family:var(--font-body)] w-full sm:w-auto"
            >
              {saving ? "Saving…" : "Create project"}
              <CaretRight size={14} weight="bold" aria-hidden />
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 && !showForm ? (
        <>
          <h3 className={`${pmLeadTitle} mb-2 text-center pt-12 px-4`}>No active projects</h3>
          <p className={`${pmBodyMuted} mb-4 max-w-md mx-auto text-center px-4`}>
            Projects help you manage renovation programs and multi-unit turnovers. Moves can still be booked individually.
          </p>
          <p className="text-center px-4 pb-12">
            <button type="button" className={BTN_PRIMARY} onClick={() => setShowForm(true)}>
              Create your first project
              <CaretRight className="w-4 h-4" weight="bold" aria-hidden />
            </button>
          </p>
        </>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const total = Math.max(1, p.total_moves ?? 1);
            const done = p.completed_moves ?? 0;
            const pct = Math.min(100, Math.round((done / total) * 100));
            const units = p.units ?? [];
            return (
              <div key={p.id} className={`${PM_CARD} p-5`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                  <div>
                    <h3 className={pmCardTitle}>{p.project_name}</h3>
                    <p className={pmMeta}>
                      {projectTypeLabel(p.project_type)} · {p.building_name || "Building"} ·{" "}
                      {(p.total_units ?? units.length) || "—"} units ·{" "}
                      {p.start_date && p.end_date
                        ? `${formatDate(String(p.start_date), { month: "short", day: "numeric" })} — ${formatDate(String(p.end_date), { month: "short", day: "numeric", year: "numeric" })}`
                        : "Timeline TBD"}
                    </p>
                  </div>
                  <PmStatusBadge status={p.status} />
                </div>
                <div className="mb-4">
                  <div className={`flex justify-between text-[10px] text-[#5A6B5E] mb-1 font-medium ${pmFontBody}`}>
                    <span>
                      {done} of {total} moves completed
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-[#2C3E2D]/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2C3E2D] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {units.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {units.map((u) => {
                      const st = u.status;
                      const cls =
                        st === "completed"
                          ? "bg-[#2C3E2D] text-white"
                          : st === "scheduled"
                            ? "bg-[#5C1A33]/15 text-[#5C1A33]"
                            : st === "in_progress"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#2C3E2D]/8 text-[#5A6B5E]";
                      return (
                        <div
                          key={u.number}
                          className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-semibold ${cls}`}
                          title={`Unit ${u.number}: ${st}`}
                        >
                          {u.number}
                        </div>
                      );
                    })}
                  </div>
                )}
                {p.next_move && (p.next_move.unit || p.next_move.date) && (
                  <p className={`${pmMeta} mb-3`}>
                    Next: Unit {p.next_move.unit || "—"} —{" "}
                    {p.next_move.date ? formatDate(p.next_move.date, { month: "short", day: "numeric" }) : "—"}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={pmLink} onClick={() => setTab("schedule")}>
                    Schedule next move
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
