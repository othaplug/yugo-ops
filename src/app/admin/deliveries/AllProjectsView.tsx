"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import CreateButton from "../components/CreateButton";
import { useRouter } from "next/navigation";
import MoveDateFilter, { getDateRangeFromPreset } from "../components/MoveDateFilter";
import DataTable, { type ColumnDef, type BulkAction } from "@/components/admin/DataTable";
import { useToast } from "../components/Toast";
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
import { getDeliveryDetailPath, formatJobId } from "@/lib/move-code";
import { toTitleCase } from "@/lib/format-text";
import { formatCurrency } from "@/lib/format-currency";
import { formatDeliveryPriceForAdminList } from "@/lib/delivery-pricing";
import RecurringSchedulesView from "./RecurringSchedulesView";
import ProjectsListClient from "../projects/ProjectsListClient";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import { Bell, Trash } from "@phosphor-icons/react";

const PARTNER_TYPE_FILTERS: { key: string; label: string; categories: string[] }[] = [
  { key: "all", label: "All", categories: [] },
  { key: "furniture_design", label: "Furniture & Design", categories: ["retail", "designer", "furniture_retailer", "interior_designer", "cabinetry", "flooring"] },
  { key: "art_specialty", label: "Art & Specialty", categories: ["gallery", "art_gallery", "antique_dealer"] },
  { key: "hospitality", label: "Hospitality", categories: ["hospitality"] },
  { key: "medical_technical", label: "Medical & Technical", categories: ["medical_equipment", "av_technology", "appliances"] },
];
const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "scheduled", label: "Scheduled" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

