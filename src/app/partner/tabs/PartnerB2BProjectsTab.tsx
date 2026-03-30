"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/hooks/useConfirm";
import { getDisplayLabel } from "@/lib/displayLabels";
import { toTitleCase } from "@/lib/format-text";
import { getTrackingUrl } from "@/lib/tracking-url";
import { VendorStatusCompactTable } from "@/components/VendorStatusCompactTable";
import {
  Sparkle,
  Plus,
  X,
  CaretDown as ChevronDown,
  CaretRight as ChevronRight,
  ChatText as MessageSquare,
  Camera,
  Warning as AlertTriangle,
  Trash as Trash2,
  PencilSimple as Pencil,
} from "@phosphor-icons/react";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string;
  phase_id: string | null;
  item_name: string;
  vendor: string | null;
  vendor_name: string | null;
  vendor_contact_name: string | null;
  vendor_contact_phone: string | null;
  vendor_contact_email: string | null;
  vendor_order_number: string | null;
  vendor_pickup_address: string | null;
  vendor_pickup_window: string | null;
  vendor_delivery_method: string | null;
  quantity: number;
  item_status: string | null;
  status: string;
  status_updated_at: string | null;
  status_notes: string | null;
  room_destination: string | null;
  item_value: number | null;
  item_dimensions: string | null;
  requires_crating: boolean | null;
  requires_assembly: boolean | null;
  special_handling_notes: string | null;
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
  end_client_name: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  target_end_date: string | null;
  itemsTotal: number;
  itemsReceived: number;
  itemsInTransit: number;
  itemsIssue: number;
  nextDeliveryDate: string | null;
}

interface ProjectDetail {
  id: string;
  project_number: string;
  project_name: string;
  description?: string | null;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  spec_selected:      { label: "Spec'd",             color: "text-[#4F4B47]",            bg: "bg-[#4F4B47]/12" },
  ordered:            { label: "Ordered",            color: "text-blue-500",           bg: "bg-blue-500/10" },
  in_production:      { label: "In Production",      color: "text-blue-500",           bg: "bg-blue-500/10" },
  ready_for_pickup:   { label: "Ready for Pickup",   color: "text-amber-500",          bg: "bg-amber-500/10" },
  shipped:            { label: "Shipped",            color: "text-sky-500",            bg: "bg-sky-500/10" },
  in_transit:         { label: "In Transit",         color: "text-sky-500",            bg: "bg-sky-500/10" },
  received_warehouse: { label: "Received",           color: "text-emerald-500",        bg: "bg-emerald-500/10" },
  inspected:          { label: "Inspected",          color: "text-emerald-600",        bg: "bg-emerald-500/10" },
  stored:             { label: "Stored",             color: "text-emerald-500",        bg: "bg-emerald-500/10" },
  scheduled_delivery: { label: "Delivery Scheduled", color: "text-amber-500",          bg: "bg-amber-500/10" },
  delivered:          { label: "Delivered",          color: "text-emerald-500",        bg: "bg-emerald-500/10" },
  installed:          { label: "Installed",         color: "text-emerald-600",        bg: "bg-emerald-600/10" },
  issue_reported:     { label: "Issue",               color: "text-red-500",            bg: "bg-red-500/10" },
};

const ALL_ITEM_STATUSES = [
  "spec_selected", "ordered", "in_production", "ready_for_pickup",
  "shipped", "in_transit", "received_warehouse", "inspected", "stored",
  "scheduled_delivery", "delivered", "installed", "issue_reported",
] as const;

// Items that are "at Yugo warehouse" — ready to schedule for final delivery
const WAREHOUSE_STATUSES = ["received_warehouse", "inspected", "stored"];
const RECEIVED_STATUSES = [
  "received_warehouse", "inspected", "stored", "scheduled_delivery", "delivered", "installed",
];
const TRANSIT_STATUSES = ["shipped", "in_transit"];

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  yugo_pickup:                  "Yugo Pickup",
  vendor_delivers_to_site:      "Vendor Delivers to Site",
  vendor_delivers_to_warehouse: "Vendor Delivers to Warehouse",
  shipped_carrier:              "Shipped via Carrier",
  client_self:                  "Client Self-Arrange",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  draft:     "bg-[var(--tx3)]/10 text-[var(--tx3)]",
  proposed:  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  active:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  on_hold:   "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  invoiced:  "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft:     "Draft",
  proposed:  "Proposed",
  active:    "Active",
  on_hold:   "On Hold",
  completed: "Completed",
  invoiced:  "Invoiced",
  cancelled: "Cancelled",
};

const ROOMS = [
  "Living Room", "Dining Room", "Kitchen", "Master Bedroom", "Bedroom 2",
  "Bedroom 3", "Home Office", "Bathroom", "Entryway", "Outdoor / Terrace", "Other",
];

