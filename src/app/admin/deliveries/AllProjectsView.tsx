"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import CreateButton from "../components/CreateButton";
import { useRouter } from "next/navigation";
import MoveDateFilter, { getDateRangeFromPreset } from "../components/MoveDateFilter";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatMoveDate } from "@/lib/date-format";
import { getDeliveryDetailPath, formatJobId } from "@/lib/move-code";
import { toTitleCase } from "@/lib/format-text";
import { formatCurrency } from "@/lib/format-currency";
import RecurringSchedulesView from "./RecurringSchedulesView";
import ProjectsListClient from "../projects/ProjectsListClient";

const PARTNER_TYPE_FILTERS: { key: string; label: string; categories: string[] }[] = [
  { key: "all", label: "All", categories: [] },
  { key: "furniture_design", label: "Furniture & Design", categories: ["retail", "designer", "furniture_retailer", "interior_designer", "cabinetry", "flooring", "b2b"] },
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
  vehicle_type?: string | null;
  num_stops?: number | null;
  total_price?: number | null;
  delivery_type?: string | null;
  zone?: number | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

const DELIVERY_STATUS_STYLE: Record<string, string> = {
  pending: "text-[var(--gold)] bg-[var(--gdim)]",
  pending_approval: "text-amber-400 bg-amber-500/10",
  scheduled: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  confirmed: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  dispatched: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  in_transit: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  "in-transit": "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  completed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
};

function deliveryDetailsLabel(d: Delivery): string {
  if (d.booking_type === "day_rate") {
    const parts = [d.vehicle_type || "", d.num_stops != null ? `${d.num_stops} stops` : ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }
  const parts = [d.delivery_type ? toTitleCase(String(d.delivery_type).replace(/_/g, " ")) : "", d.zone != null ? `Z${d.zone}` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const deliveryColumns: ColumnDef<Delivery>[] = [
  {
    id: "date",
    label: "Date",
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
    id: "partner",
    label: "Partner",
    accessor: (d) => d.client_name,
    sortable: true,
    searchable: true,
    render: (d) => <span className="font-medium text-[var(--tx)]">{d.client_name || "—"}</span>,
  },
  {
    id: "category",
    label: "Category",
    accessor: (d) => d.category || "Delivery",
    render: (d) => <span className="text-[var(--tx2)]">{toTitleCase(d.category || "Delivery")}</span>,
    sortable: true,
    searchable: true,
  },
  {
    id: "delivery_id",
    label: "Delivery ID",
    accessor: (d) => d.delivery_number || d.id,
    render: (d) => <span className="font-mono text-[var(--tx2)]">{formatJobId(d.delivery_number || d.id, "delivery")}</span>,
    sortable: true,
    searchable: true,
  },
  {
    id: "price",
    label: "Price",
    accessor: (d) => d.total_price ?? 0,
    render: (d) => (d.total_price != null && d.total_price > 0 ? formatCurrency(d.total_price) : "—"),
    sortable: true,
  },
  {
    id: "status",
    label: "Status",
    accessor: (d) => d.status,
    render: (d) => {
      const s = (d.status || "").toLowerCase();
      const style = DELIVERY_STATUS_STYLE[s] || "text-[var(--tx3)] bg-[var(--gdim)]";
      return (
        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold leading-tight ${style}`}>
          {toTitleCase(d.status || "")}
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
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-heading text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">All Deliveries</h1>
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
      <p className="text-[12px] text-[var(--tx3)] mb-5 font-medium">{summaryParts.join(" \u00b7 ")}</p>

      {/* Pending approval banner */}
      {pendingApproval.length > 0 && (
        <div className="mb-5 rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1A2744 0%, #142038 100%)", border: "1px solid rgba(99,140,255,0.22)" }}>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <span className="absolute inset-0 rounded-full bg-[#6B8CFF]/30 animate-ping" />
                <span className="relative w-2 h-2 rounded-full bg-[#6B8CFF] block" />
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B8CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="text-[12px] font-semibold" style={{ color: "#A8BFFF" }}>
                <span className="font-bold" style={{ color: "#FFFFFF" }}>{pendingApproval.length}</span>
                {" "}partner request{pendingApproval.length > 1 ? "s" : ""}
                {pendingPartnerNames.length > 0 && (
                  <> from <span style={{ color: "#FFFFFF" }}>{pendingPartnerNames.join(", ")}</span></>
                )}
                {" "}awaiting approval
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter("pending_approval")}
              className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all hover:opacity-90 active:scale-95"
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
            className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
              partnerType === t.key
                ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50 border border-[var(--brd)]/50"
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filters
            {activeFilterCount > 0 && <span className="min-w-[16px] h-[16px] rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
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
            <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Filters</span>
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
          searchable
          pagination
          exportable
          columnToggle
          selectable
          onRowClick={(d) => router.push(getDeliveryDetailPath(d))}
          emptyMessage={statusFilter ? `No deliveries with status "${statusFilter}"` : "No deliveries found"}
        />
      </div>
      </>)}
    </>
  );
}
