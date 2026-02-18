"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { PROJECTS } from "./projectsData";

const STATUS_COLORS: Record<string, string> = {
  done: "text-[var(--grn)]",
  transit: "text-[var(--org)]",
  wait: "text-[var(--tx3)]",
  late: "text-[var(--red)]",
};
const VENDOR_STATUS_LABELS: Record<string, string> = {
  done: "Delivered",
  transit: "In Transit",
  wait: "Awaiting Shipment",
  late: "Delayed",
};

function AnimatedProgressBar({ percent }: { percent: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(percent), 50);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className="flex-1 min-w-0 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--gold)] rounded-full transition-all duration-1000 ease-out animate-progress-shimmer"
        style={{ width: `${animated}%` }}
      />
    </div>
  );
}

export default function DesignerDashboard({
  orgs,
  deliveries,
}: {
  orgs: any[];
  deliveries: any[];
}) {
  const projects = PROJECTS;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(projects.map((p) => p.id)));

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.percent > 0 && p.percent < 100).length;
  const vendorsLate = projects.reduce((sum, p) => sum + p.vendors.filter((v) => v.status === "late").length, 0);
  const revenue = "$10.8K";

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>
      {/* Stats cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Link href="/admin/partners/designers" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Projects</div>
          <div className="text-xl font-bold font-heading">{totalProjects}</div>
        </Link>
        <Link href="/admin/partners/designers" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Active</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{activeProjects}</div>
        </Link>
        <Link href="/admin/partners/designers" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Vendors Late</div>
          <div className="text-xl font-bold font-heading text-[var(--red)]">{vendorsLate}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{revenue}</div>
        </Link>
      </div>

      {/* Add Partner / View all clients - top right above first project card */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <Link href="/admin/clients" className="text-[10px] font-semibold text-[var(--gold)] hover:underline whitespace-nowrap">
          View all clients →
        </Link>
        <Link href="/admin/clients/new?type=partner&partnerType=designer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap">
          + Add Partner
        </Link>
      </div>

      {/* Project sections - collapsible cards */}
      <div className="space-y-6">
        {projects.map((project) => {
          const isExpanded = expandedIds.has(project.id);
          return (
            <div
              key={project.id}
              className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden hover:border-[var(--gold)] transition-all"
            >
              <div
                className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(project.id)}
              >
                <div>
                  <h3 className="font-heading text-[14px] font-bold text-[var(--tx)]">{project.name}</h3>
                  <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {project.designerCompany || project.designer} • {project.address} • Install: {project.installDate}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--gold)]">{project.percent}%</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </div>
              </div>
              {isExpanded && (
                <>
                  <div className="px-4 py-3 border-b border-[var(--brd)]">
                    <div className="flex items-center gap-3">
                      <AnimatedProgressBar percent={project.percent} />
                      <span className="text-[11px] font-bold text-[var(--gold)] shrink-0">{project.percent}%</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          {["Vendor", "Items", "Status", "ETA"].map((h) => (
                            <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {project.vendors.map((v, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[var(--brd)] last:border-0 ${i % 2 === 1 ? "bg-[var(--bg)]/30" : ""}`}
                          >
                            <td className="px-4 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{v.vendor}</td>
                            <td className="px-4 py-2.5 text-[11px] text-[var(--tx2)]">{v.items}</td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[10px] font-semibold ${STATUS_COLORS[v.status]}`}>
                                {VENDOR_STATUS_LABELS[v.status] ?? v.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[10px] text-[var(--tx3)]">{v.eta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-[var(--brd)]">
                    <Link
                      href={`/admin/partners/designers/${project.id}`}
                      className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                    >
                      View project details →
                    </Link>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
