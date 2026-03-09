"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── Types ─────────────────────────────────────── */
interface RecurringSchedule {
  id: string;
  organization_id: string;
  schedule_name: string;
  frequency: "weekly" | "biweekly" | "monthly";
  days_of_week: number[];
  booking_type: "day_rate" | "per_delivery";
  vehicle_type: string | null;
  day_type: string | null;
  default_num_stops: number | null;
  time_window: string | null;
  default_pickup_address: string | null;
  is_active: boolean;
  is_paused: boolean;
  next_generation_date: string | null;
  created_at: string;
}

interface Props {
  orgId: string;
}

/* ─── Constants ────────────────────────────────── */
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const FREQ_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
};
const VEHICLE_LABELS: Record<string, string> = {
  sprinter: "Sprinter",
  "16ft": "16ft Truck",
  "20ft": "20ft Truck",
  "26ft": "26ft Truck",
};
const TIME_LABELS: Record<string, string> = {
  morning: "Morning (8–12pm)",
  afternoon: "Afternoon (12–5pm)",
  evening: "Evening (5–8pm)",
  flexible: "Flexible",
};

function formatNextDate(dateStr: string | null): string {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── Create/Edit Modal ─────────────────────────── */
function ScheduleModal({
  orgId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  existing: RecurringSchedule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.schedule_name ?? "");
  const [frequency, setFrequency] = useState<string>(existing?.frequency ?? "weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(existing?.days_of_week ?? []);
  const [bookingType, setBookingType] = useState<string>(existing?.booking_type ?? "day_rate");
  const [vehicleType, setVehicleType] = useState(existing?.vehicle_type ?? "sprinter");
  const [dayType, setDayType] = useState(existing?.day_type ?? "full_day");
  const [numStops, setNumStops] = useState(String(existing?.default_num_stops ?? ""));
  const [timeWindow, setTimeWindow] = useState(existing?.time_window ?? "morning");
  const [pickupAddress, setPickupAddress] = useState(existing?.default_pickup_address ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const handleSave = async () => {
    if (!name.trim()) { setErr("Schedule name is required"); return; }
    if (!daysOfWeek.length) { setErr("Select at least one day"); return; }
    setSaving(true);
    setErr("");
    try {
      const payload = {
        organization_id: orgId,
        schedule_name: name.trim(),
        frequency,
        days_of_week: daysOfWeek,
        booking_type: bookingType,
        vehicle_type: vehicleType || null,
        day_type: dayType,
        default_num_stops: numStops ? parseInt(numStops) : null,
        time_window: timeWindow,
        default_pickup_address: pickupAddress.trim() || null,
      };
      const url = isEdit
        ? `/api/partner/recurring-schedules/${existing.id}`
        : "/api/partner/recurring-schedules";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Save failed");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[520px] shadow-2xl border border-[var(--brd)] overflow-y-auto max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[var(--tx)]">{isEdit ? "Edit Schedule" : "Create Recurring Schedule"}</h2>
          <button onClick={onClose} className="text-[var(--tx3)] hover:text-[var(--tx)] p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {err && <div className="text-[12px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Schedule Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly GTA Deliveries"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Frequency</label>
            <div className="flex gap-2">
              {["weekly", "biweekly", "monthly"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    frequency === f
                      ? "bg-[var(--gold)] border-[var(--gold)] text-[#0D0D0D]"
                      : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Days of Week</label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((day, i) => {
                const dow = i + 1;
                const active = daysOfWeek.includes(dow);
                return (
                  <button
                    key={dow}
                    type="button"
                    title={DAY_FULL[i]}
                    onClick={() => toggleDay(dow)}
                    className={`w-9 h-9 rounded-lg text-[11px] font-bold border transition-colors ${
                      active
                        ? "bg-[var(--gold)] border-[var(--gold)] text-[#0D0D0D]"
                        : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Booking Type</label>
            <div className="flex gap-2">
              {[["day_rate", "Day Rate"], ["per_delivery", "Per Delivery"]].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBookingType(val)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    bookingType === val
                      ? "bg-[var(--gold)] border-[var(--gold)] text-[#0D0D0D]"
                      : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {bookingType === "day_rate" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Vehicle</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                >
                  {Object.entries(VEHICLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Day Type</label>
                <select
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value)}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                >
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Default Stops</label>
              <input
                type="number"
                value={numStops}
                onChange={(e) => setNumStops(e.target.value)}
                placeholder="e.g. 6"
                min={1}
                className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Time Window</label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              >
                {Object.entries(TIME_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-[var(--tx3)] mb-1">Default Pickup Address</label>
            <input
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="e.g. 123 Warehouse Rd, Toronto"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Tab ──────────────────────────────────── */
export default function PartnerRecurringTab({ orgId }: Props) {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringSchedule | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/recurring-schedules");
      if (res.ok) {
        const d = await res.json();
        setSchedules(d.schedules || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTogglePause = async (s: RecurringSchedule) => {
    setToggling(s.id);
    try {
      await fetch(`/api/partner/recurring-schedules/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_paused: !s.is_paused }),
      });
      await load();
    } catch { /* silent */ }
    setToggling(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recurring schedule?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/partner/recurring-schedules/${id}`, { method: "DELETE" });
      await load();
    } catch { /* silent */ }
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-[var(--tx)]">Recurring Schedules</h2>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">Auto-generate draft deliveries on a repeating schedule</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Create Schedule
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--card)] animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[var(--brd)] rounded-xl">
          <div className="text-[var(--tx3)]/30 mb-3 flex justify-center"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></svg></div>
          <h3 className="text-[14px] font-bold text-[var(--tx)] mb-1">No recurring schedules</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-4 max-w-[280px] mx-auto">Set up a recurring schedule and we'll auto-create draft deliveries before each run.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D]"
          >
            + Create First Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-4 transition-all ${
                s.is_paused
                  ? "bg-[var(--card)] border-[var(--brd)]/50 opacity-60"
                  : "bg-[var(--card)] border-[var(--brd)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-[var(--tx)] truncate">{s.schedule_name}</span>
                    {s.is_paused && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">PAUSED</span>
                    )}
                    {!s.is_paused && s.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACTIVE</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-[var(--tx3)]">
                    <span>{FREQ_LABELS[s.frequency]} · {s.days_of_week.map((d) => DAY_NAMES[d - 1]).join(", ")}</span>
                    {s.booking_type === "day_rate" && s.vehicle_type && (
                      <span>{VEHICLE_LABELS[s.vehicle_type] || s.vehicle_type} · {s.day_type === "full_day" ? "Full Day" : "Half Day"}</span>
                    )}
                    {s.default_num_stops && <span>{s.default_num_stops} stops</span>}
                    {s.time_window && <span>{TIME_LABELS[s.time_window] || s.time_window}</span>}
                  </div>
                  {s.next_generation_date && !s.is_paused && (
                    <div className="mt-2 text-[11px]">
                      <span className="text-[var(--tx3)]">Next: </span>
                      <span className="font-semibold text-[var(--gold)]">{formatNextDate(s.next_generation_date)}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Edit"
                    onClick={() => setEditTarget(s)}
                    className="p-2 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--bg)] transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button
                    title={s.is_paused ? "Resume" : "Pause"}
                    onClick={() => handleTogglePause(s)}
                    disabled={toggling === s.id}
                    className="p-2 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                  >
                    {s.is_paused ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    )}
                  </button>
                  <button
                    title="Delete"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="p-2 rounded-lg text-[var(--tx3)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[var(--brd)]/50 p-4 bg-[var(--card)]/50">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">How it works</h4>
        <ul className="space-y-1.5 text-[11px] text-[var(--tx3)]">
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>7 days before each scheduled run, a draft delivery is created automatically</li>
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>You&apos;ll receive a notification to add stops and confirm</li>
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>Pausing a schedule skips future runs without deleting it</li>
        </ul>
      </div>

      {/* Modals */}
      {(createOpen || editTarget) && (
        <ScheduleModal
          orgId={orgId}
          existing={editTarget}
          onClose={() => { setCreateOpen(false); setEditTarget(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
