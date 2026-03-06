"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";

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

export default function ProjectsListClient({ projects, partners }: { projects: Project[]; partners: Partner[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (partnerFilter !== "all" && p.partner_id !== partnerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.project_number.toLowerCase().includes(q) ||
          p.project_name.toLowerCase().includes(q) ||
          (p.end_client_name || "").toLowerCase().includes(q) ||
          (p.organizations?.name || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, statusFilter, partnerFilter, search]);

  return (
    <div className="px-4 sm:px-6 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">Projects</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">{projects.length} project{projects.length !== 1 ? "s" : ""} across all partners</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New Project
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none w-[220px]"
        />
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
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--tx3)] text-[13px]">
          {projects.length === 0 ? "No projects yet. Create your first project to get started." : "No projects match your filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                {["PRJ #", "Partner", "Project Name", "Status", "Phase", "Budget", "Dates"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/projects/${p.id}`)}
                  className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3 text-[12px] font-semibold text-[var(--gold)]">{p.project_number}</td>
                  <td className="px-3 py-3">
                    <div className="text-[12px] font-medium text-[var(--tx)]">{p.organizations?.name || "—"}</div>
                    <div className="text-[10px] text-[var(--tx3)] capitalize">{p.organizations?.type || ""}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-[12px] font-semibold text-[var(--tx)]">{p.project_name}</div>
                    {p.end_client_name && <div className="text-[10px] text-[var(--tx3)]">{p.end_client_name}</div>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLORS[p.status] || ""}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[11px] text-[var(--tx2)] capitalize">{p.active_phase?.replace("_", " ") || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="text-[12px] font-medium text-[var(--tx)]">
                      {p.estimated_budget ? formatCurrency(p.estimated_budget) : "—"}
                    </div>
                    {p.actual_cost ? (
                      <div className="text-[10px] text-[var(--tx3)]">Spent: {formatCurrency(p.actual_cost)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-[11px] text-[var(--tx3)]">
                    {p.start_date ? new Date(p.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    {p.target_end_date ? ` → ${new Date(p.target_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
