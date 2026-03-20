"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import CreateDeliveryDropdown from "../../components/CreateDeliveryDropdown";
import Badge from "../../components/Badge";
import EditProjectModal, { type GalleryProject } from "./EditProjectModal";
import CreateGalleryProjectModal from "./CreateGalleryProjectModal";
import { toTitleCase } from "@/lib/format-text";
import { MagnifyingGlass, CaretDown, CaretRight } from "@phosphor-icons/react";

interface GalleryPartner {
  id: string;
  name: string | null;
  contact_name?: string | null;
  email?: string | null;
}

function formatDateShort(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GalleryClient({ galleryPartners = [] }: { galleryPartners?: GalleryPartner[] }) {
  const [projects, setProjects] = useState<GalleryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [projectDetail, setProjectDetail] = useState<GalleryProject | null>(null);
  const [editingProject, setEditingProject] = useState<GalleryProject | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "partners">("projects");
  const [search, setSearch] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("all");

  const fetchProjects = () => {
    setLoading(true);
    fetch("/api/gallery/projects")
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setProjects(data) : setProjects([])))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (selectedPartner !== "all") {
      const partner = galleryPartners.find((g) => g.id === selectedPartner);
      if (partner?.name) result = result.filter((p) => p.gallery === partner.name);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.gallery || "").toLowerCase().includes(q) ||
        (p.location || "").toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [projects, selectedPartner, search, galleryPartners]);

  const tabs = [
    { key: "projects" as const, label: `Projects (${projects.length})` },
    { key: "partners" as const, label: `Partners (${galleryPartners.length})` },
  ];

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  if (loading) {
    return <div className="py-8 text-center text-[12px] text-[var(--tx3)]">Loading projects…</div>;
  }

  return (
    <>
      {/* Tabs + Action Buttons */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex gap-6 border-b border-[var(--brd)]/40 -mb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-1 py-3 text-[12px] font-semibold transition-colors touch-manipulation border-b-2 -mb-px ${
                activeTab === t.key
                  ? "text-[var(--gold)] border-[var(--gold)]"
                  : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CreateDeliveryDropdown
            type="gallery"
            createProjectOnClick={() => setCreatingProject(true)}
            addPartnerHref="/admin/clients/new?type=partner&partnerType=gallery"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-6 border-t border-[var(--brd)]/30">

        {/* ── Projects Tab ── */}
        {activeTab === "projects" && (
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Projects</div>

            {/* Search + filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pb-4 mb-4 border-b border-[var(--brd)]/30">
              <div className="relative flex-1">
                <MagnifyingGlass size={15} weight="regular" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--tx3)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors"
                />
              </div>
              <select
                value={selectedPartner}
                onChange={(e) => setSelectedPartner(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors min-w-[160px]"
              >
                <option value="all">All Partners</option>
                {galleryPartners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Project rows */}
            <div className="divide-y divide-[var(--brd)]/30">
              {filteredProjects.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[12px] text-[var(--tx3)] mb-2">
                    {search || selectedPartner !== "all" ? "No projects match your filter." : "No gallery projects yet."}
                  </p>
                  {!search && selectedPartner === "all" && (
                    <button
                      type="button"
                      onClick={() => setCreatingProject(true)}
                      className="text-[12px] font-semibold text-[var(--gold)] hover:underline"
                    >
                      Create your first gallery project →
                    </button>
                  )}
                </div>
              ) : filteredProjects.map((p) => {
                const isExpanded = expandedIds.has(p.id);
                const isExhibition = p.project_type === "exhibition" || (!p.project_type && p.status !== "delivered");
                const start = p.start_date ? formatDateShort(p.start_date) : null;
                const end = p.end_date ? formatDateShort(p.end_date) : null;
                const dates = start && end ? `${start} – ${end}` : start || end || null;
                const subtitle = [
                  p.gallery,
                  isExhibition ? p.location : (p.address || p.location),
                  dates,
                ].filter(Boolean).join(" · ") || "—";

                return (
                  <div key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg)]/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[var(--tx)] truncate">{p.name}</span>
                          {p.project_type && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg)] text-[var(--tx3)] flex-shrink-0">
                              {toTitleCase(p.project_type)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">{subtitle}</div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <Badge status={p.status} />
                        <CaretDown
                          size={14}
                          weight="regular"
                          className={`text-[var(--tx3)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-[var(--brd)]/20">
                        {p.details && (
                          <p className="text-[11px] text-[var(--tx2)] mt-3 leading-relaxed">{p.details}</p>
                        )}
                        <div className="flex items-center gap-4 mt-3">
                          {p.start_date && (
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-0.5">Dates</div>
                              <div className="text-[11px] text-[var(--tx)]">{formatDate(p.start_date)}{p.end_date ? ` – ${formatDate(p.end_date)}` : ""}</div>
                            </div>
                          )}
                          {p.insurance_value && (
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-0.5">Estimate</div>
                              <div className="text-[11px] font-semibold text-[var(--gold)]">{p.insurance_value}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            onClick={() => setProjectDetail(p)}
                            className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            View details →
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingProject(p); setProjectDetail(null); }}
                            className="text-[10px] font-semibold text-[var(--tx2)] hover:underline"
                          >
                            Edit project
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Partners Tab ── */}
        {activeTab === "partners" && (
          <div>
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">Partners</div>
            <div className="divide-y divide-[var(--brd)]/30">
              {galleryPartners.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[13px] text-[var(--tx3)]">No gallery partners yet.</p>
                  <Link
                    href="/admin/clients/new?type=partner&partnerType=gallery"
                    className="text-[12px] font-semibold text-[var(--gold)] hover:underline mt-1 inline-block"
                  >
                    Add your first partner
                  </Link>
                </div>
              ) : galleryPartners.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/clients/${p.id}?from=gallery`}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#4A7CE5]/10 flex items-center justify-center text-[12px] font-bold text-[#4A7CE5]">
                    {(p.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--tx)]">{p.name}</div>
                    <div className="text-[11px] text-[var(--tx3)]">{[p.contact_name, p.email].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <CaretRight size={14} weight="regular" className="text-[var(--tx3)]" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project detail modal */}
      {projectDetail && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProjectDetail(null)} aria-hidden="true" />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">Project details</h3>
              <button type="button" onClick={() => setProjectDetail(null)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Name</div>
                <div className="text-[var(--tx)] font-semibold">{projectDetail.name}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Gallery</div>
                <div className="text-[var(--tx)]">{projectDetail.gallery || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Type</div>
                <div className="text-[var(--tx)]">{toTitleCase(projectDetail.project_type || "—")}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Address</div>
                <div className="text-[var(--tx)]">{projectDetail.address || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Location</div>
                <div className="text-[var(--tx)]">{projectDetail.location || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Dates</div>
                <div className="text-[var(--tx)]">{formatDate(projectDetail.start_date)} – {formatDate(projectDetail.end_date)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Estimate</div>
                <div className="text-[var(--gold)] font-semibold">{projectDetail.insurance_value || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Status</div>
                <Badge status={projectDetail.status} />
              </div>
              {(projectDetail.white_glove || projectDetail.crating_required || projectDetail.climate_controlled) && (
                <div>
                  <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Handling</div>
                  <div className="text-[var(--tx2)]">
                    {[
                      projectDetail.white_glove && "White-glove",
                      projectDetail.crating_required && "Crating",
                      projectDetail.climate_controlled && "Climate-controlled",
                    ].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-0.5">Details</div>
                <p className="text-[var(--tx2)] leading-relaxed">{projectDetail.details || "—"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEditingProject(projectDetail); setProjectDetail(null); }}
              className="mt-4 w-full py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
            >
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

      <CreateGalleryProjectModal
        open={creatingProject}
        onClose={() => setCreatingProject(false)}
        galleryPartners={galleryPartners}
        onCreated={fetchProjects}
      />
    </>
  );
}
