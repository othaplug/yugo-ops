"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, PencilSimple, Play, Pause, Trash } from "@phosphor-icons/react";
import { createPortal } from "react-dom";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useConfirm } from "@/hooks/useConfirm";

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
    <div className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-[520px] shadow-2xl border border-[var(--brd)] max-h-[92dvh] flex flex-col overflow-hidden animate-slide-up sm:animate-none" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h2 className="text-[15px] font-bold font-hero text-[var(--tx)]">{isEdit ? "Edit Schedule" : "Create Recurring Schedule"}</h2>
          <button onClick={onClose} className="text-[var(--tx3)] hover:text-[var(--tx)] p-1">
            <X size={18} weight="regular" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {err && <div className="text-[12px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

          <div>
            <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Schedule Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly GTA Deliveries"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Frequency</label>
            <div className="flex gap-2">
              {["weekly", "biweekly", "monthly"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    frequency === f
                      ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--btn-text-on-accent)]"
                      : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Days of Week</label>
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
                        ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--btn-text-on-accent)]"
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
            <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Booking Type</label>
            <div className="flex gap-2">
              {[["day_rate", "Day Rate"], ["per_delivery", "Per Delivery"]].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBookingType(val)}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                    bookingType === val
                      ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--btn-text-on-accent)]"
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
                <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Vehicle</label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                >
                  {Object.entries(VEHICLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Day Type</label>
                <select
                  value={dayType}
                  onChange={(e) => setDayType(e.target.value)}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                >
                  <option value="full_day">Full Day</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Default Stops</label>
              <input
                type="number"
                value={numStops}
                onChange={(e) => setNumStops(e.target.value)}
                placeholder="e.g. 6"
                min={1}
                className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Time Window</label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
              >
                {Object.entries(TIME_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold capitalize text-[var(--tx3)] mb-1">Default Pickup Address</label>
            <AddressAutocomplete
              value={pickupAddress}
              onRawChange={setPickupAddress}
              onChange={(r) => setPickupAddress(r.fullAddress)}
              placeholder="e.g. 123 Warehouse Rd, Toronto"
              country="CA"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
            />
          </div>
        </div>

        <div className="flex-shrink-0 px-5 py-4 border-t border-[var(--brd)] flex gap-2 bg-[var(--card)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)] hover:text-[var(--tx)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Tab ──────────────────────────────────── */
export default function PartnerRecurringTab({ orgId }: Props) {
  const { confirm, confirmEl } = useConfirm();
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
    const ok = await confirm({ title: "Delete schedule?", message: "This recurring schedule will be removed. Existing deliveries are not affected.", confirmLabel: "Delete", variant: "danger" });
    if (!ok) return;
    setDeleting(id);
    try {
      await fetch(`/api/partner/recurring-schedules/${id}`, { method: "DELETE" });
      await load();
    } catch { /* silent */ }
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      {confirmEl}
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold font-hero text-[var(--tx)]">Recurring Schedules</h2>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">Auto-generate draft deliveries on a repeating schedule</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-colors"
        >
          <Plus size={13} weight="regular" />
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
          <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-1">No recurring schedules</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-4 max-w-[280px] mx-auto">Set up a recurring schedule and we'll auto-create draft deliveries before each run.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
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
                    <span className="text-[var(--text-base)] font-bold text-[var(--tx)] truncate">{s.schedule_name}</span>
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
                    <PencilSimple size={14} />
                  </button>
                  <button
                    title={s.is_paused ? "Resume" : "Pause"}
                    onClick={() => handleTogglePause(s)}
                    disabled={toggling === s.id}
                    className="p-2 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                  >
                    {s.is_paused ? (
                      <Play size={14} />
                    ) : (
                      <Pause size={14} />
                    )}
                  </button>
                  <button
                    title="Delete"
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="p-2 rounded-lg text-[var(--tx3)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[var(--brd)]/50 p-4 bg-[var(--card)]/50">
        <h4 className="text-[11px] font-bold capitalize tracking-wider text-[var(--tx3)] mb-2">How it works</h4>
        <ul className="space-y-1.5 text-[11px] text-[var(--tx3)]">
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>7 days before each scheduled run, a draft delivery is created automatically</li>
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>You&apos;ll receive a notification to add stops and confirm</li>
          <li className="flex items-start gap-2"><span className="text-[var(--gold)] mt-0.5">→</span>Pausing a schedule skips future runs without deleting it</li>
        </ul>
      </div>

      {/* Modals, portal to body so modal isn't clipped by ancestor overflow-hidden */}
      {(createOpen || editTarget) &&
        typeof document !== "undefined" &&
        createPortal(
          <ScheduleModal
            orgId={orgId}
            existing={editTarget}
            onClose={() => { setCreateOpen(false); setEditTarget(null); }}
            onSaved={load}
          />,
          document.body
        )}
    </div>
  );
}
