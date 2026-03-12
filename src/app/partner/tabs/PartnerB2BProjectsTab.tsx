"use client";

import { useState, useEffect, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Phase {
  id: string;
  phase_name: string;
  phase_order: number;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
}

interface ProjectSummary {
  id: string;
  project_number: string;
  project_name: string;
  description: string | null;
  end_client_name: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  target_end_date: string | null;
  estimated_budget: number | null;
  phases: Phase[];
  itemsTotal: number;
  itemsReceived: number;
  phasesTotal: number;
  phasesCompleted: number;
  nextDeliveryDate: string | null;
}

interface ProjectDetail {
  id: string;
  project_number: string;
  project_name: string;
  description: string | null;
  end_client_name: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  target_end_date: string | null;
  estimated_budget: number | null;
  phases: Phase[];
  inventory: InventoryItem[];
  timeline: TimelineEntry[];
  deliveries: DeliveryLink[];
}

interface InventoryItem {
  id: string;
  phase_id: string | null;
  item_name: string;
  vendor: string | null;
  quantity: number;
  status: string;
  received_date: string | null;
  condition_on_receipt: string | null;
  photo_urls: string[] | null;
  storage_location: string | null;
}

interface TimelineEntry {
  id: string;
  event_type: string;
  event_description: string;
  phase_id: string | null;
  photos: string[] | null;
  created_at: string;
}

interface DeliveryLink {
  id: string;
  delivery_number: string | null;
  status: string;
  scheduled_date: string | null;
  time_slot: string | null;
  total_price: number | null;
  items: any;
  phase_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--tx3)]/10 text-[var(--tx3)]",
  proposed: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  on_hold: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  invoiced: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const PHASE_STATUS_ICONS: Record<string, { color: string; label: string }> = {
  pending: { color: "#888", label: "Pending" },
  active: { color: "#D48A29", label: "In Progress" },
  completed: { color: "#2D9F5A", label: "Completed" },
  skipped: { color: "#aaa", label: "Skipped" },
};

const INV_STATUS_COLORS: Record<string, string> = {
  expected: "text-[#888]",
  received: "text-blue-500",
  inspected: "text-blue-600",
  stored: "text-purple-500",
  scheduled_for_delivery: "text-amber-500",
  delivered: "text-emerald-500",
  installed: "text-emerald-600",
};

