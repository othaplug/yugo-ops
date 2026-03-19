"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateButton from "../components/CreateButton";
import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--tx3)]/10 text-[var(--tx3)]",
  proposed: "bg-amber-500/10 text-amber-500",
  active: "bg-emerald-500/10 text-emerald-500",
  on_hold: "bg-orange-500/10 text-orange-500",
  completed: "bg-blue-500/10 text-blue-500",
  invoiced: "bg-purple-500/10 text-purple-500",
  cancelled: "bg-red-500/10 text-red-500",
};

const STATUS_OPTIONS = ["all", "draft", "proposed", "active", "on_hold", "completed", "invoiced", "cancelled"];

const projectColumns: ColumnDef<Project>[] = [
  {
    id: "project_number",
    label: "PRJ #",
    accessor: (p) => p.project_number,
    searchable: true,
    render: (p) => <span className="text-[12px] font-semibold text-[var(--gold)]">{p.project_number}</span>,
  },
  {
    id: "partner",
    label: "Partner",
    accessor: (p) => p.organizations?.name || "",
    searchable: true,
    render: (p) => (
      <div>
        <div className="text-[12px] font-medium text-[var(--tx)]">{p.organizations?.name || "—"}</div>
        <div className="text-[10px] text-[var(--tx3)] capitalize">{p.organizations?.type || ""}</div>
      </div>
    ),
  },
  {
    id: "project_name",
    label: "Project Name",
    accessor: (p) => p.project_name,
    searchable: true,
    render: (p) => (
      <div>
        <div className="text-[12px] font-semibold text-[var(--tx)]">{p.project_name}</div>
        {p.end_client_name && <div className="text-[10px] text-[var(--tx3)]">{p.end_client_name}</div>}
      </div>
    ),
  },
  {
    id: "status",
    label: "Status",
    accessor: (p) => p.status,
    render: (p) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLORS[p.status] || ""}`}>
        {p.status.replace("_", " ")}
      </span>
    ),
  },
  {
    id: "phase",
    label: "Phase",
    accessor: (p) => p.active_phase || "",
    render: (p) => <span className="text-[11px] text-[var(--tx2)] capitalize">{p.active_phase?.replace("_", " ") || "—"}</span>,
  },
  {
    id: "budget",
    label: "Budget",
    accessor: (p) => p.estimated_budget ?? 0,
    render: (p) => (
      <div>
        <div className="text-[12px] font-medium text-[var(--tx)]">
          {p.estimated_budget ? formatCurrency(p.estimated_budget) : "—"}
        </div>
        {p.actual_cost ? (
          <div className="text-[10px] text-[var(--tx3)]">Spent: {formatCurrency(p.actual_cost)}</div>
        ) : null}
      </div>
    ),
    align: "right",
  },
  {
    id: "dates",
    label: "Dates",
    accessor: (p) => p.start_date || "",
    render: (p) => (
      <span className="text-[11px] text-[var(--tx3)]">
        {p.start_date ? new Date(p.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
        {p.target_end_date ? ` → ${new Date(p.target_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
      </span>
    ),
  },
];

export default function ProjectsListClient({ projects, partners }: { projects: Project[]; partners: Partner[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (partnerFilter !== "all" && p.partner_id !== partnerFilter) return false;
      return true;
    });
  }, [projects, statusFilter, partnerFilter]);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalBudget = projects.reduce((s, p) => s + (p.estimated_budget ?? 0), 0);

  return (
    <div className="px-4 sm:px-6 py-5">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">B2B Operations</p>
          <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">All Projects</h1>
        </div>
        <CreateButton href="/admin/projects/new" title="New Project" />
      </div>

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-6">
        <KpiCard label="Total Projects" value={String(projects.length)} sub={`${activeProjects} active`} />
        <KpiCard label="Active" value={String(activeProjects)} sub="in progress" accent={activeProjects > 0} />
        <KpiCard label="Total Budget" value={totalBudget > 0 ? `$${(totalBudget / 1000).toFixed(0)}K` : "—"} sub="estimated" />
      </div>


      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-0.5 overflow-x-auto">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-[var(--card)] text-[var(--gold)] shadow-sm"
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

      {/* Table */}
      <DataTable<Project>
        data={filtered}
        columns={projectColumns}
        keyField="id"
        tableId="projects-list"
        searchable
        searchPlaceholder="Search by project #, name, partner…"
        pagination
        exportable
        exportFilename="yugo-projects"
        columnToggle
        onRowClick={(p) => router.push(`/admin/projects/${p.id}`)}
        emptyMessage={projects.length === 0 ? "No projects yet. Create your first project to get started." : "No projects match your filters."}
      />
    </div>
  );
}
