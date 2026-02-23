"use client";

import { useState, useEffect } from "react";
import Badge from "../../components/Badge";
import EditProjectModal, { type GalleryProject } from "./EditProjectModal";

interface GalleryPartner {
  id: string;
  name: string | null;
  contact_name?: string | null;
  email?: string | null;
}

function getProgressBarColor(onTrack: boolean, atRisk: boolean, behind: boolean): string {
  if (onTrack) return "bg-[var(--grn)]";
  if (atRisk) return "bg-[var(--org)]";
  return "bg-[var(--red)]";
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GalleryClient({ galleryPartners = [] }: { galleryPartners?: GalleryPartner[] }) {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEx, setExpandedEx] = useState<Set<string>>(new Set());
  const [expandedTrans, setExpandedTrans] = useState<Set<string>>(new Set());
  const [projectDetail, setProjectDetail] = useState<GalleryProject | null>(null);
  const [editingProject, setEditingProject] = useState<GalleryProject | null>(null);

  const fetchProjects = () => {
    setLoading(true);
    fetch("/api/gallery/projects")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setProjects(data) : setProjects([])))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const exhibitions = projects.filter((p) => p.project_type === "exhibition" || (!p.project_type && p.status !== "delivered"));
  const transports = projects.filter((p) => ["delivery", "install", "storage_retrieval", "art_fair", "other"].includes(p.project_type || ""));

  const toggleEx = (id: string) => {
    setExpandedEx((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTrans = (id: string) => {
    setExpandedTrans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = (p: GalleryProject) => {
    setProjectDetail(p);
  };

  const openEdit = (p: GalleryProject) => {
    setEditingProject(p);
    setProjectDetail(null);
  };

  if (loading) {
    return (
      <div className="mb-6 py-8 text-center text-[12px] text-[var(--tx3)]">Loading projects…</div>
    );
  }

  const allProjects = [...exhibitions, ...transports];

  return (
    <>
      {/* Projects - consolidated exhibitions & transports */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mb-6">
        <div className="p-4 space-y-2">
          {allProjects.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[var(--tx3)]">
              No projects yet
            </div>
          ) : allProjects.map((ex) => {
            const isExhibition = exhibitions.some((e) => e.id === ex.id);
            const isExpanded = isExhibition ? expandedEx.has(ex.id) : expandedTrans.has(ex.id);
            const toggle = isExhibition ? () => toggleEx(ex.id) : () => toggleTrans(ex.id);
            const start = ex.start_date ? new Date(ex.start_date) : null;
            const end = ex.end_date ? new Date(ex.end_date) : null;
            const dates = start && end ? `${formatDateShort(ex.start_date)} – ${formatDateShort(ex.end_date)}` : "—";
            const subtitle = isExhibition
              ? `${ex.gallery || "—"} • ${ex.location || "—"} • ${dates}`
              : `${ex.gallery || "—"} • ${ex.address || ex.location || "—"} • ${ex.insurance_value || "—"}`;
            return (
              <div key={ex.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden hover:border-[var(--gold)] transition-all">
                <button type="button" onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  {!isExhibition && (
                    <div className="w-10 h-10 rounded-lg bg-[var(--gdim)] flex items-center justify-center text-[var(--gold)] shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 9h18M9 21V9" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[var(--tx)]">{ex.name}</div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">{subtitle}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {!isExhibition && ex.start_date && <div className="text-[10px] text-[var(--tx3)]">{formatDateShort(ex.start_date)}</div>}
                    <Badge status={ex.status} />
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-[var(--brd)]">
                    <div className="text-[11px] text-[var(--tx2)] mt-3 leading-relaxed">{ex.details || "—"}</div>
                    <button type="button" onClick={() => openDetail(ex)} className="inline-block mt-2 text-[10px] font-semibold text-[var(--gold)] hover:underline mr-3">View details →</button>
                    <button type="button" onClick={() => openEdit(ex)} className="inline-block mt-2 text-[10px] font-semibold text-[var(--tx2)] hover:underline">Edit project</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Project detail modal */}
      {projectDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProjectDetail(null)} aria-hidden="true" />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">Project details</h3>
              <button type="button" onClick={() => setProjectDetail(null)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Name</div>
                <div className="text-[var(--tx)] font-semibold">{projectDetail.name}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Gallery</div>
                <div className="text-[var(--tx)]">{projectDetail.gallery || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Type</div>
                <div className="text-[var(--tx)]">{(projectDetail.project_type || "—").replace(/_/g, " ")}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Address</div>
                <div className="text-[var(--tx)]">{projectDetail.address || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Location</div>
                <div className="text-[var(--tx)]">{projectDetail.location || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Dates</div>
                <div className="text-[var(--tx)]">{projectDetail.start_date ? formatDate(projectDetail.start_date) : "—"} – {projectDetail.end_date ? formatDate(projectDetail.end_date) : "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Estimate</div>
                <div className="text-[var(--gold)] font-semibold">{projectDetail.insurance_value || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Status</div>
                <Badge status={projectDetail.status} />
              </div>
              {(projectDetail.white_glove || projectDetail.crating_required || projectDetail.climate_controlled) && (
                <div>
                  <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Handling</div>
                  <div className="text-[var(--tx2)]">
                    {[projectDetail.white_glove && "White-glove", projectDetail.crating_required && "Crating", projectDetail.climate_controlled && "Climate-controlled"].filter(Boolean).join(" • ") || "—"}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Details</div>
                <p className="text-[var(--tx2)] leading-relaxed">{projectDetail.details || "—"}</p>
              </div>
            </div>
            <button type="button" onClick={() => openEdit(projectDetail)} className="mt-4 w-full py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]">
              Edit project
            </button>
          </div>
        </div>
      )}

      <EditProjectModal
        open={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
        galleryPartners={galleryPartners}
        onSaved={fetchProjects}
      />
    </>
  );
}
