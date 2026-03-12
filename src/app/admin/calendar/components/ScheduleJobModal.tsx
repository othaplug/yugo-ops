"use client";

import { useState, useEffect, useCallback } from "react";
import { TIME_SLOTS_15MIN, formatTime12 } from "@/lib/calendar/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
  prefillDate?: string;
  prefillCrewId?: string;
  prefillStart?: string;
  crews: { id: string; name: string }[];
}

type JobType = "move" | "delivery" | "blocked";

interface ConflictState {
  checking: boolean;
  hasConflict: boolean;
  message: string;
  availableSlots: { start: string; end: string }[];
  availableCrews: { id: string; name: string }[];
}

export default function ScheduleJobModal({ open, onClose, onScheduled, prefillDate, prefillCrewId, prefillStart, crews }: Props) {
  const [jobType, setJobType] = useState<JobType>("move");
  const [date, setDate] = useState(prefillDate || "");
  const [startTime, setStartTime] = useState(prefillStart || "08:00");
  const [endTime, setEndTime] = useState("14:00");
  const [crewId, setCrewId] = useState(prefillCrewId || "");
  const [notes, setNotes] = useState("");
  const [blockReason, setBlockReason] = useState("maintenance");
  const [submitting, setSubmitting] = useState(false);

  const [conflict, setConflict] = useState<ConflictState>({
    checking: false, hasConflict: false, message: "", availableSlots: [], availableCrews: [],
  });

  useEffect(() => {
    if (prefillDate) setDate(prefillDate);
    if (prefillCrewId) setCrewId(prefillCrewId);
    if (prefillStart) {
      setStartTime(prefillStart);
      const [h, m] = prefillStart.split(":").map(Number);
      const endMins = h * 60 + m + 360;
      const eH = Math.floor(endMins / 60);
      const eM = endMins % 60;
      setEndTime(`${String(Math.min(eH, 20)).padStart(2, "0")}:${String(eM).padStart(2, "0")}`);
    }
  }, [prefillDate, prefillCrewId, prefillStart]);

  const checkConflict = useCallback(async () => {
    if (!crewId || !date || !startTime || !endTime) {
      setConflict({ checking: false, hasConflict: false, message: "", availableSlots: [], availableCrews: [] });
      return;
    }
    setConflict((prev) => ({ ...prev, checking: true }));
    try {
      const res = await fetch("/api/admin/calendar/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crew_id: crewId, date, start: startTime, end: endTime }),
      });
      const data = await res.json();
      if (data.hasConflict) {
        const labels = data.conflicts?.map((c: { start: string; end: string; reference_label: string }) =>
          `${c.start}-${c.end} (${c.reference_label})`
        ).join(", ");
        setConflict({
          checking: false,
          hasConflict: true,
          message: labels || "Crew is booked during this time",
          availableSlots: data.availableSlots || [],
          availableCrews: data.availableCrews || [],
        });
      } else {
        setConflict({ checking: false, hasConflict: false, message: "", availableSlots: data.availableSlots || [], availableCrews: [] });
      }
    } catch {
      setConflict({ checking: false, hasConflict: false, message: "", availableSlots: [], availableCrews: [] });
    }
  }, [crewId, date, startTime, endTime]);

  useEffect(() => {
    const timeout = setTimeout(checkConflict, 300);
    return () => clearTimeout(timeout);
  }, [checkConflict]);

  const handleSubmit = async () => {
    if (conflict.hasConflict || !date || !startTime || !endTime) return;
    if (jobType !== "blocked" && !crewId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/calendar/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_type: jobType === "blocked" ? blockReason : jobType,
          crew_id: crewId,
          date,
          start: startTime,
          end: endTime,
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        onScheduled();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to schedule");
      }
    } catch {
      alert("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const crewName = crews.find((c) => c.id === crewId)?.name || "team";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto border border-[var(--brd)]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-3 border-b border-[var(--brd)]">
          <h2 className="text-[18px] font-bold text-[var(--tx)]">Schedule Job</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Job type */}
          <div>
            <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Job Type</label>
            <div className="flex gap-1 bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-0.5">
              {(["move", "delivery", "blocked"] as JobType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setJobType(t)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                    jobType === t ? "bg-[var(--card)] text-[var(--gold)] shadow-sm" : "text-[var(--tx3)]"
                  }`}
                >
                  {t === "blocked" ? "Block Time" : t}
                </button>
              ))}
            </div>
          </div>

          {jobType === "blocked" && (
            <div>
              <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Reason</label>
              <select value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="maintenance">Vehicle Maintenance</option>
                <option value="training">Training</option>
                <option value="break">Break</option>
                <option value="time_off">Time Off</option>
                <option value="blocked">Other</option>
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Start</label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                {TIME_SLOTS_15MIN.map((t) => (
                  <option key={t} value={t}>{formatTime12(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">End</label>
              <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                {TIME_SLOTS_15MIN.filter((t) => t > startTime).map((t) => (
                  <option key={t} value={t}>{formatTime12(t)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Crew */}
          <div>
            <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Team</label>
            <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
              <option value="">Select team...</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]/50 mb-1.5 block">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--brd)] outline-none resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {/* Conflict indicator */}
          {crewId && date && (
            <div className={`rounded-lg p-3 text-[11px] ${
              conflict.checking
                ? "bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx3)]"
                : conflict.hasConflict
                  ? "bg-red-500/10 border border-red-500/30 text-red-400"
                  : "bg-green-500/10 border border-green-500/30 text-green-400"
            }`}>
              {conflict.checking ? (
                <span>Checking availability...</span>
              ) : conflict.hasConflict ? (
                <div>
                  <div className="font-bold mb-1">CONFLICT — {crewName} is booked</div>
                  <div className="text-[10px] opacity-80">{conflict.message}</div>
                  {conflict.availableSlots.length > 0 && (
                    <div className="mt-2 text-[10px]">
                      <span className="font-semibold">Available slots today:</span>
                      {conflict.availableSlots.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setStartTime(s.start); setEndTime(s.end > "20:00" ? "20:00" : s.end); }}
                          className="ml-1 underline hover:text-[var(--gold)] transition-colors"
                        >
                          {formatTime12(s.start)}-{formatTime12(s.end)}
                        </button>
                      ))}
                    </div>
                  )}
                  {conflict.availableCrews.length > 0 && (
                    <div className="mt-1 text-[10px]">
                      <span className="font-semibold">Available teams:</span>
                      {conflict.availableCrews.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCrewId(c.id)}
                          className="ml-1 underline hover:text-[var(--gold)] transition-colors"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <span className="font-bold">{crewName} is available</span>
                  <span className="ml-2 opacity-70">{formatTime12(startTime)} – {formatTime12(endTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[var(--brd)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[var(--tx3)] border border-[var(--brd)] hover:bg-[var(--bg)] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={conflict.hasConflict || conflict.checking || submitting || !date || !startTime || !endTime}
            className="px-5 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
