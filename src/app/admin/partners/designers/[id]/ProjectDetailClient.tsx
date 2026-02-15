"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "../projectsData";
import ViewDesignerModal from "./ViewDesignerModal";

const STATUS_COLORS: Record<string, string> = {
  done: "text-[var(--grn)]",
  transit: "text-[var(--org)]",
  wait: "text-[var(--gold)]",
  late: "text-[var(--red)]",
};

function AnimatedProgressBar({ percent }: { percent: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(percent), 50);
    return () => clearTimeout(t);
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

export default function ProjectDetailClient({ project }: { project: Project }) {
  const [designerModalOpen, setDesignerModalOpen] = useState(false);
  const doneCount = project.vendors.filter((v) => v.status === "done").length;
  const lateCount = project.vendors.filter((v) => v.status === "late").length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5 animate-fade-up">
      {/* Back link */}
      <Link
        href="/admin/partners/designers"
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Designer Dashboard
      </Link>

      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{project.name}</h1>
            <div className="text-[12px] text-[var(--tx3)] mt-1">
              {project.designer} • {project.address}
            </div>
            <div className="text-[11px] text-[var(--gold)] font-semibold mt-1">
              Install: {project.installDate}
              {project.budget && ` • Quote: ${project.budget}`}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDesignerModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              View designer
            </button>
            <Link
              href="/admin/deliveries/new"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
            >
              + New delivery
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Link
          href="/admin/partners/designers"
          className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block"
        >
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Vendors</div>
          <div className="text-xl font-bold font-heading">{project.vendors.length}</div>
        </Link>
        <Link
          href="/admin/partners/designers"
          className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block"
        >
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Completed</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{doneCount}</div>
        </Link>
        <Link
          href="/admin/partners/designers"
          className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block"
        >
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Late</div>
          <div className="text-xl font-bold font-heading text-[var(--red)]">{lateCount}</div>
        </Link>
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Project progress</h3>
        <div className="flex items-center gap-3">
          <AnimatedProgressBar percent={project.percent} />
          <span className="text-[13px] font-bold text-[var(--gold)] shrink-0">{project.percent}%</span>
        </div>
      </div>

      {/* Vendor table */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Vendor line items</h3>
          <Link
            href="/admin/deliveries"
            className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
          >
            View all deliveries →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Vendor", "Items", "Status", "ETA", "Notes"].map((h) => (
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
                    <span className={`text-[10px] font-semibold capitalize ${STATUS_COLORS[v.status]}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-[var(--tx3)]">{v.eta}</td>
                  <td className="px-4 py-2.5 text-[10px] text-[var(--tx3)]">{v.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ViewDesignerModal
        open={designerModalOpen}
        onClose={() => setDesignerModalOpen(false)}
        designer={{
          name: project.designer,
          company: project.designerCompany,
          email: project.designerEmail,
          phone: project.designerPhone,
        }}
      />
    </div>
  );
}
