"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import CreateButton from "../../components/CreateButton";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";
import { formatCurrency } from "@/lib/format-currency";
import { Plus, Truck, Clock, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Camera, FileText, PaperPlaneTilt as Send, Pulse as Activity, Trash as Trash2, Lock, MapPin, Warning as AlertTriangle, CaretDown as ChevronDown, CaretRight as ChevronRight, PencilSimple as Pencil, ArrowSquareOut } from "@phosphor-icons/react";
import { getTrackingUrl } from "@/lib/tracking-url";
import { getDeliveryDetailPath } from "@/lib/move-code";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { VendorStatusCompactTable } from "@/components/VendorStatusCompactTable";
import {
  DELIVERY_METHOD_LABELS,
  PROJECT_ITEM_RECEIVED_STATUSES,
  PROJECT_ITEM_TRANSIT_STATUSES,
  PROJECT_ITEM_WAREHOUSE_STATUSES,
  type ProjectItemStatus,
  VALID_PROJECT_ITEM_STATUSES,
  getProjectItemStatus,
  getProjectItemStatusLabel,
  getProjectItemStatusUi,
} from "@/lib/project-item-status";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ProjectData {
  id: string;
  project_number: string;
  project_name: string;
  description: string | null;
  partner_id: string;
  end_client_name: string | null;
  end_client_contact: string | null;
  site_address: string | null;
  status: string;
  active_phase: string | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  estimated_budget: number | null;
  project_mgmt_fee: number | null;
  notes: string | null;
  created_at: string;
  organizations: { name: string; type: string; email: string | null; contact_name: string | null } | null;
  phases: Phase[];
  inventory: InventoryItem[];
  timeline: TimelineEntry[];
  deliveries: DeliveryLink[];
}

interface Phase {
  id: string;
  phase_name: string;
  description: string | null;
  phase_order: number;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  address: string | null;
}

interface InventoryItem {
  id: string;
  phase_id: string | null;
  item_name: string;
  description: string | null;
  vendor: string | null;
  vendor_name: string | null;
  vendor_contact_name: string | null;
  vendor_contact_phone: string | null;
  vendor_contact_email: string | null;
  vendor_order_number: string | null;
  vendor_pickup_address: string | null;
  vendor_pickup_window: string | null;
  vendor_delivery_method: string | null;
  item_status: string | null;
  status_updated_at: string | null;
  status_notes: string | null;
  room_destination: string | null;
  item_value: number | null;
  item_dimensions: string | null;
  requires_crating: boolean | null;
  requires_assembly: boolean | null;
  special_handling_notes: string | null;
  quantity: number;
  status: string;
  received_date: string | null;
  received_by: string | null;
  condition_on_receipt: string | null;
  inspection_notes: string | null;
  photo_urls: string[] | null;
  storage_location: string | null;
  delivered_date: string | null;
  handled_by: "yugo" | "vendor_direct" | "other_carrier" | null;
  vendor_tracking_number: string | null;
  vendor_carrier: string | null;
  expected_delivery_date: string | null;
}

const HANDLER_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  yugo: { bg: "bg-[var(--gold)]/15", text: "text-[var(--gold)]", label: "Yugo" },
  vendor_direct: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", label: "VENDOR" },
  other_carrier: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", label: "CARRIER" },
};

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
  delivery_address: string | null;
  total_price: number | null;
  category: string | null;
  items: any;
  phase_id: string | null;
  customer_name: string | null;
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

const PHASE_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  pending: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", icon: Clock },
  active: { bg: "bg-amber-500/10", text: "text-amber-500", icon: Activity },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-500", icon: CheckCircle2 },
  skipped: { bg: "bg-[var(--tx3)]/5", text: "text-[var(--tx3)]/50", icon: Clock },
};

const TABS = ["Overview", "Phases", "Inventory", "Vendor Tracker", "Deliveries", "Timeline", "Invoice"];
const fieldInput = "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