interface Delivery {
  id: string;
  delivery_number: string;
  client_name: string;
  customer_name: string;
  items: string[];
  scheduled_date: string;
  time_slot: string;
  status: string;
  category: string;
  booking_type?: string | null;
  organization_id?: string | null;
  payment_received_at?: string | null;
  vehicle_type?: string | null;
  num_stops?: number | null;
  total_price?: number | null;
  admin_adjusted_price?: number | null;
  quoted_price?: number | null;
  final_price?: number | null;
  calculated_price?: number | null;
  override_price?: number | null;
  delivery_type?: string | null;
  zone?: number | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

const DELIVERY_STATUS_STYLE: Record<string, string> = {
  pending: "text-[var(--gold)]",
  pending_approval: "text-amber-400",
  scheduled: "text-[#3B82F6]",
  confirmed: "text-[#3B82F6]",
  dispatched: "text-[var(--org)]",
  in_transit: "text-[var(--org)]",
  "in-transit": "text-[var(--org)]",
  delivered: "text-[var(--grn)]",
  completed: "text-[var(--grn)]",
  cancelled: "text-[var(--red)]",
};

function deliveryDetailsLabel(d: Delivery): string {
  if (d.booking_type === "day_rate") {
    const parts = [d.vehicle_type || "", d.num_stops != null ? `${d.num_stops} stops` : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : "-";
  }
  const parts = [d.delivery_type ? toTitleCase(String(d.delivery_type).replace(/_/g, " ")) : "", d.zone != null ? `Z${d.zone}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "-";
}

const deliveryColumns: ColumnDef<Delivery>[] = [
  {
    id: "date",
    label: "Service date",
    accessor: (d) => d.scheduled_date,
    render: (d) => (
      <div className="tabular-nums">
        <div className="text-[12px] font-semibold text-[var(--tx2)]">{formatMoveDate(d.scheduled_date)}</div>
        <div className="text-[10px] text-[var(--tx3)]">{d.time_slot || ""}</div>
      </div>
    ),
    sortable: true,
    searchable: true,
    exportAccessor: (d) => `${formatMoveDate(d.scheduled_date)} ${d.time_slot || ""}`,
  },
  {
    id: "created_at",
    label: "Create date",
    accessor: (d) => d.created_at || "",
    render: (d) => (
      <span className="text-[12px] font-normal text-[var(--tx2)] tabular-nums whitespace-nowrap">
        {d.created_at ? formatAdminCreatedAt(d.created_at) : "—"}
      </span>
    ),
    sortable: true,
    searchable: true,
    exportAccessor: (d) => (d.created_at ? formatAdminCreatedAt(d.created_at) : ""),
  },
  {
    id: "partner",
    label: "Partner",
    accessor: (d) => d.client_name,
    sortable: true,
    searchable: true,
    render: (d) => <span className="font-medium text-[var(--tx)]">{d.client_name || "-"}</span>,
  },
  {
    id: "category",
    label: "Category",
    accessor: (d) => d.category || "Delivery",
    render: (d) => (
      <span className="dt-badge tracking-[0.04em] text-[var(--tx2)]">
        {toTitleCase((d.category || "delivery").replace(/_/g, " "))}
      </span>
    ),
    sortable: true,
    searchable: true,
  },
  {
    id: "delivery_id",
    label: "Delivery ID",
    accessor: (d) => d.delivery_number || "",
    render: (d) => (
      <span className="font-mono text-[var(--tx2)]">
        {d.delivery_number ? formatJobId(d.delivery_number, "delivery") : "—"}
      </span>
    ),
    sortable: true,
    searchable: true,
  },
  {
    id: "price",
    label: "Price",
    accessor: (d) => d.total_price ?? 0,
    render: (d) => (
      <span className="text-[11px] leading-snug tabular-nums">
        {formatDeliveryPriceForAdminList(d)}
      </span>
    ),
    sortable: true,
  },
  {
    id: "status",
    label: "Status",
    accessor: (d) => d.status,
    render: (d) => {
      const s = (d.status || "").toLowerCase();
      const style = DELIVERY_STATUS_STYLE[s] || "text-[var(--tx3)] bg-[var(--gdim)]";
      const prepaid =
        d.booking_type === "one_off" && !d.organization_id && !!d.payment_received_at;
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className={`dt-badge tracking-[0.04em] ${style}`}>
            {toTitleCase((d.status || "").replace(/_/g, " ").replace(/-/g, " "))}
          </span>
          {prepaid ? (
            <span className="dt-badge tracking-[0.04em] text-emerald-600">Paid</span>
          ) : null}
        </span>
      );
    },
    sortable: true,
    searchable: true,
  },
];

export default function AllDeliveriesView({
  deliveries,
  projects,
  partners,
  today,
  initialView,
  initialScheduleId,
}: {
  deliveries: Delivery[];
  projects: { id: string; project_number: string; project_name: string; status: string; active_phase: string | null; partner_id: string; end_client_name: string | null; estimated_budget: number | null; actual_cost: number | null; start_date: string | null; target_end_date: string | null; created_at: string; organizations: { name: string; type: string } | null }[];
  partners: { id: string; name: string; type: string }[];
  today: string;
  initialView?: "deliveries" | "projects" | "recurring";
  initialScheduleId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"deliveries" | "projects" | "recurring">(initialView || "deliveries");
  const [createDropOpen, setCreateDropOpen] = useState(false);
  const createDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (createDropRef.current && !createDropRef.current.contains(e.target as Node)) setCreateDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [partnerType, setPartnerType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [moveDatePreset, setMoveDatePreset] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [bulkSelectionTick, setBulkSelectionTick] = useState(0);

  const dateRange = getDateRangeFromPreset(moveDatePreset);
  const dateFrom = dateRange?.from ?? "";
  const dateTo = dateRange?.to ?? "";

  const filteredDeliveries = useMemo(() => {
    let list = [...deliveries];
    if (partnerType !== "all") {
      const filter = PARTNER_TYPE_FILTERS.find((f) => f.key === partnerType);
      if (filter && filter.categories.length > 0) {
        list = list.filter((d) => filter.categories.includes((d.category || "").toLowerCase()));
      }
    }
    if (statusFilter) list = list.filter((d) => (d.status || "").toLowerCase() === statusFilter.toLowerCase());
    if (dateFrom) list = list.filter((d) => (d.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((d) => (d.scheduled_date || "") <= dateTo);
    return list;
  }, [deliveries, partnerType, statusFilter, dateFrom, dateTo]);

  const runBulk = useCallback(
    async (action: "deliver" | "cancel", ids: string[]) => {
      const res = await fetch("/api/admin/deliveries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (data.ok) {
        const labels: Record<string, string> = { deliver: "Marked delivered", cancel: "Cancelled" };
        toast(`${labels[action]} ${data.updated} delivery${data.updated !== 1 ? "ies" : ""}`, "check");
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [toast, router],
  );

  const runBulkDelete = useCallback(
    async (ids: string[]) => {
      const n = ids.length;
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          `Delete ${n} delivery${n !== 1 ? "ies" : "y"}? This cannot be undone.`,
        )
      ) {
        return;
      }
      const res = await fetch("/api/admin/deliveries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const data = await res.json();
      if (data.ok) {
        const deleted = Number(data.deleted) || 0;
        const skipped = Number(data.skipped) || 0;
        let msg = `Deleted ${deleted} delivery${deleted !== 1 ? "ies" : "y"}`;
        if (skipped > 0) {
          msg += ` (${skipped} skipped: completed or not found)`;
        }
        toast(msg, "check");
        setBulkSelectionTick((t) => t + 1);
        router.refresh();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [toast, router],
  );

  const deliveryBulkActions: BulkAction[] = useMemo(
    () => [
      { label: "Mark Delivered", onClick: (ids) => runBulk("deliver", ids) },
      { label: "Cancel", onClick: (ids) => runBulk("cancel", ids), variant: "danger" as const },
      {
        label: "Delete selected deliveries",
        icon: <Trash className="w-4 h-4 shrink-0" weight="bold" aria-hidden />,
        iconOnly: true,
        onClick: runBulkDelete,
        variant: "danger" as const,
      },
    ],
    [runBulk, runBulkDelete],
  );

  const hasActiveFilters = !!(statusFilter || moveDatePreset);
  const activeFilterCount = [statusFilter, moveDatePreset].filter(Boolean).length;
  const clearFilters = () => { setStatusFilter(""); setMoveDatePreset(""); };

  const pendingApproval = useMemo(
    () => deliveries.filter((d) => d.status === "pending_approval" || (d.status === "pending" && (d as unknown as Record<string, unknown>).created_by_source === "partner_portal")),
    [deliveries],
  );
  const pendingPartnerNames = useMemo(() => {
    const names = [...new Set(pendingApproval.map((d) => d.client_name).filter(Boolean))];
    return names.slice(0, 3);
  }, [pendingApproval]);

  const todayCount = deliveries.filter((d) => d.scheduled_date === today).length;
  const summaryParts = [
    `${deliveries.length} deliveries`,
    todayCount > 0 ? `${todayCount} today` : null,
    pendingApproval.length > 0 ? `${pendingApproval.length} pending approval` : null,
  ].filter(Boolean);

  return (
    <>
      {/* View tabs */}
      <div className="flex gap-0 border-b border-[var(--brd)]/30 mb-5 -mx-1">
        {([
          { key: "deliveries" as const, label: "All Deliveries" },
          { key: "projects" as const, label: "All Projects" },
          { key: "recurring" as const, label: "Recurring Schedules" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveView(t.key)}
            className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeView === t.key
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeView === "recurring" && (
        <RecurringSchedulesView initialScheduleId={initialScheduleId} />
      )}

      {activeView === "projects" && (
        <ProjectsListClient projects={projects} partners={partners} />
      )}

      {activeView === "deliveries" && (<>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">B2B Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">All Deliveries</h1>
        </div>
        <div className="relative" ref={createDropRef}>
          <CreateButton onClick={() => setCreateDropOpen((v) => !v)} title="New Delivery" />
          {createDropOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl py-1.5 overflow-hidden">
              {[
                { href: "/admin/deliveries/new?choice=single", label: "Single Delivery", sub: "Per-delivery from rate card" },
                { href: "/admin/deliveries/new?choice=day_rate", label: "Day Rate", sub: "Multi-stop day rate" },
                { href: "/admin/deliveries/new?choice=b2b_oneoff", label: "B2B One-Off", sub: "Business, no partner account" },
              ].map((opt) => (
                <Link
                  key={opt.href}
                  href={opt.href}
                  onClick={() => setCreateDropOpen(false)}
                  className="flex flex-col px-4 py-2.5 hover:bg-[var(--bg)] transition-colors group"
                >
                  <span className="text-[12px] font-semibold text-[var(--tx)] group-hover:text-[var(--gold)]">{opt.label}</span>
                  <span className="text-[10px] text-[var(--tx3)]">{opt.sub}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-6">
        <KpiCard label="Total" value={String(deliveries.length)} sub={todayCount > 0 ? `${todayCount} today` : "all deliveries"} />
        <KpiCard label="Pending Approval" value={String(pendingApproval.length)} sub="partner requests" warn={pendingApproval.length > 0} />
        <KpiCard label="Completed" value={String(deliveries.filter((d) => d.status === "completed" || d.status === "delivered").length)} sub="fulfilled" accent />
        <KpiCard label="In Progress" value={String(deliveries.filter((d) => ["scheduled","confirmed","in_transit","dispatched"].includes(d.status)).length)} sub="active now" />
      </div>

      {/* Pending approval banner */}
      {pendingApproval.length > 0 && (
        <div className="mb-5 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1A2744 0%, #142038 100%)", border: "1px solid rgba(99,140,255,0.22)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#6B8CFF]/30 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-[#6B8CFF] block" />
              </div>
              <Bell size={14} color="#6B8CFF" className="shrink-0 opacity-80" />
              <span className="text-[12px] font-semibold" style={{ color: "#A8BFFF" }}>
                <span className="font-bold" style={{ color: "#F9EDE4" }}>{pendingApproval.length}</span>
                {" "}partner request{pendingApproval.length > 1 ? "s" : ""}
                {pendingPartnerNames.length > 0 && (
                  <> from <span style={{ color: "#F9EDE4" }}>{pendingPartnerNames.join(", ")}</span></>
                )}
                {" "}awaiting approval
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter("pending_approval")}
              className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-md transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: "#6B8CFF", color: "#0D1B3E" }}
            >
              Review
            </button>
          </div>
          <div className="h-px" style={{ background: "linear-gradient(to right, transparent, #6B8CFF40, transparent)" }} />
        </div>
      )}

      {/* Partner type pills */}
      <div className="flex flex-wrap gap-1.5 mb-4 pt-5 border-t border-[var(--brd)]/30">
        {PARTNER_TYPE_FILTERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPartnerType(t.key)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-colors border ${
              partnerType === t.key
                ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50 border-[var(--brd)]/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx2)] border border-[var(--brd)]/50"
          >
            Filters
            {activeFilterCount > 0 && <span className="dt-badge tracking-[0.04em] text-[var(--admin-primary-fill)] tabular-nums">{activeFilterCount}</span>}
          </button>
          <div className="hidden md:flex items-center gap-3 flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} label="Date" />
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterOpen && (
        <div className="md:hidden border-t border-[var(--brd)]/30 pt-4 pb-4 space-y-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">Filters</span>
            <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[11px] font-medium">Done</button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} label="Date" />
          {hasActiveFilters && <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">Clear all</button>}
        </div>
      )}

      {/* Deliveries table */}
      <div className="border-t border-[var(--brd)]/30 pt-5">
        <DataTable<Delivery>
          data={filteredDeliveries}
          columns={deliveryColumns}
          keyField="id"
          tableId="all-deliveries"
          defaultSortCol="created_at"
          defaultSortDir="desc"
          searchable
          pagination
          exportable
          columnToggle
          selectable
          clearSelectionSignal={bulkSelectionTick}
          bulkActions={deliveryBulkActions}
          mobileCardLayout={{
            primaryColumnId: "partner",
            subtitleColumnId: "delivery_id",
            amountColumnId: "price",
            metaColumnIds: ["date", "created_at", "category", "status"],
          }}
          onRowClick={(d) => router.push(getDeliveryDetailPath(d))}
          emptyMessage={statusFilter ? `No deliveries with status "${statusFilter}"` : "No deliveries found"}
        />
      </div>
      </>)}
    </>
  );
}
