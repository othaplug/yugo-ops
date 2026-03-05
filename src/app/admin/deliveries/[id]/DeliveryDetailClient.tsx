"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Copy, Send, MapPin, Truck, Clock, Package, Users, FileText, DollarSign, AlertTriangle } from "lucide-react";
import BackButton from "../../components/BackButton";
import EditDeliveryModal from "./EditDeliveryModal";
import NotifyClientButton from "./NotifyClientButton";
import DownloadPDFButton from "./DownloadPDFButton";
import { formatPhone } from "@/lib/phone";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import LiveTrackingMap from "./LiveTrackingMap";
import CollapsibleSection from "@/components/CollapsibleSection";
import IncidentsSection from "../../components/IncidentsSection";
import SegmentedProgressBar from "../../components/SegmentedProgressBar";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatCurrency } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";

const PROGRESS_STEPS = ["pending", "confirmed", "in-transit", "delivered"] as const;
const PROGRESS_LABELS: Record<string, string> = {
  pending: "Pending",
  pending_approval: "Pending approval",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  "in-transit": "In Transit",
  delivered: "Completed",
  cancelled: "Cancelled",
};

const STAGE_OPTIONS = [
  { value: "quote", label: "Quote" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string; border: string }> = {
  retail: { bg: "bg-[var(--gold)]/10", text: "text-[var(--gold)]", label: "Retail", border: "border-l-[var(--gold)]" },
  designer: { bg: "bg-[#B8860B]/10", text: "text-[#B8860B]", label: "Designer", border: "border-l-[#B8860B]" },
  hospitality: { bg: "bg-[#D48A29]/10", text: "text-[#D48A29]", label: "Hospitality", border: "border-l-[#D48A29]" },
  gallery: { bg: "bg-[#4A7CE5]/10", text: "text-[#4A7CE5]", label: "Gallery", border: "border-l-[#4A7CE5]" },
  b2c: { bg: "bg-[#2D9F5A]/10", text: "text-[#2D9F5A]", label: "B2C", border: "border-l-[#2D9F5A]" },
};

interface Crew { id: string; name: string; members?: string[] }

function isDone(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "delivered" || s === "completed" || s === "cancelled";
}

function InfoRow({ icon: Icon, label, children, onEdit }: { icon: React.ElementType; label: string; children: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="group/row flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-[var(--bg)]/60 transition-colors -mx-1">
      <Icon className="w-3.5 h-3.5 text-[var(--tx3)] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/70 block">{label}</span>
        <div className="text-[12px] text-[var(--tx)] mt-0.5">{children}</div>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} className="opacity-0 group-hover/row:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity shrink-0" aria-label={`Edit ${label}`}>
          <Pencil className="w-[10px] h-[10px]" />
        </button>
      )}
    </div>
  );
}

