"use client";

import Link from "next/link";
import BackButton from "../../components/BackButton";
import { StatPctChange } from "../../components/StatPctChange";
import { PROJECTS } from "./projectsData";
import { mergeProjectsWithSavedState } from "./designerProjectsStorage";

export default function DesignerDashboard({
  orgs,
  deliveries,
}: {
  orgs: any[];
  deliveries: any[];
}) {
  const allProjects = mergeProjectsWithSavedState(PROJECTS);
  const activeProjects = allProjects.filter((p) => p.percent > 0 && p.percent < 100);
  const delayedCount = allProjects.reduce((sum, p) => sum + p.vendors.filter((v) => v.status === "late").length, 0);
  const revenue = 10800;
  const revenuePrev = 8200;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading">{allProjects.length}</span>
            <StatPctChange current={allProjects.length} previous={3} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Active</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">{activeProjects.length}</span>
            <StatPctChange current={activeProjects.length} previous={2} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Delayed</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--red)]">{delayedCount}</span>
            <StatPctChange current={delayedCount} previous={1} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">${(revenue / 1000).toFixed(1)}K</span>
            <StatPctChange current={revenue} previous={revenuePrev} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <Link href="/admin/deliveries/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all whitespace-nowrap">
          Create Project
        </Link>
        <Link href="/admin/clients/new?type=partner&partnerType=designer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap">
          Add Partner
        </Link>
      </div>

      {/* Active Projects - only show active (ongoing) */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[14px] font-bold text-[var(--tx)]">Active Projects</h3>
          <Link href="/admin/partners/designers/projects" className="text-[11px] font-semibold text-[var(--gold)] hover:underline">
            View all projects →
          </Link>
        </div>
        <div className="divide-y divide-[var(--brd)]">
          {activeProjects.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
              No active projects. <Link href="/admin/partners/designers/projects" className="text-[var(--gold)] hover:underline">View all</Link>
            </div>
          ) : activeProjects.map((project) => {
            const doneCount = project.vendors.filter((v) => v.status === "done").length;
            const lateCount = project.vendors.filter((v) => v.status === "late").length;
            const summary = `${doneCount}/${project.vendors.length} delivered${lateCount > 0 ? ` · ${lateCount} delayed` : ""}`;
            return (
              <Link
                key={project.id}
                href={`/admin/partners/designers/${project.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg)]/30 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-heading text-[13px] font-bold text-[var(--tx)] truncate">{project.name}</h4>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">
                    {project.designerCompany || project.designer} · {project.address} · Install {project.installDate}
                  </div>
                  <div className="text-[10px] text-[var(--tx2)] mt-1">{summary}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-bold text-[var(--gold)]">{project.percent}%</span>
                  <span className="text-[10px] font-medium text-[var(--gold)] group-hover:underline">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Designers - partner list */}
      <div>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Designers</h3>
        <div className="space-y-2">
          {orgs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No designers yet. <Link href="/admin/clients/new?type=partner&partnerType=designer" className="text-[var(--gold)] hover:underline">Add one</Link>
            </div>
          ) : orgs.map((c: { id: string; name?: string | null; contact_name?: string | null; email?: string | null; deliveries_per_month?: number }) => {
            const designerDeliveries = deliveries.filter((d: { client_name?: string }) => (d as { client_name?: string }).client_name === c.name);
            const avgDel = c.deliveries_per_month ?? (designerDeliveries.length || 0);
            return (
              <Link
                key={c.id}
                href={`/admin/clients/${c.id}?from=designers`}
                className="block bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-semibold">{c.name}</div>
                    <div className="text-[10px] text-[var(--tx3)]">{[c.contact_name, c.email].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-[var(--tx2)]">{avgDel} avg/mo</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
