"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Project } from "../projectsData";
import { mergeProjectsWithSavedState } from "../designerProjectsStorage";

type Tab = "all" | "active" | "completed";

export default function ViewAllProjectsClient({ projects }: { projects: Project[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const projectsWithSaved = useMemo(() => mergeProjectsWithSavedState(projects), [projects]);

  const active = projectsWithSaved.filter((p) => p.percent > 0 && p.percent < 100);
  const completed = projectsWithSaved.filter((p) => p.percent === 100);

  const list = tab === "all" ? projectsWithSaved : tab === "active" ? active : completed;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: projectsWithSaved.length },
    { key: "active", label: "Active", count: active.length },
    { key: "completed", label: "Completed", count: completed.length },
  ];

  return (
    <>
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              tab === t.key ? "bg-[var(--gold)] text-white" : "bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="divide-y divide-[var(--brd)]">
          {list.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">No projects</div>
          ) : list.map((project) => {
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
                  <span className={`text-[11px] font-bold ${project.percent === 100 ? "text-[var(--grn)]" : "text-[var(--gold)]"}`}>
                    {project.percent}%
                  </span>
                  <span className="text-[10px] font-medium text-[var(--gold)] group-hover:underline">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
