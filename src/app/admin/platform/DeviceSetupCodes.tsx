"use client";

import { useState, useEffect } from "react";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";
import ModalOverlay from "../components/ModalOverlay";

interface Truck {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

interface SetupCode {
  id: string;
  code: string;
  truck_id: string | null;
  default_team_id: string | null;
  device_name: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export default function DeviceSetupCodes() {
  const { toast } = useToast();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [codes, setCodes] = useState<SetupCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [addTruckModalOpen, setAddTruckModalOpen] = useState(false);
  const [newTruckName, setNewTruckName] = useState("");
  const [addTruckSaving, setAddTruckSaving] = useState(false);
  const [formTruckId, setFormTruckId] = useState("");
  const [formTeamId, setFormTeamId] = useState("");
  const [formDeviceName, setFormDeviceName] = useState("");
  const [formExpiresInHours, setFormExpiresInHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<SetupCode | null>(null);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [editTruckName, setEditTruckName] = useState("");
  const [savingTruck, setSavingTruck] = useState(false);
  const [deletingTruckId, setDeletingTruckId] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/admin/device-setup-codes")
      .then((r) => r.json())
      .then((data) => {
        if (data.trucks) setTrucks(data.trucks);
        if (data.teams) setTeams(data.teams);
        if (data.codes) setCodes(data.codes);
      })
      .catch(() => toast("Failed to load", "x"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTruckId && !formTeamId) {
      toast("Select at least a truck or team", "x");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/device-setup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: formTruckId || null,
          teamId: formTeamId || null,
          deviceName: formDeviceName.trim() || null,
          expiresInHours: formExpiresInHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to create code", "x");
        return;
      }
      setCreatedCode(data);
      setCreateModalOpen(false);
      setFormTruckId("");
      setFormTeamId("");
      setFormDeviceName("");
      setFormExpiresInHours(24);
      fetchData();
      toast("Setup code created", "check");
    } catch {
      toast("Failed to create code", "x");
    } finally {
      setCreating(false);
    }
  };

  const handleAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTruckName.trim();
    if (!name) return;
    setAddTruckSaving(true);
    try {
      const res = await fetch("/api/admin/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to add truck", "x");
        return;
      }
      setTrucks((prev) => [...prev, data]);
      setNewTruckName("");
      setAddTruckModalOpen(false);
      toast("Truck added", "check");
    } catch {
      toast("Failed to add truck", "x");
    } finally {
      setAddTruckSaving(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast("Code copied", "check");
  };

  const handleUpdateTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTruck || !editTruckName.trim()) return;
    setSavingTruck(true);
    try {
      const res = await fetch("/api/admin/trucks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingTruck.id, name: editTruckName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to update truck", "x");
        return;
      }
      setTrucks((prev) => prev.map((t) => (t.id === editingTruck.id ? { ...t, name: data.name } : t)));
      setEditingTruck(null);
      setEditTruckName("");
      toast("Truck updated", "check");
    } catch {
      toast("Failed to update truck", "x");
    } finally {
      setSavingTruck(false);
    }
  };

  const handleRemoveTruck = async (truck: Truck) => {
    if (!window.confirm(`Remove truck "${truck.name}"? Devices linked to it will keep working but the truck will no longer appear in the list.`)) return;
    setDeletingTruckId(truck.id);
    try {
      const res = await fetch(`/api/admin/trucks?id=${encodeURIComponent(truck.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to remove truck", "x");
        return;
      }
      setTrucks((prev) => prev.filter((t) => t.id !== truck.id));
      toast("Truck removed", "check");
    } catch {
      toast("Failed to remove truck", "x");
    } finally {
      setDeletingTruckId(null);
    }
  };

  const truckMap = new Map(trucks.map((t) => [t.id, t.name]));
  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const isExpired = (iso: string) => new Date(iso) < new Date();

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-12 text-center text-[13px] text-[var(--tx3)]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
              <Icon name="plug" className="w-[16px] h-[16px]" /> iPad Setup Codes
            </h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              Create codes for crew to register iPads. Crew enters the code at /crew/setup
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {trucks.length === 0 && (
              <button
                onClick={() => setAddTruckModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
              >
                + Add Truck
              </button>
            )}
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all"
            >
              + Create Setup Code
            </button>
          </div>
        </div>
        <div className="px-5 py-5">
          {codes.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--gdim)] border border-[rgba(201,169,98,0.25)] mb-4">
                <Icon name="plug" className="w-6 h-6 text-[var(--gold)]" />
              </div>
              <p className="text-[14px] font-medium text-[var(--tx)] mb-1">No setup codes yet</p>
              <p className="text-[12px] text-[var(--tx3)] mb-5 max-w-[280px] mx-auto">
                Create a code to register an iPad. Crew opens /crew/setup on the device and enters the code to link it to a truck and team.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-6 py-3 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all"
              >
                Create your first code
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--brd)] bg-[var(--bg)] hover:border-[var(--gold)]/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-[14px] font-bold text-[var(--gold)] tracking-wider">{c.code}</code>
                      <button
                        onClick={() => copyCode(c.code)}
                        className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                      {c.truck_id ? truckMap.get(c.truck_id) || "Truck" : "—"} · {c.default_team_id ? teamMap.get(c.default_team_id) || "Team" : "—"}
                      {c.device_name && ` · ${c.device_name}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        c.used_at
                          ? "bg-[var(--brd)] text-[var(--tx3)]"
                          : isExpired(c.expires_at)
                            ? "bg-[var(--red)]/15 text-[var(--red)]"
                            : "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]"
                      }`}
                    >
                      {c.used_at ? "Used" : isExpired(c.expires_at) ? "Expired" : "Active"}
                    </span>
                    <span className="text-[9px] text-[var(--tx3)]">
                      {c.used_at ? `Used ${formatDate(c.used_at)}` : `Expires ${formatDate(c.expires_at)}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {trucks.length > 0 && (
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-heading text-[14px] font-bold text-[var(--tx)] flex items-center gap-2 min-w-0">
              <Icon name="truck" className="w-[14px] h-[14px]" /> Fleet Trucks
            </h2>
            <button
              onClick={() => setAddTruckModalOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              + Add Truck
            </button>
          </div>
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {trucks.map((t) => (
                <div
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)]"
                >
                  <span>{t.name}</span>
                  <button
                    type="button"
                    onClick={() => { setEditingTruck(t); setEditTruckName(t.name); }}
                    className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                  >
                    Reassign
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveTruck(t)}
                    disabled={deletingTruckId === t.id}
                    className="text-[10px] font-semibold text-[var(--red)] hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingTruck && (
        <ModalOverlay
          open={!!editingTruck}
          onClose={() => { setEditingTruck(null); setEditTruckName(""); }}
          title="Reassign truck"
        >
          <form onSubmit={handleUpdateTruck} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Truck name</label>
              <input
                type="text"
                value={editTruckName}
                onChange={(e) => setEditTruckName(e.target.value)}
                placeholder="e.g. Truck 1"
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setEditingTruck(null); setEditTruckName(""); }}
                disabled={savingTruck}
                className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-medium hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTruck || !editTruckName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-white text-[12px] font-semibold hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
              >
                {savingTruck ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      <ModalOverlay
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Setup Code"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCode} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Truck (optional)</label>
            <div className="flex gap-2">
              <select
                value={formTruckId}
                onChange={(e) => setFormTruckId(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
              >
                <option value="">— None —</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAddTruckModalOpen(true)}
                className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] shrink-0"
              >
                + Truck
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Default Team (optional)</label>
            <select
              value={formTeamId}
              onChange={(e) => setFormTeamId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--tx3)] mt-1">At least one of Truck or Team is required</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Device Name (optional)</label>
            <input
              type="text"
              value={formDeviceName}
              onChange={(e) => setFormDeviceName(e.target.value)}
              placeholder="e.g. Truck 1 iPad"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Expires in</label>
            <select
              value={formExpiresInHours}
              onChange={(e) => setFormExpiresInHours(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value={1}>1 hour</option>
              <option value={4}>4 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={72}>72 hours</option>
              <option value={168}>7 days</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--brd)]">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              disabled={creating}
              className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-medium hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || (!formTruckId && !formTeamId)}
              className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-white text-[12px] font-semibold hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create Code"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={addTruckModalOpen}
        onClose={() => setAddTruckModalOpen(false)}
        title="Add Truck"
      >
        <form onSubmit={handleAddTruck} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Truck name</label>
            <input
              type="text"
              value={newTruckName}
              onChange={(e) => setNewTruckName(e.target.value)}
              placeholder="e.g. Truck 1"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddTruckModalOpen(false)}
              disabled={addTruckSaving}
              className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-medium hover:bg-[var(--bg)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addTruckSaving || !newTruckName.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[var(--gold)] text-white text-[12px] font-semibold hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
            >
              {addTruckSaving ? "Adding…" : "Add Truck"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      {createdCode && (
        <ModalOverlay
          open={!!createdCode}
          onClose={() => setCreatedCode(null)}
          title="Setup Code Created"
        >
          <div className="space-y-5">
            <p className="text-[13px] text-[var(--tx2)]">
              Share this code with the crew. They enter it at <strong>/crew/setup</strong> on the iPad.
            </p>
            <div className="p-4 rounded-xl bg-[var(--bg)] border-2 border-[var(--gold)] text-center">
              <code className="text-[24px] font-bold text-[var(--gold)] tracking-[4px]">{createdCode.code}</code>
              <button
                onClick={() => copyCode(createdCode.code)}
                className="mt-3 block w-full py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-colors"
              >
                Copy Code
              </button>
            </div>
            <p className="text-[11px] text-[var(--tx3)]">
              Expires {formatDate(createdCode.expires_at)}. Code can only be used once.
            </p>
            <button
              onClick={() => setCreatedCode(null)}
              className="w-full py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] text-[12px] font-medium hover:bg-[var(--bg)]"
            >
              Done
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
