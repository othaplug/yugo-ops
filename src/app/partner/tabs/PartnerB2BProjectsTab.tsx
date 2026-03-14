"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getTrackingUrl } from "@/lib/tracking-url";
import { Boxes, Truck, Plus, X } from "lucide-react";

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
  inspection_notes: string | null;
  photo_urls: string[] | null;
  storage_location: string | null;
  handled_by: "yugo" | "vendor_direct" | "other_carrier" | null;
  vendor_tracking_number: string | null;
  vendor_carrier: string | null;
  expected_delivery_date: string | null;
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

const HANDLER_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  yugo: { bg: "bg-[var(--gold)]/15", text: "text-[var(--gold)]", label: "YUGO" },
  vendor_direct: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", label: "VENDOR" },
  other_carrier: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", label: "CARRIER" },
};

const INV_STATUS_COLORS: Record<string, string> = {
  expected: "text-[#888]",
  shipped: "text-amber-500",
  received: "text-blue-500",
  inspected: "text-blue-600",
  stored: "text-purple-500",
  scheduled_for_delivery: "text-amber-500",
  delivered: "text-emerald-500",
  installed: "text-emerald-600",
};

interface PartnerB2BProjectsTabProps {
  onScheduleDelivery?: (suggestedItems?: string) => void;
}

