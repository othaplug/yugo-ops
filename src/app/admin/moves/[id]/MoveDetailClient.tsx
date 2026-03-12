"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { Pencil, ChevronDown } from "lucide-react";
import { Icon } from "@/components/AppIcons";
import MoveNotifyButton from "../MoveNotifyButton";
import ResendTrackingLinkButton from "../ResendTrackingLinkButton";
import MoveContactModal from "./MoveContactModal";
import EditMoveDetailsModal from "./EditMoveDetailsModal";
import MoveInventorySection from "./MoveInventorySection";
import ClientMessagesSection from "./ClientMessagesSection";
import MovePhotosSection from "./MovePhotosSection";
import MoveCrewPhotosSection from "./MoveCrewPhotosSection";
import MoveSignOffSection from "./MoveSignOffSection";
import MoveDocumentsSection from "./MoveDocumentsSection";
import LiveTrackingMap from "../../deliveries/[id]/LiveTrackingMap";
import CollapsibleSection from "@/components/CollapsibleSection";
import IncidentsSection from "../../components/IncidentsSection";
import DistanceLogistics from "./DistanceLogistics";
import ModalOverlay from "../../components/ModalOverlay";
import SegmentedProgressBar from "../../components/SegmentedProgressBar";
import { useToast } from "../../components/Toast";
import { useRelativeTime } from "./useRelativeTime";

interface MoveDetailClientProps {
  move: any;
  crews?: { id: string; name: string; members?: string[] }[];
  isOffice?: boolean;
  userRole?: string;
  additionalFeesCents?: number;
}
import { MOVE_STATUS_OPTIONS, MOVE_STATUS_COLORS_ADMIN, MOVE_STATUS_INDEX, LIVE_TRACKING_STAGES, getStatusLabel, normalizeStatus } from "@/lib/move-status";

function isMoveStatusCompleted(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "delivered" || s === "done";
}
import { stripClientMessagesFromNotes } from "@/lib/internal-notes";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { formatCurrency, calcHST } from "@/lib/format-currency";

const VEHICLE_LABELS: Record<string, string> = {
  sprinter: "Sprinter Van",
  "16ft": "16ft Box Truck",
  "20ft": "20ft Box Truck",
  "24ft": "24ft Box Truck",
  "26ft": "26ft Box Truck",
};
const VEHICLE_OPTIONS = Object.entries(VEHICLE_LABELS);

