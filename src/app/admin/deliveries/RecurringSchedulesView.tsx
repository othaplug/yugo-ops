"use client";

import { useState, useEffect, useCallback } from "react";
import { toTitleCase } from "@/lib/format-text";
import CreateButton from "../components/CreateButton";

/* ─── Types ─────────────────────────────────────── */
interface RecurringSchedule {
  id: string;
  organization_id: string;
  schedule_name: string;
  frequency: string;
  days_of_week: number[];
  booking_type: string;
  vehicle_type: string | null;
  day_type: string | null;
  default_num_stops: number | null;
  time_window: string | null;
  is_active: boolean;
  is_paused: boolean;
  next_generation_date: string | null;
  created_by_source: string;
  created_at: string;
  organizations?: { id: string; name: string; type: string } | null;
}

/* ─── Constants ─────────────────────────────────── */
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FREQ_LABELS: Record<string, string> = { weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly" };
const VEHICLE_LABELS: Record<string, string> = { sprinter: "Sprinter", "16ft": "16ft", "20ft": "20ft", "26ft": "26ft" };

function formatNextDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── Create Modal ──────────────────────────────── */
function AdminCreateModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [orgs, setOrgs] = useState<{ id: string; name: string; type: string }[]>([]);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgDropOpen, setOrgDropOpen] = useState(false);

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [bookingType, setBookingType] = useState("day_rate");
  const [vehicleType, setVehicleType] = useState("sprinter");
  const [dayType, setDayType] = useState("full_day");
  const [numStops, setNumStops] = useState("");
  const [timeWindow, setTimeWindow] = useState("morning");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/organizations/list")
      .then((r) => r.json())
      .then((d) => setOrgs((d.organizations || []).filter((o: { type: string }) => o.type !== "b2c")))
      .catch((err) => { console.error("Failed to load organizations list:", err); });
  }, []);

  const filteredOrgs = orgs.filter((o) => !orgSearch.trim() || o.name.toLowerCase().includes(orgSearch.toLowerCase()));
  const selectedOrg = orgs.find((o) => o.id === orgId);

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const handleSave = async () => {
    if (!orgId) { setErr("Select a partner"); return; }
    if (!name.trim()) { setErr("Schedule name required"); return; }
    if (!daysOfWeek.length) { setErr("Select at least one day"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/admin/recurring-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId, schedule_name: name.trim(), frequency, days_of_week: daysOfWeek, booking_type: bookingType, vehicle_type: vehicleType, day_type: dayType, default_num_stops: numStops ? parseInt(numStops) : null, time_window: timeWindow }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      onSaved(); onClose();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[500px] shadow-2xl border border-[var(--brd)] overflow-y-auto max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--tx)]">New Recurring Schedule</h2>
          <button onClick={onClose} className="text-[var(--tx3)] hover:text-[var(--tx)] p-1">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</div>}

          {/* Partner select */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Partner</label>
            <input
              value={orgSearch || (selectedOrg?.name ?? "")}
              onChange={(e) => { setOrgSearch(e.target.value); setOrgDropOpen(true); }}
              onFocus={() => setOrgDropOpen(true)}
              placeholder="Search partners…"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
            />
            {orgDropOpen && filteredOrgs.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-xl max-h-[180px] overflow-y-auto">
                {filteredOrgs.slice(0, 20).map((o) => (
                  <button key={o.id} type="button" onClick={() => { setOrgId(o.id); setOrgSearch(o.name); setOrgDropOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0">
                    <span className="font-semibold">{o.name}</span>
                    <span className="text-[var(--tx3)] ml-1">· {o.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Schedule Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly GTA Deliveries"
              className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Frequency</label>
            <div className="flex gap-2">
              {["weekly", "biweekly", "monthly"].map((f) => (
                <button key={f} type="button" onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-colors ${frequency === f ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--btn-text-on-accent)]" : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"}`}>
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Days</label>
            <div className="flex gap-1.5">
              {DAY_NAMES.map((day, i) => {
                const dow = i + 1;
                const active = daysOfWeek.includes(dow);
                return (
                  <button key={dow} type="button" onClick={() => toggleDay(dow)}
                    className={`w-9 h-9 rounded-lg text-[10px] font-bold border transition-colors ${active ? "bg-[var(--gold)] border-[var(--gold)] text-[var(--btn-text-on-accent)]" : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"}`}>
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Booking Type</label>
              <select value={bookingType} onChange={(e) => setBookingType(e.target.value)}
                className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="day_rate">Day Rate</option>
                <option value="per_delivery">Per Delivery</option>
              </select>
            </div>
            {bookingType === "day_rate" && (
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Vehicle</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                  {Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Day Type</label>
              <select value={dayType} onChange={(e) => setDayType(e.target.value)}
                className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="full_day">Full Day</option>
                <option value="half_day">Half Day</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Default Stops</label>
              <input type="number" value={numStops} onChange={(e) => setNumStops(e.target.value)} placeholder="e.g. 6" min={1}
                className="w-full text-[13px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none" />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50">
            {saving ? "Creating…" : "Create Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main View ─────────────────────────────────── */
export default function RecurringSchedulesView({ initialScheduleId }: { initialScheduleId?: string } = {}) {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recurring-schedules");
      if (res.ok) {
        const d = await res.json();
        setSchedules(d.schedules || []);
      }
    } catch (err) { console.error("Failed to load recurring schedules:", err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTogglePause = async (s: RecurringSchedule) => {
    setToggling(s.id);
    await fetch(`/api/admin/recurring-schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_paused: !s.is_paused }),
    }).catch((err) => { console.error("Failed to toggle pause on recurring schedule:", err); });
    await load();
    setToggling(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recurring schedule?")) return;
    setDeleting(id);
    await fetch(`/api/admin/recurring-schedules/${id}`, { method: "DELETE" }).catch((err) => { console.error("Failed to delete recurring schedule:", err); });
    await load();
    setDeleting(null);
  };

  const filtered = schedules.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.schedule_name.toLowerCase().includes(q) ||
      (s.organizations?.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <div>
          <h1 className="font-heading text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">Recurring Schedules</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""} across all partners</p>
        </div>
        <CreateButton onClick={() => setCreateOpen(true)} title="New Schedule" />
      </div>

      {/* Search */}
      <div className="relative max-w-[360px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or partner…"
          className="w-full pl-8 pr-3 py-2 text-[12px] bg-[var(--card)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
        />
      </div>

      {/* Table */}
      <div className="border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--brd)] bg-[var(--bg)]">
                {["Partner", "Schedule", "Frequency", "Days", "Booking", "Next Run", "Status", "Source", ""].map((h) => (
                  <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2.5 px-3 whitespace-nowrap first:pl-4 last:pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-[var(--brd)]/50">
                    {[...Array(9)].map((__, j) => (
                      <td key={j} className="py-3 px-3">
                        <div className="h-4 bg-[var(--brd)] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[var(--tx3)] text-[12px]">
                    {search ? "No matching schedules" : "No recurring schedules yet"}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--bg)]/50 transition-colors">
                    <td className="py-3 px-3 pl-4">
                      <div className="font-semibold text-[var(--tx)]">{s.organizations?.name || "—"}</div>
                      <div className="text-[10px] text-[var(--tx3)] capitalize">{s.organizations?.type || ""}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[var(--tx)]">{s.schedule_name}</div>
                    </td>
                    <td className="py-3 px-3 text-[var(--tx2)]">{FREQ_LABELS[s.frequency] || s.frequency}</td>
                    <td className="py-3 px-3 text-[var(--tx2)]">
                      {s.days_of_week.map((d) => DAY_NAMES[d - 1]).join(", ")}
                    </td>
                    <td className="py-3 px-3">
                      {s.booking_type === "day_rate" ? (
                        <span>
                          <span className="text-[var(--tx2)]">Day Rate</span>
                          {s.vehicle_type && <span className="text-[var(--tx3)]"> · {VEHICLE_LABELS[s.vehicle_type] || s.vehicle_type}</span>}
                        </span>
                      ) : (
                        <span className="text-[var(--tx2)]">{toTitleCase(s.booking_type.replace(/_/g, " "))}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {s.is_paused ? (
                        <span className="text-[var(--tx3)]">—</span>
                      ) : (
                        <span className="font-medium text-[var(--gold)]">{formatNextDate(s.next_generation_date)}</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {s.is_paused ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">PAUSED</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">ACTIVE</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[var(--tx3)]">
                      <span className="capitalize">{s.created_by_source?.replace("_", " ") || "—"}</span>
                    </td>
                    <td className="py-3 px-3 pr-4">
                      <div className="flex items-center gap-0.5">
                        <button
                          title={s.is_paused ? "Resume" : "Pause"}
                          onClick={() => handleTogglePause(s)}
                          disabled={toggling === s.id}
                          className="p-1.5 rounded text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors disabled:opacity-40"
                        >
                          {s.is_paused ? (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          ) : (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          )}
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="p-1.5 rounded text-[var(--tx3)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {createOpen && (
        <AdminCreateModal onClose={() => setCreateOpen(false)} onSaved={load} />
      )}
    </div>
  );
}