// Vendor-accent colors for the Gantt chart (cycles)
const VENDOR_COLORS = [
  "#C9A962", "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EF4444", "#06B6D4", "#EC4899", "#6366F1", "#14B8A6",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getItemStatus(item: InventoryItem): string {
  return item.item_status || item.status || "ordered";
}

function getVendorLabel(item: InventoryItem): string {
  return item.vendor_name || item.vendor || "No Vendor";
}

function statusCfg(s: string) {
  return ITEM_STATUS_CONFIG[s] || { label: toTitleCase(s), color: "text-[#4F4B47]", bg: "bg-[#4F4B47]/12" };
}

function fmtDate(dateStr: string | null | undefined, includeYear = false) {
  if (!dateStr) return null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (includeYear) opts.year = "numeric";
  return new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", opts);
}

// Convert any date string to a JS Date (handles "YYYY-MM-DD" and ISO)
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  return new Date(s.length === 10 ? s + "T00:00:00" : s);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PartnerB2BProjectsTabProps {
  initialProjectId?: string;
  onScheduleDelivery?: (suggestedItems?: string) => void;
}

function abbreviateSuggestionRegion(
  placeName: string,
  context?: { id: string; text?: string; short_code?: string }[]
): string {
  const ctx = context ?? [];
  const regionName = ctx.find((c) => c.id.startsWith("region."))?.text ?? "";
  const regionShortCode = ctx.find((c) => c.id.startsWith("region."))?.short_code ?? "";
  if (!regionName || !regionShortCode) return placeName;
  const abbr = regionShortCode.includes("-")
    ? regionShortCode.split("-").slice(1).join("-")
    : regionShortCode;
  if (!abbr || abbr === regionName) return placeName;
  const parts = placeName.split(",");
  for (let i = parts.length - 1; i >= 0; i--) {
    const trimmed = parts[i].trim();
    if (trimmed === regionName || trimmed.startsWith(regionName + " ")) {
      parts[i] = parts[i].replace(regionName, abbr);
      break;
    }
  }
  return parts.join(",");
}

export default function PartnerB2BProjectsTab({
  initialProjectId,
  onScheduleDelivery,
}: PartnerB2BProjectsTabProps = {}) {
  const { confirm, confirmEl } = useConfirm();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [groupBy, setGroupBy] = useState<"vendor" | "room" | "status" | "timeline" | "gantt">("vendor");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // ── New project form ──────────────────────────────────────────────────────
  const [showNewProject, setShowNewProject] = useState(false);
  const [npName, setNpName] = useState("");
  const [npClientName, setNpClientName] = useState("");
  const [npAddress, setNpAddress] = useState("");
  const [npStartDate, setNpStartDate] = useState("");
  const [npEndDate, setNpEndDate] = useState("");
  const [npSaving, setNpSaving] = useState(false);
  const [npError, setNpError] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{
    place_name: string;
    context?: { id: string; text?: string; short_code?: string }[];
  }[]>([]);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Add item form ─────────────────────────────────────────────────────────
  const [showAddItem, setShowAddItem] = useState(false);
  const [aiVendorName, setAiVendorName] = useState("");
  const [aiShowContact, setAiShowContact] = useState(false);
  const [aiContactName, setAiContactName] = useState("");
  const [aiContactPhone, setAiContactPhone] = useState("");
  const [aiContactEmail, setAiContactEmail] = useState("");
  const [aiPickupAddr, setAiPickupAddr] = useState("");
  const [aiPickupWindow, setAiPickupWindow] = useState("");
  const [aiOrderNum, setAiOrderNum] = useState("");
  const [aiRoom, setAiRoom] = useState("");
  const [aiDeliveryMethod, setAiDeliveryMethod] = useState("yugo_pickup");
  const [aiValue, setAiValue] = useState("");
  const [aiCrating, setAiCrating] = useState(false);
  const [aiAssembly, setAiAssembly] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [aiItems, setAiItems] = useState<{ name: string; qty: string; dimensions: string; showDims: boolean }[]>([
    { name: "", qty: "1", dimensions: "", showDims: false },
  ]);
  const [aiPhoto, setAiPhoto] = useState<File | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState("");

  // ── Status update ─────────────────────────────────────────────────────────
  const [statusItem, setStatusItem] = useState<InventoryItem | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  // ── Per-item note ─────────────────────────────────────────────────────────
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteItemText, setNoteItemText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // ── Photo viewer ──────────────────────────────────────────────────────────
  const [viewPhotos, setViewPhotos] = useState<string[] | null>(null);
  const [viewPhotoIdx, setViewPhotoIdx] = useState(0);
  const [viewPhotosLoading, setViewPhotosLoading] = useState(false);

  // ── Schedule pickup prompt ────────────────────────────────────────────────
  const [scheduleItem, setScheduleItem] = useState<InventoryItem | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"pickup" | "delivery">("pickup");

  // ── Timeline note ─────────────────────────────────────────────────────────
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note_added");

  // ── Delete item ───────────────────────────────────────────────────────────
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // ── Edit project ───────────────────────────────────────────────────────────
  const [showEditProject, setShowEditProject] = useState(false);
  const [epName, setEpName] = useState("");
  const [epClientName, setEpClientName] = useState("");
  const [epAddress, setEpAddress] = useState("");
  const [epStartDate, setEpStartDate] = useState("");
  const [epEndDate, setEpEndDate] = useState("");
  const [epDescription, setEpDescription] = useState("");
  const [epSaving, setEpSaving] = useState(false);
  const [epError, setEpError] = useState("");

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* graceful fail */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const viewProject = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setSelectedProject(null);
    setGroupBy("vendor");
    setCollapsedGroups(new Set());
    try {
      const res = await fetch(`/api/partner/projects/${id}`);
      if (res.ok) setSelectedProject(await res.json());
    } catch { /* graceful fail */ }
    setLoadingDetail(false);
  }, []);

  useEffect(() => {
    if (initialProjectId) viewProject(initialProjectId);
  }, [initialProjectId, viewProject]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
          client_name: npClientName || null,
          client_address: npAddress || null,
          start_date: npStartDate || null,
          end_date: npEndDate || null,
          phases: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      setShowNewProject(false);
      setNpName(""); setNpClientName(""); setNpAddress(""); setNpStartDate(""); setNpEndDate("");
      await loadProjects();
      viewProject(data.id);
    } catch (e) {
      setNpError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setNpSaving(false);
    }
  };

  const resetAddItem = () => {
    setAiItems([{ name: "", qty: "1", dimensions: "", showDims: false }]);
    setAiVendorName(""); setAiShowContact(false);
    setAiContactName(""); setAiContactPhone(""); setAiContactEmail("");
    setAiPickupAddr(""); setAiPickupWindow(""); setAiOrderNum("");
    setAiRoom(""); setAiDeliveryMethod("yugo_pickup");
    setAiValue("");
    setAiCrating(false); setAiAssembly(false); setAiNotes("");
    setAiPhoto(null); setAiError("");
  };

  const addItemRow = () =>
    setAiItems((prev) => [...prev, { name: "", qty: "1", dimensions: "", showDims: false }]);
  const updateItemRow = (idx: number, field: "name" | "qty" | "dimensions", val: string) =>
    setAiItems((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  const toggleItemDims = (idx: number) =>
    setAiItems((prev) => prev.map((r, i) => (i === idx ? { ...r, showDims: !r.showDims } : r)));
  const removeItemRow = (idx: number) =>
    setAiItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const addItem = async () => {
    const validItems = aiItems.filter((r) => r.name.trim());
    if (!selectedProject || validItems.length === 0) {
      setAiError("At least one item name is required");
      return;
    }
    if (aiSaving) return; // Prevent double submission
    setAiSaving(true);
    setAiError("");
    try {
      // Merge rows with the same item name (case-insensitive) — sum quantities, use first dimensions
      const merged = new Map<string, { name: string; qty: number; dimensions: string }>();
      for (const r of validItems) {
        const key = r.name.trim().toLowerCase();
        const qty = parseInt(r.qty) || 1;
        const existing = merged.get(key);
        if (existing) {
          existing.qty += qty;
          if (r.dimensions?.trim() && !existing.dimensions) existing.dimensions = r.dimensions.trim();
        } else {
          merged.set(key, {
            name: r.name.trim(),
            qty,
            dimensions: r.dimensions?.trim() || "",
          });
        }
      }
      const toCreate = Array.from(merged.values());

      let firstItemId: string | null = null;
      for (let i = 0; i < toCreate.length; i++) {
        const row = toCreate[i];
        const res = await fetch(`/api/partner/projects/${selectedProject.id}/inventory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_name: row.name,
            vendor_name: aiVendorName || null,
            vendor_contact_name: aiContactName || null,
            vendor_contact_phone: aiContactPhone || null,
            vendor_contact_email: aiContactEmail || null,
            vendor_pickup_address: aiPickupAddr || null,
            vendor_pickup_window: aiPickupWindow || null,
            vendor_order_number: aiOrderNum || null,
            room_destination: aiRoom || null,
            vendor_delivery_method: aiDeliveryMethod,
            quantity: row.qty,
            item_value: aiValue ? parseFloat(aiValue) : null,
            item_dimensions: row.dimensions || null,
            requires_crating: aiCrating,
            requires_assembly: aiAssembly,
            special_handling_notes: aiNotes || null,
            item_status: "ordered",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add item");
        if (i === 0) firstItemId = data.id;
      }

      // Upload photo if provided (attach to first item)
      if (aiPhoto && firstItemId) {
        const fd = new FormData();
        fd.append("file", aiPhoto);
        fd.append("item_id", firstItemId);
        fd.append("project_id", selectedProject.id);
        await fetch(`/api/partner/projects/${selectedProject.id}/inventory/${firstItemId}/photos`, {
          method: "POST",
          body: fd,
        }).catch(() => {});
      }

      setShowAddItem(false);
      resetAddItem();
      viewProject(selectedProject.id);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAiSaving(false);
    }
  };

  const submitStatusUpdate = async () => {
    if (!selectedProject || !statusItem || !newStatus) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/partner/projects/${selectedProject.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: statusItem.id, item_status: newStatus, notes: statusNotes || null }),
      });
      const data = await res.json();
      const savedItem = { ...statusItem, item_status: newStatus };

      // Determine whether to show schedule prompt
      if (data.should_schedule) {
        setScheduleItem(savedItem);
        setScheduleMode("pickup");
      } else if (WAREHOUSE_STATUSES.includes(newStatus) && !data.should_schedule) {
        // Item is now at warehouse — can schedule final delivery
        setScheduleItem(savedItem);
        setScheduleMode("delivery");
      }

      setStatusItem(null);
      setNewStatus("");
      setStatusNotes("");
      await viewProject(selectedProject.id);
    } finally {
      setStatusSaving(false);
    }
  };

  const submitItemNote = async () => {
    if (!selectedProject || !noteItemId || !noteItemText.trim()) return;
    setNoteSaving(true);
    try {
      await fetch(`/api/partner/projects/${selectedProject.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "note_added",
          event_description: `[Item note] ${noteItemText}`,
        }),
      });
      // Also store in status_notes via PATCH
      await fetch(`/api/partner/projects/${selectedProject.id}/inventory`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: noteItemId, status_notes: noteItemText }),
      });
      setNoteItemId(null);
      setNoteItemText("");
      viewProject(selectedProject.id);
    } finally {
      setNoteSaving(false);
    }
  };

  const addNote = async () => {
    if (!selectedProject || !noteText.trim()) return;
    await fetch(`/api/partner/projects/${selectedProject.id}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: noteType, event_description: noteText }),
    });
    setNoteText(""); setShowNoteForm(false);
    viewProject(selectedProject.id);
  };

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const deleteItem = async (itemId: string) => {
    if (!selectedProject || deletingItemId) return;
    const ok = await confirm({ title: "Remove item?", message: "This item will be removed from the project.", confirmLabel: "Remove", variant: "danger" });
    if (!ok) return;
    setDeletingItemId(itemId);
    try {
      const res = await fetch(`/api/partner/projects/${selectedProject.id}/inventory/${itemId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove item");
      await viewProject(selectedProject.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to remove item");
    } finally {
      setDeletingItemId(null);
    }
  };

  const openEditProject = () => {
    if (!selectedProject) return;
    setEpName(selectedProject.project_name);
    setEpClientName(selectedProject.end_client_name || "");
    setEpAddress(selectedProject.site_address || "");
    setEpStartDate(selectedProject.start_date || "");
    setEpEndDate(selectedProject.target_end_date || "");
    setEpDescription(selectedProject.description || "");
    setEpError("");
    setShowEditProject(true);
  };

  const updateProject = async () => {
    if (!selectedProject || !epName.trim()) { setEpError("Project name is required"); return; }
    setEpSaving(true);
    setEpError("");
    try {
      const res = await fetch(`/api/partner/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: epName.trim(),
          end_client_name: epClientName.trim() || null,
          site_address: epAddress.trim() || null,
          start_date: epStartDate || null,
          target_end_date: epEndDate || null,
          description: epDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");
      setShowEditProject(false);
      await viewProject(selectedProject.id);
    } catch (e) {
      setEpError(e instanceof Error ? e.message : "Failed to update project");
    } finally {
      setEpSaving(false);
    }
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <div key={i} className="animate-pulse h-28 bg-[var(--brd)]/30 rounded-xl" />)}
      </div>
    );
  }

  // ── Modals ────────────────────────────────────────────────────────────────

  const NewProjectModal = showNewProject && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center bg-black/50 p-4 sm:p-5" onClick={() => setShowNewProject(false)}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[440px] max-h-[92vh] overflow-hidden flex flex-col mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 z-10">
          <h2 className="font-hero text-[20px] sm:text-[24px] font-bold text-[#1A1A1A]">New Project</h2>
          <button type="button" onClick={() => setShowNewProject(false)} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#454545]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4 min-h-0">
          {npError && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{npError}</div>}
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Project Name *</label>
            <input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="e.g. Wilson Residence"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" autoFocus />
          </div>
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Client Name</label>
            <input value={npClientName} onChange={(e) => setNpClientName(e.target.value)} placeholder="Sarah & James Wilson"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
          </div>
          <div className="relative">
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Site Address</label>
            <input value={npAddress} onChange={(e) => { setNpAddress(e.target.value); fetchAddressSuggestions(e.target.value); }}
              placeholder="Start typing address…"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            {addressSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#E8E4DF] rounded-xl shadow-lg mt-1 overflow-hidden">
                {addressSuggestions.map((s, i) => (
                  <button key={i} type="button" onClick={() => { setNpAddress(s.place_name); setAddressSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-[12px] text-[#1A1A1A] hover:bg-[#F5F3F0] transition-colors border-b border-[#E8E4DF]/50 last:border-0">
                    {abbreviateSuggestionRegion(s.place_name, s.context)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Start Date</label>
              <input type="date" value={npStartDate} onChange={(e) => setNpStartDate(e.target.value)}
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Target End Date</label>
              <input type="date" value={npEndDate} onChange={(e) => setNpEndDate(e.target.value)}
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowNewProject(false)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#454545] hover:bg-[#F5F3F0] transition-colors">Cancel</button>
            <button type="button" onClick={createProject} disabled={npSaving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89952] disabled:opacity-60 transition-colors">
              {npSaving ? "Creating…" : "Create Project"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const EditProjectModal = showEditProject && selectedProject && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center bg-black/50 p-4 sm:p-5" onClick={() => setShowEditProject(false)}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[440px] max-h-[92vh] overflow-hidden flex flex-col mx-0 sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 z-10">
          <h2 className="font-hero text-[20px] sm:text-[24px] font-bold text-[#1A1A1A]">Edit Project</h2>
          <button type="button" onClick={() => setShowEditProject(false)} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#454545]" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4 min-h-0">
          {epError && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{epError}</div>}
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Project Name *</label>
            <input value={epName} onChange={(e) => setEpName(e.target.value)} placeholder="e.g. Wilson Residence"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" autoFocus />
          </div>
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Client Name</label>
            <input value={epClientName} onChange={(e) => setEpClientName(e.target.value)} placeholder="Sarah & James Wilson"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
          </div>
          <div className="relative">
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Site Address</label>
            <input value={epAddress} onChange={(e) => { setEpAddress(e.target.value); fetchAddressSuggestions(e.target.value); }}
              placeholder="Start typing address…"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            {addressSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-[#E8E4DF] rounded-xl shadow-lg mt-1 overflow-hidden">
                {addressSuggestions.map((s, i) => (
                  <button key={i} type="button" onClick={() => { setEpAddress(s.place_name); setAddressSuggestions([]); }}
                    className="w-full text-left px-4 py-2.5 text-[12px] text-[#1A1A1A] hover:bg-[#F5F3F0] transition-colors border-b border-[#E8E4DF]/50 last:border-0">
                    {abbreviateSuggestionRegion(s.place_name, s.context)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Description</label>
            <textarea value={epDescription} onChange={(e) => setEpDescription(e.target.value)} placeholder="Project description"
              rows={2} className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Start Date</label>
              <input type="date" value={epStartDate} onChange={(e) => setEpStartDate(e.target.value)}
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Target End Date</label>
              <input type="date" value={epEndDate} onChange={(e) => setEpEndDate(e.target.value)}
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowEditProject(false)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#454545] hover:bg-[#F5F3F0] transition-colors">Cancel</button>
            <button type="button" onClick={updateProject} disabled={epSaving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89952] disabled:opacity-60 transition-colors">
              {epSaving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const AddItemModal = showAddItem && selectedProject && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center bg-black/50 p-4 sm:p-5" onClick={() => { setShowAddItem(false); resetAddItem(); }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[520px] max-h-[92vh] overflow-hidden flex flex-col mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] flex items-center justify-between px-5 py-4 shrink-0 z-10">
          <h3 className="font-hero text-[20px] sm:text-[22px] font-bold text-[#1A1A1A]">Add Item</h3>
          <button type="button" onClick={() => { setShowAddItem(false); resetAddItem(); }}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#454545]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 space-y-4 min-h-0">
          {/* Item name + qty */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A]">Item Name *</label>
              <button type="button" onClick={addItemRow}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C9A962] hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>
            <div className="space-y-2">
              {aiItems.map((row, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_56px_44px] gap-2 items-end">
                    <input value={row.name} onChange={(e) => updateItemRow(idx, "name", e.target.value)}
                      placeholder="e.g. Cloud Sectional Sofa"
                      className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors"
                      autoFocus={idx === 0} />
                    <input type="number" min="1" value={row.qty} onChange={(e) => updateItemRow(idx, "qty", e.target.value)}
                      className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors"
                      aria-label="Quantity" />
                    <button type="button" onClick={() => removeItemRow(idx)} title="Remove item"
                      className={`p-2.5 rounded-lg border transition-colors ${aiItems.length > 1 ? "border-[#E8E4DF] text-[#454545] hover:bg-red-50 hover:border-red-200 hover:text-red-500" : "border-transparent text-[#9CA3AF] cursor-default"}`}
                      disabled={aiItems.length <= 1}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {row.showDims ? (
                    <div className="flex items-center gap-2">
                      <input value={row.dimensions} onChange={(e) => updateItemRow(idx, "dimensions", e.target.value)}
                        placeholder='e.g. 84 × 42 × 30"'
                        className="flex-1 text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none"
                        autoFocus />
                      <button type="button" onClick={() => toggleItemDims(idx)}
                        className="text-[11px] text-[#454545] hover:underline shrink-0">− Hide</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => toggleItemDims(idx)}
                      className="text-[11px] text-[#C9A962] hover:underline">
                      + Add dimensions (optional)
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Vendor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A]">Vendor *</label>
              <button type="button" onClick={() => setAiShowContact(!aiShowContact)}
                className="text-[11px] text-[#C9A962] hover:underline">
                {aiShowContact ? "– Hide contact details" : "+ Add vendor contact"}
              </button>
            </div>
            <input value={aiVendorName} onChange={(e) => setAiVendorName(e.target.value)} placeholder="e.g. Poliform, RH, local vendor"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
          </div>

          {aiShowContact && (
            <div className="space-y-3 p-4 bg-[#F5F3F0] rounded-xl border border-[#E8E4DF]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-[#454545] mb-1">Contact Name</label>
                  <input value={aiContactName} onChange={(e) => setAiContactName(e.target.value)} placeholder="Sales rep name"
                    className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wide text-[#454545] mb-1">Phone</label>
                  <input value={aiContactPhone} onChange={(e) => setAiContactPhone(e.target.value)} placeholder="+1 (647) …"
                    className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#454545] mb-1">Email</label>
                <input value={aiContactEmail} onChange={(e) => setAiContactEmail(e.target.value)} placeholder="vendor@example.com"
                  className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#454545] mb-1">Pickup Address</label>
                <input value={aiPickupAddr} onChange={(e) => setAiPickupAddr(e.target.value)} placeholder="200 King St W, Toronto"
                  className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#454545] mb-1">Pickup Window</label>
                <input value={aiPickupWindow} onChange={(e) => setAiPickupWindow(e.target.value)} placeholder="Mon–Fri 9am–4pm, loading dock"
                  className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none" />
              </div>
            </div>
          )}

          {/* Order # + Room */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Order Number</label>
              <input value={aiOrderNum} onChange={(e) => setAiOrderNum(e.target.value)} placeholder="PF-4521"
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Room Destination</label>
              <select value={aiRoom} onChange={(e) => setAiRoom(e.target.value)}
                className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] outline-none">
                <option value="">Select room…</option>
                {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Delivery method */}
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Delivery Method</label>
            <select value={aiDeliveryMethod} onChange={(e) => setAiDeliveryMethod(e.target.value)}
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] focus:border-[#C9A962] outline-none">
              {Object.entries(DELIVERY_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {/* Declared Value */}
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Declared Value ($)</label>
            <input type="number" min="0" value={aiValue} onChange={(e) => setAiValue(e.target.value)} placeholder="8,200"
              className="w-full text-[var(--text-base)] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors" />
          </div>

          {/* Special handling */}
          <div className="space-y-2">
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A]">Special Handling</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={aiCrating} onChange={(e) => setAiCrating(e.target.checked)} className="w-4 h-4 accent-[#C9A962]" />
              <span className="text-[13px] text-[#444]">Crating required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={aiAssembly} onChange={(e) => setAiAssembly(e.target.checked)} className="w-4 h-4 accent-[#C9A962]" />
              <span className="text-[13px] text-[#444]">Assembly required</span>
            </label>
            <textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={2}
              placeholder="Special notes (e.g. legs ship separately, white glove only)…"
              className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none resize-none" />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">
              <Camera className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              Reference Photo (optional)
            </label>
            {aiPhoto ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#444] truncate max-w-[200px]">{aiPhoto.name}</span>
                <button type="button" onClick={() => setAiPhoto(null)} className="text-[11px] text-red-500 hover:underline shrink-0">Remove</button>
              </div>
            ) : (
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#E8E4DF] text-[12px] text-[#5C5853] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors">
                <Camera className="w-3.5 h-3.5" />
                Upload photo
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setAiPhoto(f); }} />
              </label>
            )}
          </div>

          {aiError && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{aiError}</div>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowAddItem(false); resetAddItem(); }}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#454545] hover:bg-[#F5F3F0] transition-colors">Cancel</button>
            <button type="button" onClick={addItem} disabled={aiSaving}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89952] disabled:opacity-60 transition-colors">
              {aiSaving ? "Adding…" : "Add Item"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const StatusUpdateModal = statusItem && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center bg-black/50 p-4 sm:p-5" onClick={() => setStatusItem(null)}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[420px] overflow-hidden flex flex-col mx-0 sm:mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E4DF] shrink-0">
          <div>
            <h3 className="font-hero text-[20px] font-bold text-[#1A1A1A]">Update Status</h3>
            <p className="text-[12px] text-[#454545] mt-0.5 truncate max-w-[260px]">{statusItem.item_name}</p>
          </div>
          <button type="button" onClick={() => setStatusItem(null)} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#454545]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-2">New Status</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_ITEM_STATUSES.map((s) => {
                const cfg = statusCfg(s);
                return (
                  <button key={s} type="button" onClick={() => setNewStatus(s)}
                    className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold border transition-colors text-left ${
                      newStatus === s
                        ? `border-[#C9A962] bg-[#C9A962]/10 ${cfg.color}`
                        : `border-[#E8E4DF] ${cfg.color} opacity-60 hover:opacity-100`
                    }`}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold tracking-wider uppercase text-[#1A1A1A] mb-1">Notes (optional)</label>
            <textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} rows={2}
              placeholder="e.g. Received in perfect condition"
              className="w-full text-[13px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#6B6B6B] focus:border-[#C9A962] outline-none resize-none" />
          </div>
          <div className="flex gap-2 pb-1">
            <button type="button" onClick={() => setStatusItem(null)}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#454545] hover:bg-[#F5F3F0] transition-colors">Cancel</button>
            <button type="button" onClick={submitStatusUpdate} disabled={statusSaving || !newStatus}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89952] disabled:opacity-60 transition-colors">
              {statusSaving ? "Updating…" : "Update"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  const SchedulePromptModal = scheduleItem && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/50 p-4" onClick={() => setScheduleItem(null)}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[380px] p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[18px] font-bold text-[#1A1A1A] mb-2">
          {scheduleMode === "pickup" ? "Ready for pickup!" : "Schedule delivery?"}
        </h3>
        <p className="text-[13px] text-[#454545] mb-5">
          {scheduleMode === "pickup" ? (
            <><strong className="text-[#1A1A1A]">{scheduleItem.item_name}</strong> is ready at {scheduleItem.vendor_name || scheduleItem.vendor || "the vendor"}. Schedule a Yugo pickup now?</>
          ) : (
            <><strong className="text-[#1A1A1A]">{scheduleItem.item_name}</strong> is now in storage. Ready to schedule final delivery to the client site?</>
          )}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setScheduleItem(null)}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#454545] hover:bg-[#F5F3F0] transition-colors">Later</button>
          <button
            type="button"
            onClick={() => {
              if (onScheduleDelivery) {
                const vendor = scheduleItem.vendor_name || scheduleItem.vendor || "vendor";
                if (scheduleMode === "pickup") {
                  const addr = scheduleItem.vendor_pickup_address ? ` at ${scheduleItem.vendor_pickup_address}` : "";
                  onScheduleDelivery(`Pickup from ${vendor}${addr}: ${scheduleItem.item_name}`);
                } else {
                  onScheduleDelivery(`Delivery to client site: ${scheduleItem.item_name} (from ${vendor})`);
                }
              }
              setScheduleItem(null);
            }}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89952] transition-colors">
            Schedule →
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  // Photo lightbox
  const PhotoLightbox = viewPhotos && viewPhotos.length > 0 ? (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center bg-black/60" onClick={() => setViewPhotos(null)}>
      <button
        type="button"
        className="absolute top-4 right-4 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
        onClick={() => setViewPhotos(null)}
      >
        <X className="w-5 h-5" />
      </button>
      {viewPhotos.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            onClick={(e) => { e.stopPropagation(); setViewPhotoIdx((i) => Math.max(0, i - 1)); }}
          >
            <CaretLeft size={20} weight="regular" />
          </button>
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            onClick={(e) => { e.stopPropagation(); setViewPhotoIdx((i) => Math.min(viewPhotos.length - 1, i + 1)); }}
          >
            <CaretRight size={20} weight="regular" />
          </button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={viewPhotos[viewPhotoIdx]}
        alt="Item photo"
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {viewPhotos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-black/30 text-white text-[11px]">
          {viewPhotoIdx + 1} / {viewPhotos.length}
        </div>
      )}
    </div>
  ) : null;

  // ── Detail View ────────────────────────────────────────────────────────────

  if (selectedProject) {
    const p = selectedProject;
    const inv = p.inventory;
    const totalItems = inv.length;
    const receivedItems = inv.filter((i) => RECEIVED_STATUSES.includes(getItemStatus(i))).length;
    const inTransitItems = inv.filter((i) => TRANSIT_STATUSES.includes(getItemStatus(i))).length;
    const pendingItems = inv.filter(
      (i) => !RECEIVED_STATUSES.includes(getItemStatus(i)) && !TRANSIT_STATUSES.includes(getItemStatus(i)) && getItemStatus(i) !== "issue_reported"
    ).length;
    const yugoItems = inv.filter((i) => (i.handled_by || "yugo") === "yugo").length;
    const issueItems = inv.filter((i) => getItemStatus(i) === "issue_reported").length;
    const readyItems = inv.filter((i) => getItemStatus(i) === "ready_for_pickup").length;
    const warehouseItems = inv.filter((i) => WAREHOUSE_STATUSES.includes(getItemStatus(i))).length;
    const nonYugoItems = inv.filter((i) => i.handled_by && i.handled_by !== "yugo");
    const receivedPct = totalItems > 0 ? Math.round((receivedItems / totalItems) * 100) : 0;

    // Build groups for active view
    let groups: { name: string; items: InventoryItem[] }[] = [];
    if (groupBy === "vendor") {
      const names = Array.from(new Set(inv.map(getVendorLabel)));
      groups = names.map((name) => ({ name, items: inv.filter((i) => getVendorLabel(i) === name) }));
    } else if (groupBy === "room") {
      const rooms = Array.from(new Set(inv.map((i) => i.room_destination || "Room Not Set")));
      groups = rooms.map((name) => ({ name, items: inv.filter((i) => (i.room_destination || "Room Not Set") === name) }));
    } else if (groupBy === "status") {
      const statusGroupDefs = [
        { name: "Needs Action",            statuses: ["ready_for_pickup"] },
        { name: "Ordered / In Production", statuses: ["spec_selected", "ordered", "in_production"] },
        { name: "In Transit",              statuses: ["shipped", "in_transit"] },
        { name: "Received & Stored",       statuses: ["received_warehouse", "inspected", "stored"] },
        { name: "Scheduled & Delivered",   statuses: ["scheduled_delivery", "delivered", "installed"] },
        { name: "Issues",                  statuses: ["issue_reported"] },
      ];
      groups = statusGroupDefs
        .map(({ name, statuses }) => ({ name, items: inv.filter((i) => statuses.includes(getItemStatus(i))) }))
        .filter((g) => g.items.length > 0);
    }

    const renderItemCard = (item: InventoryItem) => {
      const st = getItemStatus(item);
      const cfg = statusCfg(st);
      const trackingUrl = item.vendor_tracking_number ? getTrackingUrl(item.vendor_carrier, item.vendor_tracking_number) : null;
      const hasPhotos = item.photo_urls && item.photo_urls.length > 0;
      const isAddingNote = noteItemId === item.id;

      return (
        <div key={item.id} className="border border-[var(--brd)] rounded-xl p-4 bg-[var(--bg)] space-y-2.5">
          {/* Name + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-[var(--tx)]">{item.item_name}</span>
                {item.quantity > 1 && <span className="text-[10px] text-[var(--tx3)]">×{item.quantity}</span>}
              </div>
              {item.room_destination && <p className="text-[11px] text-[var(--tx3)] mt-0.5">{item.room_destination}</p>}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 whitespace-nowrap ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>

          {/* Vendor + order + delivery method */}
          <div className="text-[11px] text-[var(--tx3)] flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="font-medium text-[var(--tx2)]">{getVendorLabel(item)}</span>
            {item.vendor_order_number && <span>#{item.vendor_order_number}</span>}
            {item.vendor_delivery_method && (
              <span>{DELIVERY_METHOD_LABELS[item.vendor_delivery_method] || item.vendor_delivery_method}</span>
            )}
          </div>

          {/* Tracking / dates / value */}
          {(item.vendor_tracking_number || item.status_updated_at || item.item_value || item.item_dimensions) && (
            <div className="text-[11px] flex flex-wrap gap-x-3 gap-y-0.5">
              {item.vendor_tracking_number && (
                trackingUrl
                  ? <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:underline font-mono">
                      {item.vendor_carrier ? `${item.vendor_carrier}: ` : ""}{item.vendor_tracking_number}
                    </a>
                  : <span className="text-[var(--tx3)] font-mono">{item.vendor_tracking_number}</span>
              )}
              {item.status_updated_at && <span className="text-[var(--tx3)]">Updated {fmtDate(item.status_updated_at)}</span>}
              {item.item_value && <span className="text-[var(--tx3)]">${item.item_value.toLocaleString()}</span>}
              {item.item_dimensions && <span className="text-[var(--tx3)]">{item.item_dimensions}</span>}
            </div>
          )}

          {/* Status notes */}
          {item.status_notes && <p className="text-[11px] text-[var(--tx3)] italic">"{item.status_notes}"</p>}

          {/* Inline note form */}
          {isAddingNote && (
            <div className="space-y-2 pt-1">
              <textarea
                value={noteItemText}
                onChange={(e) => setNoteItemText(e.target.value)}
                placeholder="Add a note about this item…"
                rows={2}
                autoFocus
                className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--brd)] rounded-lg text-[12px] text-[var(--tx)] outline-none resize-none focus:border-[var(--gold)]"
              />
              <div className="flex gap-2">
                <button type="button" onClick={submitItemNote} disabled={noteSaving || !noteItemText.trim()}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
                  {noteSaving ? "Saving…" : "Save Note"}
                </button>
                <button type="button" onClick={() => { setNoteItemId(null); setNoteItemText(""); }}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5 pt-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => { setStatusItem(item); setNewStatus(getItemStatus(item)); setStatusNotes(""); }}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] transition-colors"
            >
              Update Status
            </button>

            {st === "ready_for_pickup" && onScheduleDelivery && (
              <button type="button" onClick={() => { setScheduleItem(item); setScheduleMode("pickup"); }}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">
                Schedule pickup
              </button>
            )}

            {WAREHOUSE_STATUSES.includes(st) && onScheduleDelivery && (
              <button type="button" onClick={() => { setScheduleItem(item); setScheduleMode("delivery"); }}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                Schedule delivery
              </button>
            )}

            <button
              type="button"
              onClick={() => { setNoteItemId(isAddingNote ? null : item.id); setNoteItemText(""); }}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] transition-colors"
            >
              <MessageSquare className="inline w-3 h-3 mr-1 -mt-0.5" />Add note
            </button>

            {hasPhotos && (
              <button
                type="button"
                onClick={async () => {
                  setViewPhotoIdx(0);
                  if (!selectedProject) return;
                  setViewPhotosLoading(true);
                  try {
                    const res = await fetch(`/api/partner/projects/${selectedProject.id}/inventory/${item.id}/photos`);
                    const data = res.ok ? await res.json() : null;
                    const urls = data?.urls ?? item.photo_urls ?? [];
                    setViewPhotos(urls);
                  } catch {
                    setViewPhotos(item.photo_urls ?? []);
                  } finally {
                    setViewPhotosLoading(false);
                  }
                }}
                disabled={viewPhotosLoading}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--gold)] transition-colors disabled:opacity-60"
              >
                <Camera className="inline w-3 h-3 mr-1 -mt-0.5" />Photos ({item.photo_urls!.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => deleteItem(item.id)}
              disabled={deletingItemId === item.id}
              className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Remove item"
            >
              <Trash2 className="inline w-3 h-3 mr-1 -mt-0.5" />Delete
            </button>
          </div>
        </div>
      );
    };

    const renderVendorGroup = (group: { name: string; items: InventoryItem[] }) => {
      const isCollapsed = collapsedGroups.has(group.name);
      const gReceived = group.items.filter((i) => RECEIVED_STATUSES.includes(getItemStatus(i))).length;
      const gTransit = group.items.filter((i) => TRANSIT_STATUSES.includes(getItemStatus(i))).length;
      const gIssues = group.items.filter((i) => getItemStatus(i) === "issue_reported").length;
      const contactItem = group.items.find((i) => i.vendor_contact_phone || i.vendor_contact_email);

      return (
        <div key={group.name} className="border border-[var(--brd)] rounded-xl overflow-hidden">
          <button type="button" onClick={() => toggleGroup(group.name)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[var(--card)] hover:bg-[var(--bg)] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              {isCollapsed ? <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" />}
              <span className="text-[12px] font-bold text-[var(--tx)] uppercase tracking-wide truncate">{group.name}</span>
              <span className="text-[11px] text-[var(--tx3)] shrink-0">({group.items.length})</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold shrink-0 ml-2">
              {gIssues > 0 && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{gIssues} issue{gIssues > 1 ? "s" : ""}</span>}
              {gReceived > 0 && <span className="text-emerald-500">{gReceived} received</span>}
              {gTransit > 0 && <span className="text-sky-500">{gTransit} in transit</span>}
            </div>
          </button>

          {!isCollapsed && (
            <div className="p-3 space-y-2 border-t border-[var(--brd)]/30">
              {contactItem && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[10px] text-[var(--tx3)] bg-[var(--bg)] rounded-lg border border-[var(--brd)]/50">
                  {contactItem.vendor_contact_name && <span className="font-medium text-[var(--tx2)]">{contactItem.vendor_contact_name}</span>}
                  {contactItem.vendor_contact_phone && (
                    <a href={`tel:${contactItem.vendor_contact_phone}`} className="text-[var(--gold)] hover:underline">{contactItem.vendor_contact_phone}</a>
                  )}
                  {contactItem.vendor_contact_email && (
                    <a href={`mailto:${contactItem.vendor_contact_email}`} className="text-[var(--gold)] hover:underline">{contactItem.vendor_contact_email}</a>
                  )}
                  {contactItem.vendor_pickup_window && <span>· {contactItem.vendor_pickup_window}</span>}
                </div>
              )}
              {group.items.map(renderItemCard)}
            </div>
          )}
        </div>
      );
    };

    // ── Gantt view ──────────────────────────────────────────────────────────
    const GanttView = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Determine chart date range
      const projectStart = toDate(p.start_date) || toDate(inv.map((i) => i.status_updated_at || i.received_date || i.expected_delivery_date).filter(Boolean)[0]) || today;
      const projectEnd = toDate(p.target_end_date) || new Date(today.getTime() + 60 * 86400000);
      const rangeMs = Math.max(projectEnd.getTime() - projectStart.getTime(), 14 * 86400000);
      const totalDays = Math.ceil(rangeMs / 86400000);

      // Vendor → color mapping
      const vendors = Array.from(new Set(inv.map(getVendorLabel)));
      const vendorColor: Record<string, string> = {};
      vendors.forEach((v, i) => { vendorColor[v] = VENDOR_COLORS[i % VENDOR_COLORS.length]; });

      // Build tick marks (every ~7 days)
      const tickEvery = totalDays > 60 ? 14 : 7;
      const ticks: { day: number; label: string }[] = [];
      for (let d = 0; d <= totalDays; d += tickEvery) {
        const dt = new Date(projectStart.getTime() + d * 86400000);
        ticks.push({ day: d, label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
      }

      const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - projectStart.getTime()) / rangeMs) * 100));

      const STATUS_ORDER = [
        "ordered", "in_production", "ready_for_pickup", "shipped", "in_transit",
        "received_warehouse", "inspected", "stored", "scheduled_delivery", "delivered", "installed",
      ];

      const todayPct = pct(today);
      const isPastDeadline = today > projectEnd;

      // Estimate earliest date for item based on what we know
      const getItemStart = (item: InventoryItem): Date => {
        const d = toDate(item.status_updated_at) || toDate(item.received_date) || toDate(item.expected_delivery_date);
        if (d && d < today) return d;
        return today;
      };

      const getItemEnd = (item: InventoryItem): Date => {
        const st = getItemStatus(item);
        if (["delivered", "installed"].includes(st)) {
          return toDate(item.status_updated_at) || toDate(item.received_date) || today;
        }
        return toDate(item.expected_delivery_date) || toDate(p.target_end_date) || projectEnd;
      };

      return (
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center">
            {vendors.map((v) => (
              <div key={v} className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: vendorColor[v] }} />
                {v}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)] ml-auto">
              <div className="w-px h-3 bg-red-400" />
              Today
            </div>
          </div>

          {/* Timeline header */}
          <div className="relative" style={{ height: 24 }}>
            <div className="absolute inset-0 bg-[var(--bg)] rounded-lg border border-[var(--brd)]/50" />
            {ticks.map((t) => (
              <div key={t.day} className="absolute top-0 bottom-0 flex flex-col justify-center" style={{ left: `${(t.day / totalDays) * 100}%` }}>
                <div className="w-px h-full bg-[var(--brd)]/50" />
                <span className="absolute top-1 left-1 text-[9px] text-[var(--tx3)] whitespace-nowrap">{t.label}</span>
              </div>
            ))}
          </div>

          {/* Item rows */}
          <div className="space-y-1.5">
            {[...inv]
              .sort((a, b) => STATUS_ORDER.indexOf(getItemStatus(a)) - STATUS_ORDER.indexOf(getItemStatus(b)))
              .map((item) => {
                const st = getItemStatus(item);
                const cfg = statusCfg(st);
                const color = vendorColor[getVendorLabel(item)] || "#C9A962";
                const startPct = pct(getItemStart(item));
                const endPct = pct(getItemEnd(item));
                const barWidth = Math.max(endPct - startPct, 1.5);
                const isDone = ["delivered", "installed"].includes(st);
                const isDelayed = !isDone && today > projectEnd && !["delivered", "installed"].includes(st);

                return (
                  <div key={item.id} className="flex items-center gap-3">
                    {/* Label */}
                    <div className="w-[35%] min-w-0 shrink-0">
                      <div className="text-[11px] font-medium text-[var(--tx)] truncate">{item.item_name}</div>
                      <div className="text-[9px] text-[var(--tx3)] truncate">{getVendorLabel(item)}</div>
                    </div>

                    {/* Bar track */}
                    <div className="flex-1 relative h-6 bg-[var(--bg)] rounded border border-[var(--brd)]/30">
                      {/* Today line */}
                      <div
                        className="absolute top-0 bottom-0 w-px z-10"
                        style={{ left: `${todayPct}%`, backgroundColor: isPastDeadline ? "#ef4444" : "#ef4444" }}
                      />
                      {/* Item bar */}
                      <div
                        className={`absolute top-1 bottom-1 rounded transition-all ${isDelayed ? "opacity-70" : ""}`}
                        style={{
                          left: `${startPct}%`,
                          width: `${barWidth}%`,
                          backgroundColor: isDelayed ? "#ef4444" : color,
                          opacity: isDone ? 0.9 : 0.7,
                        }}
                      />
                    </div>

                    {/* Status badge */}
                    <span className={`text-[9px] font-bold shrink-0 w-[80px] text-right ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Project end marker */}
          <div className="flex items-center gap-2 text-[10px] text-[var(--tx3)] pt-1">
            <div className="flex-1 h-px bg-[var(--brd)]" />
            Target: {fmtDate(p.target_end_date, true) || "TBD"}
            {isPastDeadline && <span className="text-red-500 font-semibold">PAST DUE</span>}
          </div>
        </div>
      );
    };

    return (
      <>
        {EditProjectModal}
        {AddItemModal}
        {StatusUpdateModal}
        {SchedulePromptModal}
        {PhotoLightbox}

        <div>
          {/* Back */}
          <button onClick={() => setSelectedProject(null)}
            className="flex items-center gap-1 text-[12px] text-[var(--tx3)] hover:text-[var(--gold)] mb-4 transition-colors">
            <CaretLeft size={14} weight="regular" />
            Back to Projects
          </button>

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-[11px] font-semibold text-[var(--gold)]">{p.project_number}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${PROJECT_STATUS_COLORS[p.status] || ""}`}>
                {PROJECT_STATUS_LABELS[p.status] || getDisplayLabel(p.status)}
              </span>
              {readyItems > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500">
                  {readyItems} ready for pickup
                </span>
              )}
              {warehouseItems > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500">
                  {warehouseItems} ready to deliver
                </span>
              )}
              </div>
              <button type="button" onClick={openEditProject}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--tx2)] border border-[var(--brd)] hover:bg-[var(--card)] hover:border-[var(--gold)]/40 transition-colors">
                <Pencil size={12} /> Edit
              </button>
            </div>
            <h2 className="text-[20px] font-bold text-[var(--tx)] font-hero">{p.project_name}</h2>
            {p.end_client_name && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{p.end_client_name}</p>}
            {p.site_address && <p className="text-[12px] text-[var(--tx3)]">{p.site_address}</p>}
            {(p.start_date || p.target_end_date) && (
              <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                {fmtDate(p.start_date, true) || "TBD"} → {fmtDate(p.target_end_date, true) || "TBD"}
              </p>
            )}
          </div>

          {/* Vendor Status, compact summary */}
          {inv.length > 0 && (
            <div className="mb-4 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">Vendor Status</div>
              <VendorStatusCompactTable inventory={inv} />
            </div>
          )}

          {/* Stat cards */}
          {totalItems > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              {[
                { label: "Total",      value: totalItems,    color: "text-[var(--tx)]" },
                { label: "Received",   value: receivedItems, color: "text-emerald-500" },
                { label: "In Transit", value: inTransitItems,color: "text-sky-500" },
                { label: "Pending",    value: pendingItems,  color: "text-[var(--tx3)]" },
                { label: "Yugo",       value: yugoItems,     color: "text-[var(--gold)]" },
                { label: "Issues",     value: issueItems,    color: issueItems > 0 ? "text-red-500" : "text-[var(--tx3)]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-3 text-center">
                  <div className={`text-[18px] font-bold ${color}`}>{value}</div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--tx3)] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Progress bar */}
          {totalItems > 0 && (
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4">
              <div className="flex justify-between text-[11px] text-[var(--tx3)] mb-2">
                <span>{receivedItems} of {totalItems} pieces received or delivered</span>
                <span className="font-semibold text-[var(--tx)]">{receivedPct}%</span>
              </div>
              <div className="relative h-3 bg-[var(--bg)] rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2D9F5A] to-[#38C172] rounded-full transition-all duration-500"
                  style={{ width: `${receivedPct}%` }} />
              </div>
            </div>
          )}

          {/* Upsell banner */}
          {nonYugoItems.length > 0 && onScheduleDelivery && (
            <div className="mb-4 rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
              <div className="flex items-start gap-3">
                <Sparkle className="w-5 h-5 text-[var(--gold)] shrink-0 mt-0.5" weight="duotone" aria-hidden />
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-[var(--tx)]">
                    {nonYugoItems.length} item{nonYugoItems.length > 1 ? "s" : ""} tracked manually
                  </div>
                  <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                    Want Yugo to handle pickup and delivery with full tracking, photos, and proof of delivery?
                  </p>
                  <button onClick={() => onScheduleDelivery(nonYugoItems.map((i) => i.item_name).join(", "))}
                    className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">
                    Convert to Yugo Delivery →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View toggles */}
          <div className="flex gap-0 border-b border-[var(--brd)]/30 mb-4 overflow-x-auto scrollbar-hide">
            {(["vendor", "room", "status", "timeline", "gantt"] as const).map((v) => (
              <button key={v} onClick={() => setGroupBy(v)}
                className={`px-4 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
                  groupBy === v
                    ? "border-[var(--gold)] text-[var(--gold)]"
                    : "border-transparent text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}>
                {v === "vendor" ? "By Vendor" : v === "room" ? "By Room" : v === "status" ? "By Status" : v === "timeline" ? "Timeline" : "Gantt"}
              </button>
            ))}
          </div>

          {/* Gantt view */}
          {groupBy === "gantt" && (
            <GanttView />
          )}

          {/* Timeline */}
          {groupBy === "timeline" && (
            <div>
              <div className="flex gap-2 mb-4">
                <button onClick={() => { setShowNoteForm(!showNoteForm); setNoteType("note_added"); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]">
                  + Add Note
                </button>
                <button onClick={() => { setShowNoteForm(!showNoteForm); setNoteType("issue_flagged"); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20">
                  Flag Issue
                </button>
              </div>

              {showNoteForm && (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-4 space-y-3">
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3}
                    placeholder={noteType === "issue_flagged" ? "Describe the issue…" : "Add a note…"}
                    className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] outline-none" autoFocus />
                  <div className="flex gap-2">
                    <button onClick={addNote}
                      className={`px-4 py-2 rounded-lg text-[11px] font-semibold text-white ${noteType === "issue_flagged" ? "bg-red-500" : "bg-[#2D6A4F]"}`}>
                      {noteType === "issue_flagged" ? "Submit Issue" : "Add Note"}
                    </button>
                    <button onClick={() => setShowNoteForm(false)}
                      className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)]">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-0">
                {p.timeline.map((e) => (
                  <div key={e.id} className="flex gap-3 py-3 border-b border-[var(--brd)]/30 last:border-0">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{
                      backgroundColor: e.event_type === "issue_flagged" ? "#D14343"
                        : e.event_type.includes("completed") || e.event_type.includes("delivered") || e.event_type.includes("received") ? "#2D9F5A"
                        : "#C9A962"
                    }} />
                    <div>
                      <div className="text-[12px] text-[var(--tx)]">{e.event_description}</div>
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
                {p.timeline.length === 0 && <div className="text-center py-8 text-[var(--tx3)] text-[13px]">No activity yet</div>}
              </div>
            </div>
          )}

          {/* Grouped views (vendor / room / status) */}
          {groupBy !== "timeline" && groupBy !== "gantt" && (
            <div>
              <div className="flex justify-end mb-3">
                <button type="button" onClick={() => setShowAddItem(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
                  <Plus className="w-[13px] h-[13px]" /> Add Item
                </button>
              </div>

              {inv.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[13px] text-[var(--tx3)]">No items yet</p>
                  <p className="text-[11px] text-[var(--tx3)]/60 mt-1">Click "Add Item" to start tracking your pieces</p>
                </div>
              ) : groupBy === "vendor" ? (
                <div className="space-y-3">{groups.map((g) => renderVendorGroup(g))}</div>
              ) : (
                <div className="space-y-5">
                  {groups.map((g) => (
                    <div key={g.name}>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--tx3)]">{g.name}</h3>
                        <span className="text-[10px] text-[var(--tx3)]">({g.items.length})</span>
                      </div>
                      <div className="space-y-2">{g.items.map(renderItemCard)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </>
    );
  }

  // ── Projects list ──────────────────────────────────────────────────────────

  if (projects.length === 0) {
    return (
      <>
        {NewProjectModal}
        <div className="text-center py-12">
          <p className="text-[var(--text-base)] text-[var(--tx3)]">No active projects</p>
          <p className="text-[12px] text-[var(--tx3)]/60 mt-1">Create your first project to start coordinating multi-vendor deliveries</p>
          <button type="button" onClick={() => setShowNewProject(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
            <Plus className="w-[14px] h-[14px]" /> New Project
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {confirmEl}
      {NewProjectModal}
      {loadingDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--bg)]/70">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full" />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[var(--text-base)] font-bold font-hero text-[var(--tx)]">Projects ({projects.length})</h2>
        <button type="button" onClick={() => setShowNewProject(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
          <Plus className="w-[13px] h-[13px]" /> New Project
        </button>
      </div>

      <div className="space-y-3">
        {projects.map((p) => {
          const pct = p.itemsTotal > 0 ? Math.round((p.itemsReceived / p.itemsTotal) * 100) : 0;
          return (
            <button key={p.id} onClick={() => viewProject(p.id)}
              className="w-full text-left bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 hover:border-[var(--gold)]/40 transition-colors">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[11px] font-semibold text-[var(--gold)]">{p.project_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${PROJECT_STATUS_COLORS[p.status] || ""}`}>
                      {PROJECT_STATUS_LABELS[p.status] || getDisplayLabel(p.status)}
                    </span>
                    {p.itemsIssue > 0 && (
                      <span className="text-[9px] font-semibold text-red-500 flex items-center gap-0.5"><AlertTriangle size={9} />{p.itemsIssue} issue{p.itemsIssue > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <h3 className="text-[15px] font-bold text-[var(--tx)]">{p.project_name}</h3>
                  {p.end_client_name && <p className="text-[12px] text-[var(--tx3)] mt-0.5">{p.end_client_name}</p>}
                  {p.site_address && <p className="text-[11px] text-[var(--tx3)]">{p.site_address}</p>}
                </div>
                <CaretRight size={16} weight="regular" color="var(--tx3)" className="shrink-0 mt-1" />
              </div>

              <div className="relative h-2 bg-[var(--bg)] rounded-full overflow-hidden mb-2">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#2D9F5A] to-[#38C172] rounded-full transition-all"
                  style={{ width: `${pct}%` }} />
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--tx3)]">
                <span>{p.itemsReceived} of {p.itemsTotal} received</span>
                {p.itemsInTransit > 0 && <span className="text-sky-500">· {p.itemsInTransit} in transit</span>}
                {p.nextDeliveryDate && <span>· Next delivery: {fmtDate(p.nextDeliveryDate)}</span>}
                {p.target_end_date && <span>· Target: {fmtDate(p.target_end_date, true)}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