export default function PartnerB2BProjectsTab({ onScheduleDelivery }: PartnerB2BProjectsTabProps = {}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeView, setActiveView] = useState<"phases" | "inventory" | "deliveries" | "timeline">("phases");

  // New project form
  const [showNewProject, setShowNewProject] = useState(false);
  const [npName, setNpName] = useState("");
  const [npClientName, setNpClientName] = useState("");
  const [npAddress, setNpAddress] = useState("");
  const [npPhone, setNpPhone] = useState("");
  const [npEmail, setNpEmail] = useState("");
  const [npDesc, setNpDesc] = useState("");
  const [npPhases, setNpPhases] = useState<string[]>(["receiving", "delivery"]);
  const [npStartDate, setNpStartDate] = useState("");
  const [npEndDate, setNpEndDate] = useState("");
  const [npBudget, setNpBudget] = useState("");
  const [npSaving, setNpSaving] = useState(false);
  const [npError, setNpError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{ place_name: string }[]>([]);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [aiName, setAiName] = useState("");
  const [aiVendor, setAiVendor] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [aiQty, setAiQty] = useState("1");
  const [aiValue, setAiValue] = useState("");
  const [aiDelivery, setAiDelivery] = useState("");
  const [aiHandledBy, setAiHandledBy] = useState<"yugo" | "vendor_direct" | "other_carrier">("yugo");
  const [aiCarrier, setAiCarrier] = useState("");
  const [aiTracking, setAiTracking] = useState("");
  const [aiPhaseId, setAiPhaseId] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState("");

  // Note/issue form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note_added");

  // Vendor item update form
  const [updateItemId, setUpdateItemId] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTracking, setUpdateTracking] = useState("");
  const [updateCarrier, setUpdateCarrier] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");

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

  const updateVendorItem = async () => {
    if (!selectedProject || !updateItemId) return;
    const payload: Record<string, unknown> = { item_id: updateItemId };
    if (updateStatus) payload.status = updateStatus;
    if (updateTracking !== undefined) payload.vendor_tracking_number = updateTracking || null;
    if (updateCarrier !== undefined) payload.vendor_carrier = updateCarrier || null;
    if (updateNotes !== undefined) payload.inspection_notes = updateNotes || null;
    if (updateStatus === "received" || updateStatus === "delivered") {
      const today = new Date().toISOString().slice(0, 10);
      payload.received_date = today;
      if (updateStatus === "delivered") payload.delivered_date = today;
    }
    await fetch(`/api/partner/projects/${selectedProject.id}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setUpdateItemId(null);
    setUpdateStatus("");
    setUpdateTracking("");
    setUpdateCarrier("");
    setUpdateNotes("");
    viewProject(selectedProject.id);
  };

  const openUpdateForm = (item: InventoryItem) => {
    setUpdateItemId(item.id);
    setUpdateStatus(item.status);
    setUpdateTracking(item.vendor_tracking_number || "");
    setUpdateCarrier(item.vendor_carrier || "");
    setUpdateNotes(item.inspection_notes || "");
  };

  const fetchAddressSuggestions = (val: string) => {
    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    if (!val.trim() || val.length < 3) { setAddressSuggestions([]); return; }
    addressDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mapbox/geocode?q=${encodeURIComponent(val)}&limit=5`);
        const data = await res.json();
        setAddressSuggestions(data.features ?? []);
      } catch { /* ignore */ }
    }, 300);
  };

  const createProject = async () => {
    if (!npName.trim()) { setNpError("Project name is required"); return; }
    setNpSaving(true);
    setNpError("");
    try {
      const res = await fetch("/api/partner/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: npName,
          description: npDesc,
          client_name: npClientName,
          client_address: npAddress,
          client_phone: npPhone,
          client_email: npEmail,
          start_date: npStartDate || null,
          end_date: npEndDate || null,
          budget_range: npBudget || null,
          phases: npPhases,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      setShowNewProject(false);
      setNpName(""); setNpClientName(""); setNpAddress(""); setNpPhone("");
      setNpEmail(""); setNpDesc(""); setNpPhases(["receiving", "delivery"]);
      setNpStartDate(""); setNpEndDate(""); setNpBudget("");
      loadProjects();
      viewProject(data.id);
    } catch (e) {
      setNpError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setNpSaving(false);
    }
  };

  const addItem = async () => {
    if (!selectedProject || !aiName.trim()) { setAiError("Item name is required"); return; }
    setAiSaving(true);
    setAiError("");
    try {
      const res = await fetch(`/api/partner/projects/${selectedProject.id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: aiName,
          vendor: aiVendor,
          description: aiDesc,
          quantity: parseInt(aiQty) || 1,
          estimated_value: aiValue ? parseFloat(aiValue) : null,
          expected_delivery_date: aiDelivery || null,
          handled_by: aiHandledBy,
          vendor_carrier: aiCarrier || null,
          vendor_tracking_number: aiTracking || null,
          phase_id: aiPhaseId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");
      setShowAddItem(false);
      setAiName(""); setAiVendor(""); setAiDesc(""); setAiQty("1");
      setAiValue(""); setAiDelivery(""); setAiHandledBy("yugo");
      setAiCarrier(""); setAiTracking(""); setAiPhaseId("");
      viewProject(selectedProject.id);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAiSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="animate-pulse h-32 bg-[var(--brd)]/30 rounded-xl" />)}</div>;
  }

  const AddItemModal = showAddItem && selectedProject ? (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] flex items-center justify-between px-5 py-4 rounded-t-2xl">
          <h3 className="text-[16px] font-bold text-[var(--tx)]">Add Item</h3>
          <button type="button" onClick={() => setShowAddItem(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"><X className="w-4 h-4 text-[var(--tx3)]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Item Name *</label>
            <input value={aiName} onChange={(e) => setAiName(e.target.value)} placeholder="e.g. Roche Bobois sofa" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Vendor</label>
              <input value={aiVendor} onChange={(e) => setAiVendor(e.target.value)} placeholder="Brand / vendor" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Qty</label>
              <input type="number" min="1" value={aiQty} onChange={(e) => setAiQty(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Description</label>
            <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} rows={2} placeholder="Dimensions, color, notes…" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Est. Value ($)</label>
              <input type="number" min="0" value={aiValue} onChange={(e) => setAiValue(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Expected Delivery</label>
              <input type="date" value={aiDelivery} onChange={(e) => setAiDelivery(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          {selectedProject.phases.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Phase</label>
              <select value={aiPhaseId} onChange={(e) => setAiPhaseId(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none">
                <option value="">No phase</option>
                {selectedProject.phases.map((ph) => <option key={ph.id} value={ph.id}>{ph.phase_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-2">Handled By</label>
            <div className="flex gap-2">
              {(["yugo", "vendor_direct", "other_carrier"] as const).map((h) => (
                <button key={h} type="button" onClick={() => setAiHandledBy(h)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${aiHandledBy === h ? "border-[var(--gold)] bg-[var(--gdim)] text-[var(--gold)]" : "border-[var(--brd)] text-[var(--tx3)]"}`}>
                  {h === "yugo" ? "Yugo" : h === "vendor_direct" ? "Vendor ships" : "Carrier"}
                </button>
              ))}
            </div>
          </div>
          {aiHandledBy !== "yugo" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Carrier</label>
                <input value={aiCarrier} onChange={(e) => setAiCarrier(e.target.value)} placeholder="FedEx, UPS…" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Tracking #</label>
                <input value={aiTracking} onChange={(e) => setAiTracking(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
              </div>
            </div>
          )}
          {aiError && <p className="text-[11px] text-red-500">{aiError}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowAddItem(false)} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
            <button type="button" onClick={addItem} disabled={aiSaving} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
              {aiSaving ? "Adding…" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // Detail view
  if (selectedProject) {
    const p = selectedProject;
    const completedPhases = p.phases.filter((ph) => ph.status === "completed").length;
    const pct = p.phases.length > 0 ? Math.round((completedPhases / p.phases.length) * 100) : 0;
    const receivedItems = p.inventory.filter((i) => i.status !== "expected").length;

    return (
      <>
        {AddItemModal}
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
            <div className="flex justify-end mb-2">
              <button type="button" onClick={() => setShowAddItem(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
                <Plus className="w-[13px] h-[13px]" /> Add Item
              </button>
            </div>
            {/* Update vendor item form */}
            {updateItemId && (() => {
              const item = p.inventory.find((i) => i.id === updateItemId);
              if (!item || (item.handled_by || "yugo") === "yugo") return null;
              return (
                <div className="bg-[var(--card)] border border-[var(--gold)]/30 rounded-xl p-4 mb-4 space-y-3">
                  <div className="text-[13px] font-semibold text-[var(--tx)]">Update: {item.item_name}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--tx3)] mb-1 block">Status</label>
                      <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]">
                        <option value="expected">Expected</option>
                        <option value="shipped">Shipped</option>
                        <option value="received">Received</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--tx3)] mb-1 block">Carrier</label>
                      <input value={updateCarrier} onChange={(e) => setUpdateCarrier(e.target.value)} placeholder="e.g., FedEx, DHL" className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--tx3)] mb-1 block">Tracking number</label>
                      <input value={updateTracking} onChange={(e) => setUpdateTracking(e.target.value)} placeholder="Tracking #" className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--tx3)] mb-1 block">Notes</label>
                    <textarea value={updateNotes} onChange={(e) => setUpdateNotes(e.target.value)} placeholder="e.g., Delayed — customs hold, expected +5 days" rows={2} className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={updateVendorItem} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Save</button>
                    <button onClick={() => setUpdateItemId(null)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
                  </div>
                </div>
              );
            })()}

            {p.inventory.length === 0 ? (
              <div className="text-center py-8 text-[var(--tx3)] text-[13px]">No items tracked yet</div>
            ) : (
              <>
                {p.inventory.map((item) => {
                  const phase = p.phases.find((ph) => ph.id === item.phase_id);
                  const handler = item.handled_by || "yugo";
                  const badge = HANDLER_BADGE[handler] || HANDLER_BADGE.yugo;
                  const isVendor = handler !== "yugo";
                  return (
                    <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-[var(--card)] border border-[var(--brd)] rounded-xl gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-[var(--tx)]">{item.item_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${badge.bg} ${badge.text}`}>{badge.label}</span>
                        </div>
                        <div className="text-[11px] text-[var(--tx3)]">
                          {item.vendor || "No vendor"}{phase ? ` · ${phase.phase_name}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-semibold capitalize ${INV_STATUS_COLORS[item.status] || "text-[#888]"}`}>{item.status.replace(/_/g, " ")}</div>
                        {item.vendor_tracking_number ? (
                          <a href={getTrackingUrl(item.vendor_carrier, item.vendor_tracking_number)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--gold)] hover:underline font-mono">
                            {item.vendor_tracking_number.slice(0, 12)}{item.vendor_tracking_number.length > 12 ? "…" : ""}
                          </a>
                        ) : isVendor && (
                          <span className="text-[10px] text-[var(--tx3)]">—</span>
                        )}
                        {(item.received_date || item.expected_delivery_date) && (
                          <div className="text-[10px] text-[var(--tx3)]">
                            {item.received_date
                              ? new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : item.expected_delivery_date
                                ? `ETA ${new Date(item.expected_delivery_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                                : null}
                          </div>
                        )}
                      </div>
                      {isVendor && (
                        <button onClick={() => openUpdateForm(item)} className="shrink-0 px-2 py-1 rounded text-[10px] font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/10">
                          Update
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Upsell for non-Yugo items */}
                {(() => {
                  const nonYugo = p.inventory.filter((i) => i.handled_by && i.handled_by !== "yugo");
                  if (nonYugo.length === 0 || !onScheduleDelivery) return null;
                  const suggestedItems = nonYugo.map((i) => i.item_name).join(", ");
                  return (
                    <div className="mt-6 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-5">
                      <div className="flex items-start gap-3">
                        <Boxes className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-[var(--tx)]">{nonYugo.length} item{nonYugo.length > 1 ? "s" : ""} tracked manually this month</div>
                          <p className="text-[11px] text-[var(--tx3)] mt-1">
                            Want guaranteed white-glove handling with real-time tracking, photo documentation, and proof of delivery?
                          </p>
                          <button
                            onClick={() => onScheduleDelivery(suggestedItems)}
                            className="inline-flex items-center gap-1 mt-3 px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
                          >
                            <Truck size={13} /> Schedule these with Yugo
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
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
      </>
    );
  }

  const PHASE_OPTIONS = [
    { key: "receiving",    label: "Receiving — items arrive at Yugo warehouse" },
    { key: "storage",      label: "Storage — items held until install date" },
    { key: "delivery",     label: "Delivery — items delivered to client site" },
    { key: "installation", label: "Installation — items placed and assembled" },
    { key: "removal",      label: "Removal — existing items removed" },
  ];

  const BUDGET_OPTIONS = [
    "$5,000 - $10,000", "$10,000 - $25,000", "$25,000 - $50,000",
    "$50,000 - $100,000", "$100,000+",
  ];

  const NewProjectModal = showNewProject ? (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] flex items-center justify-between px-5 py-4 rounded-t-2xl">
          <h3 className="text-[16px] font-bold text-[var(--tx)]">New Project</h3>
          <button type="button" onClick={() => setShowNewProject(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"><X className="w-4 h-4 text-[var(--tx3)]" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Project Name *</label>
            <input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. The Riverdale Residence" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Client Name</label>
            <input value={npClientName} onChange={(e) => setNpClientName(e.target.value)} placeholder="End client name" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
          </div>
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Client Address (Mapbox)</label>
            <input
              value={npAddress}
              onChange={(e) => { setNpAddress(e.target.value); fetchAddressSuggestions(e.target.value); }}
              placeholder="Start typing address…"
              className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none"
            />
            {addressSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-lg mt-1 overflow-hidden">
                {addressSuggestions.map((s, i) => (
                  <button key={i} type="button" onClick={() => { setNpAddress(s.place_name); setAddressSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-[12px] hover:bg-[var(--bg)] transition-colors border-b border-[var(--brd)]/30 last:border-0">
                    {s.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Client Phone</label>
              <input value={npPhone} onChange={(e) => setNpPhone(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Client Email</label>
              <input value={npEmail} onChange={(e) => setNpEmail(e.target.value)} placeholder="Optional" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Description</label>
            <textarea value={npDesc} onChange={(e) => setNpDesc(e.target.value)} rows={2} placeholder="Brief project description" className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-2">Phases</label>
            <div className="space-y-2">
              {PHASE_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={npPhases.includes(opt.key)}
                    onChange={(e) => setNpPhases((prev) => e.target.checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key))}
                    className="w-4 h-4 accent-[var(--gold)]" />
                  <span className="text-[12px] text-[var(--tx2)]">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Start Date</label>
              <input type="date" value={npStartDate} onChange={(e) => setNpStartDate(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">End Date</label>
              <input type="date" value={npEndDate} onChange={(e) => setNpEndDate(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Budget (optional)</label>
            <select value={npBudget} onChange={(e) => setNpBudget(e.target.value)} className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] focus:border-[var(--gold)] outline-none">
              <option value="">Select range…</option>
              {BUDGET_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {npError && <p className="text-[11px] text-red-500">{npError}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowNewProject(false)} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
            <button type="button" onClick={createProject} disabled={npSaving} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
              {npSaving ? "Creating…" : "Create Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // Projects list
  if (projects.length === 0) {
    return (
      <>
        {NewProjectModal}
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect width="6" height="4" x="9" y="3" rx="1" /></svg>
          </div>
          <p className="text-[14px] text-[var(--tx3)]">No active projects</p>
          <p className="text-[12px] text-[var(--tx3)]/60 mt-1">Create your first project or wait for your account manager</p>
          <button type="button" onClick={() => setShowNewProject(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
            <Plus className="w-[14px] h-[14px]" /> New Project
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {NewProjectModal}
      {AddItemModal}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-[var(--tx)]">Projects ({projects.length})</h2>
        <button type="button" onClick={() => setShowNewProject(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
          <Plus className="w-[13px] h-[13px]" /> New Project
        </button>
      </div>
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
    </>
  );
}
