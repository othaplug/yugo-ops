"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { formatCurrency } from "@/lib/format-currency";
import { Plus, Package, Truck, Clock, CheckCircle2, AlertCircle, Camera, FileText, Send } from "lucide-react";

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
  actual_cost: number | null;
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
}

interface InventoryItem {
  id: string;
  phase_id: string | null;
  item_name: string;
  description: string | null;
  vendor: string | null;
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
  yugo: { bg: "bg-[var(--gold)]/15", text: "text-[var(--gold)]", label: "YUGO" },
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
  active: { bg: "bg-amber-500/10", text: "text-amber-500", icon: Package },
  completed: { bg: "bg-emerald-500/10", text: "text-emerald-500", icon: CheckCircle2 },
  skipped: { bg: "bg-[var(--tx3)]/5", text: "text-[var(--tx3)]/50", icon: Clock },
};

const INV_STATUS_COLORS: Record<string, string> = {
  expected: "text-[var(--tx3)]",
  received: "text-blue-500",
  inspected: "text-blue-600",
  stored: "text-purple-500",
  scheduled_for_delivery: "text-amber-500",
  delivered: "text-emerald-500",
  installed: "text-emerald-600",
  returned: "text-orange-500",
  damaged: "text-red-500",
};

const TABS = ["Overview", "Phases", "Inventory", "Deliveries", "Timeline", "Invoice"];
const fieldInput = "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors";

