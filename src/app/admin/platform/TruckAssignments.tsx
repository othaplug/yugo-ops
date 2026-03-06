"use client";

import { useState, useEffect } from "react";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";

interface Truck {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  truck_id: string;
  team_id: string;
  date: string;
}

export default function TruckAssignments() {
  const { toast } = useToast();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formTruckId, setFormTruckId] = useState("");
  const [formTeamId, setFormTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/admin/truck-assignments?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.trucks) setTrucks(data.trucks);
        if (data.teams) setTeams(data.teams);
        if (data.assignments) setAssignments(data.assignments);
      })
      .catch(() => toast("Failed to load assignments", "x"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTruckId || !formTeamId) {
      toast("Select truck and team", "x");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/truck-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truckId: formTruckId, teamId: formTeamId, date }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to set assignment", "x");
        return;
      }
      setAddModalOpen(false);
      setFormTruckId("");
      setFormTeamId("");
      fetchData();
      toast("Assignment saved", "check");
    } catch {
      toast("Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (a: Assignment) => {
    setDeletingId(a.id);
    try {
      const res = await fetch(
        `/api/admin/truck-assignments?truckId=${encodeURIComponent(a.truck_id)}&date=${encodeURIComponent(date)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Failed to remove", "x");
        return;
      }
      fetchData();
      toast("Assignment removed", "check");
    } catch {
      toast("Failed to remove", "x");
    } finally {
      setDeletingId(null);
    }
  };

  const truckMap = new Map(trucks.map((t) => [t.id, t.name]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));
  const assignedTruckIds = new Set(assignments.map((a) => a.truck_id));

  const formatDateLabel = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    const dateObj = new Date(y, m - 1, day);
    return dateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-heading text-[14px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="calendar" className="w-[14px] h-[14px]" /> Truck Assignments
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">
            Assign which team is on which truck for the day. When crews swap trucks, set this so the tablet shows the correct team for login.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
          <button
            onClick={() => setAddModalOpen(true)}
            disabled={trucks.length === 0 || teams.length === 0}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Assign
          </button>
        </div>
      </div>
      <div className="px-5 py-4">
        {loading ? (
          <p className="text-[12px] text-[var(--tx3)]">Loading…</p>
        ) : (
          <>
            <div className="text-[11px] text-[var(--tx3)] mb-3">{formatDateLabel(date)}</div>
            {assignments.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[13px] text-[var(--tx3)] mb-1">No assignments for this date</p>
                <p className="text-[11px] text-[var(--tx3)] mb-3">
                  Tablets use their default team. Add assignments when crews swap trucks.
                </p>
                <button
                  onClick={() => setAddModalOpen(true)}
                  disabled={trucks.length === 0 || teams.length === 0}
                  className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
                >
                  + Add assignment
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--brd)] bg-[var(--bg)] hover:border-[var(--gold)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-[var(--tx)]">{truckMap.get(a.truck_id) || "Truck"}</span>
                      <span className="text-[11px] text-[var(--tx3)]">→</span>
                      <span className="text-[13px] font-medium text-[var(--gold)]">{teamMap.get(a.team_id) || "Team"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(a)}
                      disabled={deletingId === a.id}
                      className="text-[10px] font-semibold text-[var(--red)] hover:underline disabled:opacity-50"
                    >
                      {deletingId === a.id ? "…" : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {addModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAddModalOpen(false)} aria-hidden="true" />
          <div
            className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-[15px] font-bold text-[var(--tx)] mb-1">Assign team to truck</h3>
            <p className="text-[11px] text-[var(--tx3)] mb-4">{formatDateLabel(date)}</p>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Truck</label>
                <select
                  value={formTruckId}
                  onChange={(e) => setFormTruckId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
                >
                  <option value="">Select truck</option>
                  {trucks
                    .filter((t) => !assignedTruckIds.has(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  {trucks.filter((t) => assignedTruckIds.has(t.id)).length > 0 && (
                    <optgroup label="Already assigned">
                      {trucks
                        .filter((t) => assignedTruckIds.has(t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (overwrite)
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Team</label>
                <select
                  value={formTeamId}
                  onChange={(e) => setFormTeamId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-medium hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formTruckId || !formTeamId}
                  className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[12px] font-semibold hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
