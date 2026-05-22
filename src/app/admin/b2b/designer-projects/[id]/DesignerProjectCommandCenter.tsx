"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/design-system/admin/lib/cn";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";
import {
  CaretLeft,
  Buildings,
  Truck,
  Package,
  CalendarCheck,
  Plus,
  Check,
  Warning,
  PencilSimple,
  Trash,
  ArrowRight,
  Clock,
  Camera,
} from "@phosphor-icons/react";
import type {
  DesignerPhase,
  VendorReadiness,
  ProjectVendor,
  ProjectInventoryItem,
} from "@/lib/designer-projects/types";
import {
  DESIGNER_PHASE_LABELS,
  VENDOR_READINESS_LABELS,
  PHASE_ORDER,
} from "@/lib/designer-projects/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  id: string;
  event_type: string;
  event_description: string;
  photos: string[] | null;
  created_at: string;
}

interface DeliveryJob {
  id: string;
  delivery_number: string;
  status: string;
  delivery_date: string | null;
  delivery_address: string | null;
}

interface ProjectData {
  id: string;
  project_number: string;
  project_name: string;
  end_client_name: string | null;
  end_client_contact: string | null;
  site_address: string | null;
  install_unit: string | null;
  install_floor: string | null;
  install_access: string | null;
  install_access_notes: string | null;
  rooms: Array<{ room: string; notes?: string }> | null;
  placement_spec_url: string | null;
  designer_phase: DesignerPhase | null;
  status: string;
  target_end_date: string | null;
  estimated_budget: number | null;
  coordinator_name: string | null;
  hubspot_deal_id: string | null;
  delivery_job_id: string | null;
  notes: string | null;
  partner_id: string;
  created_at: string;
  organizations: { id: string; name: string; type: string } | null;
  project_vendors: ProjectVendor[];
  project_inventory: ProjectInventoryItem[];
  project_timeline: TimelineEntry[];
  deliveryJob: DeliveryJob | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_BADGE: Record<DesignerPhase, string> = {
  planning: "bg-gray-100 text-gray-600",
  vendor_coordination: "bg-amber-100 text-amber-700",
  staging: "bg-blue-100 text-blue-700",
  install_ready: "bg-emerald-100 text-emerald-700",
  install_scheduled: "bg-[#66143D]/10 text-[#66143D]",
  completed: "bg-[#2B3927]/10 text-[#2B3927]",
};

const READINESS_CONFIG: Record<
  VendorReadiness,
  { badge: string; dot: string; label: string }
> = {
  pending:   { badge: "bg-gray-100 text-gray-600",      dot: "bg-gray-300",   label: "Pending" },
  confirmed: { badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Confirmed" },
  partial:   { badge: "bg-amber-100 text-amber-700",    dot: "bg-amber-400",  label: "Partial" },
  delayed:   { badge: "bg-red-100 text-red-600",        dot: "bg-red-400",    label: "Delayed" },
  received:  { badge: "bg-[#2B3927]/10 text-[#2B3927]", dot: "bg-[#2B3927]", label: "Received" },
};

const ITEM_STATUS_BADGE: Record<string, string> = {
  spec_selected:      "bg-gray-100 text-gray-600",
  ordered:            "bg-blue-100 text-blue-700",
  in_production:      "bg-blue-100 text-blue-700",
  ready_for_pickup:   "bg-amber-100 text-amber-700",
  shipped:            "bg-sky-100 text-sky-700",
  in_transit:         "bg-sky-100 text-sky-700",
  received_warehouse: "bg-emerald-100 text-emerald-700",
  inspected:          "bg-emerald-100 text-emerald-700",
  stored:             "bg-emerald-100 text-emerald-700",
  scheduled_delivery: "bg-amber-100 text-amber-700",
  delivered:          "bg-emerald-100 text-emerald-700",
  installed:          "bg-[#2B3927]/10 text-[#2B3927]",
  issue_reported:     "bg-red-100 text-red-700",
  pending:            "bg-gray-100 text-gray-500",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  spec_selected: "Spec'd", ordered: "Ordered", in_production: "In Production",
  ready_for_pickup: "Ready for Pickup", shipped: "Shipped", in_transit: "In Transit",
  received_warehouse: "Received", inspected: "Inspected", stored: "Stored",
  scheduled_delivery: "Delivery Scheduled", delivered: "Delivered", installed: "Installed",
  issue_reported: "Issue", pending: "Pending",
};

// ─── Phase rail ───────────────────────────────────────────────────────────────

function PhaseRail({ currentPhase }: { currentPhase: DesignerPhase | null }) {
  const currentIndex = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PHASE_ORDER.map((phase, i) => {
        const isDone = i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <div key={phase} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap",
                isCurrent
                  ? PHASE_BADGE[phase]
                  : isDone
                  ? "bg-[#2B3927]/8 text-[#2B3927]/60"
                  : "text-[var(--yu3-ink-muted)]",
              )}
            >
              {isDone && <Check size={10} weight="bold" />}
              {DESIGNER_PHASE_LABELS[phase]}
            </div>
            {i < PHASE_ORDER.length - 1 && (
              <div
                className={cn(
                  "w-4 h-px mx-0.5",
                  i < currentIndex ? "bg-[#2B3927]/30" : "bg-gray-200",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Vendor card ──────────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  vendorNumber,
  items,
  projectId,
  onUpdate,
}: {
  vendor: ProjectVendor;
  vendorNumber: number;
  items: ProjectInventoryItem[];
  projectId: string;
  onUpdate: (v: ProjectVendor) => void;
}) {
  const [saving, setSaving] = useState(false);
  const rc = READINESS_CONFIG[vendor.readiness] || READINESS_CONFIG.pending;

  const updateReadiness = async (readiness: VendorReadiness) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/designer-projects/${projectId}/vendors/${vendor.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readiness }),
        },
      );
      if (res.ok) {
        const { vendor: updated } = await res.json();
        onUpdate(updated);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--yu3-line)] overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#2B0416]/6 flex items-center justify-center text-[11px] font-bold text-[#2B0416] shrink-0">
              {vendorNumber}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#2B0416] truncate">
                {vendor.vendor_name}
              </p>
              {vendor.vendor_address && (
                <p className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                  {vendor.vendor_address}
                </p>
              )}
            </div>
          </div>

          {/* Readiness control */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className={cn("w-2 h-2 rounded-full", rc.dot)} />
            <select
              value={vendor.readiness}
              onChange={(e) => updateReadiness(e.target.value as VendorReadiness)}
              disabled={saving}
              className={cn(
                "text-[11px] font-semibold border-none bg-transparent cursor-pointer focus:outline-none",
                rc.badge.includes("text-") ? rc.badge.split(" ")[1] : "text-gray-600",
              )}
            >
              {(Object.keys(READINESS_CONFIG) as VendorReadiness[]).map((r) => (
                <option key={r} value={r}>{VENDOR_READINESS_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contact */}
        {vendor.contact_name && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--yu3-ink-muted)]">
            <span>{vendor.contact_name}</span>
            {vendor.contact_phone && (
              <>
                <span>·</span>
                <a href={`tel:${vendor.contact_phone}`} className="text-[#66143D] hover:underline">
                  {vendor.contact_phone}
                </a>
              </>
            )}
          </div>
        )}

        {/* Items for this vendor */}
        {items.length > 0 && (
          <div className="mt-3 space-y-1">
            {items.map((item) => {
              const status = item.item_status || item.status || "pending";
              return (
                <div key={item.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--yu3-ink-muted)] truncate mr-2">
                    {item.quantity > 1 ? `${item.quantity}× ` : ""}
                    {item.item_name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                      ITEM_STATUS_BADGE[status] || "bg-gray-100 text-gray-600",
                    )}
                  >
                    {ITEM_STATUS_LABELS[status] || status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        {vendor.readiness_notes && (
          <p className="mt-2 text-[11px] text-amber-600 italic">
            ⚠ {vendor.readiness_notes}
          </p>
        )}
        {vendor.vendor_access_notes && (
          <p className="mt-1 text-[11px] text-[var(--yu3-ink-muted)]">
            📍 {vendor.vendor_access_notes}
          </p>
        )}
        {vendor.pickup_date && (
          <p className="mt-1 text-[11px] text-[var(--yu3-ink-muted)]">
            Pickup: {formatMoveDate(vendor.pickup_date)}
            {vendor.pickup_window ? ` · ${vendor.pickup_window}` : ""}
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="border-t border-[var(--yu3-line)] px-4 py-2 flex gap-4 bg-[var(--yu3-bg-surface)]">
        {vendor.readiness === "pending" && (
          <button
            onClick={() => updateReadiness("confirmed")}
            disabled={saving}
            className="text-[11px] text-emerald-700 font-semibold ml-auto hover:opacity-80 flex items-center gap-1"
          >
            <Check size={11} /> Mark confirmed
          </button>
        )}
        {vendor.readiness === "confirmed" && (
          <button
            onClick={() => updateReadiness("received")}
            disabled={saving}
            className="text-[11px] text-[#2B3927] font-semibold ml-auto hover:opacity-80 flex items-center gap-1"
          >
            <Check size={11} /> Mark received
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Items tab ────────────────────────────────────────────────────────────────

function ItemsTab({ items, vendors }: { items: ProjectInventoryItem[]; vendors: ProjectVendor[] }) {
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.vendor_name]));

  // Group by room_destination
  const rooms = Array.from(
    new Set(items.map((i) => i.room_destination || "Unassigned")),
  );

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-[13px] text-[var(--yu3-ink-muted)]">
        No items added yet. Add items via the partner portal or update project_inventory directly.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {rooms.map((room) => {
        const roomItems = items.filter(
          (i) => (i.room_destination || "Unassigned") === room,
        );
        return (
          <div key={room}>
            <h3 className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-3">
              {room} ({roomItems.length})
            </h3>
            <div className="space-y-2">
              {roomItems.map((item) => {
                const status = item.item_status || item.status || "pending";
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[var(--yu3-line)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[#2B0416]">
                          {item.quantity > 1 ? `${item.quantity}× ` : ""}
                          {item.item_name}
                        </p>
                        {item.vendor_id && vendorMap[item.vendor_id] && (
                          <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-0.5">
                            from {vendorMap[item.vendor_id]}
                          </p>
                        )}
                        {item.placement_notes && (
                          <p className="text-[11px] text-blue-600 mt-1 italic">
                            📐 {item.placement_notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.requires_assembly && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                            ASSEMBLY
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                            ITEM_STATUS_BADGE[status] || "bg-gray-100 text-gray-600",
                          )}
                        >
                          {ITEM_STATUS_LABELS[status] || status}
                        </span>
                      </div>
                    </div>

                    {/* Photo slots */}
                    <div className="flex gap-3 mt-3">
                      <PhotoSlot
                        label="Pickup condition"
                        url={item.pickup_photo_url}
                      />
                      <PhotoSlot
                        label="Post-install"
                        url={item.delivery_photo_url}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PhotoSlot({ label, url }: { label: string; url: string | null }) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="group">
        <img
          src={url}
          alt={label}
          className="w-20 h-20 object-cover rounded-lg border border-[var(--yu3-line)] group-hover:opacity-90 transition"
        />
        <p className="text-[9px] text-[var(--yu3-ink-muted)] mt-1 text-center">{label}</p>
      </a>
    );
  }
  return (
    <div className="w-20 h-20 rounded-lg border border-dashed border-[var(--yu3-line)] flex flex-col items-center justify-center gap-1">
      <Camera size={14} className="text-[var(--yu3-ink-muted)]" />
      <p className="text-[9px] text-[var(--yu3-ink-muted)] text-center px-1">{label}</p>
    </div>
  );
}

// ─── Install Day tab ──────────────────────────────────────────────────────────

function InstallDayTab({
  project,
  onSendReport,
}: {
  project: ProjectData;
  onSendReport: () => Promise<void>;
}) {
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const rooms = project.rooms || [];
  const items = project.project_inventory || [];

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      await onSendReport();
      setReportSent(true);
    } finally {
      setSendingReport(false);
    }
  };

  if (!project.delivery_job_id || !project.deliveryJob) {
    return (
      <div className="text-center py-12">
        <CalendarCheck size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-[13px] font-medium text-[var(--yu3-ink-muted)]">
          Install not scheduled yet
        </p>
        <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
          Once all vendors are confirmed, use "Schedule Install Day" to create the delivery job.
        </p>
      </div>
    );
  }

  const dj = project.deliveryJob;

  return (
    <div className="space-y-5">
      {/* Delivery job card */}
      <div className="bg-white rounded-xl border border-[var(--yu3-line)] p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider">
            Install Job
          </p>
          <Link
            href={`/admin/deliveries/${dj.id}`}
            className="text-[11px] text-[#66143D] font-medium flex items-center gap-1 hover:opacity-80"
          >
            {dj.delivery_number} <ArrowRight size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">Date</p>
            <p className="font-medium text-[#2B0416]">
              {dj.delivery_date ? formatMoveDate(dj.delivery_date) : "TBD"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">Status</p>
            <p className="font-medium text-[#2B0416] capitalize">{dj.status}</p>
          </div>
        </div>
      </div>

      {/* Room checklist */}
      {rooms.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-3">
            Room Checklist
          </p>
          <div className="space-y-3">
            {rooms.map((r, i) => {
              const roomItems = items.filter((it) => it.room_destination === r.room);
              return (
                <div key={i} className="bg-white rounded-xl border border-[var(--yu3-line)] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-semibold text-[#2B0416]">{r.room}</p>
                    <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                      {roomItems.length} item{roomItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {r.notes && (
                    <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-2">{r.notes}</p>
                  )}
                  {roomItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 py-1 border-t border-[var(--yu3-line)]/40">
                      <div
                        className={cn(
                          "w-3 h-3 rounded border shrink-0",
                          it.item_status === "installed"
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-gray-300",
                        )}
                      />
                      <span className="text-[12px] text-[var(--yu3-ink)]">
                        {it.quantity > 1 ? `${it.quantity}× ` : ""}{it.item_name}
                      </span>
                      {it.placement_notes && (
                        <span className="text-[10px] text-blue-500 ml-auto italic truncate max-w-32">
                          {it.placement_notes}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photo report */}
      {dj.status === "completed" && (
        <div className="bg-[#2B3927]/5 rounded-xl p-4">
          <p className="text-[12px] font-semibold text-[#2B3927] mb-2">Post-Install Photo Report</p>
          <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-3">
            Send a photo documentation email to the designer with all post-install photos.
          </p>
          {reportSent ? (
            <p className="text-[12px] text-emerald-700 font-medium">✓ Report sent</p>
          ) : (
            <button
              onClick={handleSendReport}
              disabled={sendingReport}
              className="px-4 py-2 bg-[#2B3927] text-white rounded-lg text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 transition"
            >
              {sendingReport ? "Sending…" : "Send photo report"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "overview" | "vendors" | "items" | "install";

export default function DesignerProjectCommandCenter({
  project: initialProject,
}: {
  project: ProjectData;
}) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectData>(initialProject);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [schedulingInstall, setSchedulingInstall] = useState(false);
  const [installDate, setInstallDate] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  const phase = project.designer_phase;
  const vendors = project.project_vendors || [];
  const items = project.project_inventory || [];
  const timeline = project.project_timeline || [];

  const confirmedVendors = vendors.filter((v) => ["confirmed", "received"].includes(v.readiness)).length;
  const readyItems = items.filter((i) =>
    ["received_warehouse", "inspected", "stored", "scheduled_delivery", "delivered", "installed"].includes(
      i.item_status || i.status || "",
    ),
  ).length;

  const handleVendorUpdate = useCallback((updated: ProjectVendor) => {
    setProject((prev) => ({
      ...prev,
      project_vendors: prev.project_vendors.map((v) =>
        v.id === updated.id ? updated : v,
      ),
    }));
    // Refresh to get auto-advanced phase
    setTimeout(() => router.refresh(), 500);
  }, [router]);

  const handleScheduleInstall = async () => {
    if (!installDate) return;
    setSchedulingInstall(true);
    setScheduleError("");
    try {
      const res = await fetch(
        `/api/admin/designer-projects/${project.id}/schedule-install`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ installDate }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setScheduleError(data.error || "Failed to schedule install");
        return;
      }
      setShowScheduleModal(false);
      router.refresh();
    } finally {
      setSchedulingInstall(false);
    }
  };

  const handleSendPhotoReport = async () => {
    await fetch(`/api/admin/designer-projects/${project.id}/photo-report`, {
      method: "POST",
    });
    router.refresh();
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: "Overview", icon: <Buildings size={13} /> },
    {
      id: "vendors",
      label: `Vendors (${vendors.length})`,
      icon: <Truck size={13} />,
    },
    {
      id: "items",
      label: `Items (${items.length})`,
      icon: <Package size={13} />,
    },
    {
      id: "install",
      label: "Install Day",
      icon: <CalendarCheck size={13} />,
    },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-[var(--yu3-bg-canvas)]">
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-canvas)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Link
              href="/admin/b2b/designer-projects"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] mb-2"
            >
              <CaretLeft size={11} /> Designer Projects
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-mono text-[var(--yu3-ink-muted)]">
                {project.project_number}
              </span>
              {phase && (
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                    PHASE_BADGE[phase],
                  )}
                >
                  {DESIGNER_PHASE_LABELS[phase]}
                </span>
              )}
            </div>
            <h1 className="text-[17px] font-semibold text-[#2B0416] mt-0.5">
              {project.project_name}
            </h1>
            <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-0.5">
              {project.organizations?.name}
              {project.coordinator_name ? ` · ${project.coordinator_name}` : ""}
            </p>
          </div>

          {/* CTA */}
          <div className="shrink-0">
            {phase === "install_ready" && !project.delivery_job_id && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#66143D] text-[#F9EDE4] rounded-lg text-[12px] font-semibold hover:bg-[#4f0f2e] transition"
              >
                <CalendarCheck size={14} /> Schedule Install Day
              </button>
            )}
          </div>
        </div>

        {/* Phase rail */}
        <PhaseRail currentPhase={phase} />

        {/* Quick stats */}
        {(vendors.length > 0 || items.length > 0) && (
          <div className="flex gap-6 mt-3 pt-3 border-t border-[var(--yu3-line)]/50">
            {vendors.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {vendors.map((v) => (
                    <div
                      key={v.id}
                      className={cn(
                        "w-2 h-2 rounded-full",
                        READINESS_CONFIG[v.readiness]?.dot || "bg-gray-300",
                      )}
                      title={`${v.vendor_name}: ${v.readiness}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                  {confirmedVendors}/{vendors.length} vendors confirmed
                </span>
              </div>
            )}
            {items.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2B3927] rounded-full"
                    style={{ width: `${(readyItems / items.length) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                  {readyItems}/{items.length} items ready
                </span>
              </div>
            )}
            {project.target_end_date && (
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-[var(--yu3-ink-muted)]" />
                <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                  {formatMoveDate(project.target_end_date)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="shrink-0 border-b border-[var(--yu3-line)] px-6 bg-[var(--yu3-bg-canvas)]">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold border-b-2 -mb-px transition",
                activeTab === tab.id
                  ? "text-[#66143D] border-[#66143D]"
                  : "text-[var(--yu3-ink-muted)] border-transparent hover:text-[var(--yu3-ink)]",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="max-w-2xl space-y-5">
            {/* Project details */}
            <div className="bg-white rounded-xl border border-[var(--yu3-line)] p-4 space-y-3">
              <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider">
                Project Details
              </p>
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                {project.end_client_name && (
                  <div>
                    <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">End Client</p>
                    <p className="font-medium text-[#2B0416]">{project.end_client_name}</p>
                    {project.end_client_contact && (
                      <p className="text-[var(--yu3-ink-muted)]">{project.end_client_contact}</p>
                    )}
                  </div>
                )}
                {project.target_end_date && (
                  <div>
                    <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">Target Install</p>
                    <p className="font-medium text-[#2B0416]">{formatMoveDate(project.target_end_date)}</p>
                  </div>
                )}
                {project.site_address && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">Install Address</p>
                    <p className="font-medium text-[#2B0416]">
                      {project.site_address}
                      {project.install_unit ? `, Unit ${project.install_unit}` : ""}
                      {project.install_floor ? `, Floor ${project.install_floor}` : ""}
                    </p>
                    <p className="text-[var(--yu3-ink-muted)] capitalize">
                      {(project.install_access || "elevator").replace("_", " ")}
                    </p>
                    {project.install_access_notes && (
                      <p className="text-[var(--yu3-ink-muted)] italic mt-0.5">{project.install_access_notes}</p>
                    )}
                  </div>
                )}
                {project.estimated_budget && (
                  <div>
                    <p className="text-[10px] text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-0.5">Budget</p>
                    <p className="font-medium text-[#2B0416]">{formatCurrency(project.estimated_budget)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Rooms */}
            {(project.rooms || []).length > 0 && (
              <div className="bg-white rounded-xl border border-[var(--yu3-line)] p-4">
                <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-3">
                  Rooms in Scope
                </p>
                <div className="space-y-1.5">
                  {(project.rooms || []).map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="font-medium text-[#2B0416]">{r.room}</span>
                      {r.notes && <span className="text-[var(--yu3-ink-muted)] italic">{r.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity feed */}
            {timeline.length > 0 && (
              <div className="bg-white rounded-xl border border-[var(--yu3-line)] p-4">
                <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-3">
                  Activity
                </p>
                <div className="space-y-2">
                  {timeline.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-[11px]">
                      <span className="text-[var(--yu3-ink-muted)] shrink-0 w-16">
                        {new Date(entry.created_at).toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="text-[var(--yu3-ink)]">{entry.event_description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-[12px] text-amber-900">{project.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Vendors */}
        {activeTab === "vendors" && (
          <div className="max-w-2xl space-y-3">
            {vendors.length === 0 ? (
              <div className="text-center py-12">
                <Truck size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-[13px] text-[var(--yu3-ink-muted)]">No vendors yet.</p>
                <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
                  Add vendors via the partner portal or here.
                </p>
              </div>
            ) : (
              vendors.map((vendor, idx) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  vendorNumber={idx + 1}
                  items={items.filter((i) => i.vendor_id === vendor.id)}
                  projectId={project.id}
                  onUpdate={handleVendorUpdate}
                />
              ))
            )}
          </div>
        )}

        {/* Items */}
        {activeTab === "items" && (
          <div className="max-w-2xl">
            <ItemsTab items={items} vendors={vendors} />
          </div>
        )}

        {/* Install Day */}
        {activeTab === "install" && (
          <div className="max-w-2xl">
            <InstallDayTab project={project} onSendReport={handleSendPhotoReport} />
          </div>
        )}
      </div>

      {/* Schedule Install modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-[15px] font-semibold text-[#2B0416] mb-1">Schedule Install Day</h2>
            <p className="text-[12px] text-[var(--yu3-ink-muted)] mb-4">
              This will create a delivery job (DLV-XXXXX) with vendor pickup stops and the install address.
            </p>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] block mb-1.5">
                Install date
              </label>
              <input
                type="date"
                value={installDate}
                onChange={(e) => setInstallDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--yu3-line)] rounded-lg text-[13px] focus:outline-none focus:border-[#66143D]/40"
              />
            </div>
            {scheduleError && (
              <p className="text-[12px] text-red-600 mb-3">{scheduleError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2 border border-[var(--yu3-line)] rounded-lg text-[12px] font-semibold text-[var(--yu3-ink-muted)] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleInstall}
                disabled={!installDate || schedulingInstall}
                className="flex-1 py-2 bg-[#66143D] text-[#F9EDE4] rounded-lg text-[12px] font-semibold disabled:opacity-40 hover:bg-[#4f0f2e] transition"
              >
                {schedulingInstall ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