export default function MoveDetailClient({ move: initialMove, crews = [], isOffice, userRole = "viewer", additionalFeesCents = 0 }: MoveDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [move, setMove] = useState(initialMove);
  useEffect(() => setMove(initialMove), [initialMove]);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCard, setEditingCard] = useState<"status" | null>(null);
  const selectedCrew = crews.find((c) => c.id === move.crew_id);
  const crewMembers = selectedCrew?.members && Array.isArray(selectedCrew.members) ? selectedCrew.members : [];
  const [assignedMembers, setAssignedMembers] = useState<Set<string>>(() => {
    const assigned = Array.isArray(move.assigned_members) ? move.assigned_members : [];
    return assigned.length > 0 ? new Set(assigned) : new Set(crewMembers);
  });
  useEffect(() => {
    const members = selectedCrew?.members && Array.isArray(selectedCrew.members) ? selectedCrew.members : [];
    const assigned = Array.isArray(move.assigned_members) ? move.assigned_members : [];
    if (assigned.length > 0) {
      setAssignedMembers(new Set(assigned));
    } else if (members.length > 0) {
      setAssignedMembers(new Set(members));
    } else {
      setAssignedMembers(new Set());
    }
  }, [move.crew_id, move.assigned_members, selectedCrew?.members]);
  const estimate = Number(move.estimate ?? move.amount ?? 0);
  const depositPaid = Number(move.deposit_amount ?? Math.round(estimate * 0.25));
  const baseBalance = Number(move.balance_amount ?? (estimate - depositPaid));
  const balanceDue = baseBalance + (additionalFeesCents / 100);
  const scheduledDateLocal = parseDateOnly(move.scheduled_date);
  const daysUntil = scheduledDateLocal ? Math.ceil((scheduledDateLocal.getTime() - Date.now()) / 86400000) : null;
  const balanceUnpaid = balanceDue > 0 && daysUntil !== null && daysUntil <= 1;
  const lastUpdatedRelative = useRelativeTime(move.updated_at);
  const isCompleted = isMoveStatusCompleted(move.status);
  const isPaid = move.status === "paid" || !!move.payment_marked_paid;
  const isBalancePaid = !!move.balance_paid_at;
  const [balanceLoading, setBalanceLoading] = useState<"etransfer" | "card" | null>(null);
  const [jobDuration, setJobDuration] = useState<{ startedAt: string | null; completedAt: string | null; isActive: boolean } | null>(null);
  const [jobDurationElapsed, setJobDurationElapsed] = useState(0);

  useEffect(() => {
    fetch(`/api/admin/moves/${move.id}/tracking-duration`)
      .then((r) => r.json())
      .then((d) => setJobDuration(d))
      .catch(() => {});
  }, [move.id]);

  // Live status: subscribe to moves table so crew checkpoint updates appear in real time
  useEffect(() => {
    const channel = supabase
      .channel(`move-${move.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "moves", filter: `id=eq.${move.id}` }, (payload) => {
        const next = payload.new as Record<string, unknown>;
        setMove((prev: any) => ({ ...prev, ...next }));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [move.id]);

  // Polling fallback for live status when move is in progress (in case realtime lags)
  const isInProgress = !["completed", "delivered", "cancelled"].includes((move.status || "").toLowerCase());
  useEffect(() => {
    if (!isInProgress) return;
    const poll = () =>
      fetch(`/api/admin/moves/${move.id}/stage`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.stage != null || d?.status != null) setMove((prev: any) => ({ ...prev, ...d }));
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [move.id, isInProgress]);

  useEffect(() => {
    if (!jobDuration?.startedAt) {
      setJobDurationElapsed(0);
      return;
    }
    const start = new Date(jobDuration.startedAt).getTime();
    const end = jobDuration.completedAt ? new Date(jobDuration.completedAt).getTime() : Date.now();
    const tick = () => setJobDurationElapsed(Math.max(0, (jobDuration.completedAt ? new Date(jobDuration.completedAt).getTime() : Date.now()) - start));
    tick();
    if (!jobDuration.completedAt) {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [jobDuration?.startedAt, jobDuration?.completedAt]);

  const jobDurationStr = jobDuration?.startedAt
    ? (() => {
        const ms = jobDurationElapsed || (jobDuration.completedAt ? new Date(jobDuration.completedAt).getTime() - new Date(jobDuration.startedAt).getTime() : Date.now() - new Date(jobDuration.startedAt).getTime());
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        if (h > 0) return `${h}h ${m % 60}m`;
        return `${m}m ${s % 60}s`;
      })()
    : null;

  const toggleMember = (name: string) => {
    setAssignedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-3 animate-fade-up">
      <BackButton label="Back" />

      {isCompleted && (
        <div className="rounded-lg border border-[var(--brd)]/50 bg-[var(--gdim)]/30 px-4 py-2.5 text-[11px] text-[var(--tx2)]">
          This move is complete. Some fields are locked for transparency.
        </div>
      )}

      {/* Hero - compact header with glass */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setContactModalOpen(true)}
                className="font-heading text-[17px] md:text-[19px] font-bold text-[var(--tx)] hover:text-[var(--gold)] transition-colors text-left break-words line-clamp-2"
              >
                {move.client_name}
              </button>
              {move.move_code && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold tracking-wide bg-[var(--gdim)]/60 text-[var(--gold)] border border-[var(--gold)]/20">
                  {move.move_code}
                </span>
              )}
            </div>
            {move.coordinator_name && (
              <span className="text-[11px] text-[var(--tx2)]">
                Coordinator: {move.coordinator_name}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold tracking-wide bg-[var(--gdim)]/80 text-[var(--gold)] border border-[var(--gold)]/20">
                <Icon name={isOffice ? "building" : "home"} className="w-[10px] h-[10px]" />
                {isOffice ? "Office" : "Residential"} Move
              </span>
              <MoveNotifyButton move={move} />
              <ResendTrackingLinkButton move={move} />
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold border border-[var(--red)]/50 text-[var(--red)] hover:bg-[var(--rdim)] transition-all"
              >
                Delete move
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--brd)]/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="group/card relative flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/80 shrink-0">Status</span>
              {editingCard === "status" ? (
                <select
                  className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none min-w-[120px]"
                  value={(() => {
                    const s = normalizeStatus(move.status) || move.status || "confirmed";
                    return s === "paid" ? "scheduled" : s;
                  })()}
                  onChange={async (e) => {
                    const v = e.target.value as string;
                    const isCurrentlyCompleted = isMoveStatusCompleted(move.status);
                    const isRestarting = isCurrentlyCompleted && !["completed", "delivered", "cancelled"].includes(v.toLowerCase());
                    if (isRestarting) {
                      const ok = window.confirm(
                        "This move is completed. Changing status back will RESTART the move globally:\n\n" +
                        "• Live stage will be cleared\n" +
                        "• Any tracking session will be ended\n" +
                        "• Crew will be able to start the job again from scratch\n\n" +
                        "Continue?"
                      );
                      if (!ok) {
                        setEditingCard(null);
                        return;
                      }
                      try {
                        const res = await fetch(`/api/admin/moves/${move.id}/restart`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ newStatus: v }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to restart");
                        if (data.move) setMove(data.move);
                        setEditingCard(null);
                        router.refresh();
                        toast("Move restarted", "check");
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Failed to restart", "alertTriangle");
                      }
                      return;
                    }
                    const updates: Record<string, unknown> = { status: v, updated_at: new Date().toISOString() };
                    const { data, error } = await supabase.from("moves").update(updates).eq("id", move.id).select().single();
                    if (error) {
                      toast(error.message || "Failed to update status", "alertTriangle");
                      return;
                    }
                    if (data) setMove(data);
                    setEditingCard(null);
                    router.refresh();
                    // Sync status to HubSpot deal (fire-and-forget)
                    if (move.hubspot_deal_id) {
                      fetch("/api/hubspot/update-deal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dealId: move.hubspot_deal_id, properties: { dealstage: v } }),
                      }).catch(() => {});
                    }
                  }}
                >
                  {MOVE_STATUS_OPTIONS.filter((s) => s.value !== "paid").map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingCard("status")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-transparent hover:border-[var(--gold)]/40 hover:opacity-90 transition-all cursor-pointer group/btn w-fit"
                  aria-label="Edit status"
                >
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-[12px] font-bold ${MOVE_STATUS_COLORS_ADMIN[move.status] || "bg-[var(--gdim)] text-[var(--gold)]"}`}>
                    {getStatusLabel(move.status)}
                  </span>
                  <ChevronDown className="w-[10px] h-[10px] text-[var(--tx3)] opacity-60 group-hover/btn:opacity-100" />
                </button>
              )}
            </div>

            <div className="group/card relative flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/80 shrink-0">
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
                </span>
                Live stage
              </span>
              <span className="text-[12px] font-medium text-[var(--tx)] truncate" title="Updated by crew from portal">
                {LIVE_TRACKING_STAGES.find((o) => o.key === move.stage)?.label ?? "—"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-2 sm:pt-0 sm:pl-6 sm:border-l sm:border-[var(--brd)]/50">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/80">Last updated</span>
              <span className="text-[12px] tabular-nums text-[var(--tx2)]">{lastUpdatedRelative}</span>
            </div>
          </div>
          {(normalizeStatus(move.status) || move.status) !== "cancelled" && (
            <div className="mt-4 pt-4 border-t border-[var(--brd)]/40">
              <SegmentedProgressBar
                label="MOVE STATUS"
                steps={MOVE_STATUS_OPTIONS.filter((s) => s.value !== "cancelled").map((s) => ({ key: s.value, label: s.label }))}
                currentIndex={Math.max(0, MOVE_STATUS_INDEX[normalizeStatus(move.status) || move.status || "confirmed"] ?? 0)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Live Crew Tracking Map - collapsible, collapsed by default */}
      {move.crew_id && (
        <CollapsibleSection title="Live Crew Tracking" defaultCollapsed subtitle={selectedCrew?.name || "Crew"}>
          {!isInProgress && (
            <p className="text-[11px] text-[var(--tx3)] mb-2">Move completed — live tracking still shown for vehicle and asset security.</p>
          )}
          <LiveTrackingMap
            crewId={move.crew_id}
            crewName={selectedCrew?.name}
            destination={move.to_lat != null && move.to_lng != null ? { lat: move.to_lat, lng: move.to_lng } : undefined}
            moveId={move.id}
          />
        </CollapsibleSection>
      )}

      <MoveContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        moveId={move.id}
        initial={{
          client_name: move.client_name || "",
          client_email: move.client_email || move.customer_email || "",
          client_phone: move.client_phone ?? "",
          preferred_contact: move.preferred_contact ?? undefined,
        }}
        onSaved={(updates) => setMove((prev: any) => ({ ...prev, ...updates }))}
      />


      <ModalOverlay open={crewModalOpen} onClose={() => setCrewModalOpen(false)} title="Assign Crew" maxWidth="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Select Crew</label>
            <select
              value={move.crew_id || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                const { data } = await supabase.from("moves").update({ crew_id: v, assigned_members: v ? (crews.find((c) => c.id === v)?.members || []) : [], updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                if (data) {
                  setMove(data);
                  setAssignedMembers(new Set(Array.isArray(data.assigned_members) ? data.assigned_members : (crews.find((c) => c.id === v)?.members || [])));
                }
                router.refresh();
              }}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors"
            >
              <option value="">No crew assigned</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedCrew && crewMembers.length > 0 && (
            <>
              <p className="text-[11px] text-[var(--tx3)]">Check or uncheck members to assign to this move.</p>
              <div className="space-y-2">
                {crewMembers.map((m) => (
                  <label key={m} className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--brd)] hover:bg-[var(--bg)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={assignedMembers.has(m)}
                      onChange={() => toggleMember(m)}
                      className="w-4 h-4 rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--brd)]"
                    />
                    <span className="text-[13px] font-medium text-[var(--tx)]">{m}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const members = Array.from(assignedMembers);
                  const { data } = await supabase.from("moves").update({ assigned_members: members, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                  if (data) setMove(data);
                  router.refresh();
                  setCrewModalOpen(false);
                }}
                className="w-full py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
              >
                Save Assignments
              </button>
            </>
          )}
          {selectedCrew && crewMembers.length === 0 && (
            <p className="text-[11px] text-[var(--tx3)]">No members in this crew. Add members in Platform Settings → Teams.</p>
          )}
          {!selectedCrew && (
            <p className="text-[11px] text-[var(--tx3)]">Select a crew above to assign members to this move.</p>
          )}
        </div>
      </ModalOverlay>

      <ModalOverlay open={vehicleModalOpen} onClose={() => setVehicleModalOpen(false)} title="Assign Vehicle" maxWidth="sm">
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Primary Vehicle</label>
            <select
              value={move.truck_primary || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                const isOverride = v !== move.truck_primary;
                const { data } = await supabase.from("moves").update({ truck_primary: v, truck_override: isOverride, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                if (data) setMove(data);
                router.refresh();
              }}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            >
              <option value="">No vehicle assigned</option>
              {VEHICLE_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Secondary Vehicle (Optional)</label>
            <select
              value={move.truck_secondary || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                const { data } = await supabase.from("moves").update({ truck_secondary: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                if (data) setMove(data);
                router.refresh();
              }}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            >
              <option value="">None</option>
              {VEHICLE_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Vehicle Notes</label>
            <textarea
              defaultValue={move.truck_notes || ""}
              onBlur={async (e) => {
                const v = e.target.value.trim() || null;
                if (v !== (move.truck_notes || null)) {
                  const { data } = await supabase.from("moves").update({ truck_notes: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                  if (data) setMove(data);
                }
              }}
              placeholder="e.g. Use truck #3 (newer lift gate)"
              rows={2}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none resize-none"
            />
          </div>
          <button type="button" onClick={() => setVehicleModalOpen(false)} className="w-full py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
            Done
          </button>
        </div>
      </ModalOverlay>

      {/* ─── Seamless info sections ─── */}
      <div className="mt-1 space-y-0">

        {/* Time Intelligence */}
        <div className="group/s relative py-4">
          {!isCompleted && (
            <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit date & time">
              <Pencil className="w-[11px] h-[11px]" />
            </button>
          )}
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Time & Intelligence</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Date</span><div className="text-[11px] font-medium text-[var(--tx)]">{formatMoveDate(move.scheduled_date)}</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Time Window</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.arrival_window || "—"}</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Job duration</span><div className="text-[11px] font-medium text-[var(--tx)] tabular-nums">{jobDurationStr ?? "—"}</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Completion</span><div className="text-[11px] font-medium text-[var(--tx)]">4:00 PM</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Days Left</span><div className="text-[11px] font-bold text-[var(--gold)]">{daysUntil ?? "—"}</div></div>
          </div>
        </div>

        {/* Addresses */}
        <div className="group/s relative border-t border-[var(--brd)]/30 py-4">
          {!isCompleted && (
            <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit addresses">
              <Pencil className="w-[11px] h-[11px]" />
            </button>
          )}
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Addresses</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">From</span>
              <div className="text-[11px] font-medium text-[var(--tx)]">{move.from_address || "—"}</div>
              {move.from_access && <div className="text-[9px] text-[var(--tx3)] mt-0.5">{move.from_access}</div>}
            </div>
            <div>
              <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">To</span>
              <div className="text-[11px] font-medium text-[var(--tx)]">{move.to_address || move.delivery_address || "—"}</div>
              {move.to_access && <div className="text-[9px] text-[var(--tx3)] mt-0.5">{move.to_access}</div>}
            </div>
          </div>
        </div>

        {/* Crew */}
        <div className="group/s relative border-t border-[var(--brd)]/30 py-4">
          {!isCompleted && (
            <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setCrewModalOpen(true)} aria-label="Edit crew">
              <Pencil className="w-[11px] h-[11px]" />
            </button>
          )}
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Crew</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Crew</span><div className="text-[11px] font-medium text-[var(--tx)]">{selectedCrew?.name || "—"}</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Coordinator</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.coordinator_name || "—"}</div></div>
            {isCompleted ? (
              <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Assigned</span><div className="text-[11px] font-medium text-[var(--gold)]">{assignedMembers.size} members</div></div>
            ) : (
              <button type="button" onClick={() => setCrewModalOpen(true)} className="text-left hover:opacity-90 transition-opacity"><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Assigned</span><div className="text-[11px] font-medium text-[var(--gold)]">{assignedMembers.size} members</div></button>
            )}
          </div>
        </div>

        {/* Vehicle */}
        <div className="group/s relative border-t border-[var(--brd)]/30 py-4">
          {!isCompleted && (
            <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setVehicleModalOpen(true)} aria-label="Edit vehicle">
              <Pencil className="w-[11px] h-[11px]" />
            </button>
          )}
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Vehicle</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Primary</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.truck_primary ? VEHICLE_LABELS[move.truck_primary] || move.truck_primary : "—"}</div></div>
            <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Secondary</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.truck_secondary ? VEHICLE_LABELS[move.truck_secondary] || move.truck_secondary : "—"}</div></div>
            {move.truck_notes && <div className="col-span-2 sm:col-span-1"><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Notes</span><div className="text-[10px] text-[var(--tx3)]">{move.truck_notes}</div></div>}
          </div>
        </div>

        {/* Valuation Protection */}
        {(move.valuation_tier || move.valuation_upgrade_cost || move.declaration_total) && (
          <div className="border-t border-[var(--brd)]/30 py-4">
            <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Valuation Protection</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
              <div>
                <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Tier</span>
                <div className="text-[11px] font-medium text-[var(--tx)]">
                  {move.valuation_tier === "full_replacement" ? "Full Replacement" : move.valuation_tier === "enhanced" ? "Enhanced Value" : "Released Value"}
                </div>
              </div>
              {(move.valuation_upgrade_cost ?? 0) > 0 && (
                <div>
                  <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Upgrade Cost</span>
                  <div className="text-[11px] font-medium text-[var(--gold)]">{formatCurrency(move.valuation_upgrade_cost)}</div>
                </div>
              )}
              {(move.declaration_total ?? 0) > 0 && (
                <div>
                  <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Declarations</span>
                  <div className="text-[11px] font-medium text-[var(--gold)]">{formatCurrency(move.declaration_total)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Financial Snapshot */}
      {(() => {
        const fullyPaid = isPaid || isBalancePaid;
        const quoteTotal = estimate > 0 ? estimate : (depositPaid + balanceDue);
        const collectedAmount = fullyPaid ? quoteTotal : depositPaid;
        const progressPct = quoteTotal > 0 ? Math.min(100, Math.round((collectedAmount / quoteTotal) * 100)) : 0;
        const SERVICE_LABELS: Record<string, string> = {
          local_move: "Residential", long_distance: "Long Distance",
          office_move: "Office", single_item: "Single Item",
          white_glove: "White Glove", specialty: "Specialty", b2b_delivery: "B2B Delivery",
        };

        return (
          <div className="rounded-2xl border border-[var(--brd)]/60 bg-[var(--card)] overflow-hidden">
            {/* Header strip */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0">
              <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50">Payments</span>
              <div className="flex items-center gap-1.5">
                {move.tier_selected && (
                  <span className="text-[8px] font-semibold tracking-wide px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/15">
                    {move.tier_selected.charAt(0).toUpperCase() + move.tier_selected.slice(1)}
                  </span>
                )}
                {move.service_type && (
                  <span className="text-[8px] text-[var(--tx3)]/50">
                    {SERVICE_LABELS[move.service_type as string] || move.service_type}
                  </span>
                )}
              </div>
            </div>

            {/* Main amount */}
            <div className="px-5 pt-3 pb-4">
              <div>
                  {/* Status badge sits above the number */}
                  <div className="mb-2">
                    {fullyPaid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-[var(--grn)]/12 text-[var(--grn)] border border-[var(--grn)]/20">
                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Paid
                      </span>
                    ) : balanceUnpaid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20">
                        Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className={`font-heading text-[32px] font-bold leading-none tracking-tight ${
                    fullyPaid ? "text-[var(--grn)]" : balanceUnpaid ? "text-[var(--red)]" : "text-[var(--tx)]"
                  }`}>
                    {formatCurrency(fullyPaid ? quoteTotal : balanceDue)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--tx3)]/60">
                      {fullyPaid
                        ? `Total collected${move.balance_method ? ` · ${move.balance_method === "etransfer" ? "E-Transfer" : "Card"}${move.balance_auto_charged ? " (auto)" : ""}` : ""}`
                        : `Balance due · +${formatCurrency(calcHST(balanceDue))} HST`}
                    </span>
                  </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] text-[var(--tx3)]/50">{formatCurrency(collectedAmount)} collected</span>
                  <span className="text-[9px] text-[var(--tx3)]/50">{formatCurrency(quoteTotal)} contract</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--brd)]/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${fullyPaid ? "bg-[var(--grn)]" : balanceUnpaid ? "bg-[var(--red)]" : "bg-[var(--gold)]"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Action row — only when action is needed */}
            {!fullyPaid && (
              <div className="px-4 py-3 border-t border-[var(--brd)]/40 flex flex-wrap items-center gap-2">
                {!isPaid && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/moves/${move.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "mark_paid", marked_by: "admin" }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to mark as paid");
                        if (data) setMove(data);
                        router.refresh();
                        toast("Move marked as paid", "check");
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Failed to mark as paid", "alertTriangle");
                      }
                    }}
                    className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--grn)]/12 text-[var(--grn)] border border-[var(--grn)]/25 hover:bg-[var(--grn)]/20 transition-colors"
                  >
                    Mark Deposit Paid
                  </button>
                )}
                {balanceDue > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={balanceLoading !== null}
                      onClick={async () => {
                        if (!window.confirm("Confirm that you've received the e-transfer for this move's balance?")) return;
                        setBalanceLoading("etransfer");
                        try {
                          const res = await fetch(`/api/admin/moves/${move.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "mark_etransfer_received", marked_by: "admin" }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed");
                          setMove(data);
                          router.refresh();
                          toast("E-transfer marked as received", "check");
                        } catch (err) {
                          toast(err instanceof Error ? err.message : "Failed to mark e-transfer", "alertTriangle");
                        } finally {
                          setBalanceLoading(null);
                        }
                      }}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--grn)]/12 text-[var(--grn)] border border-[var(--grn)]/25 hover:bg-[var(--grn)]/20 transition-colors disabled:opacity-40"
                    >
                      {balanceLoading === "etransfer" ? "Processing…" : "Mark E-Transfer Received"}
                    </button>
                    {move.square_card_id && (
                      <button
                        type="button"
                        disabled={balanceLoading !== null}
                        onClick={async () => {
                          const ccTotal = (balanceDue * 1.033 + 0.15).toFixed(2);
                          if (!window.confirm(`Charge ${ccTotal} CAD to the client's card on file? This includes the 3.3% processing fee.`)) return;
                          setBalanceLoading("card");
                          try {
                            const res = await fetch(`/api/admin/moves/${move.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "charge_card_now", marked_by: "admin" }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Failed");
                            setMove(data);
                            router.refresh();
                            toast("Card charged successfully", "check");
                          } catch (err) {
                            toast(err instanceof Error ? err.message : "Failed to charge card", "alertTriangle");
                          } finally {
                            setBalanceLoading(null);
                          }
                        }}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/25 hover:bg-[var(--gold)]/18 transition-colors disabled:opacity-40"
                      >
                        {balanceLoading === "card" ? "Charging…" : "Charge Card Now"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Profitability — Owner Only */}
      {userRole === "owner" && <MoveProfitCard move={move} />}

      {/* Complexity Indicators — seamless */}
      <div className="group/s relative border-t border-[var(--brd)]/30 py-4">
        <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit complexity indicators">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Complexity Indicators</div>
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(move.complexity_indicators) ? move.complexity_indicators : []).length > 0 ? (
            (Array.isArray(move.complexity_indicators) ? move.complexity_indicators : []).map((tag: string) => (
              <span key={tag} className="px-2 py-0.5 rounded text-[9px] font-medium bg-[var(--gdim)]/80 text-[var(--gold)] border border-[var(--gold)]/15">
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-[var(--tx3)]">No indicators. Click edit to add.</span>
          )}
        </div>
      </div>

      {/* Distance & Logistics */}
      <DistanceLogistics fromAddress={move.from_address} toAddress={move.to_address || move.delivery_address} />

      {/* Inventory, Photos, Documents */}
      <MoveInventorySection moveId={move.id} />
      <MovePhotosSection moveId={move.id} />
      <MoveCrewPhotosSection moveId={move.id} />
      <MoveSignOffSection moveId={move.id} />
      <MoveDocumentsSection moveId={move.id} />

      {/* Client Messages - conversation thread */}
      <ClientMessagesSection moveId={move.id} clientName={move.client_name} />

      {/* Reported Issues from crew */}
      <IncidentsSection jobId={move.id} jobType="move" />

      {/* Internal Notes — seamless */}
      <div className="group/s relative border-t border-[var(--brd)]/30 py-4">
        <button type="button" className="absolute top-4 right-0 opacity-0 group-hover/s:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit internal notes">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Internal Notes</div>
        <p className="text-[11px] text-[var(--tx2)] leading-snug whitespace-pre-wrap">
          {stripClientMessagesFromNotes(move.internal_notes) || "No internal notes. Click edit to add."}
        </p>
      </div>

      <EditMoveDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        moveId={move.id}
        crews={crews}
        isCompleted={isCompleted}
        initial={{
          from_address: move.from_address,
          to_address: move.to_address || move.delivery_address,
          from_lat: move.from_lat,
          from_lng: move.from_lng,
          to_lat: move.to_lat,
          to_lng: move.to_lng,
          crew_id: move.crew_id,
          coordinator_name: move.coordinator_name,
          scheduled_date: move.scheduled_date,
          arrival_window: move.arrival_window,
          from_access: move.from_access,
          to_access: move.to_access,
          access_notes: move.access_notes,
          complexity_indicators: move.complexity_indicators ?? [],
          internal_notes: stripClientMessagesFromNotes(move.internal_notes),
        }}
        onSaved={(updates) => {
          setMove((prev: any) => ({ ...prev, ...updates }));
          router.refresh();
        }}
      />

      {deleteConfirmOpen && (
        <ModalOverlay open onClose={() => setDeleteConfirmOpen(false)} title="Delete move?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">
              This will permanently remove this move and its inventory, documents, and photos. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/moves/${move.id}`, { method: "DELETE" });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Failed to delete");
                    toast("Move deleted", "check");
                    router.push(isOffice ? "/admin/moves/office" : "/admin/moves/residential");
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Failed to delete move", "x");
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Profitability Breakdown (Owner-Only)
   ════════════════════════════════════════ */
function MoveProfitCard({ move }: { move: any }) {
  const [costs, setCosts] = useState<{
    labour: number; fuel: number; truck: number; supplies: number;
    processing: number; totalDirect: number; allocatedOverhead: number;
    grossProfit: number; netProfit: number; grossMargin: number; netMargin: number;
  } | null>(null);
  const [target, setTarget] = useState(40);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const to = now.toISOString().slice(0, 10);
        const res = await fetch(`/api/admin/profitability?from=${from}&to=${to}`);
        if (!res.ok) return;
        const data = await res.json();
        setTarget(data.summary?.targetMargin ?? 40);
        const match = (data.rows ?? []).find((r: { id: string }) => r.id === move.id);
        if (match) {
          setCosts({
            labour: match.labour,
            fuel: match.fuel,
            truck: match.truck,
            supplies: match.supplies,
            processing: match.processing,
            totalDirect: match.totalDirect,
            allocatedOverhead: match.allocatedOverhead,
            grossProfit: match.grossProfit,
            netProfit: match.netProfit,
            grossMargin: match.grossMargin,
            netMargin: match.netMargin,
          });
        }
      } catch { /* silent */ }
    })();
  }, [move.id]);

  if (!costs) return null;

  const revenue = move.final_amount ?? move.estimate ?? move.amount ?? 0;
  const marginColor = costs.grossMargin >= target ? "text-emerald-400" : costs.grossMargin >= target - 5 ? "text-[var(--gold)]" : "text-red-400";

  return (
    <div className="border-t border-[var(--brd)]/30 py-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Profitability</div>
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20 font-medium">Owner Only</span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Revenue</span><span className="text-[var(--tx)] font-medium">{formatCurrency(revenue)}</span></div>
        <div className="border-t border-[var(--brd)]/30 my-1" />
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Labour</span><span className="text-red-400/80">-{formatCurrency(costs.labour)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Fuel</span><span className="text-red-400/80">-{formatCurrency(costs.fuel)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Truck</span><span className="text-red-400/80">-{formatCurrency(costs.truck)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Supplies</span><span className="text-red-400/80">-{formatCurrency(costs.supplies)}</span></div>
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Processing</span><span className="text-red-400/80">-{formatCurrency(costs.processing)}</span></div>
        <div className="border-t border-[var(--brd)]/30 my-1" />
        <div className="flex justify-between font-medium"><span className="text-[var(--tx3)]">Direct Cost</span><span className="text-red-400">-{formatCurrency(costs.totalDirect)}</span></div>
        <div className="flex justify-between font-semibold"><span className="text-[var(--tx)]">Gross Profit</span><span className={marginColor}>{formatCurrency(costs.grossProfit)} ({costs.grossMargin}%)</span></div>
        <div className="border-t border-[var(--brd)]/30 my-1" />
        <div className="flex justify-between"><span className="text-[var(--tx3)]">Overhead Allocation</span><span className="text-[var(--tx3)]">-{formatCurrency(costs.allocatedOverhead)}</span></div>
        <div className="flex justify-between font-semibold"><span className="text-[var(--tx)]">Net Profit</span><span className={costs.netMargin >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCurrency(costs.netProfit)} ({costs.netMargin}%)</span></div>
      </div>
      {costs.grossMargin < target && (
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          Below Target Margin ({target}%)
        </div>
      )}
    </div>
  );
}
