"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/design-system/admin/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { DesignerPhase, VendorReadiness } from "@/lib/designer-projects/types";
import { DESIGNER_PHASE_LABELS } from "@/lib/designer-projects/types";

interface Vendor { id: string; vendor_name: string; readiness: VendorReadiness; sort_order: number }
interface Item { id: string; item_name: string; item_status: string | null; status: string; vendor_id: string | null }

interface Project {
  id: string;
  project_number: string;
  project_name: string;
  end_client_name: string | null;
  site_address: string | null;
  install_unit: string | null;
  designer_phase: DesignerPhase | null;
  status: string;
  target_end_date: string | null;
  estimated_budget: number | null;
  coordinator_name: string | null;
  delivery_job_id: string | null;
  partner_id: string;
  created_at: string;
  organizations: { id: string; name: string; type: string } | null;
  project_vendors: Vendor[];
  project_inventory: Item[];
}

interface Partner { id: string; name: string; type: string }

const PHASE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "planning", label: "Planning" },
  { value: "vendor_coordination", label: "Vendor Coordination" },
  { value: "staging", label: "Staging" },
  { value: "install_ready", label: "Install Ready" },
  { value: "install_scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

const PHASE_BADGE: Record<DesignerPhase, string> = {
  planning: "bg-gray-100 text-gray-600",
  vendor_coordination: "bg-amber-100 text-amber-700",
  staging: "bg-blue-100 text-blue-700",
  install_ready: "bg-emerald-100 text-emerald-700",
  install_scheduled: "bg-[#66143D]/10 text-[#66143D]",
  completed: "bg-[#2B3927]/10 text-[#2B3927]",
};

const READINESS_DOT: Record<VendorReadiness, string> = {
  pending: "bg-gray-300",
  confirmed: "bg-emerald-500",
  partial: "bg-amber-400",
  delayed: "bg-red-400",
  received: "bg-[#2B3927]",
};

const READY_ITEM_STATUSES = new Set([
  "received_warehouse", "inspected", "stored", "scheduled_delivery", "delivered", "installed",
]);

function DesignerProjectCard({ project }: { project: Project }) {
  const phase = project.designer_phase;
  const vendors = (project.project_vendors || []).sort((a, b) => a.sort_order - b.sort_order);
  const items = project.project_inventory || [];
  const confirmedVendors = vendors.filter((v) =>
    ["confirmed", "received"].includes(v.readiness),
  ).length;
  const readyItems = items.filter((i) => READY_ITEM_STATUSES.has(i.item_status || i.status || "")).length;
  const totalItems = items.length;
  const totalVendors = vendors.length;

  const daysUntil = project.target_end_date
    ? Math.ceil(
        (new Date(project.target_end_date + "T12:00:00").getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <Link
      href={`/admin/b2b/designer-projects/${project.id}`}
      className="block bg-white rounded-xl border border-[var(--yu3-line)] p-5 hover:border-[#66143D]/30 hover:shadow-sm transition group"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono text-[var(--yu3-ink-muted)]">
              {project.project_number}
            </span>
            {phase && (
              <span
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                  PHASE_BADGE[phase],
                )}
              >
                {DESIGNER_PHASE_LABELS[phase]}
              </span>
            )}
          </div>
          <h3 className="text-[13px] font-semibold text-[#2B0416] truncate">
            {project.project_name}
          </h3>
          <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-0.5 truncate">
            {project.organizations?.name}
            {project.coordinator_name ? ` · ${project.coordinator_name}` : ""}
          </p>
        </div>
        <div className="text-right ml-4 shrink-0">
          {project.target_end_date && (
            <p className="text-[12px] font-medium text-[#2B0416]">
              {formatMoveDate(project.target_end_date)}
            </p>
          )}
          {daysUntil !== null && daysUntil >= 0 && (
            <p className="text-[10px] text-[var(--yu3-ink-muted)] mt-0.5">
              {daysUntil === 0 ? "Today" : `${daysUntil}d away`}
            </p>
          )}
          {project.estimated_budget && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-1">
              {formatCurrency(project.estimated_budget)}
            </p>
          )}
        </div>
      </div>

      {/* Progress indicators */}
      <div className="flex gap-5 mt-3 border-t border-[var(--yu3-line)]/50 pt-3">
        {totalVendors > 0 && (
          <div>
            <p className="text-[9px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-1.5">
              Vendors
            </p>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {vendors.map((v) => (
                  <div
                    key={v.id}
                    className={cn("w-2.5 h-2.5 rounded-full", READINESS_DOT[v.readiness])}
                    title={`${v.vendor_name}: ${v.readiness}`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                {confirmedVendors}/{totalVendors}
              </span>
            </div>
          </div>
        )}

        {totalItems > 0 && (
          <div>
            <p className="text-[9px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-1.5">
              Items
            </p>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2B3927] rounded-full transition-all"
                  style={{ width: `${(readyItems / totalItems) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                {readyItems}/{totalItems}
              </span>
            </div>
          </div>
        )}

        {phase === "install_ready" && (
          <div className="ml-auto self-center">
            <span className="text-[11px] text-emerald-600 font-semibold">
              ✓ Ready to schedule
            </span>
          </div>
        )}
        {phase === "install_scheduled" && project.delivery_job_id && (
          <div className="ml-auto self-center">
            <span className="text-[11px] text-[#66143D] font-semibold">
              Install scheduled
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function DesignerProjectsListClient({
  projects,
  partners,
}: {
  projects: Project[];
  partners: Partner[];
}) {
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = projects;
    if (phaseFilter !== "all") result = result.filter((p) => p.designer_phase === phaseFilter);
    if (partnerFilter !== "all") result = result.filter((p) => p.partner_id === partnerFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.project_name.toLowerCase().includes(q) ||
          (p.project_number || "").toLowerCase().includes(q) ||
          (p.end_client_name || "").toLowerCase().includes(q) ||
          (p.organizations?.name || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [projects, phaseFilter, partnerFilter, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: projects.length };
    for (const p of projects) {
      if (p.designer_phase) map[p.designer_phase] = (map[p.designer_phase] || 0) + 1;
    }
    return map;
  }, [projects]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Header */}
      <div className="shrink-0 px-6 py-5 border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[15px] font-semibold text-[var(--yu3-ink)]">Designer Projects</h1>
            <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-0.5">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/admin/b2b/designer-projects/new"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#66143D] text-[#F9EDE4] rounded-lg text-[12px] font-semibold hover:bg-[#4f0f2e] transition"
          >
            <Plus size={14} />
            New project
          </Link>
        </div>

        {/* Phase filter tabs */}
        <div className="flex gap-1 mt-4 flex-wrap">
          {PHASE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPhaseFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-semibold transition",
                phaseFilter === opt.value
                  ? "bg-[#66143D] text-[#F9EDE4]"
                  : "bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)]",
              )}
            >
              {opt.label}
              {counts[opt.value] !== undefined && (
                <span className="ml-1 opacity-70">({counts[opt.value]})</span>
              )}
            </button>
          ))}
        </div>

        {/* Search + partner filter row */}
        <div className="flex gap-3 mt-3">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--yu3-ink-muted)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-[var(--yu3-line)] rounded-lg bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] placeholder:text-[var(--yu3-ink-muted)] focus:outline-none focus:border-[#66143D]/40"
            />
          </div>
          {partners.length > 0 && (
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="px-3 py-2 text-[12px] border border-[var(--yu3-line)] rounded-lg bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] focus:outline-none"
            >
              <option value="all">All partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[13px] text-[var(--yu3-ink-muted)]">No designer projects found.</p>
            <Link
              href="/admin/b2b/designer-projects/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-[#66143D] text-[#F9EDE4] rounded-lg text-[12px] font-semibold"
            >
              <Plus size={14} /> Create first project
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <DesignerProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
