"use client";

import { useState, useEffect, useCallback } from "react";
import { TIME_SLOTS_15MIN, formatTime12 } from "@/lib/calendar/types";
import { X } from "@phosphor-icons/react";

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

const JOB_TYPE_OPTIONS: { id: JobType; label: string; description: string }[] = [
  { id: "move", label: "Move", description: "Residential or commercial move" },
  { id: "delivery", label: "Delivery", description: "Single or multi-piece delivery" },
  { id: "blocked", label: "Block Time", description: "Maintenance, training, or time off" },
];

const BLOCK_REASONS = [
  { value: "maintenance", label: "Vehicle Maintenance" },
  { value: "training", label: "Training" },
  { value: "break", label: "Break" },
  { value: "time_off", label: "Time Off" },
  { value: "blocked", label: "Other" },
];

const inputCls =
  "w-full px-3.5 py-3 bg-[var(--bg)] border border-[var(--brd)]/70 rounded-xl text-[var(--text-base)] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)]/60 focus:ring-2 focus:ring-[var(--gold)]/10 outline-none transition-all duration-150";
const labelCls =
  "flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase text-[var(--tx2)] mb-2";

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
      const endMins = h! * 60 + m! + 360;
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
          `${c.start}–${c.end} (${c.reference_label})`
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
  const canSubmit = !conflict.hasConflict && !conflict.checking && !submitting && !!date && !!startTime && !!endTime && (jobType === "blocked" || !!crewId);

  return (
    <div
      data-modal-root
      className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-job-title"
    >
      <div
        className="fixed inset-0 z-0 bg-black/60 modal-overlay"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full sm:max-w-xl bg-[var(--card)] rounded-2xl shadow-2xl overflow-hidden border border-[var(--brd)] modal-card flex flex-col pointer-events-auto"
        style={{ maxHeight: "min(90dvh, 90vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-7 pt-7 pb-6 border-b border-[var(--brd)]/60 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--gold)] mb-1.5">
                Calendar
              </p>
              <h2 id="schedule-job-title" className="font-heading text-[22px] font-bold text-[var(--tx)] leading-tight">
                Schedule Job
              </h2>
              <p className="text-[13px] text-[var(--tx2)] mt-1">
                Assign a job or block time for a crew
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors shrink-0 ml-4"
              aria-label="Close"
            >
              <X size={18} weight="regular" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5 min-h-0">
          <div>
            <p className={labelCls}>Job Type</p>
            <div className="grid grid-cols-3 gap-2.5">
              {JOB_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setJobType(opt.id)}
                  className={`px-3 py-3.5 rounded-xl border text-left transition-all duration-150 ${
                    jobType === opt.id
                      ? "border-[var(--gold)]/60 bg-[var(--gold)]/5"
                      : "border-[var(--brd)]/70 hover:border-[var(--brd)] hover:bg-[var(--bg)]/40"
                  }`}
                >
                  <p className="text-[13px] font-semibold mb-0.5 text-[var(--tx)]">
                    {opt.label}
                  </p>
                  <p className="text-[11px] leading-snug text-[var(--tx2)]">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {jobType === "blocked" && (
            <div>
              <label className={labelCls}>Reason</label>
              <select value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className={inputCls}>
                {BLOCK_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start</label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls}>
                {TIME_SLOTS_15MIN.map((t) => (
                  <option key={t} value={t}>{formatTime12(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>End</label>
              <select value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls}>
                {TIME_SLOTS_15MIN.filter((t) => t > startTime).map((t) => (
                  <option key={t} value={t}>{formatTime12(t)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Team</label>
            <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={inputCls}>
              <option value="">Select team…</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Optional notes…"
            />
          </div>

          {crewId && date && (
            <div className={`rounded-xl px-4 py-3.5 text-[12px] border transition-colors duration-200 ${
              conflict.checking
                ? "bg-[var(--bg)]/60 border-[var(--brd)]/60 text-[var(--tx3)]"
                : conflict.hasConflict
                ? "bg-red-500/8 border-red-500/25 text-red-400"
                : "bg-[var(--grn)]/8 border-[var(--grn)]/25 text-[var(--grn)]"
            }`}>
              {conflict.checking ? (
                <span className="opacity-70">Checking availability…</span>
              ) : conflict.hasConflict ? (
                <div className="space-y-1.5">
                  <div className="font-semibold">
                    {crewName} is booked during this time
                  </div>
                  <p className="text-[11px] opacity-75">{conflict.message}</p>
                  {conflict.availableSlots.length > 0 && (
                    <div className="text-[11px] mt-2">
                      <span className="font-semibold opacity-80">Available slots:</span>
                      {conflict.availableSlots.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => { setStartTime(s.start); setEndTime(s.end > "20:00" ? "20:00" : s.end); }}
                          className="ml-2 underline underline-offset-2 hover:text-[var(--gold)] transition-colors"
                        >
                          {formatTime12(s.start)}–{formatTime12(s.end)}
                        </button>
                      ))}
                    </div>
                  )}
                  {conflict.availableCrews.length > 0 && (
                    <div className="text-[11px]">
                      <span className="font-semibold opacity-80">Available teams:</span>
                      {conflict.availableCrews.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCrewId(c.id)}
                          className="ml-2 underline underline-offset-2 hover:text-[var(--gold)] transition-colors"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--grn)] shrink-0" />
                  <span className="font-semibold">{crewName} is available</span>
                  <span className="opacity-60 ml-1">{formatTime12(startTime)} – {formatTime12(endTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-7 py-5 border-t border-[var(--brd)]/60 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--brd)]/80 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-6 py-3 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed shadow-sm shadow-[var(--gold)]/20"
          >
            {submitting ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
