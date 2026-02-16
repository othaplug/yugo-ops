"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Badge from "../../components/Badge";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import MoveNotifyButton from "../MoveNotifyButton";
import MoveContactModal from "./MoveContactModal";
import EditMoveDetailsModal from "./EditMoveDetailsModal";
import ModalOverlay from "../../components/ModalOverlay";
import { useRelativeTime } from "./useRelativeTime";

interface MoveDetailClientProps {
  move: any;
  isOffice?: boolean;
}

const TEAM_MEMBERS = ["Michael T.", "Sarah K.", "James L.", "Elena M."];
const STATUS_OPTIONS = ["pending", "scheduled", "confirmed", "in-transit", "delivered", "cancelled"] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  confirmed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
};
const STAGE_OPTS = [
  { value: "quote", label: "Quote" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function MoveDetailClient({ move: initialMove, isOffice }: MoveDetailClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [move, setMove] = useState(initialMove);
  useEffect(() => setMove(initialMove), [initialMove]);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<"status" | "stage" | "next_action" | null>(null);
  const [editNextAction, setEditNextAction] = useState("");
  const [assignedMembers, setAssignedMembers] = useState<Set<string>>(new Set(TEAM_MEMBERS));
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

  const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 space-y-5 animate-fade-up">
      <BackButton label="Back" />

      {/* Hero - client name clickable */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="font-heading text-[22px] md:text-[24px] font-bold text-[var(--tx)] hover:text-[var(--gold)] transition-colors text-left truncate"
            >
              {move.client_name}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/30">
                <Icon name={isOffice ? "building" : "home"} className="w-[12px] h-[12px]" />
                {isOffice ? "Office" : "Residential"} Move
              </span>
              <MoveNotifyButton move={move} />
            </div>
          </div>
        </div>

        {/* Status bar - refined 4-column grid */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="group/card relative p-4 rounded-xl bg-[var(--bg)]/50 border border-[var(--brd)]/60 hover:border-[var(--gold)]/40 transition-all">
            <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditingCard(editingCard === "status" ? null : "status")} aria-label="Edit status">
              <EditIcon />
            </button>
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-2">Status</div>
            {editingCard === "status" ? (
              <select
                defaultValue={move.status}
                className="w-full text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                onChange={async (e) => {
                  const v = e.target.value;
                  const { data } = await supabase.from("moves").update({ status: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                  if (data) setMove(data);
                  setEditingCard(null);
                  router.refresh();
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.replace("-", " ")}</option>
                ))}
              </select>
            ) : (
              <span className={`inline-flex px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize ${STATUS_COLORS[move.status] || "bg-[var(--gdim)] text-[var(--gold)]"}`}>
                {move.status?.replace("-", " ")}
              </span>
            )}
          </div>

          <div className="group/card relative p-4 rounded-xl bg-[var(--bg)]/50 border border-[var(--brd)]/60 hover:border-[var(--gold)]/40 transition-all">
            <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setEditingCard(editingCard === "stage" ? null : "stage")} aria-label="Edit stage">
              <EditIcon />
            </button>
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-2">Stage</div>
            {editingCard === "stage" ? (
              <select
                defaultValue={move.stage ?? "scheduled"}
                className="w-full text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                onChange={async (e) => {
                  const v = e.target.value || null;
                  const { data } = await supabase.from("moves").update({ stage: v, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                  if (data) setMove(data);
                  setEditingCard(null);
                  router.refresh();
                }}
              >
                {STAGE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <div className="text-[12px] font-semibold text-[var(--tx)]">{STAGE_OPTS.find((o) => o.value === move.stage)?.label ?? move.stage ?? "—"}</div>
            )}
          </div>

          <div className="group/card relative p-4 rounded-xl bg-[var(--bg)]/50 border border-[var(--brd)]/60 hover:border-[var(--gold)]/40 transition-all">
            <button type="button" className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => { setEditNextAction(move.next_action ?? ""); setEditingCard(editingCard === "next_action" ? null : "next_action"); }} aria-label="Edit next action">
              <EditIcon />
            </button>
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-2">Next action</div>
            {editingCard === "next_action" ? (
              <input
                value={editNextAction}
                onChange={(e) => setEditNextAction(e.target.value)}
                onBlur={async () => {
                  const { data } = await supabase.from("moves").update({ next_action: editNextAction.trim() || null, updated_at: new Date().toISOString() }).eq("id", move.id).select().single();
                  if (data) setMove(data);
                  setEditingCard(null);
                  router.refresh();
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                autoFocus
                className="w-full text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                placeholder="Add next action"
              />
            ) : (
              <div className="text-[12px] font-semibold text-[var(--gold)] truncate">{move.next_action || "—"}</div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg)]/50 border border-[var(--brd)]/60">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-2">Last updated</div>
            <div className="text-[12px] font-semibold text-[var(--tx2)]">{lastUpdatedRelative}</div>
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

      {/* Crew + Asset Assignment */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6 hover:border-[var(--gold)]/60 transition-all">
        <button type="button" className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setCrewModalOpen(true)} aria-label="Edit crew">
          <EditIcon />
        </button>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Crew & Asset Assignment</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Assigned Crew</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">Team A</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Crew Lead</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">Michael T.</div>
          </div>
          <button
            type="button"
            onClick={() => setCrewModalOpen(true)}
            className="text-left hover:bg-[var(--bg)] rounded-lg p-2 -m-2 transition-colors"
          >
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Crew Size</div>
            <div className="text-[12px] font-semibold text-[var(--gold)] hover:underline">{assignedMembers.size}</div>
          </button>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Truck</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">Sprinter 3</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Dispatch Confirmed</div>
            <div className="text-[12px] font-semibold text-[var(--grn)]">Yes</div>
          </div>
        </div>
      </div>

      <ModalOverlay open={crewModalOpen} onClose={() => setCrewModalOpen(false)} title="Team Members" maxWidth="sm">
        <div className="p-5 space-y-4">
          <p className="text-[11px] text-[var(--tx3)]">Check or uncheck members to assign to this job.</p>
          <div className="space-y-2">
            {TEAM_MEMBERS.map((m) => (
              <label key={m} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--brd)] hover:bg-[var(--bg)] cursor-pointer transition-colors">
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
        </div>
      </ModalOverlay>

      {/* Time Intelligence - editable */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6 hover:border-[var(--gold)]/60 transition-all">
        <button type="button" className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit date & time">
          <EditIcon />
        </button>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Time Intelligence</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Move Date</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">{move.scheduled_date || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Time</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">{move.scheduled_time || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Arrival Window</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">{move.arrival_window || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Est. Duration</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">8h</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Projected Completion</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">4:00 PM</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Days Until Move</div>
            <div className="text-[12px] font-bold text-[var(--gold)]">{daysUntil ?? "—"}</div>
          </div>
        </div>
      </div>

      {/* Property + Access - editable */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 hover:border-[var(--gold)]/60 transition-all">
        <button type="button" className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit property access">
          <EditIcon />
        </button>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">
          {isOffice ? "Office & Access Conditions" : "Property & Access Conditions"}
        </h3>
        <p className="text-[11px] text-[var(--tx2)] leading-relaxed whitespace-pre-wrap">{move.access_notes || "No access notes. Click edit to add."}</p>
      </div>

      {/* Financial Snapshot */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Financial Snapshot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Estimate</div>
            <div className="text-[14px] font-bold text-[var(--gold)]">${estimate.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Deposit Paid</div>
            <div className="text-[14px] font-bold text-[var(--grn)]">${depositPaid.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Balance Due</div>
            <div className={`text-[14px] font-bold ${balanceUnpaid ? "text-[var(--red)]" : "text-[var(--tx)]"}`}>${balanceDue.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoice Status</div>
            <div className="text-[12px] font-semibold text-[var(--grn)]">Deposit Received</div>
          </div>
        </div>
      </div>

      {/* Complexity Indicators */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Complexity Indicators</h3>
        <div className="flex flex-wrap gap-2">
          {["White Glove", "Piano", "High Value Client", "Repeat Client"].map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-[9px] font-semibold bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/20">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Distance + Logistics */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 md:p-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Distance & Logistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Distance</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">11.2 km</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Drive Time</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">24 min</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Traffic Risk</div>
            <div className="text-[12px] font-semibold text-[var(--org)]">Moderate</div>
          </div>
        </div>
      </div>

      {/* Internal Notes */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Internal Notes</h3>
        <p className="text-[11px] text-[var(--tx2)] leading-relaxed">
          &quot;Client extremely particular about wall protection. Building strict.&quot;
        </p>
      </div>

      {/* Addresses - editable */}
      <div className="group/card relative bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 hover:border-[var(--gold)]/60 transition-all">
        <button type="button" className="absolute top-4 right-4 opacity-0 group-hover/card:opacity-100 p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] transition-opacity" onClick={() => setDetailsModalOpen(true)} aria-label="Edit addresses">
          <EditIcon />
        </button>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Addresses</h3>
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">From</div>
            <div className="text-[13px] text-[var(--tx)]">{move.from_address || "—"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">To</div>
            <div className="text-[13px] text-[var(--tx)]">{move.to_address || move.delivery_address || "—"}</div>
          </div>
        </div>
        <button type="button" onClick={() => setDetailsModalOpen(true)} className="mt-3 text-[11px] font-semibold text-[var(--gold)] hover:underline">
          Edit address, date & access →
        </button>
      </div>

      <EditMoveDetailsModal
        open={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        moveId={move.id}
        initial={{
          from_address: move.from_address,
          to_address: move.to_address || move.delivery_address,
          scheduled_date: move.scheduled_date,
          scheduled_time: move.scheduled_time,
          arrival_window: move.arrival_window,
          access_notes: move.access_notes,
        }}
        onSaved={(updates) => setMove((prev: any) => ({ ...prev, ...updates }))}
      />
    </div>
  );
}
