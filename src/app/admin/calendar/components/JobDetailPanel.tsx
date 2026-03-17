"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, TIME_SLOTS_15MIN, STATUS_DOT_COLORS } from "@/lib/calendar/types";
import { toTitleCase, formatAddressForDisplay } from "@/lib/format-text";
import { Icon } from "@/components/AppIcons";
import Link from "next/link";

interface Props {
  event: CalendarEvent | null;
  crews: { id: string; name: string; memberCount: number }[];
  onClose: () => void;
  onRescheduled?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  move: "Move",
  delivery: "Delivery",
  project_phase: "Project Phase",
  blocked: "Blocked Time",
};

const REASSIGNABLE = ["move", "delivery", "blocked"];

/** Completed jobs can only be edited if they have no time and no team assigned */
function canEditEvent(ev: CalendarEvent): boolean {
  if (ev.calendarStatus !== "completed") return true;
  const hasTime = !!(ev.start || ev.end);
  const hasTeam = !!ev.crewId;
  return !hasTime && !hasTeam;
}

export default function JobDetailPanel({ event, crews, onClose, onRescheduled }: Props) {
  const [showReassign, setShowReassign] = useState(false);
  const [reassignCrewId, setReassignCrewId] = useState("");
  const [reassignDate, setReassignDate] = useState("");
  const [reassignStart, setReassignStart] = useState("08:00");
  const [reassignEnd, setReassignEnd] = useState("14:00");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset reassign form whenever panel opens for a new event
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  if (event && event.id !== lastEventId) {
    setLastEventId(event.id);
    setShowReassign(false);
    setReassignCrewId(event.crewId || "");
    setReassignDate(event.date || "");
    setReassignStart(event.start || "08:00");
    setReassignEnd(event.end || "14:00");
    setSaveError(null);
  }

  if (!event) return null;

  const dotColor = STATUS_DOT_COLORS[event.calendarStatus] || STATUS_DOT_COLORS.scheduled;
  const timeStr = event.start
    ? event.end
      ? `${formatTime12(event.start)} – ${formatTime12(event.end)}`
      : formatTime12(event.start)
    : "Time not set";

  const canReassign = REASSIGNABLE.includes(event.type) && canEditEvent(event);

  const handleSaveReassign = async () => {
    if (!reassignCrewId || !reassignDate || !reassignStart || !reassignEnd) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/calendar/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event.type === "blocked" ? event.scheduleBlockId || event.id : event.id,
          event_type: event.type,
          crew_id: reassignCrewId,
          date: reassignDate,
          start: reassignStart,
          end: reassignEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to reassign");
      } else {
        onRescheduled?.();
        onClose();
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-[440px] bg-[var(--card)] border-l border-[var(--brd)] h-full overflow-y-auto shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: event.color }} />
              <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50">
                {TYPE_LABELS[event.type] || event.type}
              </span>
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                style={{ backgroundColor: `${dotColor}20`, color: dotColor }}
              >
                {toTitleCase(event.calendarStatus)}
              </span>
              {event.isRecurring && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-500/10 text-teal-400">
                  RECURRING
                </span>
              )}
            </div>
            <h2 className="text-[18px] font-bold text-[var(--tx)]">{event.name}</h2>
            <p className="text-[12px] text-[var(--tx3)] mt-0.5">{toTitleCase(event.description)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg)] text-[var(--tx3)] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Time */}
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">
              Time
            </div>
            <div className="text-[14px] font-semibold text-[var(--tx)]">{timeStr}</div>
            {event.durationHours && (
              <div className="text-[11px] text-[var(--tx3)]">{event.durationHours} hours estimated</div>
            )}
            <div className="text-[11px] text-[var(--tx3)]">
              {new Date(event.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>

          {/* Team & Truck */}
          {(event.crewName || event.truckName) && (
            <div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">
                Assignment
              </div>
              {event.crewName && (
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--tx)]">
                  <Icon name="users" className="w-3.5 h-3.5 shrink-0 stroke-[1.75] stroke-current text-[var(--tx3)]" />
                  {event.crewName}
                </div>
              )}
              {event.truckName && (
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--tx)]">
                  <Icon name="truck" className="w-3.5 h-3.5 shrink-0 stroke-[1.75] stroke-current text-[var(--tx3)]" />
                  {event.truckName}
                </div>
              )}
            </div>
          )}

          {/* Addresses */}
          {(event.fromAddress || event.toAddress || event.deliveryAddress) && (
            <div>
              <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">
                Location
              </div>
              {event.fromAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">From:</span>{" "}
                  {formatAddressForDisplay(event.fromAddress)}
                </div>
              )}
              {event.toAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">To:</span>{" "}
                  {formatAddressForDisplay(event.toAddress)}
                </div>
              )}
              {event.deliveryAddress && (
                <div className="text-[12px] text-[var(--tx)]">
                  <span className="text-[var(--tx3)]">Deliver to:</span>{" "}
                  {formatAddressForDisplay(event.deliveryAddress)}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div>
            <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1">
              Details
            </div>
            {event.moveSize && (
              <div className="text-[12px] text-[var(--tx)]">Size: {event.moveSize}</div>
            )}
            {event.itemCount && (
              <div className="text-[12px] text-[var(--tx)]">Items: {event.itemCount}</div>
            )}
            {event.category && (
              <div className="text-[12px] text-[var(--tx)]">
                Category: {toTitleCase(event.category)}
              </div>
            )}
          </div>

          {/* ── Reassign section (hidden for completed jobs with time/team) ── */}
          {event.calendarStatus === "completed" && !canEditEvent(event) && (
            <div className="rounded-lg px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400">
              This completed job has time and team assigned and cannot be edited.
            </div>
          )}
          {canReassign && (
            <div className="border border-[var(--brd)] rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowReassign((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg)] hover:bg-[var(--brd)]/30 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--tx)]">
                  <Icon name="calendar" className="w-3.5 h-3.5 stroke-[1.75] stroke-current text-[var(--gold)]" />
                  Reassign / Reschedule
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-[var(--tx3)] transition-transform ${showReassign ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showReassign && (
                <div className="px-4 pb-4 pt-3 space-y-3 bg-[var(--card)]">
                  {event.isRecurring && (
                    <p className="text-[11px] text-[var(--tx3)] bg-[var(--bg)] rounded-lg px-3 py-2">
                      Changing team updates the recurring schedule; all instances will use the new team.
                    </p>
                  )}
                  {/* Team */}
                  <div>
                    <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1 block">
                      Team
                    </label>
                    <select
                      value={reassignCrewId}
                      onChange={(e) => setReassignCrewId(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] outline-none"
                    >
                      <option value="">Select team…</option>
                      {crews.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1 block">
                      Date
                    </label>
                    <input
                      type="date"
                      value={reassignDate}
                      onChange={(e) => setReassignDate(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] outline-none"
                    />
                  </div>

                  {/* Start / End */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1 block">
                        Start
                      </label>
                      <select
                        value={reassignStart}
                        onChange={(e) => setReassignStart(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] outline-none"
                      >
                        {TIME_SLOTS_15MIN.map((t) => (
                          <option key={t} value={t}>
                            {formatTime12(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1 block">
                        End
                      </label>
                      <select
                        value={reassignEnd}
                        onChange={(e) => setReassignEnd(e.target.value)}
                        className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] outline-none"
                      >
                        {TIME_SLOTS_15MIN.filter((t) => t > reassignStart).map((t) => (
                          <option key={t} value={t}>
                            {formatTime12(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {saveError && (
                    <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {saveError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveReassign}
                    disabled={saving || !reassignCrewId || !reassignDate}
                    className="w-full py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Confirm Reassignment"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Link to detail */}
          {event.href && (
            <Link
              href={event.href}
              className="block w-full text-center py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--card)] border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
            >
              View Full Details →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
