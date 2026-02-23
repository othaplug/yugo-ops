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
}
import { MOVE_STATUS_OPTIONS, MOVE_STATUS_COLORS_ADMIN, MOVE_STATUS_INDEX, LIVE_TRACKING_STAGES, getStatusLabel, normalizeStatus } from "@/lib/move-status";

function isMoveStatusCompleted(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "delivered" || s === "done";
}
import { stripClientMessagesFromNotes } from "@/lib/internal-notes";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";

export default function MoveDetailClient({ move: initialMove, crews = [], isOffice }: MoveDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [move, setMove] = useState(initialMove);
  useEffect(() => setMove(initialMove), [initialMove]);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
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
  const estimate = Number(move.estimate || 0);
  const depositPaid = Math.round(estimate * 0.25);
  const balanceDue = estimate - depositPaid;
  const scheduledDateLocal = parseDateOnly(move.scheduled_date);
  const daysUntil = scheduledDateLocal ? Math.ceil((scheduledDateLocal.getTime() - Date.now()) / 86400000) : null;
  const balanceUnpaid = balanceDue > 0 && daysUntil !== null && daysUntil <= 1;
  const lastUpdatedRelative = useRelativeTime(move.updated_at);
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

      {/* Hero - compact header with glass */}
      <div className="glass rounded-xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="font-heading text-[17px] md:text-[19px] font-bold text-[var(--tx)] hover:text-[var(--gold)] transition-colors text-left break-words line-clamp-2"
            >
              {move.client_name}
            </button>
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
                  defaultValue={normalizeStatus(move.status) || move.status || "confirmed"}
                  className="text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[120px]"
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
                  }}
                >
                  {MOVE_STATUS_OPTIONS.map((s) => (
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
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors"
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
                      className="w-4 h-4 rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--gold)]"
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

      {/* Time Intelligence - editable */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit date & time">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Time & Intelligence</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Date</span><div className="text-[11px] font-medium text-[var(--tx)]">{formatMoveDate(move.scheduled_date)}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Time Window</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.arrival_window || "—"}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Job duration</span><div className="text-[11px] font-medium text-[var(--tx)] tabular-nums">{jobDurationStr ?? "—"}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Completion</span><div className="text-[11px] font-medium text-[var(--tx)]">4:00 PM</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Days Left</span><div className="text-[11px] font-bold text-[var(--gold)]">{daysUntil ?? "—"}</div></div>
        </div>
      </div>

      {/* Addresses - same grid pattern as other cards */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit addresses">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Addresses</h3>
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

      {/* Crew - same structure as other cards */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setCrewModalOpen(true)} aria-label="Edit crew">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Crew</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Crew</span><div className="text-[11px] font-medium text-[var(--tx)]">{selectedCrew?.name || "—"}</div></div>
          <button type="button" onClick={() => setCrewModalOpen(true)} className="text-left hover:opacity-90 transition-opacity"><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Assigned</span><div className="text-[11px] font-medium text-[var(--gold)]">{assignedMembers.size} members</div></button>
        </div>
      </div>

      {/* Financial Snapshot */}
      <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-4 transition-colors">
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-3">Financial Snapshot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <div className="rounded-xl bg-gradient-to-br from-[var(--gold)]/15 to-[var(--gold)]/5 border-2 border-[var(--gold)]/40 px-4 py-3 shadow-sm">
            <span className="text-[9px] font-bold tracking-widest uppercase text-[var(--gold)]/90">Estimate</span>
            <div className="text-[20px] md:text-[22px] font-bold font-heading text-[var(--gold)] mt-1 tracking-tight">{formatCurrency(estimate)}</div>
          </div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Deposit</span><div className="text-[13px] font-bold text-[var(--grn)]">{formatCurrency(depositPaid)}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Balance</span><div className={`text-[13px] font-bold ${balanceUnpaid ? "text-[var(--red)]" : "text-[var(--tx)]"}`}>{formatCurrency(balanceDue)}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Status</span><div className="text-[13px] font-medium text-[var(--grn)]">Deposit Received</div></div>
        </div>
      </div>

      {/* Complexity Indicators */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit complexity indicators">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Complexity Indicators</h3>
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

      {/* Internal Notes - admin-only, at bottom */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit internal notes">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Internal Notes</h3>
        <p className="text-[11px] text-[var(--tx2)] leading-snug whitespace-pre-wrap">
          {stripClientMessagesFromNotes(move.internal_notes) || "No internal notes. Click edit to add."}
        </p>
      </div>

      <EditMoveDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        moveId={move.id}
        crews={crews}
        initial={{
          from_address: move.from_address,
          to_address: move.to_address || move.delivery_address,
          from_lat: move.from_lat,
          from_lng: move.from_lng,
          to_lat: move.to_lat,
          to_lng: move.to_lng,
          crew_id: move.crew_id,
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