export default function DeliveryDetailClient({
  delivery: initialDelivery,
  clientEmail,
  organizations = [],
  crews = [],
}: {
  delivery: any;
  clientEmail?: string | null;
  organizations?: { id: string; name: string; type: string }[];
  crews?: Crew[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [approveDeclineLoading, setApproveDeclineLoading] = useState(false);
  const [trackingLink, setTrackingLink] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState(false);

  useEffect(() => setDelivery(initialDelivery), [initialDelivery]);

  const selectedCrew = crews.find((c) => c.id === delivery.crew_id);
  const completed = isDone(delivery.status);
  const cat = CATEGORY_STYLES[delivery.category] || CATEGORY_STYLES.retail;

  const statusColorMap: Record<string, string> = {
    pending: "text-amber-600 bg-amber-500/10",
    pending_approval: "text-amber-600 bg-amber-500/10",
    scheduled: "text-blue-600 bg-blue-500/10",
    confirmed: "text-emerald-600 bg-emerald-500/10",
    "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
    delivered: "text-emerald-600 bg-emerald-500/10",
    completed: "text-emerald-600 bg-emerald-500/10",
    cancelled: "text-red-500 bg-red-500/10",
  };
  const statusColor = statusColorMap[delivery.status] || "bg-[var(--gdim)] text-[var(--gold)]";
  const currentStepIdx = PROGRESS_STEPS.indexOf(delivery.status as typeof PROGRESS_STEPS[number]);

  useEffect(() => {
    const channel = supabase
      .channel(`delivery-${delivery.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deliveries", filter: `id=eq.${delivery.id}` }, (payload) => {
        setDelivery((prev: any) => ({ ...prev, ...payload.new }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [delivery.id]);

  const fetchTrackingLink = useCallback(async () => {
    if (trackingLink) return trackingLink;
    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}/track-link`);
      const data = await res.json();
      if (data.url) { setTrackingLink(data.url); return data.url as string; }
    } catch { /* silent */ }
    return null;
  }, [delivery.id, trackingLink]);

  const handleCopyTrackingLink = async () => {
    setCopyingLink(true);
    const url = await fetchTrackingLink();
    if (url) {
      await navigator.clipboard.writeText(url);
      toast("Tracking link copied", "check");
    } else {
      toast("Could not generate tracking link", "alertTriangle");
    }
    setCopyingLink(false);
  };

  const assignCrew = async (crewId: string | null) => {
    const crew = crewId ? crews.find((c) => c.id === crewId) : null;
    const { data, error } = await supabase
      .from("deliveries")
      .update({ crew_id: crewId, updated_at: new Date().toISOString() })
      .eq("id", delivery.id)
      .select()
      .single();
    if (error) { toast(error.message || "Failed to assign crew", "alertTriangle"); return; }
    if (data) setDelivery(data);
    router.refresh();
    toast(crewId ? `Assigned to ${crew?.name}` : "Crew unassigned", "check");
  };

  const [adjustedPrice, setAdjustedPrice] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    setApproveDeclineLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (adjustedPrice) body.adjusted_price = parseFloat(adjustedPrice);
      const res = await fetch(`/api/admin/deliveries/${delivery.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "Failed to approve", "alertTriangle");
      } else {
        router.refresh();
        toast("Delivery approved and confirmed", "check");
      }
    } catch { toast("Failed to approve", "alertTriangle"); }
    setApproveDeclineLoading(false);
  };

  const handleReject = async () => {
    setApproveDeclineLoading(true);
    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "Failed to decline", "alertTriangle");
      } else {
        router.refresh();
        toast("Delivery declined", "check");
      }
    } catch { toast("Failed to decline", "alertTriangle"); }
    setApproveDeclineLoading(false);
    setShowRejectForm(false);
  };

  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const itemsDisplay = items.map((i: any) => {
    if (typeof i === "string") return { name: i, qty: 1 };
    return { name: i?.name || String(i), qty: i?.qty ?? 1 };
  });

  return (
    <div className="max-w-[960px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 animate-fade-up">
      <BackButton label="Back" />

      {completed && (
        <div className="mt-3 rounded-lg border border-[var(--brd)]/50 bg-[var(--gdim)]/30 px-4 py-2.5 text-[11px] text-[var(--tx2)]">
          This delivery is {toTitleCase(delivery.status)}. Some fields are locked.
        </div>
      )}

      {(delivery.status === "pending_approval" || delivery.status === "pending") && delivery.created_by_source === "partner_portal" && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
              Partner Delivery Request — Awaiting Approval
            </p>
          </div>

          {delivery.total_price > 0 && (
            <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] p-3 space-y-1.5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Rate Card Pricing</div>
              {delivery.booking_type && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--tx3)]">Type</span>
                  <span className="font-semibold text-[var(--tx)]">{delivery.booking_type === "day_rate" ? "Day Rate" : "Per Delivery"} {delivery.vehicle_type ? `— ${delivery.vehicle_type.toUpperCase()}` : ""}</span>
                </div>
              )}
              {delivery.base_price > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--tx3)]">Base</span>
                  <span className="text-[var(--tx)]">{formatCurrency(delivery.base_price)}</span>
                </div>
              )}
              {delivery.overage_price > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--tx3)]">Overages</span>
                  <span className="text-[var(--tx)]">{formatCurrency(delivery.overage_price)}</span>
                </div>
              )}
              {delivery.services_price > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--tx3)]">Services</span>
                  <span className="text-[var(--tx)]">{formatCurrency(delivery.services_price)}</span>
                </div>
              )}
              {delivery.zone_surcharge > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--tx3)]">Zone Surcharge</span>
                  <span className="text-[var(--tx)]">{formatCurrency(delivery.zone_surcharge)}</span>
                </div>
              )}
              <div className="border-t border-[var(--brd)] pt-1.5 flex justify-between text-[13px]">
                <span className="font-bold text-[var(--tx)]">Total</span>
                <span className="font-bold text-[var(--gold)]">{formatCurrency(delivery.total_price)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-[var(--tx3)]">Adjust Price (optional)</label>
            <input
              type="number"
              step="0.01"
              placeholder={delivery.total_price ? String(delivery.total_price) : "Enter adjusted price"}
              value={adjustedPrice}
              onChange={(e) => setAdjustedPrice(e.target.value)}
              className="w-48 text-[13px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>

          {showRejectForm ? (
            <div className="space-y-2">
              <textarea
                placeholder="Reason for declining…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                className="w-full text-[13px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] resize-y"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleReject} disabled={approveDeclineLoading} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                  {approveDeclineLoading ? "…" : "Confirm Decline"}
                </button>
                <button type="button" onClick={() => setShowRejectForm(false)} className="px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)]">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleApprove} disabled={approveDeclineLoading} className="px-5 py-2.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {approveDeclineLoading ? "…" : "Approve"}
              </button>
              <button type="button" onClick={() => setShowRejectForm(true)} disabled={approveDeclineLoading} className="px-4 py-2.5 rounded-lg text-[11px] font-bold text-red-500 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50 transition-colors">
                Decline
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── HERO ─── */}
      <div className={`mt-3 glass rounded-xl border-l-4 ${cat.border} overflow-hidden`}>
        <div className="p-4 sm:p-5">
          {/* Top row: name + actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <button type="button" onClick={() => setContactModalOpen(true)} className="font-heading text-[18px] md:text-[20px] font-bold text-[var(--tx)] hover:text-[var(--gold)] transition-colors text-left truncate max-w-full block">
                {delivery.customer_name || delivery.delivery_number}
              </button>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[var(--gdim)]/80 text-[var(--gold)] border border-[var(--gold)]/20">{delivery.delivery_number}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wide ${cat.bg} ${cat.text}`}>{cat.label}</span>
                {delivery.special_handling && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/15 text-amber-600 border border-amber-500/40 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Special</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button type="button" onClick={handleCopyTrackingLink} disabled={copyingLink} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30 hover:bg-[var(--gold)]/20 transition-all disabled:opacity-50">
                <Copy className="w-3 h-3" /> {copyingLink ? "Copying…" : "Copy Tracking Link"}
              </button>
              <NotifyClientButton delivery={delivery} clientEmail={clientEmail} />
              <DownloadPDFButton delivery={delivery} />
            </div>
          </div>

          {/* Status row */}
          <div className="mt-4 pt-3 border-t border-[var(--brd)]/30 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/70">Status</span>
              {editingStatus ? (
                <select
                  autoFocus
                  defaultValue={delivery.status}
                  onBlur={() => setEditingStatus(false)}
                  className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  onChange={async (e) => {
                    const v = e.target.value;
                    const { data, error } = await supabase.from("deliveries").update({ status: v, updated_at: new Date().toISOString() }).eq("id", delivery.id).select().single();
                    if (error) { toast(error.message || "Failed", "alertTriangle"); return; }
                    if (data) setDelivery(data);
                    setEditingStatus(false);
                    router.refresh();
                    toast("Status updated", "check");
                  }}
                >
                  {Object.entries(PROGRESS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              ) : (
                <button type="button" onClick={() => setEditingStatus(true)} className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${statusColor}`}>{PROGRESS_LABELS[delivery.status] || toTitleCase(delivery.status)}</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[var(--tx3)] opacity-50"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/70">Stage</span>
              <span className="text-[11px] font-medium text-[var(--tx)]">{STAGE_OPTIONS.find((o) => o.value === delivery.stage)?.label ?? delivery.stage ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/70">Client</span>
              <span className="text-[11px] font-medium text-[var(--tx)]">{delivery.client_name || "—"}</span>
            </div>
            {delivery.quoted_price > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[15px] font-bold font-heading text-[var(--gold)]">{formatCurrency(delivery.quoted_price)}</span>
              </div>
            )}
          </div>

          {delivery.status !== "cancelled" && (
            <div className="mt-4">
              <SegmentedProgressBar
                label=""
                steps={PROGRESS_STEPS.map((s) => ({ key: s, label: PROGRESS_LABELS[s] }))}
                currentIndex={Math.max(0, currentStepIdx)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT: 2 columns on large screens ─── */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-3">
          {/* Live Tracking */}
          <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]/30">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-[11px] font-bold tracking-wide uppercase text-[var(--tx)]">Live Tracking</h3>
              </div>
              {delivery.crew_id ? (
                <span className="text-[10px] text-[var(--tx3)]">{selectedCrew?.name || "Crew assigned"}</span>
              ) : !completed ? (
                <button type="button" onClick={() => setCrewModalOpen(true)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                  Assign Crew to Enable
                </button>
              ) : null}
            </div>
            {delivery.crew_id ? (
              <LiveTrackingMap crewId={delivery.crew_id} crewName={selectedCrew?.name} deliveryId={delivery.id} />
            ) : (
              <div className="px-6 py-10 text-center">
                <Truck className="w-8 h-8 text-[var(--tx3)]/30 mx-auto mb-3" />
                <p className="text-[12px] font-medium text-[var(--tx3)]">No crew assigned yet</p>
                <p className="text-[10px] text-[var(--tx3)]/60 mt-1 mb-4">Assign a crew to enable live GPS tracking</p>
                {!completed && (
                  <button type="button" onClick={() => setCrewModalOpen(true)} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
                    Assign Crew
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          {itemsDisplay.length > 0 && (
            <CollapsibleSection title={`Items (${itemsDisplay.length})`} defaultCollapsed={false}>
              <div className="space-y-0.5">
                {itemsDisplay.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--bg)] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-[var(--gold)] w-5 text-center">{idx + 1}</span>
                      <span className="text-[11px] text-[var(--tx)]">{item.name}</span>
                    </div>
                    {item.qty > 1 && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--gdim)]/80 text-[var(--gold)]">x{item.qty}</span>}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Incidents */}
          <IncidentsSection jobId={delivery.id} jobType="delivery" />

          {/* Instructions */}
          <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 hover:border-[var(--gold)]/30 transition-all">
            {!completed && (
              <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditModalOpen(true)}>
                <Pencil className="w-[10px] h-[10px]" />
              </button>
            )}
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-[var(--tx3)]" />
              <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)]">Instructions & Notes</h3>
            </div>
            <p className="text-[11px] text-[var(--tx2)] leading-relaxed whitespace-pre-wrap">{delivery.instructions || "No instructions yet."}</p>
          </div>
        </div>

        {/* RIGHT COLUMN — sidebar details */}
        <div className="space-y-3">
          {/* Schedule */}
          <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 hover:border-[var(--gold)]/30 transition-all">
            {!completed && (
              <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditModalOpen(true)}>
                <Pencil className="w-[10px] h-[10px]" />
              </button>
            )}
            <InfoRow icon={Clock} label="Date">
              <span className="font-medium">{delivery.scheduled_date ? new Date(delivery.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Not scheduled"}</span>
            </InfoRow>
            <InfoRow icon={Clock} label="Time Slot">
              {delivery.time_slot || "—"}
            </InfoRow>
            <InfoRow icon={Clock} label="Window">
              {delivery.delivery_window || "—"}
            </InfoRow>
          </div>

          {/* Addresses */}
          <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 hover:border-[var(--gold)]/30 transition-all">
            {!completed && (
              <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditModalOpen(true)}>
                <Pencil className="w-[10px] h-[10px]" />
              </button>
            )}
            <InfoRow icon={MapPin} label="Pickup">
              {delivery.pickup_address || "—"}
            </InfoRow>
            <InfoRow icon={MapPin} label="Delivery To">
              <span className="font-medium">{delivery.delivery_address || "—"}</span>
            </InfoRow>
          </div>

          {/* Crew */}
          <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 hover:border-[var(--gold)]/30 transition-all">
            {!completed && (
              <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setCrewModalOpen(true)}>
                <Pencil className="w-[10px] h-[10px]" />
              </button>
            )}
            <InfoRow icon={Users} label="Assigned Team">
              {selectedCrew ? (
                <span className="font-medium">{selectedCrew.name}</span>
              ) : (
                <button type="button" onClick={() => !completed && setCrewModalOpen(true)} className="text-[var(--gold)] font-medium hover:underline">
                  {completed ? "No crew" : "+ Assign crew"}
                </button>
              )}
            </InfoRow>
            {selectedCrew?.members && selectedCrew.members.length > 0 && (
              <div className="px-3 pb-1">
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedCrew.members.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--bg)] border border-[var(--brd)]/50 text-[10px] text-[var(--tx2)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--gold)]/15 flex items-center justify-center text-[8px] font-bold text-[var(--gold)]">{m.charAt(0).toUpperCase()}</span>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer Contact */}
          <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4 hover:border-[var(--gold)]/30 transition-all">
            {!completed && (
              <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1 rounded hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditModalOpen(true)}>
                <Pencil className="w-[10px] h-[10px]" />
              </button>
            )}
            <button type="button" onClick={() => setContactModalOpen(true)} className="w-full text-left">
              <InfoRow icon={Users} label="Customer">
                <span className="font-medium text-[var(--gold)]">{delivery.customer_name || "—"}</span>
              </InfoRow>
            </button>
            {delivery.customer_email && (
              <div className="px-3 text-[10px] text-[var(--tx3)]">{delivery.customer_email}</div>
            )}
            {delivery.customer_phone && (
              <div className="px-3 mt-0.5 text-[10px] text-[var(--tx3)]">{formatPhone(delivery.customer_phone)}</div>
            )}

            {/* Customer tracking actions */}
            <div className="mt-3 px-3 flex flex-wrap gap-1.5">
              <button type="button" onClick={handleCopyTrackingLink} disabled={copyingLink} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[9px] font-semibold bg-[var(--bg)] text-[var(--tx2)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all disabled:opacity-50">
                <Copy className="w-2.5 h-2.5" /> {copyingLink ? "…" : "Copy Link"}
              </button>
              <NotifyClientButton delivery={delivery} clientEmail={clientEmail} />
            </div>
          </div>

          {/* Price highlight */}
          {delivery.quoted_price > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-[var(--gold)]/12 to-[var(--gold)]/4 border border-[var(--gold)]/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-[var(--gold)]" />
                <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--gold)]/80">Quoted Price</span>
              </div>
              <div className="text-[22px] font-bold font-heading text-[var(--gold)] mt-1">{formatCurrency(delivery.quoted_price)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Crew Picker */}
      <ModalOverlay open={crewModalOpen} onClose={() => setCrewModalOpen(false)} title="Assign Crew" maxWidth="sm">
        <div className="p-5 space-y-4">
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Select Crew</label>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => { assignCrew(null); setCrewModalOpen(false); }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${!delivery.crew_id ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--tx3)]">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[12px] font-medium text-[var(--tx)]">No crew</div>
                <div className="text-[10px] text-[var(--tx3)]">Remove crew assignment</div>
              </div>
            </button>
            {crews.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { assignCrew(c.id); setCrewModalOpen(false); }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${delivery.crew_id === c.id ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--gold)]/10 flex items-center justify-center text-[11px] font-bold text-[var(--gold)]">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[var(--tx)]">{c.name}</div>
                  {c.members && c.members.length > 0 && (
                    <div className="text-[10px] text-[var(--tx3)] truncate">{c.members.join(", ")}</div>
                  )}
                </div>
                {delivery.crew_id === c.id && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold text-emerald-600 bg-emerald-500/10">Active</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </ModalOverlay>

      <EditDeliveryModal delivery={delivery} organizations={organizations} crews={crews} open={editModalOpen} onOpenChange={setEditModalOpen} />

      <ContactDetailsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contact={{
          name: delivery.customer_name,
          email: delivery.customer_email,
          phone: delivery.customer_phone,
        }}
      />
    </div>
  );
}
