"use client";

import { useState } from "react";
import Badge from "../../components/Badge";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import MoveNotifyButton from "../MoveNotifyButton";
import ModalOverlay from "../../components/ModalOverlay";

interface MoveDetailClientProps {
  move: any;
  isOffice?: boolean;
}

const TEAM_MEMBERS = ["Michael T.", "Sarah K.", "James L.", "Elena M."];

export default function MoveDetailClient({ move, isOffice }: MoveDetailClientProps) {
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState<Set<string>>(new Set(TEAM_MEMBERS));
  const estimate = Number(move.estimate || 0);
  const depositPaid = Math.round(estimate * 0.25);
  const balanceDue = estimate - depositPaid;
  const daysUntil = move.scheduled_date ? Math.ceil((new Date(move.scheduled_date).getTime() - Date.now()) / 86400000) : null;
  const balanceUnpaid = balanceDue > 0 && daysUntil !== null && daysUntil <= 1;

  const toggleMember = (name: string) => {
    setAssignedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 space-y-5 animate-fade-up">
      <BackButton label="Back" />

      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">{move.client_name}</h1>
            <Badge status={move.status} />
            <span className="text-[11px] text-[var(--tx3)]">
              <Icon name={isOffice ? "building" : "home"} className="w-[14px] h-[14px] inline-block align-middle mr-1" />
              {isOffice ? "Office" : "Residential"} Move
            </span>
          </div>
          <MoveNotifyButton move={move} />
        </div>

        {/* Status Stage Card - upgraded */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-4 px-4 bg-[var(--bg)] rounded-xl border border-[var(--brd)]">
          <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--brd)]">
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Status</div>
            <div className="text-[12px] font-semibold text-[var(--tx)] capitalize mt-0.5">{move.status}</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--brd)]">
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Stage</div>
            <div className="text-[12px] font-semibold text-[var(--tx)] mt-0.5">Scheduled</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--brd)]">
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Next Action</div>
            <div className="text-[12px] font-semibold text-[var(--gold)] mt-0.5">Deliver Supplies</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--card)] border border-[var(--brd)]">
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">Last Updated</div>
            <div className="text-[12px] font-semibold text-[var(--tx2)] mt-0.5">2 hours ago</div>
          </div>
        </div>
      </div>

      {/* Crew + Asset Assignment */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Crew & Asset Assignment</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Time Intelligence */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Time Intelligence</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Move Date</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">{move.scheduled_date || "—"}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Arrival Window</div>
            <div className="text-[12px] font-semibold text-[var(--tx)]">8:00 to 10:00 AM</div>
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

      {/* Property + Access (Residential) or Office-specific (Office) */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">
          {isOffice ? "Office & Access Conditions" : "Property & Access Conditions"}
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Origin</div>
            <div className="space-y-1.5 text-[11px]">
              <div><span className="text-[var(--tx3)]">Type:</span> <span className="font-semibold">{isOffice ? "Office Tower" : "Condo"}</span></div>
              <div><span className="text-[var(--tx3)]">Elevator Reserved:</span> <span className="font-semibold">9:00 to 11:00</span></div>
              <div><span className="text-[var(--tx3)]">Loading Dock:</span> <span className="font-semibold">{isOffice ? "Yes" : "Yes"}</span></div>
              <div><span className="text-[var(--tx3)]">Stairs:</span> <span className="font-semibold">No</span></div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Destination</div>
            <div className="space-y-1.5 text-[11px]">
              <div><span className="text-[var(--tx3)]">Type:</span> <span className="font-semibold">{isOffice ? "Retail Unit" : "Detached"}</span></div>
              <div><span className="text-[var(--tx3)]">Parking:</span> <span className="font-semibold">Street</span></div>
              <div><span className="text-[var(--tx3)]">Access Notes:</span> <span className="font-semibold">{isOffice ? "Freight elevator required" : "Narrow driveway"}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Snapshot */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Financial Snapshot</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Distance & Logistics</h3>
        <div className="grid grid-cols-3 gap-4">
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

      {/* Addresses */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
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
      </div>
    </div>
  );
}