export default function PartnerB2BProjectsTab() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeView, setActiveView] = useState<"phases" | "inventory" | "deliveries" | "timeline">("phases");

  // Note/issue form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note_added");

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/partner/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* graceful fail */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const viewProject = async (id: string) => {
    setLoadingDetail(true);
    setSelectedProject(null);
    try {
      const res = await fetch(`/api/partner/projects/${id}`);
      if (res.ok) setSelectedProject(await res.json());
    } catch { /* graceful fail */ }
    setLoadingDetail(false);
  };

  const addNote = async () => {
    if (!selectedProject || !noteText.trim()) return;
    await fetch(`/api/partner/projects/${selectedProject.id}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: noteType, event_description: noteText }),
    });
    setNoteText("");
    setShowNoteForm(false);
    viewProject(selectedProject.id);
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="animate-pulse h-32 bg-[var(--brd)]/30 rounded-xl" />)}</div>;
  }

  // Detail view
  if (selectedProject) {
    const p = selectedProject;
    const completedPhases = p.phases.filter((ph) => ph.status === "completed").length;
    const pct = p.phases.length > 0 ? Math.round((completedPhases / p.phases.length) * 100) : 0;
    const receivedItems = p.inventory.filter((i) => i.status !== "expected").length;

    return (
      <div>
        {/* Back button */}
        <button onClick={() => setSelectedProject(null)} className="flex items-center gap-1 text-[12px] text-[var(--tx3)] hover:text-[var(--gold)] mb-4 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
          Back to Projects
        </button>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold text-[var(--gold)]">{p.project_number}</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize ${STATUS_COLORS[p.status] || ""}`}>{p.status.replace("_", " ")}</span>
          </div>
          <h2 className="text-[20px] font-bold text-[var(--tx)] font-hero">{p.project_name}</h2>
          {p.site_address && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{p.site_address}</p>}
        </div>

        {/* Progress */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-5">
          <div className="flex justify-between text-[11px] text-[var(--tx3)] mb-2">
            <span>{receivedItems} of {p.inventory.length} items received</span>
            <span>{completedPhases} of {p.phases.length} phases</span>
          </div>
          <div className="relative h-2.5 bg-[var(--bg)] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[#2D9F5A] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-right text-[11px] font-semibold text-[var(--tx)] mt-1">{pct}%</div>
        </div>

        {/* View tabs */}
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-[var(--brd)]/30 mb-4">
          {(["phases", "inventory", "deliveries", "timeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`flex-shrink-0 px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px capitalize ${
                activeView === v ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Phases View */}
        {activeView === "phases" && (
          <div className="space-y-3">
            {p.phases.map((phase) => {
              const cfg = PHASE_STATUS_ICONS[phase.status] || PHASE_STATUS_ICONS.pending;
              const phaseItems = p.inventory.filter((i) => i.phase_id === phase.id);
              const phaseReceived = phaseItems.filter((i) => i.status !== "expected").length;
              return (
                <div key={phase.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cfg.color}20` }}>
                      {phase.status === "completed" ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                      )}
                    </div>
                    <span className="text-[13px] font-semibold text-[var(--tx)]">{phase.phase_name}</span>
                    <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--tx3)]">
                    {phase.scheduled_date && <span>Target: {new Date(phase.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                    {phaseItems.length > 0 && <span>{phaseReceived}/{phaseItems.length} items received</span>}
                    {phase.completed_date && <span className="text-[#2D9F5A]">Completed {new Date(phase.completed_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Inventory View */}
        {activeView === "inventory" && (
          <div className="space-y-2">
            {p.inventory.length === 0 ? (
              <div className="text-center py-8 text-[var(--tx3)] text-[13px]">No items tracked yet</div>
            ) : p.inventory.map((item) => {
              const phase = p.phases.find((ph) => ph.id === item.phase_id);
              return (
                <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-[var(--card)] border border-[var(--brd)] rounded-xl">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--tx)]">{item.item_name}</div>
                    <div className="text-[11px] text-[var(--tx3)]">
                      {item.vendor || "No vendor"}{phase ? ` · ${phase.phase_name}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[10px] font-semibold capitalize ${INV_STATUS_COLORS[item.status] || "text-[#888]"}`}>{item.status.replace(/_/g, " ")}</div>
                    {item.received_date && <div className="text-[10px] text-[var(--tx3)]">{new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Deliveries View */}
        {activeView === "deliveries" && (
          <div className="space-y-2">
            {p.deliveries.length === 0 ? (
              <div className="text-center py-8 text-[var(--tx3)] text-[13px]">No deliveries scheduled yet</div>
            ) : p.deliveries.map((d) => {
              const phase = p.phases.find((ph) => ph.id === d.phase_id);
              return (
                <div key={d.id} className="flex items-center justify-between py-3 px-4 bg-[var(--card)] border border-[var(--brd)] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 13.52 9H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--tx)]">{d.delivery_number || "Delivery"}</div>
                      <div className="text-[11px] text-[var(--tx3)]">
                        {d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                        {phase ? ` · ${phase.phase_name}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold capitalize text-[var(--tx3)]">{d.status}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline View */}
        {activeView === "timeline" && (
          <div>
            {/* Add note/issue */}
            <div className="flex gap-2 mb-4">
              <button onClick={() => { setShowNoteForm(!showNoteForm); setNoteType("note_added"); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]">
                + Add Note
              </button>
              <button onClick={() => { setShowNoteForm(!showNoteForm); setNoteType("issue_flagged"); }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20">
                Flag Issue
              </button>
            </div>

            {showNoteForm && (
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 space-y-3">
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={noteType === "issue_flagged" ? "Describe the issue..." : "Add a note..."} rows={3} className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={addNote} className={`px-4 py-2 rounded-lg text-[11px] font-semibold text-white ${noteType === "issue_flagged" ? "bg-red-500" : "bg-[#2D6A4F]"}`}>{noteType === "issue_flagged" ? "Submit Issue" : "Add Note"}</button>
                  <button onClick={() => setShowNoteForm(false)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-0">
              {p.timeline.map((e) => (
                <div key={e.id} className="flex gap-3 py-3 border-b border-[var(--brd)]/30 last:border-0">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{
                    backgroundColor: e.event_type === "issue_flagged" ? "#D14343" : e.event_type.includes("completed") ? "#2D9F5A" : "#C9A962"
                  }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[var(--tx)]">{e.event_description}</div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">{new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                </div>
              ))}
              {p.timeline.length === 0 && <div className="text-center py-8 text-[var(--tx3)] text-[13px]">No activity yet</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Projects list
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect width="6" height="4" x="9" y="3" rx="1" /></svg>
        </div>
        <p className="text-[14px] text-[var(--tx3)]">No active projects</p>
        <p className="text-[12px] text-[var(--tx3)]/60 mt-1">Projects will appear here when your account manager creates one</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const pct = p.phasesTotal > 0 ? Math.round((p.phasesCompleted / p.phasesTotal) * 100) : 0;
        return (
          <button
            key={p.id}
            onClick={() => viewProject(p.id)}
            className="w-full text-left bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 hover:border-[var(--gold)]/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-semibold text-[var(--gold)]">{p.project_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize ${STATUS_COLORS[p.status] || ""}`}>{p.status.replace("_", " ")}</span>
                </div>
                <h3 className="text-[16px] font-bold text-[var(--tx)]">{p.project_name}</h3>
                {p.site_address && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{p.site_address}</p>}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </div>

            <div className="relative h-2 bg-[var(--bg)] rounded-full overflow-hidden mb-2">
              <div className="absolute inset-y-0 left-0 bg-[#2D9F5A] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] text-[var(--tx3)]">
              <span>{p.itemsReceived} of {p.itemsTotal} items received</span>
              <span>·</span>
              <span>{p.phasesCompleted} of {p.phasesTotal} phases done</span>
              {p.nextDeliveryDate && (
                <>
                  <span>·</span>
                  <span>Next delivery: {new Date(p.nextDeliveryDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </>
              )}
            </div>
          </button>
        );
      })}
      {loadingDetail && <div className="text-center py-4 text-[var(--tx3)] text-[12px]">Loading project...</div>}
    </div>
  );
}
