"use client";

import { useState, useEffect } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { Icon } from "@/components/AppIcons";
import { CaretDown, CaretRight, PencilSimple as Pencil, Plus } from "@phosphor-icons/react";
import {
  ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS,
  ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS,
} from "../components/admin-toolbar-action-classes";
import { PHONE_PLACEHOLDER } from "@/lib/phone";

interface Vehicle {
  id: string;
  vehicle_type: string;
  license_plate: string;
  display_name: string;
  capacity_cuft: number;
  capacity_lbs: number;
  current_mileage: number;
  status: string;
  default_team_id: string | null;
  notes: string | null;
  phone?: string | null;
  vehicle_maintenance_log?: MaintenanceEntry[];
}

interface MaintenanceEntry {
  id: string;
  maintenance_date: string;
  maintenance_type: string;
  cost: number;
  notes: string | null;
}

interface Team {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, { label: string; cuft: number; lbs: number }> = {
  sprinter: { label: "Sprinter Van", cuft: 370, lbs: 3500 },
  "16ft": { label: "16ft Box Truck", cuft: 800, lbs: 5000 },
  "20ft": { label: "20ft Box Truck", cuft: 1100, lbs: 7000 },
  "24ft": { label: "24ft Box Truck", cuft: 1400, lbs: 10000 },
  "26ft": { label: "26ft Box Truck", cuft: 1700, lbs: 12000 },
};

const STATUS_STYLES: Record<string, string> = {
  active: "text-[var(--grn)]",
  maintenance: "text-amber-400",
  retired: "text-[var(--tx3)]",
};

const MAINT_TYPES = ["oil_change", "tire", "repair", "inspection", "other"];
const MAINT_LABELS: Record<string, string> = {
  oil_change: "Oil Change",
  tire: "Tire Service",
  repair: "Repair",
  inspection: "Inspection",
  other: "Other",
};

interface FleetVehiclesManagerProps {
  refreshKey?: number;
}

export default function FleetVehiclesManager({ refreshKey = 0 }: FleetVehiclesManagerProps) {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [formType, setFormType] = useState("sprinter");
  const [formPlate, setFormPlate] = useState("");
  const [formName, setFormName] = useState("");
  const [formMileage, setFormMileage] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formTeam, setFormTeam] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Maintenance form
  const [maintVehicleId, setMaintVehicleId] = useState<string | null>(null);
  const [maintType, setMaintType] = useState("oil_change");
  const [maintCost, setMaintCost] = useState("");
  const [maintNotes, setMaintNotes] = useState("");
  const [maintDate, setMaintDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/fleet-vehicles").then((r) => r.json()),
      fetch("/api/admin/truck-assignments").then((r) => r.json()),
    ]).then(([vehicleData, assignData]) => {
      if (Array.isArray(vehicleData)) setVehicles(vehicleData);
      if (assignData?.teams) setTeams(assignData.teams);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    // Auto-fill display name from type
    if (!editVehicle && !formName) {
      setFormName(TYPE_LABELS[formType]?.label || formType);
    }
  }, [formType, editVehicle, formName]);

  const resetForm = () => {
    setFormType("sprinter");
    setFormPlate("");
    setFormName("");
    setFormMileage("");
    setFormStatus("active");
    setFormTeam("");
    setFormPhone("");
    setFormNotes("");
  };

  const handleAdd = async () => {
    if (!formPlate.trim()) { toast("License plate required", "x"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fleet-vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: formType,
          license_plate: formPlate.trim(),
          display_name: formName.trim() || TYPE_LABELS[formType]?.label,
          current_mileage: parseInt(formMileage) || 0,
          status: formStatus,
          default_team_id: formTeam || null,
          phone: formPhone.trim() || null,
          notes: formNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to add", "x"); return; }
      setVehicles((prev) => [...prev, data]);
      setAddOpen(false);
      resetForm();
      toast("Vehicle added", "check");
    } catch { toast("Failed to add", "x"); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editVehicle) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fleet-vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editVehicle.id,
          display_name: formName.trim(),
          current_mileage: parseInt(formMileage) || 0,
          status: formStatus,
          default_team_id: formTeam || null,
          phone: formPhone.trim() || null,
          notes: formNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to update", "x"); return; }
      setVehicles((prev) => prev.map((v) => v.id === editVehicle.id ? { ...v, ...data } : v));
      setEditVehicle(null);
      resetForm();
      toast("Vehicle updated", "check");
    } catch { toast("Failed to update", "x"); }
    finally { setSaving(false); }
  };

  const handleRetire = async (v: Vehicle) => {
    if (!window.confirm(`Retire ${v.display_name}? It will be marked as retired and excluded from assignments.`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fleet-vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id, status: "retired" }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed to retire", "x"); return; }
      setVehicles((prev) => prev.map((ve) => ve.id === v.id ? { ...ve, ...data } : ve));
      setExpandedId(null);
      toast("Vehicle retired", "check");
    } catch { toast("Failed to retire", "x"); }
    finally { setSaving(false); }
  };

  const handleAddMaintenance = async () => {
    if (!maintVehicleId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fleet-vehicles/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: maintVehicleId,
          maintenance_date: maintDate,
          maintenance_type: maintType,
          cost: parseFloat(maintCost) || 0,
          notes: maintNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || "Failed", "x"); return; }
      setVehicles((prev) => prev.map((v) => {
        if (v.id === maintVehicleId) {
          return { ...v, vehicle_maintenance_log: [...(v.vehicle_maintenance_log || []), data] };
        }
        return v;
      }));
      setMaintVehicleId(null);
      setMaintType("oil_change");
      setMaintCost("");
      setMaintNotes("");
      toast("Maintenance logged", "check");
    } catch { toast("Failed", "x"); }
    finally { setSaving(false); }
  };

  const teamMap = new Map(teams.map((t) => [t.id, t.name]));

  if (loading) return <div className="py-8 text-center text-[12px] text-[var(--tx3)]">Loading fleet...</div>;

  return (
    <div id="fleet-vehicles" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
      <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
        <div>
          <h3 className="font-heading text-[var(--text-base)] font-bold text-[var(--tx)]">Fleet Vehicles</h3>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage trucks and vans, including the call number shown on live tracking. Vehicle data feeds into quote pricing and profitability tracking.</p>
        </div>
        <button
          onClick={() => { resetForm(); setAddOpen(true); }}
          className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all"
        >
          + Add Vehicle
        </button>
      </div>
      <div className="px-5 py-4 space-y-3">
        {vehicles.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-[var(--tx3)]">No fleet vehicles yet.</p>
            <p className="text-[11px] text-[var(--tx3)] mt-1">Add your fleet vehicles to enable automatic truck allocation in the quoting system.</p>
          </div>
        ) : vehicles.map((v) => {
          const typeInfo = TYPE_LABELS[v.vehicle_type] || { label: v.vehicle_type, cuft: 0, lbs: 0 };
          const statusCls = STATUS_STYLES[v.status] || STATUS_STYLES.retired;
          const isExpanded = expandedId === v.id;
          const logs = v.vehicle_maintenance_log || [];
          const teamName = v.default_team_id ? teamMap.get(v.default_team_id) : null;

          return (
            <div key={v.id} className="border border-[var(--brd)] rounded-lg overflow-hidden">
              <div
                className="px-4 py-3 cursor-pointer hover:bg-[var(--bg)] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon name="truck" className="w-4 h-4 text-[var(--tx3)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--tx)]">
                        {v.license_plate} · {v.display_name}
                      </div>
                      <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                        {typeInfo.label} · {v.capacity_cuft.toLocaleString()} cu ft · {v.capacity_lbs.toLocaleString()} lbs
                      </div>
                      {v.current_mileage > 0 && (
                        <div className="text-[11px] text-[var(--tx3)]">Mileage: {v.current_mileage.toLocaleString()} km</div>
                      )}
                      {teamName && (
                        <div className="text-[11px] text-[var(--tx3)]">Team: {teamName}</div>
                      )}
                      {v.phone && (
                        <div className="text-[11px] text-[var(--tx3)]">Call number: {v.phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`dt-badge tracking-[0.04em] ${statusCls}`}>{v.status}</span>
                    <CaretDown weight="regular" className={`w-4 h-4 text-[var(--tx3)] transition-transform ${isExpanded ? "rotate-180" : ""}`} aria-hidden />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 py-3 border-t border-[var(--brd)] bg-[var(--bg)] space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditVehicle(v);
                        setFormName(v.display_name);
                        setFormMileage(String(v.current_mileage));
                        setFormStatus(v.status);
                        setFormTeam(v.default_team_id || "");
                        setFormPhone(v.phone || "");
                        setFormNotes(v.notes || "");
                      }}
                      className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                    >
                      <Pencil weight="regular" className="w-3 h-3 shrink-0" aria-hidden />
                      Edit
                      <CaretRight weight="bold" className="w-3 h-3 shrink-0 opacity-90" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMaintVehicleId(v.id); setMaintDate(new Date().toISOString().split("T")[0]); }}
                      className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                    >
                      <Plus weight="regular" className="w-3 h-3 shrink-0" aria-hidden />
                      Log Maintenance
                      <CaretRight weight="bold" className="w-3 h-3 shrink-0 opacity-90" aria-hidden />
                    </button>
                    {v.status !== "retired" && (
                      <button
                        type="button"
                        onClick={() => handleRetire(v)}
                        disabled={saving}
                        className={ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS}
                      >
                        Retire Vehicle
                      </button>
                    )}
                  </div>

                  {/* Maintenance log */}
                  {logs.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">Maintenance History</div>
                      <div className="space-y-1">
                        {logs.sort((a, b) => b.maintenance_date.localeCompare(a.maintenance_date)).map((log) => (
                          <div key={log.id} className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--card)] border border-[var(--brd)] text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--tx3)]">{log.maintenance_date}</span>
                              <span className="text-[var(--tx)] font-medium">{MAINT_LABELS[log.maintenance_type] || log.maintenance_type}</span>
                              {log.notes && <span className="text-[var(--tx3)]">- {log.notes}</span>}
                            </div>
                            {log.cost > 0 && <span className="text-[var(--gold)] font-semibold">${log.cost.toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {v.notes && (
                    <div className="text-[11px] text-[var(--tx3)]">Notes: {v.notes}</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Vehicle Modal */}
      <ModalOverlay open={addOpen} onClose={() => setAddOpen(false)} title="Add Vehicle" maxWidth="sm">
        <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); handleAdd(); }}>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Vehicle Type</label>
            <select value={formType} onChange={(e) => { setFormType(e.target.value); setFormName(TYPE_LABELS[e.target.value]?.label || ""); }} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
              {Object.entries(TYPE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{val.label} ({val.cuft} cu ft)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">License Plate</label>
            <input type="text" value={formPlate} onChange={(e) => setFormPlate(e.target.value.toUpperCase())} placeholder="e.g. SPR786" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Display Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Call number (optional)</label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder={PHONE_PLACEHOLDER}
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
            />
            <p className="text-[10px] text-[var(--tx3)] mt-1">Shown to customers on live tracking for this vehicle.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Mileage (km)</label>
              <input type="number" value={formMileage} onChange={(e) => setFormMileage(e.target.value)} placeholder="0" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>
          {teams.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Assigned Team</label>
              <select value={formTeam} onChange={(e) => setFormTeam(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="">None</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Notes</label>
            <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">Cancel</button>
            <button type="submit" disabled={!formPlate.trim() || saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50">{saving ? "Adding..." : "Add Vehicle"}</button>
          </div>
        </form>
      </ModalOverlay>

      {/* Edit Vehicle Modal */}
      <ModalOverlay open={!!editVehicle} onClose={() => setEditVehicle(null)} title={`Edit ${editVehicle?.display_name ?? "Vehicle"}`} maxWidth="sm">
        <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); handleUpdate(); }}>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Display Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Call number (optional)</label>
            <input
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder={PHONE_PLACEHOLDER}
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
            />
            <p className="text-[10px] text-[var(--tx3)] mt-1">Shown to customers on live tracking for this vehicle.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Mileage (km)</label>
              <input type="number" value={formMileage} onChange={(e) => setFormMileage(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Status</label>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>
          </div>
          {teams.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Assigned Team</label>
              <select value={formTeam} onChange={(e) => setFormTeam(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                <option value="">None</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Notes</label>
            <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setEditVehicle(null)} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </ModalOverlay>

      {/* Add Maintenance Modal */}
      <ModalOverlay open={!!maintVehicleId} onClose={() => setMaintVehicleId(null)} title="Log Maintenance" maxWidth="sm">
        <form className="p-5 space-y-4" onSubmit={(e) => { e.preventDefault(); handleAddMaintenance(); }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Type</label>
              <select value={maintType} onChange={(e) => setMaintType(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none">
                {MAINT_TYPES.map((t) => <option key={t} value={t}>{MAINT_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Date</label>
              <input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Cost ($)</label>
            <input type="number" step="0.01" value={maintCost} onChange={(e) => setMaintCost(e.target.value)} placeholder="0.00" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Notes</label>
            <input type="text" value={maintNotes} onChange={(e) => setMaintNotes(e.target.value)} placeholder="Optional" className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setMaintVehicleId(null)} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50">{saving ? "Saving..." : "Log Entry"}</button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}
