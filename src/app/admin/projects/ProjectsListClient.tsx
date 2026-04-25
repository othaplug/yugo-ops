"use client"

import { useState, useMemo, useCallback } from "react"
import type { ComponentProps } from "react"
import { useRouter } from "next/navigation"
import CreateButton from "../components/CreateButton"
import { formatCurrency } from "@/lib/format-currency"
import { formatAdminCreatedAt } from "@/lib/date-format"
import { csvField } from "@/lib/admin-csv-field"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
} from "@/design-system/admin/table"
import { StatusPill } from "@/design-system/admin/primitives"
import KpiCard from "@/components/ui/KpiCard"
import { organizationTypeLabel } from "@/lib/partner-type"

interface Project {
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
}

interface Partner {
  id: string;
  name: string;
  type: string;
}

const STATUS_OPTIONS = ["all", "draft", "proposed", "active", "on_hold", "completed", "invoiced", "cancelled"] as const

function projectStatusTone(
  s: string,
): ComponentProps<typeof StatusPill>["tone"] {
  const k = s.toLowerCase()
  if (k === "active" || k === "completed" || k === "invoiced") return "success"
  if (k === "cancelled") return "danger"
  if (k === "on_hold" || k === "proposed") return "warning"
  if (k === "draft") return "neutral"
  return "info"
}

export default function ProjectsListClient({ projects, partners }: { projects: Project[]; partners: Partner[] }) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [partnerFilter, setPartnerFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<ColumnSort | null>({ columnId: "created_at", direction: "desc" })
  const [viewMode, setViewMode] = useState<ViewMode>("list")

  const projectColumns = useMemo<ColumnDef<Project>[]>(
    () => [
      {
        id: "project_number",
        shortLabel: "PRJ",
        header: "PRJ #",
        accessor: (p) => p.project_number,
        width: 100,
        cell: (p) => (
          <span className="text-[12px] font-semibold text-[var(--yu3-wine)]">{p.project_number}</span>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Create date",
        accessor: (p) => p.created_at,
        sortable: true,
        width: 160,
        cell: (p) => (
          <span className="text-[11px] text-[var(--yu3-ink-muted)] tabular-nums whitespace-nowrap">
            {formatAdminCreatedAt(p.created_at)}
          </span>
        ),
      },
      {
        id: "partner",
        header: "Partner",
        accessor: (p) => p.organizations?.name || "",
        width: 200,
        cell: (p) => (
          <div>
            <div className="text-[12px] font-medium text-[var(--yu3-ink)]">
              {p.organizations?.name || "—"}
            </div>
            <div className="text-[10px] text-[var(--yu3-ink-faint)]">
              {p.organizations?.type ? organizationTypeLabel(p.organizations.type) : ""}
            </div>
          </div>
        ),
      },
      {
        id: "project_name",
        header: "Project Name",
        accessor: (p) => p.project_name,
        width: 200,
        cell: (p) => (
          <div>
            <div className="text-[12px] font-semibold text-[var(--yu3-ink)]">{p.project_name}</div>
            {p.end_client_name ? (
              <div className="text-[10px] text-[var(--yu3-ink-faint)]">{p.end_client_name}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (p) => p.status,
        sortable: true,
        width: 120,
        cell: (p) => (
          <StatusPill tone={projectStatusTone(p.status)}>{p.status.replace(/_/g, " ")}</StatusPill>
        ),
      },
      {
        id: "phase",
        header: "Phase",
        accessor: (p) => p.active_phase || "",
        width: 100,
        cell: (p) => (
          <span className="text-[11px] text-[var(--yu3-ink-muted)] uppercase">
            {p.active_phase?.replace(/_/g, " ") || "—"}
          </span>
        ),
      },
      {
        id: "budget",
        header: "Budget",
        accessor: (p) => p.estimated_budget ?? 0,
        sortable: true,
        align: "right",
        numeric: true,
        width: 140,
        cell: (p) => (
          <div>
            <div className="text-[12px] font-medium text-[var(--yu3-ink)]">
              {p.estimated_budget ? formatCurrency(p.estimated_budget) : "—"}
            </div>
            {p.actual_cost != null && p.actual_cost > 0 ? (
              <div className="text-[10px] text-[var(--yu3-ink-faint)]">
                Spent: {formatCurrency(p.actual_cost)}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "dates",
        header: "Dates",
        accessor: (p) => p.start_date || "",
        width: 120,
        cell: (p) => (
          <span className="text-[11px] text-[var(--yu3-ink-faint)]">
            {p.start_date
              ? new Date(p.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—"}
            {p.target_end_date
              ? ` → ${new Date(p.target_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : ""}
          </span>
        ),
      },
    ],
    [],
  )

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (partnerFilter !== "all" && p.partner_id !== partnerFilter) return false;
      return true;
    });
  }, [projects, statusFilter, partnerFilter]);

  const activeProjects = projects.filter((p) => p.status === "active").length
  const totalBudget = projects.reduce((s, p) => s + (p.estimated_budget ?? 0), 0)

  const onExport = useCallback(() => {
    const headers = [
      "PRJ #",
      "Create date",
      "Partner",
      "Project",
      "Status",
      "Phase",
      "Budget",
      "Dates",
    ]
    const lines = filtered.map((p) => {
      const nameLine = p.end_client_name
        ? `${p.project_name} (${p.end_client_name})`
        : p.project_name
      return [
        p.project_number,
        formatAdminCreatedAt(p.created_at),
        p.organizations?.name || "",
        nameLine,
        p.status,
        p.active_phase || "",
        p.estimated_budget != null ? formatCurrency(p.estimated_budget) : "",
        [p.start_date, p.target_end_date].filter(Boolean).join(" → "),
      ]
        .map((c) => csvField(String(c)))
        .join(",")
    })
    const csv = [headers.map(csvField).join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "yugo-projects.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">B2B Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">All Projects</h1>
        </div>
        <CreateButton href="/admin/projects/new" title="New Project" />
      </div>

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-6">
        <KpiCard label="Total Projects" value={String(projects.length)} sub={`${activeProjects} active`} />
        <KpiCard label="Active" value={String(activeProjects)} sub="in progress" accent={activeProjects > 0} />
        <KpiCard label="Total Budget" value={totalBudget > 0 ? `$${(totalBudget / 1000).toFixed(0)}K` : "-"} sub="estimated" />
      </div>


      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-0.5 overflow-x-auto">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-[var(--card)] text-[var(--accent-text)] shadow-sm"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <select
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
          className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] outline-none"
        >
          <option value="all">All Partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <DataTable<Project>
        columns={projectColumns}
        rows={filtered}
        rowId={(p) => p.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(p) => router.push(`/admin/projects/${p.id}`)}
        onExport={onExport}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
        searchPlaceholder="Search by project #, name, partner…"
        emptyState={
          <div className="px-2 py-8 text-center">
            <p className="text-[15px] font-semibold text-[var(--yu3-ink)]">
              {projects.length === 0
                ? "No projects yet. Create your first project to get started."
                : "No projects match your filters."}
            </p>
          </div>
        }
      />
    </div>
  )
}