function EditProjectModal({ open, onClose, data, onSaved }: { open: boolean; onClose: () => void; data: ProjectData; onSaved: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [projectName, setProjectName] = useState(data.project_name);
  const [description, setDescription] = useState(data.description || "");
  const [endClientName, setEndClientName] = useState(data.end_client_name || "");
  const [endClientContact, setEndClientContact] = useState(data.end_client_contact || "");
  const [siteAddress, setSiteAddress] = useState(data.site_address || "");
  const [startDate, setStartDate] = useState(data.start_date || "");
  const [targetEndDate, setTargetEndDate] = useState(data.target_end_date || "");
  const [estimatedBudget, setEstimatedBudget] = useState(data.estimated_budget != null ? String(data.estimated_budget) : "");
  const [projectMgmtFee, setProjectMgmtFee] = useState(data.project_mgmt_fee != null ? String(data.project_mgmt_fee) : "");
  const [notes, setNotes] = useState(data.notes || "");

  useEffect(() => {
    if (open) {
      setProjectName(data.project_name);
      setDescription(data.description || "");
      setEndClientName(data.end_client_name || "");
      setEndClientContact(data.end_client_contact || "");
      setSiteAddress(data.site_address || "");
      setStartDate(data.start_date || "");
      setTargetEndDate(data.target_end_date || "");
      setEstimatedBudget(data.estimated_budget != null ? String(data.estimated_budget) : "");
      setProjectMgmtFee(data.project_mgmt_fee != null ? String(data.project_mgmt_fee) : "");
      setNotes(data.notes || "");
    }
  }, [open, data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast("Project name is required", "x");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName.trim(),
          description: description.trim() || null,
          end_client_name: endClientName.trim() || null,
          end_client_contact: endClientContact.trim() || null,
          site_address: siteAddress.trim() || null,
          start_date: startDate || null,
          target_end_date: targetEndDate || null,
          estimated_budget: estimatedBudget ? parseFloat(estimatedBudget) : null,
          project_mgmt_fee: projectMgmtFee ? parseFloat(projectMgmtFee) : null,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update project");
      toast("Project updated", "check");
      onSaved();
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update project", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit Project" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Project Name *</label>
          <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" required className={fieldInput} />
        </div>
        <div>
          <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Project description" rows={3} className={fieldInput} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">End Client</label>
            <input type="text" value={endClientName} onChange={(e) => setEndClientName(e.target.value)} placeholder="Client name" className={fieldInput} />
          </div>
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Contact</label>
            <input type="text" value={endClientContact} onChange={(e) => setEndClientContact(e.target.value)} placeholder="Contact info" className={fieldInput} />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Site Address</label>
          <AddressAutocomplete value={siteAddress} onChange={(r) => setSiteAddress(r.fullAddress)} placeholder="Primary delivery location" className={fieldInput} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldInput} />
          </div>
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Target End Date</label>
            <input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} className={fieldInput} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Estimated Budget</label>
            <input type="number" step="0.01" min="0" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0" className={fieldInput} />
          </div>
          <div>
            <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Mgmt Fee</label>
            <input type="number" step="0.01" min="0" value={projectMgmtFee} onChange={(e) => setProjectMgmtFee(e.target.value)} placeholder="0" className={fieldInput} />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1.5 block">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" rows={2} className={fieldInput} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50">{loading ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
const PROJECT_ITEM_STATUS_OPTIONS = [...VALID_PROJECT_ITEM_STATUSES];
const ROOM_OPTIONS = [
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Master Bedroom",
  "Bedroom 2",
  "Bedroom 3",
  "Home Office",
  "Bathroom",
  "Entryway",
  "Outdoor / Terrace",
  "Other",
];

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const fromDesigners = searchParams.get("from") === "designers";
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(fromDesigners ? "Vendor Tracker" : "Overview");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showReceiveItem, setShowReceiveItem] = useState<string | null>(null);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/admin/projects/${projectId}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const updateStatus = async (status: string) => {
    setStatusUpdating(true);
    await fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadProject();
    setStatusUpdating(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to delete", "alertTriangle");
        setDeleting(false);
        return;
      }
      toast("Project deleted", "check");
      router.back();
      router.refresh();
    } catch {
      toast("Failed to delete", "alertTriangle");
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="px-6 py-8"><div className="animate-pulse h-8 w-48 bg-[var(--brd)] rounded mb-4" /><div className="animate-pulse h-64 bg-[var(--brd)] rounded" /></div>;
  }

  if (!data) {
    return <div className="px-6 py-8 text-[var(--tx3)]">Project not found</div>;
  }

  const completedPhases = data.phases.filter((p) => p.status === "completed").length;
  const totalPhases = data.phases.length;
  const progressPct = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const activeDeliveryTotal = data.deliveries.filter((d) => d.status !== "cancelled").reduce((s, d) => s + (d.total_price || 0), 0);
  const projectEstimate = activeDeliveryTotal > 0 ? activeDeliveryTotal + (data.project_mgmt_fee || 0) : (data.estimated_budget || 0) + (data.project_mgmt_fee || 0);
  const estimateFromDeliveries = activeDeliveryTotal > 0;
  const manualItemsExist = data.inventory.some((i) => i.handled_by && i.handled_by !== "yugo");

  return (
    <div className="px-4 sm:px-6 py-5">
      <BackButton label="Back" />

      {/* Header */}
      <div className="mt-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-2">B2B Operations · Project</p>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-hero text-[20px] font-bold text-[var(--tx)]">
            {data.project_number} · {data.project_name}
          </h1>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLORS[data.status] || ""}`}>
            {data.status.replace("_", " ")}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-[12px] text-[var(--tx3)]">
          <span>Partner: <span className="text-[var(--tx)] font-medium">{data.organizations?.name}</span></span>
          {data.end_client_name && <span>Client: <span className="text-[var(--tx)] font-medium">{data.end_client_name}</span></span>}
          {data.active_phase && <span>Phase: <span className="text-[var(--tx)] font-medium capitalize">{data.active_phase}</span></span>}
          <span>Estimate: <span className="text-[var(--tx)] font-medium">{formatCurrency(projectEstimate)}{estimateFromDeliveries ? "" : " (initial)"}</span></span>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <div className="flex flex-wrap gap-2">
          {data.status === "draft" && (
            <button onClick={() => updateStatus("proposed")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
              <Send size={12} weight="regular" className="inline mr-1" /> Send Proposal
            </button>
          )}
          {data.status === "proposed" && (
            <button onClick={() => updateStatus("active")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
              <CheckCircle2 size={12} weight="regular" className="inline mr-1" /> Mark Active
            </button>
          )}
          {data.status === "active" && (
            <>
              <button onClick={() => updateStatus("completed")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-40">
                <CheckCircle2 size={12} weight="regular" className="inline mr-1" /> Complete
              </button>
              <button onClick={() => updateStatus("on_hold")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                Hold
              </button>
            </>
          )}
          {data.status === "completed" && (
            <button onClick={() => updateStatus("invoiced")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors disabled:opacity-40">
              <FileText size={12} weight="regular" className="inline mr-1" /> Mark Invoiced
            </button>
          )}
          </div>
          <button type="button" onClick={() => setShowEditProject(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--tx2)] border border-[var(--brd)] hover:bg-[var(--card)] transition-colors shrink-0">
            <Pencil size={12} weight="regular" className="inline mr-1" /> Edit
          </button>
          <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="px-3 py-1 rounded text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all shrink-0">
            <Trash2 size={12} weight="regular" className="inline mr-1" /> Delete
          </button>
        </div>
      </div>

      {/* Edit Project Modal */}
      <EditProjectModal open={showEditProject} onClose={() => setShowEditProject(false)} data={data} onSaved={loadProject} />

      {/* Upsell Banner */}
      {manualItemsExist && (
        <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5">
          <Truck size={16} className="text-[var(--gold)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[var(--tx)]">
              {data.inventory.filter((i) => i.handled_by && i.handled_by !== "yugo").length} items are being tracked manually
            </p>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              Want Yugo to handle pickup and delivery with full tracking, photos, and proof of delivery?
            </p>
          </div>
          <button
            onClick={() => setActiveTab("Deliveries")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors whitespace-nowrap"
          >
            Convert to Yugo →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-[var(--brd)]/30 mb-5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-shrink-0 px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === t ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "Overview" && <OverviewTab data={data} progressPct={progressPct} completedPhases={completedPhases} totalPhases={totalPhases} projectEstimate={projectEstimate} estimateFromDeliveries={estimateFromDeliveries} />}
        {activeTab === "Phases" && <PhasesTab data={data} onRefresh={loadProject} projectId={projectId} showAddPhase={showAddPhase} setShowAddPhase={setShowAddPhase} />}
        {activeTab === "Inventory" && <InventoryTab data={data} onRefresh={loadProject} projectId={projectId} showAddItem={showAddItem} setShowAddItem={setShowAddItem} showReceiveItem={showReceiveItem} setShowReceiveItem={setShowReceiveItem} />}
        {activeTab === "Vendor Tracker" && <VendorTrackerTab data={data} projectId={projectId} onRefresh={loadProject} />}
        {activeTab === "Deliveries" && <DeliveriesTab data={data} projectId={projectId} onRefresh={loadProject} />}
        {activeTab === "Timeline" && <TimelineTab data={data} projectId={projectId} onRefresh={loadProject} showAddNote={showAddNote} setShowAddNote={setShowAddNote} />}
        {activeTab === "Invoice" && <InvoiceTab data={data} projectId={projectId} />}
      </div>

      {/* Delete Confirmation */}
      <ModalOverlay open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Project" maxWidth="sm">
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--tx2)]">
            Are you sure you want to delete <strong>{data.project_number} · {data.project_name}</strong>? Deliveries will be unlinked. This action cannot be undone.
          </p>
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="px-4 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)]">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {deleting ? "Deleting…" : "Delete Project"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}

/* ─── OVERVIEW TAB ─── */
function OverviewTab({ data, progressPct, completedPhases, totalPhases, projectEstimate, estimateFromDeliveries }: { data: ProjectData; progressPct: number; completedPhases: number; totalPhases: number; projectEstimate: number; estimateFromDeliveries: boolean }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="divide-y divide-[var(--brd)]/50 pt-0 pb-6 lg:pb-0 lg:pr-6">
        {/* Progress */}
        <section className="py-5 first:pt-0">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Progress</div>
          <div className="relative h-3 bg-[var(--bg)] rounded-full overflow-hidden mb-2">
            <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-[var(--tx3)]">
            <span>{progressPct}% complete</span>
            <span>{completedPhases} of {totalPhases} phases done</span>
          </div>
        </div>
        </section>

        {/* Project Details */}
        <section className="py-5">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 space-y-2">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Details</div>
          {data.description && <InfoRow label="Description" value={data.description} />}
          <InfoRow label="Partner" value={`${data.organizations?.name || "-"} (${data.organizations?.type || ""})`} />
          {data.end_client_name && <InfoRow label="End Client" value={data.end_client_name} />}
          {data.end_client_contact && <InfoRow label="Contact" value={data.end_client_contact} />}
          {data.site_address && <InfoRow label="Site" value={data.site_address} />}
          <InfoRow label="Start" value={data.start_date ? new Date(data.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD"} />
          <InfoRow label="Target End" value={data.target_end_date ? new Date(data.target_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD"} />
        </div>
        </section>

        {/* Vendor Status, compact table */}
        {data.inventory.length > 0 && (
          <section className="py-5">
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Vendor Status</div>
            <VendorStatusCompactTable inventory={data.inventory} />
          </section>
        )}
      </div>

      <div className="divide-y divide-[var(--brd)]/50 border-t lg:border-t-0 lg:border-l border-[var(--brd)]/50 pt-5 lg:pt-0 pl-0 lg:pl-6">
        {/* Estimate */}
        <section className="py-5 first:pt-0">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Project Estimate</div>
          <div className="text-[28px] font-bold text-[var(--tx)] font-hero">{formatCurrency(projectEstimate)}</div>
          <div className="text-[12px] text-[var(--tx3)] mt-1">
            {estimateFromDeliveries
              ? `Based on ${data.deliveries.filter((d) => d.status !== "cancelled").length} linked deliver${data.deliveries.filter((d) => d.status !== "cancelled").length === 1 ? "y" : "ies"}${data.project_mgmt_fee ? " + mgmt fee" : ""}`
              : "Initial estimate, no deliveries yet"}
          </div>
          {data.project_mgmt_fee ? (
            <div className="mt-3 pt-3 border-t border-[var(--brd)] flex justify-between text-[11px]">
              <span className="text-[var(--tx3)]">Mgmt Fee</span>
              <span className="text-[var(--tx)]">{formatCurrency(data.project_mgmt_fee)}</span>
            </div>
          ) : null}
        </section>

        {/* Quick Stats */}
        <section className="py-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Inventory Items"
            value={String(data.inventory.length)}
            sub={`${data.inventory.filter((i) => PROJECT_ITEM_RECEIVED_STATUSES.includes(getProjectItemStatus(i))).length} received`}
          />
          <StatCard label="Deliveries" value={String(data.deliveries.length)} sub={`${data.deliveries.filter((d) => d.status === "delivered" || d.status === "completed").length} completed`} />
        </div>
        </section>

        {/* Recent Activity */}
        <section className="py-5 last:pb-0">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Recent Activity</div>
          {data.timeline.slice(0, 5).map((e) => (
            <div key={e.id} className="flex gap-3 py-2 text-[12px]">
              <TimelineIcon type={e.event_type} />
              <div className="flex-1 min-w-0">
                <div className="text-[var(--tx)]">{e.event_description}</div>
                <div className="text-[10px] text-[var(--tx3)]">{new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
            </div>
          ))}
          {data.timeline.length === 0 && <div className="text-[12px] text-[var(--tx3)]">No activity yet</div>}
        </section>
      </div>
    </div>
  );
}

/* ─── PHASE ITEM ROW (inline editable) ─── */
function PhaseItemRow({ item, status, cfg, projectId, onRefresh }: { item: InventoryItem; status: string; cfg: { bg: string; color: string; label: string }; projectId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [condition, setCondition] = useState(item.condition_on_receipt || "");
  const [storage, setStorage] = useState(item.storage_location || "");
  const [saving, setSaving] = useState(false);
  const [condTimeout, setCondTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [storTimeout, setStorTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const patchItem = async (patch: Record<string, string | null>) => {
    setSaving(true);
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, ...patch }),
    });
    setSaving(false);
    onRefresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    const res = await fetch(`/api/admin/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, item_status: newStatus }),
    });
    if (res.ok) { onRefresh(); toast("Status updated", "check"); }
    else toast("Failed to update", "alertTriangle");
    setSaving(false);
  };

  const handleCondition = (val: string) => {
    setCondition(val);
    if (condTimeout) clearTimeout(condTimeout);
    setCondTimeout(setTimeout(() => patchItem({ condition_on_receipt: val || null }), 800));
  };

  const handleStorage = (val: string) => {
    setStorage(val);
    if (storTimeout) clearTimeout(storTimeout);
    setStorTimeout(setTimeout(() => patchItem({ storage_location: val || null }), 800));
  };

  return (
    <tr className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/10">
      <td className="px-2 py-2 text-[12px] font-medium text-[var(--tx)]">{item.item_name}</td>
      <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{item.vendor_name || item.vendor || "-"}</td>
      <td className="px-2 py-2">
        <select
          value={status}
          disabled={saving}
          onChange={(e) => handleStatusChange(e.target.value)}
          className={`text-[9px] font-semibold bg-transparent border-0 outline-none cursor-pointer disabled:opacity-50 ${cfg.color}`}
        >
          {VALID_PROJECT_ITEM_STATUSES.map((s) => {
            const scfg = getProjectItemStatusUi(s);
            return <option key={s} value={s}>{scfg.label}</option>;
          })}
        </select>
      </td>
      <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">
        {item.received_date ? new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "-"}
      </td>
      <td className="px-2 py-2">
        <select
          value={condition}
          onChange={(e) => handleCondition(e.target.value)}
          className="text-[11px] bg-transparent border-0 outline-none cursor-pointer text-[var(--tx3)] hover:text-[var(--tx)]"
        >
          <option value="">-</option>
          <option value="perfect">Perfect</option>
          <option value="good">Good</option>
          <option value="minor_damage">Minor Damage</option>
          <option value="damaged">Damaged</option>
          <option value="wrong_item">Wrong Item</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          value={storage}
          onChange={(e) => handleStorage(e.target.value)}
          placeholder="e.g. Rack B-3"
          className="text-[11px] bg-transparent border-0 outline-none text-[var(--tx3)] hover:text-[var(--tx)] w-full placeholder:text-[var(--tx3)]/40"
        />
      </td>
    </tr>
  );
}

