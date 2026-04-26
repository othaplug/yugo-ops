"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import CreateButton from "../components/CreateButton";
import MoveDateFilter, {
  getDateRangeFromPreset,
} from "../components/MoveDateFilter";
import { formatCurrency } from "@/lib/format-currency";
import RecurringSchedulesView from "./RecurringSchedulesView";
import ProjectsListClient from "../projects/ProjectsListClient";
import { Bell } from "@phosphor-icons/react";
import { PageHeader as PageHeaderV3 } from "@/design-system/admin/layout";
import { KpiStrip as KpiStripV3 } from "@/design-system/admin/dashboard";
import { Button } from "@/design-system/admin/primitives/Button";
import { cn } from "@/design-system/admin/lib/cn";
import { AllDeliveriesV3DataTable } from "./AllDeliveriesV3DataTable";

const PARTNER_TYPE_FILTERS: {
  key: string;
  label: string;
  categories: string[];
}[] = [
  { key: "all", label: "All", categories: [] },
  {
    key: "furniture_design",
    label: "Furniture & Design",
    categories: [
      "retail",
      "designer",
      "furniture_retailer",
      "interior_designer",
      "cabinetry",
      "flooring",
    ],
  },
  {
    key: "art_specialty",
    label: "Art & Specialty",
    categories: ["gallery", "art_gallery", "antique_dealer"],
  },
  { key: "hospitality", label: "Hospitality", categories: ["hospitality"] },
  {
    key: "medical_technical",
    label: "Medical & Technical",
    categories: ["medical_equipment", "av_technology", "appliances"],
  },
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

export default function AllDeliveriesView({
  deliveries,
  projects,
  partners,
  today,
  initialView,
  initialScheduleId,
}: {
  deliveries: Delivery[];
  projects: {
    id: string;
    project_number: string;
    project_name: string;
    status: string;
    active_phase: string | null;
    partner_id: string;
    end_client_name: string | null;
    estimated_budget: number | null;
    actual_cost: number | null;
    start_date: string | null;
    target_end_date: string | null;
    created_at: string;
    organizations: { name: string; type: string } | null;
  }[];
  partners: { id: string; name: string; type: string }[];
  today: string;
  initialView?: "deliveries" | "projects" | "recurring";
  initialScheduleId?: string;
}) {
  const [activeView, setActiveView] = useState<
    "deliveries" | "projects" | "recurring"
  >(initialView || "deliveries");
  const [createDropOpen, setCreateDropOpen] = useState(false);
  const createDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        createDropRef.current &&
        !createDropRef.current.contains(e.target as Node)
      )
        setCreateDropOpen(false);
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
        list = list.filter((d) =>
          filter.categories.includes((d.category || "").toLowerCase()),
        );
      }
    }
    if (statusFilter)
      list = list.filter(
        (d) => (d.status || "").toLowerCase() === statusFilter.toLowerCase(),
      );
    if (dateFrom)
      list = list.filter((d) => (d.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((d) => (d.scheduled_date || "") <= dateTo);
    return list;
  }, [deliveries, partnerType, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!(statusFilter || moveDatePreset);
  const activeFilterCount = [statusFilter, moveDatePreset].filter(
    Boolean,
  ).length;
  const clearFilters = () => {
    setStatusFilter("");
    setMoveDatePreset("");
  };

  const pendingApproval = useMemo(
    () =>
      deliveries.filter(
        (d) =>
          d.status === "pending_approval" ||
          (d.status === "pending" &&
            (d as unknown as Record<string, unknown>).created_by_source ===
              "partner_portal"),
      ),
    [deliveries],
  );
  const pendingPartnerNames = useMemo(() => {
    const names = [
      ...new Set(pendingApproval.map((d) => d.client_name).filter(Boolean)),
    ];
    return names.slice(0, 3);
  }, [pendingApproval]);

  const todayCount = deliveries.filter(
    (d) => d.scheduled_date === today,
  ).length;
  const summaryParts = [
    `${deliveries.length} deliveries`,
    todayCount > 0 ? `${todayCount} today` : null,
    pendingApproval.length > 0
      ? `${pendingApproval.length} pending approval`
      : null,
  ].filter(Boolean);

  return (
    <>
      {/* View tabs — v3 pill segment inside a raised bar */}
      <div className="mb-5">
        <div
          className="inline-flex w-full max-w-full sm:w-auto rounded-full border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-1 shadow-[var(--yu3-shadow-sm)]"
          role="tablist"
          aria-label="Deliveries view"
        >
          {(
            [
              { key: "deliveries" as const, label: "All Deliveries" },
              { key: "projects" as const, label: "All Projects" },
              { key: "recurring" as const, label: "Recurring Schedules" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeView === t.key}
              onClick={() => setActiveView(t.key)}
              className={cn(
                "min-w-0 flex-1 sm:flex-initial sm:shrink-0 rounded-full px-3.5 py-2.5 sm:px-4 text-[12px] font-semibold whitespace-nowrap transition-colors",
                activeView === t.key
                  ? "bg-[var(--yu3-wine-wash)] text-[var(--yu3-wine)]"
                  : "text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeView === "recurring" && (
        <RecurringSchedulesView initialScheduleId={initialScheduleId} />
      )}

      {activeView === "projects" && (
        <ProjectsListClient projects={projects} partners={partners} />
      )}

      {activeView === "deliveries" && (
        <>
          <PageHeaderV3
            eyebrow="B2B Operations"
            title="All deliveries"
            description="Every delivery across partners, day-rates, and one-off B2B jobs."
            actions={
              <div className="relative" ref={createDropRef}>
                <CreateButton
                  onClick={() => setCreateDropOpen((v) => !v)}
                  title="New delivery"
                  label="Add delivery"
                />
                {createDropOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] py-1.5 shadow-[var(--yu3-shadow-lg)]">
                    {[
                      {
                        href: "/admin/deliveries/new?choice=single",
                        label: "Single Delivery",
                        sub: "Per-delivery from rate card",
                      },
                      {
                        href: "/admin/deliveries/new?choice=day_rate",
                        label: "Day Rate",
                        sub: "Multi-stop day rate",
                      },
                      {
                        href: "/admin/deliveries/new?choice=b2b_oneoff",
                        label: "B2B One-Off",
                        sub: "Business, no partner account",
                      },
                    ].map((opt) => (
                      <Link
                        key={opt.href}
                        href={opt.href}
                        onClick={() => setCreateDropOpen(false)}
                        className="group flex flex-col px-4 py-2.5 transition-colors hover:bg-[var(--yu3-bg-surface-sunken)]"
                      >
                        <span className="text-[12px] font-semibold text-[var(--yu3-ink)] group-hover:text-[var(--yu3-wine)]">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-[var(--yu3-ink-faint)]">
                          {opt.sub}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            }
          />
          <KpiStripV3
            tiles={[
              {
                id: "total",
                label: "Total",
                value: String(deliveries.length),
                hint: todayCount > 0 ? `${todayCount} today` : "all deliveries",
              },
              {
                id: "pending",
                label: "Pending approval",
                value: String(pendingApproval.length),
                hint: "partner requests",
              },
              {
                id: "completed",
                label: "Completed",
                value: String(
                  deliveries.filter(
                    (d) => d.status === "completed" || d.status === "delivered",
                  ).length,
                ),
                hint: "fulfilled",
              },
              {
                id: "in_progress",
                label: "In progress",
                value: String(
                  deliveries.filter((d) =>
                    [
                      "scheduled",
                      "confirmed",
                      "in_transit",
                      "dispatched",
                    ].includes(d.status),
                  ).length,
                ),
                hint: "active now",
              },
            ]}
            columns={4}
          />

          {/* Pending approval — Yugo+ wine wash (replaces legacy blue alert strip) */}
          {pendingApproval.length > 0 && (
            <div className="mb-5 flex flex-col gap-3 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-wine)]/25 bg-[var(--yu3-wine-wash)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                <span
                  className="mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-[var(--yu3-wine)] sm:mt-0"
                  aria-hidden
                />
                <Bell
                  size={18}
                  weight="duotone"
                  className="shrink-0 text-[var(--yu3-wine)]"
                  aria-hidden
                />
                <p className="min-w-0 text-[12px] font-medium leading-relaxed text-[var(--yu3-ink)]">
                  <span className="font-bold text-[var(--yu3-wine)]">
                    {pendingApproval.length}
                  </span>{" "}
                  partner request{pendingApproval.length > 1 ? "s" : ""}
                  {pendingPartnerNames.length > 0 && (
                    <>
                      {" "}
                      from{" "}
                      <span className="font-semibold text-[var(--yu3-ink-strong)]">
                        {pendingPartnerNames.join(", ")}
                      </span>
                    </>
                  )}{" "}
                  awaiting approval
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => setStatusFilter("pending_approval")}
              >
                Review
              </Button>
            </div>
          )}

          {/* Partner type pills */}
          <div className="mb-4 flex flex-wrap gap-1.5 border-t border-[var(--yu3-line)]/30 pt-5">
            {PARTNER_TYPE_FILTERS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setPartnerType(t.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors",
                  partnerType === t.key
                    ? "border-[var(--yu3-wine)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)]"
                    : "border-[var(--yu3-line)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]",
                )}
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
                {activeFilterCount > 0 && (
                  <span className="dt-badge tracking-[0.04em] text-[var(--admin-primary-fill)] tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="hidden md:flex items-center gap-3 flex-1">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[11px] rounded-lg border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-3 py-2 text-[var(--yu3-ink)] outline-none focus:border-[var(--yu3-wine)]/35"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <MoveDateFilter
                  value={moveDatePreset}
                  onChange={setMoveDatePreset}
                  label="Date"
                />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[10px] font-medium text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-wine)]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile filter drawer */}
          {filterOpen && (
            <div className="md:hidden border-t border-[var(--brd)]/30 pt-4 pb-4 space-y-3 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                  Filters
                </span>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="text-[11px] font-medium text-[var(--yu3-wine)]"
                >
                  Done
                </button>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-premium-input w-full"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <MoveDateFilter
                value={moveDatePreset}
                onChange={setMoveDatePreset}
                label="Date"
              />
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-wine)]"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Deliveries list — design-system DataTable (same chrome as Moves) */}
          <div className="border-t border-[var(--yu3-line)]/30 pt-5">
            <AllDeliveriesV3DataTable
              rows={filteredDeliveries}
              emptyMessage={
                statusFilter
                  ? `No deliveries with status "${statusFilter}"`
                  : "No deliveries found"
              }
            />
          </div>
        </>
      )}
    </>
  );
}
