"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { Project, ProjectVendor } from "../projectsData";
import { mergeWithSavedState, saveProjectState } from "../designerProjectsStorage";
import BackButton from "../../../components/BackButton";
import ViewDesignerModal from "./ViewDesignerModal";
import EditProjectModal from "./EditProjectModal";

const STATUS_OPTIONS: { value: ProjectVendor["status"]; label: string }[] = [
  { value: "wait", label: "Awaiting Shipment" },
  { value: "transit", label: "In Transit" },
  { value: "done", label: "Delivered" },
  { value: "late", label: "Delayed" },
];
const STATUS_COLORS: Record<string, string> = {
  done: "text-[var(--grn)]",
  transit: "text-[var(--org)]",
  wait: "text-[var(--tx3)]",
  late: "text-[var(--red)]",
};

function calcPercent(vendors: ProjectVendor[]): number {
  if (vendors.length === 0) return 0;
  const done = vendors.filter((v) => v.status === "done").length;
  return Math.round((done / vendors.length) * 100);
}

function AnimatedProgressBar({ percent }: { percent: number }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(percent), 50);
    return () => clearTimeout(t);
  }, [percent]);
  return (
    <div className="flex-1 min-w-0 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--gold)] rounded-full transition-all duration-300 ease-out"
        style={{ width: `${animated}%` }}
      />
    </div>
  );
}

export default function ProjectDetailClient({ project: initialProject }: { project: Project }) {
  const [project, setProject] = useState<Project>(() => mergeWithSavedState(initialProject));
  const [designerModalOpen, setDesignerModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    setProject(mergeWithSavedState(initialProject));
  }, [initialProject]);

  const persistProject = useCallback((p: Project) => {
    saveProjectState(p.id, p.vendors, p.percent);
  }, []);

  const updateVendorStatus = useCallback((index: number, status: ProjectVendor["status"]) => {
    setProject((prev) => {
      const vendors = [...prev.vendors];
      vendors[index] = { ...vendors[index], status };
      const percent = calcPercent(vendors);
      const next = { ...prev, vendors, percent };
      persistProject(next);
      return next;
    });
  }, [persistProject]);

  const markComplete = useCallback(() => {
    setProject((prev) => {
      const next = {
        ...prev,
        percent: 100,
        vendors: prev.vendors.map((v) => ({ ...v, status: "done" as const })),
      };
      persistProject(next);
      return next;
    });
  }, [persistProject]);

  const completeAllLines = useCallback(() => {
    setProject((prev) => {
      const next = {
        ...prev,
        vendors: prev.vendors.map((v) => ({ ...v, status: "done" as const })),
        percent: 100,
      };
      persistProject(next);
      return next;
    });
  }, [persistProject]);

  const onProjectSaved = useCallback((updated: Partial<Project>) => {
    setProject((prev) => {
      const next = { ...prev, ...updated };
      if (next.vendors) persistProject(next);
      return next;
    });
  }, [persistProject]);

  const doneCount = project.vendors.filter((v) => v.status === "done").length;
  const lateCount = project.vendors.filter((v) => v.status === "late").length;
  const isComplete = project.percent === 100;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5 animate-fade-up">
      <div className="mb-2"><BackButton label="Designers" href="/admin/partners/designers" /></div>

      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{project.name}</h1>
            <div className="text-[12px] text-[var(--tx3)] mt-1">
              {project.designer} · {project.address}
            </div>
            <div className="text-[11px] text-[var(--gold)] font-semibold mt-1">
              Install: {project.installDate}
              {project.budget && ` · Quote: ${project.budget}`}
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
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              Edit project
            </button>
            <Link
              href="/admin/deliveries/new"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all"
            >
              + New delivery
            </Link>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Line items</div>
          <div className="text-xl font-bold font-heading">{project.vendors.length}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Completed</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{doneCount}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Delayed</div>
          <div className="text-xl font-bold font-heading text-[var(--red)]">{lateCount}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</div>
          <div className={`text-xl font-bold font-heading ${isComplete ? "text-[var(--grn)]" : "text-[var(--gold)]"}`}>
            {isComplete ? "Complete" : "In progress"}
          </div>
        </div>
      </div>

      {/* Actions: Mark complete / Complete all lines */}
      <div className="flex flex-wrap gap-2">
        {!isComplete && (
          <>
            <button
              type="button"
              onClick={markComplete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--grn)] text-white hover:opacity-90 transition-all"
            >
              Mark project complete
            </button>
            {doneCount < project.vendors.length && (
              <button
                type="button"
                onClick={completeAllLines}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
              >
                Complete all lines
              </button>
            )}
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Project progress</h3>
        <div className="flex items-center gap-3">
          <AnimatedProgressBar percent={project.percent} />
          <span className={`text-[13px] font-bold shrink-0 ${isComplete ? "text-[var(--grn)]" : "text-[var(--gold)]"}`}>
            {project.percent}%
          </span>
        </div>
      </div>

      {/* Line items table with editable status */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Line items</h3>
          <Link href="/admin/deliveries" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
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
                    <select
                      value={v.status}
                      onChange={(e) => updateVendorStatus(i, e.target.value as ProjectVendor["status"])}
                      className={`text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] rounded px-2 py-1 cursor-pointer focus:border-[var(--gold)] outline-none ${STATUS_COLORS[v.status]}`}
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
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

      <EditProjectModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        project={project}
        onSaved={onProjectSaved}
      />
    </div>
  );
}
