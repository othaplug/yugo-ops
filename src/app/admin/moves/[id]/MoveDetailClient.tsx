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
import MovePhotosSection from "./MovePhotosSection";
import MoveDocumentsSection from "./MoveDocumentsSection";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { useRelativeTime } from "./useRelativeTime";

interface MoveDetailClientProps {
  move: any;
  crews?: { id: string; name: string; members?: string[] }[];
  isOffice?: boolean;
}
import { MOVE_STATUS_OPTIONS, MOVE_STATUS_COLORS_ADMIN, LIVE_TRACKING_STAGES, getStatusLabel, normalizeStatus } from "@/lib/move-status";
import { formatMoveDate } from "@/lib/date-format";

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
  const [editingCard, setEditingCard] = useState<"status" | "stage" | null>(null);
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
  const daysUntil = move.scheduled_date ? Math.ceil((new Date(move.scheduled_date).getTime() - Date.now()) / 86400000) : null;
  const balanceUnpaid = balanceDue > 0 && daysUntil !== null && daysUntil <= 1;
  const lastUpdatedRelative = useRelativeTime(move.updated_at);

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

      {/* Hero - compact header */}
      <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
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
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-[var(--brd)]/40 pt-3">
          <div className="group/card relative flex items-center gap-2 min-w-0">
            <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/80 shrink-0">Status</span>
            {editingCard === "status" ? (
              <select
                defaultValue={normalizeStatus(move.status) || move.status || "confirmed"}
                className="text-[11px] bg-transparent border-b border-[var(--brd)] px-0 py-0.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[100px]"
                onChange={async (e) => {
                  const v = e.target.value as string;
                  const { data, error } = await supabase.from("moves").update({ status: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
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
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-dashed border-transparent hover:border-[var(--gold)]/40 hover:opacity-90 transition-all cursor-pointer group/btn"
                aria-label="Edit status"
              >
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${MOVE_STATUS_COLORS_ADMIN[move.status] || "bg-[var(--gdim)] text-[var(--gold)]"}`}>
                  {getStatusLabel(move.status)}
                </span>
                <ChevronDown className="w-[10px] h-[10px] text-[var(--tx3)] opacity-60 group-hover/btn:opacity-100" />
              </button>
            )}
          </div>

          <div className="group/card relative flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/80 shrink-0">
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
              </span>
              Live stage
            </span>
              {editingCard === "stage" ? (
                <select
                  defaultValue={move.stage ?? "pending"}
                  className="text-[11px] bg-transparent border-b border-[var(--brd)] px-0 py-0.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[120px]"
                  onChange={async (e) => {
                    const v = e.target.value || null;
                    const { data } = await supabase.from("moves").update({ stage: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                    if (data) setMove(data);
                    setEditingCard(null);
                    router.refresh();
                  }}
                >
                  {LIVE_TRACKING_STAGES.map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingCard("stage")}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-dashed border-transparent hover:border-[var(--gold)]/40 hover:opacity-90 transition-all cursor-pointer group/btn text-left min-w-0"
                  aria-label="Edit live stage"
                >
                  <span className="text-[11px] font-medium text-[var(--tx)] truncate">{LIVE_TRACKING_STAGES.find((o) => o.key === move.stage)?.label ?? "—"}</span>
                  <ChevronDown className="w-[10px] h-[10px] text-[var(--tx3)] opacity-60 group-hover/btn:opacity-100 shrink-0" />
                </button>
              )}
            </div>

          <div className="flex items-center gap-1.5 pl-4 ml-2 border-l border-[var(--brd)]/50">
            <span className="text-[9px] font-medium tracking-wide uppercase text-[var(--tx3)]/90">
              Last updated <span className="tabular-nums text-[var(--tx2)]">{lastUpdatedRelative}</span>
            </span>
          </div>
        </div>
      </div>

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
                className="w-full py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
              >
                Save Assignments
              </button>
            </>
          )}
          {selectedCrew && crewMembers.length === 0 && (
            <p className="text-[11px] text-[var(--tx3)]">No members in this crew. Add members in Platform Settings → Crews & Teams.</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1">
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Date</span><div className="text-[11px] font-medium text-[var(--tx)]">{formatMoveDate(move.scheduled_date)}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Time</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.scheduled_time || "—"}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Window</span><div className="text-[11px] font-medium text-[var(--tx)]">{move.arrival_window || "—"}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Duration</span><div className="text-[11px] font-medium text-[var(--tx)]">8h</div></div>
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
      <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 transition-colors">
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Financial Snapshot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Estimate</span><div className="text-[11px] font-bold text-[var(--gold)]">${estimate.toLocaleString()}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Deposit</span><div className="text-[11px] font-bold text-[var(--grn)]">${depositPaid.toLocaleString()}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Balance</span><div className={`text-[11px] font-bold ${balanceUnpaid ? "text-[var(--red)]" : "text-[var(--tx)]"}`}>${balanceDue.toLocaleString()}</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Status</span><div className="text-[11px] font-medium text-[var(--grn)]">Deposit Received</div></div>
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
      <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 transition-colors">
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Distance & Logistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1">
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Distance</span><div className="text-[11px] font-medium text-[var(--tx)]">11.2 km</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Drive Time</span><div className="text-[11px] font-medium text-[var(--tx)]">24 min</div></div>
          <div><span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Traffic Risk</span><div className="text-[11px] font-medium text-[var(--org)]">Moderate</div></div>
        </div>
      </div>

      {/* Internal Notes */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 hover:border-[var(--gold)]/40 transition-all">
        <button type="button" className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover/card:opacity-100 p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit internal notes">
          <Pencil className="w-[11px] h-[11px]" />
        </button>
        <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">Internal Notes</h3>
        <p className="text-[11px] text-[var(--tx2)] leading-snug whitespace-pre-wrap">
          {move.internal_notes || "No internal notes. Click edit to add."}
        </p>
      </div>

      <MoveInventorySection moveId={move.id} />
      <MovePhotosSection moveId={move.id} />
      <MoveDocumentsSection moveId={move.id} />

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
          scheduled_time: move.scheduled_time,
          arrival_window: move.arrival_window,
          from_access: move.from_access,
          to_access: move.to_access,
          access_notes: move.access_notes,
          complexity_indicators: move.complexity_indicators ?? [],
          internal_notes: move.internal_notes,
        }}
        onSaved={(updates) => setMove((prev: any) => ({ ...prev, ...updates }))}
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
                    router.push("/admin/moves");
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