export default function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Overview");
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Modals
  const [showAddItem, setShowAddItem] = useState(false);
  const [showReceiveItem, setShowReceiveItem] = useState<string | null>(null);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

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

  if (loading) {
    return <div className="px-6 py-8"><div className="animate-pulse h-8 w-48 bg-[var(--brd)] rounded mb-4" /><div className="animate-pulse h-64 bg-[var(--brd)] rounded" /></div>;
  }

  if (!data) {
    return <div className="px-6 py-8 text-[var(--tx3)]">Project not found</div>;
  }

  const completedPhases = data.phases.filter((p) => p.status === "completed").length;
  const totalPhases = data.phases.length;
  const progressPct = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;
  const budgetTotal = (data.estimated_budget || 0) + (data.project_mgmt_fee || 0);

  return (
    <div className="px-4 sm:px-6 py-5">
      <BackButton href="/admin/projects" label="Projects" />

      {/* Header */}
      <div className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">
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
          <span>Budget: <span className="text-[var(--tx)] font-medium">{formatCurrency(data.actual_cost || 0)} / {formatCurrency(budgetTotal)}</span></span>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {data.status === "draft" && (
            <button onClick={() => updateStatus("proposed")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors disabled:opacity-40">
              <Send size={12} className="inline mr-1" /> Send Proposal
            </button>
          )}
          {data.status === "proposed" && (
            <button onClick={() => updateStatus("active")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-40">
              <CheckCircle2 size={12} className="inline mr-1" /> Mark Active
            </button>
          )}
          {data.status === "active" && (
            <>
              <button onClick={() => updateStatus("completed")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors disabled:opacity-40">
                <CheckCircle2 size={12} className="inline mr-1" /> Complete
              </button>
              <button onClick={() => updateStatus("on_hold")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors disabled:opacity-40">
                Hold
              </button>
            </>
          )}
          {data.status === "completed" && (
            <button onClick={() => updateStatus("invoiced")} disabled={statusUpdating} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-colors disabled:opacity-40">
              <FileText size={12} className="inline mr-1" /> Mark Invoiced
            </button>
          )}
        </div>
      </div>

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
        {activeTab === "Overview" && <OverviewTab data={data} progressPct={progressPct} completedPhases={completedPhases} totalPhases={totalPhases} budgetTotal={budgetTotal} />}
        {activeTab === "Phases" && <PhasesTab data={data} onRefresh={loadProject} projectId={projectId} showAddPhase={showAddPhase} setShowAddPhase={setShowAddPhase} />}
        {activeTab === "Inventory" && <InventoryTab data={data} onRefresh={loadProject} projectId={projectId} showAddItem={showAddItem} setShowAddItem={setShowAddItem} showReceiveItem={showReceiveItem} setShowReceiveItem={setShowReceiveItem} />}
        {activeTab === "Deliveries" && <DeliveriesTab data={data} />}
        {activeTab === "Timeline" && <TimelineTab data={data} projectId={projectId} onRefresh={loadProject} showAddNote={showAddNote} setShowAddNote={setShowAddNote} />}
        {activeTab === "Invoice" && <InvoiceTab data={data} />}
      </div>
    </div>
  );
}

/* ─── OVERVIEW TAB ─── */
function OverviewTab({ data, progressPct, completedPhases, totalPhases, budgetTotal }: { data: ProjectData; progressPct: number; completedPhases: number; totalPhases: number; budgetTotal: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        {/* Progress */}
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

        {/* Project Details */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 space-y-2">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Details</div>
          {data.description && <InfoRow label="Description" value={data.description} />}
          <InfoRow label="Partner" value={`${data.organizations?.name || "—"} (${data.organizations?.type || ""})`} />
          {data.end_client_name && <InfoRow label="End Client" value={data.end_client_name} />}
          {data.end_client_contact && <InfoRow label="Contact" value={data.end_client_contact} />}
          {data.site_address && <InfoRow label="Site" value={data.site_address} />}
          <InfoRow label="Start" value={data.start_date ? new Date(data.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD"} />
          <InfoRow label="Target End" value={data.target_end_date ? new Date(data.target_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "TBD"} />
        </div>
      </div>

      <div className="space-y-5">
        {/* Budget */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Budget</div>
          <div className="text-[28px] font-bold text-[var(--tx)] font-hero">{formatCurrency(data.actual_cost || 0)}</div>
          <div className="text-[12px] text-[var(--tx3)]">of {formatCurrency(budgetTotal)} estimated</div>
          <div className="relative h-2 bg-[var(--bg)] rounded-full overflow-hidden mt-3">
            <div className="absolute inset-y-0 left-0 bg-[var(--gold)] rounded-full transition-all" style={{ width: `${budgetTotal > 0 ? Math.min(((data.actual_cost || 0) / budgetTotal) * 100, 100) : 0}%` }} />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Inventory Items" value={String(data.inventory.length)} sub={`${data.inventory.filter((i) => i.status !== "expected").length} received`} />
          <StatCard label="Deliveries" value={String(data.deliveries.length)} sub={`${data.deliveries.filter((d) => d.status === "delivered" || d.status === "completed").length} completed`} />
        </div>

        {/* Recent Activity */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
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
        </div>
      </div>
    </div>
  );
}

/* ─── PHASES TAB ─── */
function PhasesTab({ data, onRefresh, projectId, showAddPhase, setShowAddPhase }: { data: ProjectData; onRefresh: () => void; projectId: string; showAddPhase: boolean; setShowAddPhase: (v: boolean) => void }) {
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newPhaseDate, setNewPhaseDate] = useState("");
  const [expandedPhase, setExpandedPhase] = useState<string | null>(data.phases.find((p) => p.status === "active")?.id || data.phases[0]?.id || null);

  const addPhase = async () => {
    if (!newPhaseName.trim()) return;
    await fetch(`/api/admin/projects/${projectId}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase_name: newPhaseName, scheduled_date: newPhaseDate || null }),
    });
    setNewPhaseName("");
    setNewPhaseDate("");
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
    <div>
      {/* Visual Timeline */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
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
                <div className="text-[9px] text-[var(--tx3)] capitalize">{phase.status}{phase.scheduled_date ? ` · ${new Date(phase.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</div>
              </div>
              {i < data.phases.length - 1 && <span className="text-[var(--tx3)] ml-1">→</span>}
            </button>
          );
        })}
      </div>

      {/* Expanded Phase Detail */}
      {expandedPhase && (() => {
        const phase = data.phases.find((p) => p.id === expandedPhase);
        if (!phase) return null;
        const phaseItems = data.inventory.filter((i) => i.phase_id === phase.id);
        const phaseDeliveries = data.deliveries.filter((d) => d.phase_id === phase.id);

        return (
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-[var(--tx)]">{phase.phase_name}</h3>
                {phase.description && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{phase.description}</p>}
              </div>
              <div className="flex gap-2">
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
                    {phaseItems.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--brd)]/50">
                        <td className="px-2 py-2 text-[12px] font-medium text-[var(--tx)]">{item.item_name}</td>
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{item.vendor || "—"}</td>
                        <td className="px-2 py-2">
                          <span className={`text-[10px] font-semibold capitalize ${INV_STATUS_COLORS[item.status] || ""}`}>{item.status.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{item.received_date ? new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</td>
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)] capitalize">{item.condition_on_receipt?.replace(/_/g, " ") || "—"}</td>
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{item.storage_location || "—"}</td>
                      </tr>
                    ))}
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
                      <Truck size={14} className="text-[var(--gold)]" />
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

      {/* Add Phase */}
      {showAddPhase ? (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 space-y-3">
          <input value={newPhaseName} onChange={(e) => setNewPhaseName(e.target.value)} placeholder="Phase name..." className={fieldInput} autoFocus />
          <input type="date" value={newPhaseDate} onChange={(e) => setNewPhaseDate(e.target.value)} className={fieldInput} />
          <div className="flex gap-2">
            <button onClick={addPhase} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add Phase</button>
            <button onClick={() => setShowAddPhase(false)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddPhase(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold border border-dashed border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors">
          <Plus size={14} /> Add Phase
        </button>
      )}
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
  const [newItemPhase, setNewItemPhase] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemHandledBy, setNewItemHandledBy] = useState<string>("yugo");
  const [newItemCarrier, setNewItemCarrier] = useState("");
  const [newItemTrackingNum, setNewItemTrackingNum] = useState("");
  const [search, setSearch] = useState("");

  // Receive item form
  const [receiveCondition, setReceiveCondition] = useState("perfect");
  const [receiveStorage, setReceiveStorage] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");

  const addItem = async () => {
    if (!newItemName.trim()) return;
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_name: newItemName,
        vendor: newItemVendor || null,
        phase_id: newItemPhase || null,
        quantity: parseInt(newItemQty) || 1,
        handled_by: newItemHandledBy || "yugo",
        vendor_carrier: newItemCarrier || null,
        vendor_tracking_number: newItemTrackingNum || null,
      }),
    });
    setNewItemName("");
    setNewItemVendor("");
    setNewItemPhase("");
    setNewItemQty("1");
    setNewItemHandledBy("yugo");
    setNewItemCarrier("");
    setNewItemTrackingNum("");
    setShowAddItem(false);
    onRefresh();
  };

  const receiveItem = async () => {
    if (!showReceiveItem) return;
    await fetch(`/api/admin/projects/${projectId}/inventory`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: showReceiveItem,
        status: "received",
        received_date: new Date().toISOString().slice(0, 10),
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

  const filtered = data.inventory.filter((i) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return i.item_name.toLowerCase().includes(q) || (i.vendor || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className={`${fieldInput} w-[220px]`} />
        <button onClick={() => setShowAddItem(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]">
          <Plus size={13} /> Add Item
        </button>
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" className={fieldInput} autoFocus />
            <input value={newItemVendor} onChange={(e) => setNewItemVendor(e.target.value)} placeholder="Vendor" className={fieldInput} />
            <select value={newItemPhase} onChange={(e) => setNewItemPhase(e.target.value)} className={fieldInput}>
              <option value="">No phase</option>
              {data.phases.map((p) => <option key={p.id} value={p.id}>{p.phase_name}</option>)}
            </select>
            <input type="number" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} placeholder="Qty" min="1" className={fieldInput} />
            <select value={newItemHandledBy} onChange={(e) => setNewItemHandledBy(e.target.value)} className={fieldInput}>
              <option value="yugo">Yugo (white-glove)</option>
              <option value="vendor_direct">Vendor Direct</option>
              <option value="other_carrier">Other Carrier</option>
            </select>
            {newItemHandledBy !== "yugo" && (
              <>
                <input value={newItemCarrier} onChange={(e) => setNewItemCarrier(e.target.value)} placeholder="Carrier (e.g., FedEx, DHL)" className={fieldInput} />
                <input value={newItemTrackingNum} onChange={(e) => setNewItemTrackingNum(e.target.value)} placeholder="Tracking number" className={fieldInput} />
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={addItem} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
            <button onClick={() => setShowAddItem(false)} className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Receive Item Modal */}
      {showReceiveItem && (() => {
        const item = data.inventory.find((i) => i.id === showReceiveItem);
        if (!item) return null;
        return (
          <div className="bg-[var(--card)] border border-[var(--gold)]/30 rounded-xl p-4 mb-4 space-y-3">
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
        );
      })()}

      {/* Items Table */}
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
                return (
                  <tr key={item.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--gdim)]/20">
                    <td className="px-2 py-2.5">
                      <div className="text-[12px] font-medium text-[var(--tx)]">{item.item_name}</div>
                      {item.quantity > 1 && <span className="text-[10px] text-[var(--tx3)]">×{item.quantity}</span>}
                    </td>
                    <td className="px-2 py-2.5 text-[11px] text-[var(--tx3)]">{item.vendor || "—"}</td>
                    <td className="px-2 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`text-[10px] font-semibold capitalize ${INV_STATUS_COLORS[item.status] || ""}`}>{item.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-2 py-2.5 text-[11px]">
                      {handler === "yugo" ? (
                        <span className="text-[var(--tx3)]">—</span>
                      ) : item.vendor_tracking_number ? (
                        <a
                          href={item.vendor_carrier?.toLowerCase().includes("fedex") ? `https://www.fedex.com/fedextrack/?trknbr=${item.vendor_tracking_number}` : item.vendor_carrier?.toLowerCase().includes("dhl") ? `https://www.dhl.com/en/express/tracking.html?AWB=${item.vendor_tracking_number}` : item.vendor_carrier?.toLowerCase().includes("ups") ? `https://www.ups.com/track?tracknum=${item.vendor_tracking_number}` : "#"}
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
                    <td className="px-2 py-2.5 text-[11px] text-[var(--tx3)]">{item.received_date ? new Date(item.received_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : item.expected_delivery_date ? `ETA ${new Date(item.expected_delivery_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "—"}</td>
                    <td className="px-2 py-2.5">
                      {handler === "yugo" && item.status !== "delivered" && item.status !== "installed" && (
                        <span className="text-[10px] text-[var(--tx3)]">Auto-tracked</span>
                      )}
                      {handler !== "yugo" && item.status === "expected" && (
                        <button onClick={() => setShowReceiveItem(item.id)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Update</button>
                      )}
                      {handler === "yugo" && (item.status === "delivered" || item.status === "installed") && (
                        <span className="text-[10px] text-emerald-500 font-semibold">View PoD</span>
                      )}
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
                  <Package className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-[var(--tx)]">{nonYugoCount} item{nonYugoCount > 1 ? "s" : ""} tracked manually this month</div>
                    <p className="text-[11px] text-[var(--tx3)] mt-1">
                      Want guaranteed white-glove handling with real-time tracking, photo documentation, and proof of delivery?
                    </p>
                    <Link
                      href={`/admin/deliveries/new?org=${data.partner_id}&projectId=${projectId}`}
                      className="inline-flex items-center gap-1 mt-3 px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
                    >
                      <Truck size={13} /> Schedule these with Yugo
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ─── DELIVERIES TAB ─── */
function DeliveriesTab({ data }: { data: ProjectData }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-[12px] text-[var(--tx3)]">{data.deliveries.length} deliver{data.deliveries.length !== 1 ? "ies" : "y"} linked</div>
        <Link
          href={`/admin/deliveries/new?org=${data.partner_id}`}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
        >
          <Plus size={13} /> Create Delivery
        </Link>
      </div>

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
                      <Link href={`/admin/deliveries/${d.id}`} className="text-[12px] font-semibold text-[var(--gold)] hover:underline">{d.delivery_number || "—"}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{phase?.phase_name || "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx3)]">{itemCount} item{itemCount !== 1 ? "s" : ""}</td>
                    <td className="px-3 py-2.5 text-[12px] font-medium text-[var(--tx)]">{d.total_price ? formatCurrency(d.total_price) : "—"}</td>
                    <td className="px-3 py-2.5 text-[10px] font-semibold capitalize text-[var(--tx3)]">{d.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
    <div>
      <button onClick={() => setShowAddNote(!showAddNote)} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] mb-4">
        <Plus size={13} /> Add Note
      </button>

      {showAddNote && (
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
      )}

      {/* Timeline List */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-[var(--brd)]" />
        {data.timeline.map((e) => (
          <div key={e.id} className="relative pb-5">
            <div className="absolute left-[-16px] top-1">
              <TimelineIcon type={e.event_type} />
            </div>
            <div className="ml-4">
              <div className="text-[12px] font-medium text-[var(--tx)]">{e.event_description}</div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        {data.timeline.length === 0 && <div className="text-[12px] text-[var(--tx3)] ml-4">No activity yet</div>}
      </div>
    </div>
  );
}

/* ─── INVOICE TAB ─── */
function InvoiceTab({ data }: { data: ProjectData }) {
  const activeDeliveries = data.deliveries.filter((d) => d.status !== "cancelled");
  const deliveryTotal = activeDeliveries.reduce((s, d) => s + (d.total_price || 0), 0);
  // Use estimated budget if no delivery prices are set yet
  const effectiveDeliveryTotal = deliveryTotal > 0 ? deliveryTotal : (data.estimated_budget || 0);
  const mgmtFee = data.project_mgmt_fee || 0;
  const subtotal = effectiveDeliveryTotal + mgmtFee;
  const hst = Math.round(subtotal * 0.13);
  const grandTotal = subtotal + hst;

  return (
    <div>
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
                  <td className="px-2 py-2.5 text-[12px] font-medium text-[var(--tx)]">{d.total_price ? formatCurrency(d.total_price) : "—"}</td>
                </tr>
              );
            }) : data.estimated_budget ? (
              <tr className="border-b border-[var(--brd)]/50">
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx3)]">—</td>
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx)]">Estimated Delivery Cost</td>
                <td className="px-2 py-2.5 text-[12px] font-medium text-[var(--tx)]">{formatCurrency(data.estimated_budget)}</td>
              </tr>
            ) : null}
            {mgmtFee > 0 && (
              <tr className="border-b border-[var(--brd)]/50">
                <td className="px-2 py-2.5 text-[12px] text-[var(--tx3)]">—</td>
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
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
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
      return <div className={`${baseClass} bg-emerald-500/10`}><Package {...iconProps} className="text-emerald-500" /></div>;
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