/* ─── PHASES TAB ─── */
function PhasesTab({ data, onRefresh, projectId, showAddPhase, setShowAddPhase }: { data: ProjectData; onRefresh: () => void; projectId: string; showAddPhase: boolean; setShowAddPhase: (v: boolean) => void }) {
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDate, setNewPhaseDate] = useState("");
  const [newPhaseAddress, setNewPhaseAddress] = useState("");
  const [expandedPhase, setExpandedPhase] = useState<string | null>(data.phases.find((p) => p.status === "active")?.id || data.phases[0]?.id || null);

  const addPhase = async () => {
    if (!newPhaseName.trim()) return;
    await fetch(`/api/admin/projects/${projectId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase_name: newPhaseName, scheduled_date: newPhaseDate || null, address: newPhaseAddress || null }),
    });
    setNewPhaseName("");
    setNewPhaseDate("");
    setNewPhaseAddress("");
    setShowAddPhase(false);
    onRefresh();
  };

  const updatePhaseStatus = async (phaseId: string, status: string) => {
    await fetch(`/api/admin/projects/${projectId}/phases`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase_id: phaseId, status, completed_date: status === "completed" ? new Date().toISOString().slice(0, 10) : null }),
    });
    onRefresh();
  };

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      {/* Visual Timeline */}
      <section className="py-5 first:pt-0">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {data.phases.map((phase, i) => {
          const cfg = PHASE_COLORS[phase.status] || PHASE_COLORS.pending;
          const Icon = cfg.icon;
          return (
            <button
              key={phase.id}
              onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-colors shrink-0 ${
                expandedPhase === phase.id ? "border-[var(--gold)] bg-[var(--gdim)]/30" : "border-[var(--brd)] hover:border-[var(--gold)]/50"
              }`}
            >
              <Icon size={14} className={cfg.text} />
              <div className="text-left">
                <div className="text-[11px] font-semibold text-[var(--tx)] whitespace-nowrap">{phase.phase_name}</div>
                <div className="text-[9px] text-[var(--tx3)] capitalize">{phase.status}{phase.scheduled_date ? ` · ${new Date(phase.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}{phase.address ? ` · ${phase.address.split(",")[0]}` : ""}</div>
              </div>
              {i < data.phases.length - 1 && <span className="text-[var(--tx3)] ml-1">→</span>}
            </button>
          );
        })}
      </div>
      </section>

      {/* Expanded Phase Detail */}
      {expandedPhase && (
      <section className="py-5">
      {(() => {
        const phase = data.phases.find((p) => p.id === expandedPhase);
        if (!phase) return null;
        const phaseItems = data.inventory.filter((i) => i.phase_id === phase.id);
        const phaseDeliveries = data.deliveries.filter((d) => d.phase_id === phase.id);

        return (
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 mb-5">
            <div className="flex items-start justify-between mb-4 gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-[var(--tx)]">{phase.phase_name}</h3>
                {phase.description && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{phase.description}</p>}
                {phase.address && (
                  <p className="text-[11px] text-[var(--tx3)] mt-1 flex items-center gap-1">
                    <MapPin size={11} className="shrink-0 text-current" />
                    {phase.address}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/admin/deliveries/new?choice=single&org=${data.partner_id}&projectId=${projectId}&phaseId=${phase.id}`}
                  className="px-3 py-1 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors flex items-center gap-1"
                >
                  <Truck size={11} weight="regular" /> New Delivery
                </Link>
                {phase.status === "pending" && (
                  <button onClick={() => updatePhaseStatus(phase.id, "active")} className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">Start Phase</button>
                )}
                {phase.status === "active" && (
                  <button onClick={() => updatePhaseStatus(phase.id, "completed")} className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Complete Phase</button>
                )}
              </div>
            </div>

            {/* Items table */}
            {phaseItems.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--brd)]">
                      {["Item", "Vendor", "Status", "Received", "Condition", "Storage"].map((h) => (
                        <th key={h} className="px-2 py-2 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {phaseItems.map((item) => {
                      const status = getProjectItemStatus(item);
                      const cfg = getProjectItemStatusUi(status);
                      return (
                        <PhaseItemRow
                          key={item.id}
                          item={item}
                          status={status}
                          cfg={cfg}
                          projectId={projectId}
                          onRefresh={onRefresh}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Linked deliveries */}
            {phaseDeliveries.length > 0 && (
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Deliveries</div>
                {phaseDeliveries.map((d) => (
                  <Link key={d.id} href={`/admin/deliveries/${d.id}`} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg)] transition-colors">
                    <div className="flex items-center gap-2">
                      <Truck size={14} weight="regular" className="text-[var(--gold)]" />
                      <span className="text-[12px] font-medium text-[var(--tx)]">{d.delivery_number || "Delivery"}</span>
                      <span className="text-[10px] text-[var(--tx3)]">{d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}</span>
                    </div>
                    <span className="text-[10px] font-semibold capitalize text-[var(--tx3)]">{d.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      </section>
      )}

      {/* Add Phase */}
      <section className="py-5 last:pb-0">
      {showAddPhase ? (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-3">
          <input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="Phase name (e.g. Receiving, Delivery, Installation)…" className={fieldInput} autoFocus />
          <input type="date" value={newPhaseDate} onChange={(e) => setNewPhaseDate(e.target.value)} className={fieldInput} />
          <input value={newPhaseAddress} onChange={(e) => setNewPhaseAddress(e.target.value)} placeholder="Delivery address for this phase (optional)" className={fieldInput} />
          <div className="flex gap-2">
            <button onClick={addPhase} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add Phase</button>
            <button onClick={() => setShowAddPhase(false)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddPhase(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border border-dashed border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
          <Plus size={14} weight="regular" /> Add Phase
        </button>
      )}
      </section>
    </div>
  );
}

/* ─── INVENTORY TAB ─── */
function InventoryTab({ data, onRefresh, projectId, showAddItem, setShowAddItem, showReceiveItem, setShowReceiveItem }: {
  data: ProjectData; onRefresh: () => void; projectId: string;
  showAddItem: boolean; setShowAddItem: (v: boolean) => void;
  showReceiveItem: string | null; setShowReceiveItem: (v: string | null) => void;
}) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemVendor, setNewItemVendor] = useState("");
  const [newItemContactName, setNewItemContactName] = useState("");
  const [newItemContactPhone, setNewItemContactPhone] = useState("");
  const [newItemContactEmail, setNewItemContactEmail] = useState("");
  const [newItemOrderNumber, setNewItemOrderNumber] = useState("");
  const [newItemPickupAddress, setNewItemPickupAddress] = useState("");
  const [newItemPickupWindow, setNewItemPickupWindow] = useState("");
  const [newItemPhase, setNewItemPhase] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemStatus, setNewItemStatus] = useState("ordered");
  const [newItemRoom, setNewItemRoom] = useState("");
  const [newItemDeliveryMethod, setNewItemDeliveryMethod] = useState("yugo_pickup");
  const [newItemCarrier, setNewItemCarrier] = useState("");
  const [newItemTrackingNum, setNewItemTrackingNum] = useState("");
  const [newItemExpectedDate, setNewItemExpectedDate] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemDimensions, setNewItemDimensions] = useState("");
  const [newItemCrating, setNewItemCrating] = useState(false);
  const [newItemAssembly, setNewItemAssembly] = useState(false);
  const [newItemNotes, setNewItemNotes] = useState("");
  const [search, setSearch] = useState("");

  // Receive item form
  const [receiveCondition, setReceiveCondition] = useState("perfect");
  const [receiveStorage, setReceiveStorage] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");

  // Vendor item update form
  const [updateVendorItemId, setUpdateVendorItemId] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateTracking, setUpdateTracking] = useState("");
  const [updateCarrier, setUpdateCarrier] = useState("");
  const [updateExpectedDate, setUpdateExpectedDate] = useState("");
  const [updateNotes, setUpdateNotes] = useState("");

  const getStatus = (item: InventoryItem) => getProjectItemStatus(item);
  const isComplete = (status: string) => status === "delivered" || status === "installed";
  const canReceive = (status: string) =>
    !PROJECT_ITEM_RECEIVED_STATUSES.includes(status as (typeof PROJECT_ITEM_RECEIVED_STATUSES)[number]) &&
    !isComplete(status) &&
    status !== "issue_reported";

  const resetAddItem = () => {
    setNewItemName("");
    setNewItemVendor("");
    setNewItemContactName("");
    setNewItemContactPhone("");
    setNewItemContactEmail("");
    setNewItemOrderNumber("");
    setNewItemPickupAddress("");
    setNewItemPickupWindow("");
    setNewItemPhase("");
    setNewItemQty("1");
    setNewItemStatus("ordered");
    setNewItemRoom("");
    setNewItemDeliveryMethod("yugo_pickup");
    setNewItemCarrier("");
    setNewItemTrackingNum("");
    setNewItemExpectedDate("");
    setNewItemValue("");
    setNewItemDimensions("");
    setNewItemCrating(false);
    setNewItemAssembly(false);
    setNewItemNotes("");
  };

  const addItem = async () => {
    if (!newItemName.trim()) return;
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_name: newItemName,
        vendor_name: newItemVendor || null,
        vendor_contact_name: newItemContactName || null,
        vendor_contact_phone: newItemContactPhone || null,
        vendor_contact_email: newItemContactEmail || null,
        vendor_order_number: newItemOrderNumber || null,
        vendor_pickup_address: newItemPickupAddress || null,
        vendor_pickup_window: newItemPickupWindow || null,
        phase_id: newItemPhase || null,
        quantity: parseInt(newItemQty) || 1,
        item_status: newItemStatus,
        room_destination: newItemRoom || null,
        vendor_delivery_method: newItemDeliveryMethod,
        vendor_carrier: newItemCarrier || null,
        vendor_tracking_number: newItemTrackingNum || null,
        expected_delivery_date: newItemExpectedDate || null,
        item_value: newItemValue ? parseFloat(newItemValue) : null,
        item_dimensions: newItemDimensions || null,
        requires_crating: newItemCrating,
        requires_assembly: newItemAssembly,
        special_handling_notes: newItemNotes || null,
        status_notes: newItemNotes || null,
      }),
    });
    resetAddItem();
    setShowAddItem(false);
    onRefresh();
  };

  const receiveItem = async () => {
    if (!showReceiveItem) return;
    await fetch(`/api/admin/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: showReceiveItem,
        item_status: "received_warehouse",
        notes: receiveNotes || null,
      }),
    });
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: showReceiveItem,
        condition_on_receipt: receiveCondition,
        storage_location: receiveStorage || null,
        inspection_notes: receiveNotes || null,
      }),
    });
    setShowReceiveItem(null);
    setReceiveCondition("perfect");
    setReceiveStorage("");
    setReceiveNotes("");
    onRefresh();
  };

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const deleteItem = async (itemId: string) => {
    if (deletingItemId) return;
    if (!confirm("Remove this item from the project?")) return;
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/inventory`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove item");
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove item");
    } finally {
      setDeletingItemId(null);
    }
  };

  const updateVendorItem = async () => {
    if (!updateVendorItemId) return;
    await fetch(`/api/admin/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: updateVendorItemId,
        item_status: updateStatus,
        notes: updateNotes || null,
      }),
    });
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: updateVendorItemId,
        vendor_tracking_number: updateTracking || null,
        vendor_carrier: updateCarrier || null,
        expected_delivery_date: updateExpectedDate || null,
        inspection_notes: updateNotes || null,
      }),
    });
    setUpdateVendorItemId(null);
    setUpdateStatus("");
    setUpdateTracking("");
    setUpdateCarrier("");
    setUpdateExpectedDate("");
    setUpdateNotes("");
    onRefresh();
  };

  const filtered = data.inventory.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.item_name.toLowerCase().includes(q) ||
      (i.vendor_name || i.vendor || "").toLowerCase().includes(q) ||
      (i.room_destination || "").toLowerCase().includes(q) ||
      (i.vendor_order_number || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      <section className="py-5 first:pt-0">
      <div className="flex flex-wrap gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className={`${fieldInput} w-[220px]`} />
        <CreateButton onClick={() => setShowAddItem(true)} title="Add Item" />
      </div>
      </section>

      {/* Add Item Form */}
      {showAddItem && (
        <section className="py-5">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" className={fieldInput} autoFocus />
            <input value={newItemVendor} onChange={(e) => setNewItemVendor(e.target.value)} placeholder="Vendor" className={fieldInput} />
            <input value={newItemContactName} onChange={(e) => setNewItemContactName(e.target.value)} placeholder="Vendor contact name" className={fieldInput} />
            <input value={newItemContactPhone} onChange={(e) => setNewItemContactPhone(e.target.value)} placeholder="Vendor contact phone" className={fieldInput} />
            <input value={newItemContactEmail} onChange={(e) => setNewItemContactEmail(e.target.value)} placeholder="Vendor contact email" className={fieldInput} />
            <input value={newItemOrderNumber} onChange={(e) => setNewItemOrderNumber(e.target.value)} placeholder="Order number" className={fieldInput} />
            <input value={newItemPickupAddress} onChange={(e) => setNewItemPickupAddress(e.target.value)} placeholder="Pickup address" className={fieldInput} />
            <input value={newItemPickupWindow} onChange={(e) => setNewItemPickupWindow(e.target.value)} placeholder="Pickup window" className={fieldInput} />
            <select value={newItemPhase} onChange={(e) => setNewItemPhase(e.target.value)} className={fieldInput}>
              <option value="">No phase</option>
              {data.phases.map((p) => <option key={p.id} value={p.id}>{p.phase_name}</option>)}
            </select>
            <input type="number" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} placeholder="Qty" min="1" className={fieldInput} />
            <select value={newItemStatus} onChange={(e) => setNewItemStatus(e.target.value)} className={fieldInput}>
              {PROJECT_ITEM_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {getProjectItemStatusLabel(status)}
                </option>
              ))}
            </select>
            <select value={newItemRoom} onChange={(e) => setNewItemRoom(e.target.value)} className={fieldInput}>
              <option value="">Room destination</option>
              {ROOM_OPTIONS.map((room) => <option key={room} value={room}>{room}</option>)}
            </select>
            <select value={newItemDeliveryMethod} onChange={(e) => setNewItemDeliveryMethod(e.target.value)} className={fieldInput}>
              {Object.entries(DELIVERY_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <input value={newItemCarrier} onChange={(e) => setNewItemCarrier(e.target.value)} placeholder="Carrier (e.g., FedEx, DHL)" className={fieldInput} />
            <input value={newItemTrackingNum} onChange={(e) => setNewItemTrackingNum(e.target.value)} placeholder="Tracking number" className={fieldInput} />
            <input type="date" value={newItemExpectedDate} onChange={(e) => setNewItemExpectedDate(e.target.value)} placeholder="Expected delivery" className={fieldInput} />
            <input type="number" min="0" value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} placeholder="Declared value" className={fieldInput} />
            <input value={newItemDimensions} onChange={(e) => setNewItemDimensions(e.target.value)} placeholder="Dimensions" className={fieldInput} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)]">
              <input type="checkbox" checked={newItemCrating} onChange={(e) => setNewItemCrating(e.target.checked)} />
              Crating required
            </label>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)]">
              <input type="checkbox" checked={newItemAssembly} onChange={(e) => setNewItemAssembly(e.target.checked)} />
              Assembly required
            </label>
          </div>
          <textarea value={newItemNotes} onChange={(e) => setNewItemNotes(e.target.value)} placeholder="Special handling / status notes" rows={3} className={fieldInput} />
          <div className="flex gap-2">
            <button onClick={addItem} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
            <button onClick={() => { resetAddItem(); setShowAddItem(false); }} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
          </div>
        </div>
        </section>
      )}

      {/* Update Vendor Item Form */}
      {updateVendorItemId && (() => {
        const item = data.inventory.find((i) => i.id === updateVendorItemId);
        if (!item || (item.handled_by || "yugo") === "yugo") return null;
        return (
          <section className="py-5">
          <div className="bg-[var(--card)] border border-[var(--gold)]/30 rounded-xl p-4 space-y-3">
            <div className="text-[13px] font-semibold text-[var(--tx)]">Update: {item.item_name}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Status</label>
                <select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} className={fieldInput}>
                  {PROJECT_ITEM_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {getProjectItemStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Carrier</label>
                <input value={updateCarrier} onChange={(e) => setUpdateCarrier(e.target.value)} placeholder="e.g., FedEx, DHL" className={fieldInput} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Tracking number</label>
                <input value={updateTracking} onChange={(e) => setUpdateTracking(e.target.value)} placeholder="Tracking #" className={fieldInput} />
              </div>
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Expected date</label>
                <input type="date" value={updateExpectedDate} onChange={(e) => setUpdateExpectedDate(e.target.value)} className={fieldInput} />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--tx3)] mb-1 block">Notes</label>
              <textarea value={updateNotes} onChange={(e) => setUpdateNotes(e.target.value)} placeholder="e.g., Delayed, customs hold, expected +5 days" rows={2} className={fieldInput} />
            </div>
            <div className="flex gap-2">
              <button onClick={updateVendorItem} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Save</button>
              <button onClick={() => setUpdateVendorItemId(null)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
            </div>
          </div>
          </section>
        );
      })()}

      {/* Receive Item */}
      {showReceiveItem && (() => {
        const item = data.inventory.find((i) => i.id === showReceiveItem);
        if (!item) return null;
        return (
          <section className="py-5">
          <div className="bg-[var(--card)] border border-[var(--gold)]/30 rounded-xl p-4 space-y-3">
            <div className="text-[13px] font-semibold text-[var(--tx)]">Receive: {item.item_name}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Condition</label>
                <select value={receiveCondition} onChange={(e) => setReceiveCondition(e.target.value)} className={fieldInput}>
                  <option value="perfect">Perfect</option>
                  <option value="minor_damage">Minor Damage</option>
                  <option value="major_damage">Major Damage</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--tx3)] mb-1 block">Storage Location</label>
                <input value={receiveStorage} onChange={(e) => setReceiveStorage(e.target.value)} placeholder="e.g., Bay 3, Shelf 2" className={fieldInput} />
              </div>
            </div>
            <textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Inspection notes..." rows={2} className={fieldInput} />
            <div className="flex gap-2">
              <button onClick={receiveItem} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600">Mark Received</button>
              <button onClick={() => setShowReceiveItem(null)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
            </div>
          </div>
          </section>
        );
      })()}

      {/* Items Table */}
      <section className="py-5 last:pb-0">
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--tx3)] text-[13px]">No inventory items yet</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                {["Item", "Vendor", "Handled By", "Status", "Tracking", "Received", "Actions"].map((h) => (
                  <th key={h} className="px-2 py-2 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">{h === "Actions" ? "" : h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const handler = item.handled_by || "yugo";
                const badge = HANDLER_BADGE[handler] || HANDLER_BADGE.yugo;
                const status = getStatus(item);
                const statusCfg = getProjectItemStatusUi(status);
                return (
                  <tr key={item.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/20">
                    <td className="px-2 py-2.5">
                      <div className="text-[12px] font-medium text-[var(--tx)]">{item.item_name}</div>
                      {item.quantity > 1 && <span className="text-[10px] text-[var(--tx3)]">×{item.quantity}</span>}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-[var(--tx3)]">{item.vendor_name || item.vendor || "-"}</td>
                    <td className="px-2 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`text-[10px] font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                    </td>
                    <td className="px-2 py-2.5 text-[11px]">
                      {handler === "yugo" ? (
                        <span className="text-[var(--tx3)]">-</span>
                      ) : item.vendor_tracking_number ? (
                        <a
                          href={getTrackingUrl(item.vendor_carrier, item.vendor_tracking_number)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--gold)] hover:underline font-mono"
                        >
                          {item.vendor_tracking_number.slice(0, 12)}{item.vendor_tracking_number.length > 12 ? "…" : ""}
                        </a>
                      ) : (
                        <span className="text-[var(--tx3)]">No tracking</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-[var(--tx3)]">{item.received_date ? new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : item.expected_delivery_date ? `ETA ${new Date(item.expected_delivery_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "-"}</td>
                    <td className="px-2 py-2.5">
                      {handler === "yugo" && !isComplete(status) && (
                        <span className="text-[10px] text-[var(--tx3)]">Auto-tracked</span>
                      )}
                      {handler === "yugo" && isComplete(status) && (
                        <span className="text-[10px] text-emerald-500 font-semibold">View PoD</span>
                      )}
                      {handler !== "yugo" && !isComplete(status) && (
                        <>
                          <button
                            onClick={() => {
                              setUpdateVendorItemId(item.id);
                              setUpdateStatus(status);
                              setUpdateTracking(item.vendor_tracking_number || "");
                              setUpdateCarrier(item.vendor_carrier || "");
                              setUpdateExpectedDate(item.expected_delivery_date || "");
                              setUpdateNotes(item.status_notes || item.inspection_notes || "");
                            }}
                            className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            Update
                          </button>
                          {canReceive(status) && (
                            <span className="text-[var(--tx3)] mx-1">·</span>
                          )}
                          {canReceive(status) && (
                            <button onClick={() => setShowReceiveItem(item.id)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Receive</button>
                          )}
                        </>
                      )}
                      <span className="text-[var(--tx3)] mx-1">·</span>
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={deletingItemId === item.id}
                        className="text-[10px] font-semibold text-red-500 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Upsell for non-Yugo items */}
          {(() => {
            const nonYugoCount = filtered.filter((i) => i.handled_by && i.handled_by !== "yugo").length;
            if (nonYugoCount === 0) return null;
            return (
              <div className="mt-6 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-5">
                <div className="flex items-start gap-3">
                  <Truck className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[var(--tx)]">{nonYugoCount} item{nonYugoCount > 1 ? "s" : ""} tracked manually this month</div>
                    <p className="text-[11px] text-[var(--tx3)] mt-1">
                      Want guaranteed white-glove handling with real-time tracking, photo documentation, and proof of delivery?
                    </p>
                    <Link
                      href={`/admin/deliveries/new?choice=single&org=${data.partner_id}&projectId=${projectId}`}
                      className="inline-flex items-center gap-1 mt-3 px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
                    >
                      <Truck size={13} weight="regular" /> Schedule these with Yugo
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      </section>
    </div>
  );
}

const DELIVERY_STATUS_OPTIONS = [
  { value: "pending_acceptance", label: "Pending Acceptance" },
  { value: "accepted",           label: "Accepted" },
  { value: "scheduled",          label: "Scheduled" },
  { value: "in_progress",        label: "In Progress" },
  { value: "en_route_to_pickup", label: "En Route to Pickup" },
  { value: "picked_up",          label: "Picked Up" },
  { value: "en_route",           label: "En Route" },
  { value: "delivered",          label: "Delivered" },
  { value: "completed",          label: "Completed" },
  { value: "cancelled",          label: "Cancelled" },
];

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending_acceptance: "text-[var(--tx3)]",
  accepted:          "text-sky-500",
  scheduled:         "text-blue-500",
  in_progress:       "text-amber-500",
  en_route_to_pickup:"text-amber-500",
  picked_up:         "text-amber-600",
  en_route:          "text-amber-500",
  delivered:         "text-emerald-500",
  completed:         "text-emerald-500",
  cancelled:         "text-red-500",
};

/* ─── DELIVERIES TAB ─── */
function DeliveriesTab({ data, projectId, onRefresh }: { data: ProjectData; projectId: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);

  const updateDeliveryStatus = async (deliveryId: string, status: string) => {
    setUpdatingDelivery(deliveryId);
    const res = await fetch(`/api/admin/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { onRefresh(); toast("Delivery status updated", "check"); }
    else toast("Failed to update status", "alertTriangle");
    setUpdatingDelivery(null);
  };

  // Build a pre-filled URL for new delivery
  const buildDeliveryUrl = (phaseId?: string, pickupAddr?: string) => {
    const params = new URLSearchParams({
      choice: "single",
      org: data.partner_id,
      projectId,
    });
    if (phaseId) params.set("phaseId", phaseId);
    if (pickupAddr) params.set("pickup", pickupAddr);
    if (data.site_address) params.set("delivery", data.site_address);
    if (data.end_client_name) params.set("customer", data.end_client_name);
    return `/admin/deliveries/new?${params.toString()}`;
  };

  // Collect ready items grouped by vendor pickup address
  const readyItems = data.inventory.filter((i) => {
    const st = (i as any).item_status || i.status;
    return st === "ready_for_pickup" || PROJECT_ITEM_WAREHOUSE_STATUSES.includes(st);
  });
  const pickupGroups = Array.from(new Set(readyItems.map((i: any) => i.vendor_pickup_address || ""))).filter(Boolean) as string[];

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      <section className="py-5 first:pt-0">
      <div className="flex justify-between items-center">
        <div className="text-[12px] text-[var(--tx3)]">{data.deliveries.length} deliver{data.deliveries.length !== 1 ? "ies" : "y"} linked</div>
        <div className="flex gap-2">
          {pickupGroups.length > 0 && pickupGroups.map((addr) => {
            const count = readyItems.filter((i: any) => i.vendor_pickup_address === addr).length;
            const short = addr.split(",")[0];
            return (
              <Link key={addr}
                href={buildDeliveryUrl(undefined, addr)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                title={`Pickup from ${addr}`}
              >
                <Truck size={12} /> {count} item{count !== 1 ? "s" : ""} from {short}
              </Link>
            );
          })}
          <CreateButton href={buildDeliveryUrl()} title="Create Delivery" />
        </div>
      </div>
      </section>

      <section className="py-5 last:pb-0">
      {data.deliveries.length === 0 ? (
        <div className="text-center py-12 text-[var(--tx3)] text-[13px]">No deliveries linked to this project</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                {["DLV #", "Phase", "Date", "Items", "Price", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.deliveries.map((d) => {
                const phase = data.phases.find((p) => p.id === d.phase_id);
                const itemCount = Array.isArray(d.items) ? d.items.length : 0;
                return (
                  <tr key={d.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/20">
                    <td className="px-3 py-2.5">
                      <Link href={`/admin/deliveries/${d.id}`} className="text-[12px] font-semibold text-[var(--gold)] hover:underline">{d.delivery_number || "-"}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{phase?.phase_name || "-"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{itemCount} item{itemCount !== 1 ? "s" : ""}</td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[var(--tx)]">{d.total_price ? formatCurrency(d.total_price) : "-"}</td>
                    <td className="px-3 py-2.5">
                      <select
                        value={d.status}
                        disabled={updatingDelivery === d.id}
                        onChange={(e) => updateDeliveryStatus(d.id, e.target.value)}
                        className={`text-[10px] font-semibold bg-transparent border-0 outline-none cursor-pointer disabled:opacity-50 ${DELIVERY_STATUS_COLORS[d.status] || "text-[var(--tx3)]"}`}
                      >
                        {DELIVERY_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </div>
  );
}

/* ─── TIMELINE TAB ─── */
function TimelineTab({ data, projectId, onRefresh, showAddNote, setShowAddNote }: { data: ProjectData; projectId: string; onRefresh: () => void; showAddNote: boolean; setShowAddNote: (v: boolean) => void }) {
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note_added");

  const addNote = async () => {
    if (!noteText.trim()) return;
    await fetch(`/api/admin/projects/${projectId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: noteType, event_description: noteText }),
    });
    setNoteText("");
    setNoteType("note_added");
    setShowAddNote(false);
    onRefresh();
  };

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      <section className="py-5 first:pt-0">
      <button onClick={() => setShowAddNote(!showAddNote)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]">
        <Plus size={13} weight="regular" /> Add Note
      </button>
      </section>

      {showAddNote && (
      <section className="py-5">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 space-y-3">
          <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className={fieldInput}>
            <option value="note_added">Note</option>
            <option value="issue_flagged">Issue</option>
          </select>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What happened?" rows={3} className={fieldInput} autoFocus />
          <div className="flex gap-2">
            <button onClick={addNote} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
            <button onClick={() => setShowAddNote(false)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
          </div>
        </div>
      </section>
      )}

      {/* Timeline List */}
      <section className="py-5 last:pb-0">
      <div className="relative">
        {data.timeline.length > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--brd)]"
            style={{ left: "11px" }}
            aria-hidden
          />
        )}
        {data.timeline.map((e) => (
          <div key={e.id} className="flex gap-3 pb-5 last:pb-0">
            <div className="relative flex shrink-0 w-6 items-start justify-center pt-0.5">
              <TimelineIcon type={e.event_type} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[var(--tx)]">{e.event_description}</div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        {data.timeline.length === 0 && <div className="text-[12px] text-[var(--tx3)]">No activity yet</div>}
      </div>
      </section>
    </div>
  );
}

/* ─── INVOICE TAB ─── */
function InvoiceTab({ data, projectId }: { data: ProjectData; projectId: string }) {
  const [generating, setGenerating] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  const { toast } = useToast();

  const activeDeliveries = data.deliveries.filter((d) => d.status !== "cancelled");
  const deliveryTotal = activeDeliveries.reduce((s, d) => s + (d.total_price || 0), 0);
  const effectiveDeliveryTotal = deliveryTotal > 0 ? deliveryTotal : (data.estimated_budget || 0);
  const mgmtFee = data.project_mgmt_fee || 0;
  const subtotal = effectiveDeliveryTotal + mgmtFee;
  const hst = Math.round(subtotal * 0.13);
  const grandTotal = subtotal + hst;

  const generateInvoice = async () => {
    setGenerating(true);
    setInvoiceError("");
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtotal, hst, grandTotal }),
      });
      const json = await res.json();
      if (!res.ok) { setInvoiceError(json.error || "Failed to generate invoice"); }
      else {
        setInvoiceUrl(json.invoice_url || null);
        toast("Project invoice generated", "check");
      }
    } catch {
      setInvoiceError("Failed to generate invoice");
    }
    setGenerating(false);
  };

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      <section className="py-5 first:pt-0">
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-4">Project Invoice</div>

        <table className="w-full text-left mb-4">
          <thead>
            <tr className="border-b border-[var(--brd)]">
              {["Line", "Description", "Amount"].map((h) => (
                <th key={h} className="px-2 py-2 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeDeliveries.length > 0 ? activeDeliveries.map((d) => {
              const phase = data.phases.find((p) => p.id === d.phase_id);
              const isCompleted = d.status === "delivered" || d.status === "completed";
              return (
                <tr key={d.id} className="border-b border-[var(--brd)]/50">
                  <td className="px-2 py-2.5 text-[12px] text-[var(--gold)] font-medium">{d.delivery_number}</td>
                  <td className="px-2 py-2.5 text-[12px] text-[var(--tx)]">
                    {phase ? `${phase.phase_name} delivery` : "Delivery"}
                    {!isCompleted && <span className="ml-1.5 text-[9px] font-semibold capitalize text-[var(--tx3)] opacity-60">({d.status})</span>}
                  </td>
                  <td className="px-2 py-2.5 text-[12px] font-medium text-[var(--tx)]">{d.total_price ? formatCurrency(d.total_price) : "-"}</td>
                </tr>
              );
            }) : data.estimated_budget ? (
              <tr className="border-b border-[var(--brd)]/50">
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx3)]">-</td>
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx)]">Estimated Delivery Cost</td>
                <td className="px-2 py-2.5 text-[12px] font-medium text-[var(--tx)]">{formatCurrency(data.estimated_budget)}</td>
              </tr>
            ) : null}
            {mgmtFee > 0 && (
              <tr className="border-b border-[var(--brd)]/50">
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx3)]">-</td>
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx)]">Project Management Fee</td>
                <td className="px-2 py-2.5 text-[12px] font-medium text-[var(--tx)]">{formatCurrency(mgmtFee)}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-2 py-2 text-[12px] text-[var(--tx3)]" colSpan={2}>Subtotal</td>
              <td className="px-2 py-2 text-[12px] font-medium text-[var(--tx)]">{formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td className="px-2 py-2 text-[12px] text-[var(--tx3)]" colSpan={2}>HST (13%)</td>
              <td className="px-2 py-2 text-[12px] font-medium text-[var(--tx)]">{formatCurrency(hst)}</td>
            </tr>
            <tr className="border-t-2 border-[var(--brd)]">
              <td className="px-2 py-3 text-[13px] font-bold text-[var(--tx)]" colSpan={2}>TOTAL (incl. HST)</td>
              <td className="px-2 py-3 text-[13px] font-bold text-[var(--gold)]">{formatCurrency(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {activeDeliveries.length === 0 && !data.estimated_budget && (
          <div className="text-center py-8 text-[var(--tx3)] text-[12px]">No deliveries linked to this project yet</div>
        )}
      </div>
      </section>

      {/* Invoice actions */}
      <section className="py-5 last:pb-0">
      {grandTotal > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {invoiceUrl ? (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
            >
              <ArrowSquareOut size={14} className="text-current" />
              View Invoice
            </a>
          ) : (
            <button
              onClick={generateInvoice}
              disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
            >
              <FileText size={13} />
              {generating ? "Generating…" : "Generate Project Invoice"}
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
          >
            <Truck size={13} className="text-current" />
            Print / Save PDF
          </button>
        </div>
      )}
      {invoiceError && <p className="text-[11px] text-[var(--red)]">{invoiceError}</p>}
      </section>
    </div>
  );
}

/* ─── VENDOR TRACKER TAB ─── */

const VT_RECEIVED = PROJECT_ITEM_RECEIVED_STATUSES;
const VT_TRANSIT = PROJECT_ITEM_TRANSIT_STATUSES;

const VT_STATUS_GROUPS = [
  { key: "needs_action",        label: "Needs Action",          color: "text-amber-500",  statuses: ["ready_for_pickup"] },
  { key: "ordered",             label: "Ordered / In Production", color: "text-sky-400",  statuses: ["spec_selected", "ordered", "in_production"] },
  { key: "in_transit",          label: "In Transit",            color: "text-blue-500",   statuses: ["shipped", "in_transit"] },
  { key: "received",            label: "Received & Stored",     color: "text-emerald-500",statuses: VT_RECEIVED },
  { key: "delivered",           label: "Delivered & Installed", color: "text-purple-500", statuses: ["delivered", "installed"] },
  { key: "issues",              label: "Issues",                color: "text-red-500",    statuses: ["issue_reported"] },
] as const;

function VtItemCard({ item, projectId, deliveries, onRefresh }: { item: InventoryItem; projectId: string; deliveries: DeliveryLink[]; onRefresh: () => void }) {
  const { toast } = useToast();
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trackingNum, setTrackingNum] = useState(item.vendor_tracking_number || "");
  const [carrier, setCarrier] = useState(item.vendor_carrier || "");
  const [trackTimeout, setTrackTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const st = getProjectItemStatus(item);
  const cfg = getProjectItemStatusUi(st);
  const isYugo = item.handled_by === "yugo" || item.vendor_delivery_method === "yugo_pickup";
  const isCarrier = item.handled_by === "other_carrier" || item.vendor_delivery_method === "shipped_carrier";
  const isVendorDirect = item.handled_by === "vendor_direct" || item.vendor_delivery_method === "vendor_direct";

  // Find linked Yugo delivery for this item (by phase match or items array)
  const linkedDelivery = isYugo ? deliveries.find((d) => {
    if (Array.isArray(d.items)) {
      return d.items.some((di: any) => di?.id === item.id || di?.item_id === item.id || di === item.id);
    }
    return false;
  }) || (item.phase_id ? deliveries.find((d) => d.phase_id === item.phase_id && d.status !== "cancelled") : null)
  : null;

  const quickStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    const res = await fetch(`/api/admin/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, item_status: newStatus }),
    });
    if (res.ok) { onRefresh(); toast(`Status updated`, "check"); }
    else toast("Failed to update status", "alertTriangle");
    setUpdatingStatus(false);
  };

  const saveTracking = (num: string, car: string) => {
    if (trackTimeout) clearTimeout(trackTimeout);
    setTrackTimeout(setTimeout(async () => {
      await fetch(`/api/admin/projects/${projectId}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          vendor_tracking_number: num.trim() || null,
          vendor_carrier: car.trim() || null,
        }),
      });
    }, 800));
  };

  const handleTrackingNum = (val: string) => { setTrackingNum(val); saveTracking(val, carrier); };
  const handleCarrier = (val: string) => { setCarrier(val); saveTracking(trackingNum, val); };

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showStatusPicker || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const w = 160;
    const itemCount = VALID_PROJECT_ITEM_STATUSES.length;
    const approxHeight = itemCount * 28 + 16;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < approxHeight && rect.top > approxHeight;
    setDropdownRect({
      top: openAbove ? rect.top - approxHeight - 4 : rect.bottom + 4,
      left: Math.max(8, rect.right - w),
      width: w,
    });
  }, [showStatusPicker]);

  useEffect(() => {
    if (!showStatusPicker) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || (e.target as HTMLElement)?.closest?.("[data-status-picker]")) return;
      setShowStatusPicker(false);
    };
    const t = setTimeout(() => document.addEventListener("click", close), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("click", close);
    };
  }, [showStatusPicker]);

  const deleteItem = async () => {
    if (deleting || !confirm("Remove this item from the project?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/inventory`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id }),
      });
      if (res.ok) { onRefresh(); toast("Item removed", "check"); }
      else toast("Failed to remove item", "alertTriangle");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="py-2.5 space-y-2">
      {/* Row 1: Name + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-semibold text-[var(--tx)]">{item.item_name}</span>
            {(item.quantity || 1) > 1 && <span className="text-[10px] text-[var(--tx3)]">×{item.quantity}</span>}
            {isYugo && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--gold)]/15 text-[var(--gold)]">Yugo</span>}
            {isCarrier && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">CARRIER</span>}
            {isVendorDirect && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">VENDOR SHIP</span>}
          </div>
          {item.room_destination && <p className="text-[10px] text-[var(--tx3)] mt-0.5">{item.room_destination}</p>}
        </div>

        {/* Status badge, click to change */}
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusPicker((v) => !v);
            }}
            disabled={updatingStatus}
            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 ${cfg.bg} ${cfg.color}`}
          >
            {cfg.label}
            <ChevronDown size={9} />
          </button>
          {showStatusPicker && dropdownRect && typeof document !== "undefined" &&
            createPortal(
              <div
                data-status-picker
                className="fixed z-[9999] bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                style={{ top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
                onClick={(e) => e.stopPropagation()}
              >
                {VALID_PROJECT_ITEM_STATUSES.map((s) => {
                  const scfg = getProjectItemStatusUi(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={async () => { setShowStatusPicker(false); await quickStatus(s); }}
                      className={`w-full text-left px-3 py-1.5 text-[10px] font-semibold hover:bg-[var(--bg)] transition-colors first:pt-2 last:pb-2 ${s === st ? `${scfg.color} font-bold` : "text-[var(--tx3)]"}`}
                    >
                      {scfg.label}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
      </div>

      {/* Row 2: Tracking */}
      {isYugo ? (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--gold)]">Yugo Job</span>
          {linkedDelivery ? (
            <Link
              href={getDeliveryDetailPath(linkedDelivery)}
              className="text-[10px] font-mono text-[var(--gold)] hover:underline flex items-center gap-1"
            >
              {linkedDelivery.delivery_number || "Delivery"}
              <ChevronRight size={9} />
            </Link>
          ) : (
            <Link
              href={`/admin/deliveries/new?choice=single&org=${projectId}&projectId=${projectId}${item.phase_id ? `&phaseId=${item.phase_id}` : ""}`}
              className="text-[10px] text-[var(--tx3)] hover:text-[var(--gold)] transition-colors flex items-center gap-1"
            >
              No delivery linked, schedule pickup <ChevronRight size={9} />
            </Link>
          )}
        </div>
      ) : (isCarrier || isVendorDirect) ? (
        <div className="flex items-end gap-2">
          <div className="shrink-0" style={{ width: "5.5rem" }}>
            <label className="text-[9px] font-semibold uppercase tracking-wide text-purple-400 block mb-0.5">Carrier</label>
            <input
              value={carrier}
              onChange={(e) => handleCarrier(e.target.value)}
              placeholder="FedEx, UPS…"
              className="w-full text-[10px] bg-transparent border-b border-[var(--brd)] px-0 py-1 text-[var(--tx)] placeholder:text-[var(--tx3)]/40 outline-none focus:border-purple-400/50 transition-colors"
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[9px] font-semibold uppercase tracking-wide text-purple-400 block mb-0.5">Tracking #</label>
            <input
              value={trackingNum}
              onChange={(e) => handleTrackingNum(e.target.value)}
              placeholder="Enter tracking number…"
              className="w-full text-[10px] font-mono bg-transparent border-b border-[var(--brd)] px-0 py-1 text-[var(--tx)] placeholder:text-[var(--tx3)]/40 outline-none focus:border-purple-400/50 transition-colors"
            />
          </div>
        </div>
      ) : null}

      {/* Row 3: Notes */}
      {(item.status_notes || item.special_handling_notes) && (
        <div className="space-y-0.5">
          {item.status_notes && <p className="text-[10px] text-[var(--tx3)] italic">&quot;{item.status_notes}&quot;</p>}
          {item.special_handling_notes && (
            <p className="text-[10px] text-amber-500 flex items-center gap-1">
              <AlertTriangle size={10} className="shrink-0" />
              {item.special_handling_notes}
            </p>
          )}
        </div>
      )}

      {/* Delete */}
      <div className="pt-1">
        <button
          type="button"
          onClick={deleteItem}
          disabled={deleting}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:underline disabled:opacity-50"
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  );
}

function VendorTrackerTab({ data, projectId, onRefresh }: { data: ProjectData; projectId: string; onRefresh: () => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"vendor" | "room" | "status">("vendor");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");
  const [internalNote, setInternalNote] = useState(data.notes || "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteTimeout, setNoteTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const inv = data.inventory;

  const saveInternalNote = async (val: string) => {
    setSavingNote(true);
    await fetch(`/api/admin/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: val }),
    });
    setSavingNote(false);
    onRefresh();
  };

  const handleNoteChange = (val: string) => {
    setInternalNote(val);
    if (noteTimeout) clearTimeout(noteTimeout);
    setNoteTimeout(setTimeout(() => saveInternalNote(val), 1200));
  };

  const getStatus = (item: InventoryItem) => getProjectItemStatus(item);
  const getVendor = (item: InventoryItem) => item.vendor_name || item.vendor || "No Vendor";

  const totalItems = inv.length;
  // Yugo flow stages (left → right, delivered = final)
  const stageOrdered     = inv.filter((i) => ["spec_selected", "ordered", "in_production"].includes(getStatus(i))).length;
  const stageReadyPickup = inv.filter((i) => getStatus(i) === "ready_for_pickup").length;
  const stageInTransit   = inv.filter((i) => VT_TRANSIT.includes(getStatus(i))).length;
  const stageWarehouse   = inv.filter((i) => ["received_warehouse", "inspected", "stored"].includes(getStatus(i))).length;
  const stageScheduled   = inv.filter((i) => getStatus(i) === "scheduled_delivery").length;
  const stageDelivered   = inv.filter((i) => ["delivered", "installed"].includes(getStatus(i))).length;
  const stageUnassigned  = inv.filter((i) => !i.item_status || i.item_status === "pending").length;
  const issues           = inv.filter((i) => getStatus(i) === "issue_reported").length;
  const viaCarrier       = inv.filter((i) => i.handled_by === "other_carrier" || i.vendor_delivery_method === "shipped_carrier").length;

  const YUGO_STAGES = [
    { key: "ordered",   label: "Ordered", color: "#6B7280" },
    { key: "pickup",    label: "Ready Pickup", color: "#F59E0B" },
    { key: "transit",   label: "In Transit", color: "#3B82F6" },
    { key: "warehouse",  label: "At Warehouse", color: "#14B8A6" },
    { key: "scheduled", label: "Scheduled", color: "#8B5CF6" },
    { key: "delivered", label: "Delivered", color: "#22C55E" },
    { key: "pending",   label: "Pending", color: "#4B5563" },
  ] as const;

  const toggleCollapse = (key: string) =>
    setCollapsed((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  // Build groups based on view mode
  const groups: { key: string; name: string; items: InventoryItem[]; meta?: string }[] =
    groupBy === "vendor"
      ? Array.from(new Set(inv.map(getVendor))).map((name) => ({ key: name, name, items: inv.filter((i) => getVendor(i) === name) }))
      : groupBy === "room"
      ? Array.from(new Set(inv.map((i) => i.room_destination || "No Room Assigned"))).sort().map((room) => ({ key: room, name: room, items: inv.filter((i) => (i.room_destination || "No Room Assigned") === room) }))
      : VT_STATUS_GROUPS.map((g) => ({ key: g.key, name: g.label, items: inv.filter((i) => g.statuses.includes(getStatus(i) as never)), meta: g.color })).filter((g) => g.items.length > 0);

  return (
    <div className="divide-y divide-[var(--brd)]/50">
      {/* Stats */}
      <section className="py-5 first:pt-0">
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {[
          { label: "Total",          value: totalItems,       color: "text-[var(--tx)]" },
          { label: "Delivered ✓",    value: stageDelivered,  color: "text-emerald-500" },
          { label: "At Warehouse",   value: stageWarehouse,  color: "text-teal-500" },
          { label: "Ready Pickup",   value: stageReadyPickup,color: "text-amber-500" },
          { label: "In Transit",     value: stageInTransit,  color: "text-sky-500" },
          { label: "Via Carrier",    value: viaCarrier,      color: viaCarrier > 0 ? "text-purple-400" : "text-[var(--tx3)]" },
          { label: "Issues",         value: issues,          color: issues > 0 ? "text-red-500" : "text-[var(--tx3)]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center py-2">
            <div className={`text-[20px] font-bold ${color}`}>{value}</div>
            <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--tx3)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>
      </section>

      {/* Yugo flow progress bar, fills only as items move toward delivery, 100% = all delivered */}
      <section className="py-5">
      <div className="py-2">
        {(() => {
          const stageWeight = (st: ProjectItemStatus) =>
            st === "delivered" || st === "installed" ? 100 : st === "scheduled_delivery" ? 85 : ["received_warehouse", "inspected", "stored"].includes(st) ? 70 : st === "ready_for_pickup" ? 45 : VT_TRANSIT.includes(st) ? 55 : ["spec_selected", "ordered", "in_production"].includes(st) ? 15 : 0;
          const avgProgress = totalItems > 0 ? inv.reduce((sum, i) => sum + stageWeight(getStatus(i)), 0) / totalItems : 0;
          return (
            <>
              <div className="flex justify-between text-[10px] text-[var(--tx3)] mb-1.5">
                <span className="font-semibold text-[var(--tx)]">{stageDelivered} of {totalItems} delivered</span>
                <span className="font-medium">{Math.round(avgProgress)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--brd)]/30 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
            </>
          );
        })()}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
          {YUGO_STAGES.map((s) => {
            const count = s.key === "ordered" ? stageOrdered : s.key === "pickup" ? stageReadyPickup : s.key === "transit" ? stageInTransit : s.key === "warehouse" ? stageWarehouse : s.key === "scheduled" ? stageScheduled : s.key === "delivered" ? stageDelivered : stageUnassigned;
            return count > 0 ? (
              <span key={s.key} className="text-[9px] font-medium flex items-center gap-1" style={{ color: s.color }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label}: {count}
              </span>
            ) : null;
          })}
        </div>
      </div>
      </section>

      {/* View toggle: Compact | Detailed */}
      <section className="py-5">
      <div className="inline-flex p-1 rounded-xl bg-[var(--brd)]/20 border border-[var(--brd)]/40">
        {(["compact", "detailed"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 capitalize ${
              viewMode === mode
                ? "text-[var(--tx)] bg-[var(--card)] shadow-sm border border-[var(--brd)]/50"
                : "text-[var(--tx3)] hover:text-[var(--tx2)] hover:bg-[var(--bg)]/50"
            }`}
          >
            {mode === "compact" ? "Compact" : "Detailed"}
          </button>
        ))}
      </div>
      </section>

      {/* Compact view: flat table */}
      {viewMode === "compact" && (
        <section className="py-5">
        {inv.length === 0 ? (
          <p className="text-center py-10 text-[var(--tx3)] text-[13px]">No inventory items yet</p>
        ) : (
          <VendorStatusCompactTable inventory={inv} />
        )}
        </section>
      )}

      {/* Detailed view: group-by toggles */}
      {viewMode === "detailed" && (
      <>
      <section className="py-5">
      <div className="inline-flex p-1 rounded-xl bg-[var(--brd)]/20 border border-[var(--brd)]/40">
        {(["vendor", "room", "status"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setGroupBy(mode)}
            className={`px-4 py-2 rounded-lg text-[11px] font-semibold transition-all duration-200 capitalize ${
              groupBy === mode
                ? "text-[var(--tx)] bg-[var(--card)] shadow-sm border border-[var(--brd)]/50"
                : "text-[var(--tx3)] hover:text-[var(--tx2)] hover:bg-[var(--bg)]/50"
            }`}
          >
            By {mode === "status" ? "Status" : mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      </section>

      {/* Groups */}
      <section className="py-5">
      {inv.length === 0 ? (
        <p className="text-center py-10 text-[var(--tx3)] text-[13px]">No inventory items yet</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isCollapsed = collapsed.has(group.key);
            const gReceived = group.items.filter((i) => VT_RECEIVED.includes(getStatus(i))).length;
            const gTransit = group.items.filter((i) => VT_TRANSIT.includes(getStatus(i))).length;
            const gIssues = group.items.filter((i) => getStatus(i) === "issue_reported").length;
            const contactItem = groupBy === "vendor" ? group.items.find((i) => i.vendor_contact_phone || i.vendor_contact_email) : null;

            return (
              <div key={group.key} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--bg)]/50 transition-colors rounded-lg"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed
                      ? <ChevronRight size={14} className="text-[var(--tx3)]" />
                      : <ChevronDown size={14} className="text-[var(--tx3)]" />}
                    <span className={`text-[12px] font-bold uppercase tracking-wide ${group.meta || "text-[var(--tx)]"}`}>{group.name}</span>
                    <span className="text-[11px] text-[var(--tx3)]">({group.items.length})</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-semibold">
                    {gIssues > 0 && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{gIssues} issue{gIssues > 1 ? "s" : ""}</span>}
                    {gReceived > 0 && <span className="text-emerald-500">{gReceived} received</span>}
                    {gTransit > 0 && <span className="text-sky-500">{gTransit} in transit</span>}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="pl-3 pt-1 space-y-2">
                    {/* Contact strip (vendor view only) */}
                    {contactItem && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[11px] text-[var(--tx3)]">
                        {contactItem.vendor_contact_name && <span className="font-semibold text-[var(--tx)]">{contactItem.vendor_contact_name}</span>}
                        {contactItem.vendor_contact_phone && (
                          <a href={`tel:${contactItem.vendor_contact_phone}`} className="text-[var(--gold)] hover:underline">{contactItem.vendor_contact_phone}</a>
                        )}
                        {contactItem.vendor_contact_email && (
                          <a href={`mailto:${contactItem.vendor_contact_email}`} className="text-[var(--gold)] hover:underline">{contactItem.vendor_contact_email}</a>
                        )}
                        {contactItem.vendor_pickup_address && <span className="text-[var(--tx3)] flex items-center gap-1"><MapPin size={10} className="shrink-0" />{contactItem.vendor_pickup_address}</span>}
                        {contactItem.vendor_pickup_window && <span className="text-[var(--tx3)] flex items-center gap-1"><Clock size={10} className="shrink-0" />{contactItem.vendor_pickup_window}</span>}
                      </div>
                    )}

                    {/* Items */}
                    {group.items.map((item) => (
                      <VtItemCard key={item.id} item={item} projectId={projectId} deliveries={data.deliveries} onRefresh={onRefresh} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </section>

      {/* Internal notes (admin-only) */}
      <section className="py-5 last:pb-0">
      <div className="py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Lock size={11} /> Internal Notes (Admin Only)
          </span>
          {savingNote && <span className="text-[10px] text-[var(--tx3)]">Saving…</span>}
        </div>
        <textarea
          value={internalNote}
          onChange={(e) => handleNoteChange(e.target.value)}
          rows={3}
          placeholder="Internal notes not visible to the designer. Issues, scheduling notes, logistics remarks…"
          className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] outline-none resize-none focus:border-amber-500/50 transition-colors"
        />
      </div>
      </section>
      </>
      )}
    </div>
  );
}

/* ─── SHARED COMPONENTS ─── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[12px] py-0.5">
      <span className="text-[var(--tx3)]">{label}</span>
      <span className="text-[var(--tx)] font-medium text-right max-w-[65%]">{value}</span>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">{label}</div>
      <div className="text-[24px] font-bold text-[var(--tx)] mt-1 font-hero">{value}</div>
      <div className="text-[11px] text-[var(--tx3)]">{sub}</div>
    </div>
  );
}

function TimelineIcon({ type }: { type: string }) {
  const iconProps = { size: 14 };
  const baseClass = "w-6 h-6 rounded-full flex items-center justify-center";

  switch (type) {
    case "created":
      return <div className={`${baseClass} bg-blue-500/10`}><Plus {...iconProps} className="text-blue-500" /></div>;
    case "item_received":
    case "item_inspected":
      return <div className={`${baseClass} bg-emerald-500/10`}><CheckCircle2 {...iconProps} className="text-emerald-500" /></div>;
    case "phase_started":
    case "phase_completed":
    case "phase_added":
      return <div className={`${baseClass} bg-purple-500/10`}><CheckCircle2 {...iconProps} className="text-purple-500" /></div>;
    case "delivery_scheduled":
    case "delivery_completed":
      return <div className={`${baseClass} bg-[var(--gold)]/10`}><Truck {...iconProps} className="text-[var(--gold)]" /></div>;
    case "issue_flagged":
      return <div className={`${baseClass} bg-red-500/10`}><AlertCircle {...iconProps} className="text-red-500" /></div>;
    case "invoice_generated":
      return <div className={`${baseClass} bg-purple-500/10`}><FileText {...iconProps} className="text-purple-500" /></div>;
    default:
      return <div className={`${baseClass} bg-[var(--tx3)]/10`}><Clock {...iconProps} className="text-[var(--tx3)]" /></div>;
  }
}
