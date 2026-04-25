"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { Icon } from "@/components/AppIcons";
import { Truck } from "@phosphor-icons/react";

const STEPS = [
  { id: 1, label: "Vehicle", description: "Add this truck to the fleet" },
  { id: 2, label: "Equipment", description: "Put catalog items on the truck" },
  { id: 3, label: "Team", description: "Link a crew team" },
  { id: 4, label: "iPad code", description: "Code for /crew/setup on the tablet" },
  { id: 5, label: "Done", description: "Finish on the iPad" },
] as const;

const TYPE_OPTIONS = [
  { id: "sprinter", label: "Sprinter Van" },
  { id: "16ft", label: "16ft Box Truck" },
  { id: "20ft", label: "20ft Box Truck" },
  { id: "24ft", label: "24ft Box Truck" },
  { id: "26ft", label: "26ft Box Truck" },
];

type CatalogRow = {
  id: string;
  name: string;
  category: string;
  default_quantity: number;
  active: boolean;
};

type TeamOpt = { id: string; name: string };

const inputCls = "admin-premium-input w-full";
const labelCls = "admin-premium-label";

interface TruckOnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onFinished?: () => void;
}

export default function TruckOnboardingWizard({ open, onClose, onFinished }: TruckOnboardingWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [vehicleLabel, setVehicleLabel] = useState("");

  const [formType, setFormType] = useState("16ft");
  const [formPlate, setFormPlate] = useState("");
  const [formName, setFormName] = useState("");
  const [formMileage, setFormMileage] = useState("0");
  const [formNotes, setFormNotes] = useState("");

  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [qtyById, setQtyById] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamId, setTeamId] = useState("");

  const [deviceName, setDeviceName] = useState("Crew iPad");
  const [expiresHours, setExpiresHours] = useState(48);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setVehicleId(null);
    setVehicleLabel("");
    setFormType("16ft");
    setFormPlate("");
    setFormName("");
    setFormMileage("0");
    setFormNotes("");
    setCatalog([]);
    setQtyById({});
    setSelectedIds(new Set());
    setTeams([]);
    setTeamId("");
    setDeviceName("Crew iPad");
    setExpiresHours(48);
    setCreatedCode(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open || step < 2) return;
    fetch("/api/admin/equipment-inventory")
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d)) return;
        setCatalog(d);
        const nextQty: Record<string, number> = {};
        const nextSel = new Set<string>();
        for (const row of d as CatalogRow[]) {
          if (!row.active) continue;
          nextQty[row.id] = Math.max(0, Number(row.default_quantity) || 0);
          nextSel.add(row.id);
        }
        setQtyById(nextQty);
        setSelectedIds(nextSel);
      })
      .catch(() => {});
  }, [open, step]);

  useEffect(() => {
    if (!open || step < 3) return;
    fetch("/api/admin/truck-assignments")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.teams)) setTeams(d.teams);
      })
      .catch(() => {});
  }, [open, step]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const currentStep = STEPS[step - 1]!;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const setQty = (id: string, v: number) => {
    setQtyById((prev) => ({ ...prev, [id]: Math.max(0, v) }));
  };

  const submitVehicle = async () => {
    const plate = formPlate.trim();
    if (!plate) {
      toast("License plate required", "x");
      return;
    }
    setLoading(true);
    try {
      const typeMeta = TYPE_OPTIONS.find((t) => t.id === formType);
      const res = await fetch("/api/admin/fleet-vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_type: formType,
          license_plate: plate,
          display_name: formName.trim() || typeMeta?.label,
          current_mileage: parseInt(formMileage, 10) || 0,
          status: "active",
          notes: formNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to add vehicle", "x");
        return;
      }
      setVehicleId(data.id);
      setVehicleLabel(`${data.display_name || typeMeta?.label} · ${data.license_plate}`);
      toast("Vehicle created", "check");
      setStep(2);
    } catch {
      toast("Failed to add vehicle", "x");
    } finally {
      setLoading(false);
    }
  };

  const submitEquipment = async () => {
    if (!vehicleId) return;
    const lines = [...selectedIds].map((equipment_id) => ({
      equipment_id,
      assigned_quantity: qtyById[equipment_id] ?? 0,
      current_quantity: qtyById[equipment_id] ?? 0,
    }));
    if (lines.length === 0) {
      toast("Select at least one equipment item", "x");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/fleet-vehicles/${vehicleId}/equipment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to save equipment", "x");
        return;
      }
      toast("Truck equipment saved", "check");
      setStep(3);
    } catch {
      toast("Failed to save equipment", "x");
    } finally {
      setLoading(false);
    }
  };

  const submitTeam = async () => {
    if (!vehicleId || !teamId) {
      toast("Select a team", "x");
      return;
    }
    setLoading(true);
    try {
      const patchRes = await fetch("/api/admin/fleet-vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vehicleId, default_team_id: teamId }),
      });
      if (!patchRes.ok) {
        const e = await patchRes.json().catch(() => ({}));
        toast(e.error || "Failed to set default team on vehicle", "x");
        return;
      }
      const assignRes = await fetch("/api/admin/truck-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truckId: vehicleId, teamId }),
      });
      if (!assignRes.ok) {
        const e = await assignRes.json().catch(() => ({}));
        toast(e.error || "Failed to set today’s truck assignment", "x");
        return;
      }
      toast("Team linked and today’s assignment set", "check");
      setStep(4);
    } catch {
      toast("Failed to link team", "x");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!vehicleId || !teamId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/device-setup-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truckId: vehicleId,
          teamId,
          deviceName: deviceName.trim() || "Crew iPad",
          expiresInHours: expiresHours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to create code", "x");
        return;
      }
      setCreatedCode(data.code || null);
      toast("Setup code created", "check");
      setStep(5);
      onFinished?.();
    } catch {
      toast("Failed to create code", "x");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={handleClose} title="" maxWidth="2xl" noHeader noPadding>
      <div className="flex flex-col flex-1 min-h-0 max-h-[90vh]">
        <div className="px-7 pt-7 pb-6 border-b border-[var(--brd)]/60 shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/12 flex items-center justify-center text-[var(--accent-text)] shrink-0">
                <Truck size={22} aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--accent-text)] mb-1">
                  Truck onboarding
                </p>
                <h2 className="font-heading text-[22px] font-bold text-[var(--tx)] leading-tight">{currentStep.label}</h2>
                <p className="text-[13px] text-[var(--tx3)] mt-1">{currentStep.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors shrink-0"
              aria-label="Close"
            >
              <Icon name="x" className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${
                      step === s.id
                        ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] shadow-sm shadow-[var(--gold)]/30 scale-110"
                        : step > s.id
                          ? "bg-[var(--grn)]/15 text-[var(--grn)] border border-[var(--grn)]/30"
                          : "bg-[var(--brd)]/60 text-[var(--tx3)] border border-[var(--brd)]"
                    }`}
                  >
                    {step > s.id ? <Icon name="check" className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  <span
                    className={`text-[9px] font-semibold tracking-wide text-center max-w-[72px] leading-tight ${
                      step === s.id ? "text-[var(--tx)]" : "text-[var(--tx3)]"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-1 mb-5 min-w-[8px]">
                    <div className={`h-px ${step > s.id ? "bg-[var(--grn)]/40" : "bg-[var(--brd)]/50"}`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 min-h-0">
          {step === 1 && (
            <div className="space-y-4 max-w-lg">
              <div>
                <label className={labelCls}>Vehicle type</label>
                <select className={inputCls} value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>License plate</label>
                <input className={inputCls} value={formPlate} onChange={(e) => setFormPlate(e.target.value.toUpperCase())} placeholder="CB7485" />
              </div>
              <div>
                <label className={labelCls}>Display name (optional)</label>
                <input className={inputCls} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Defaults from type" />
              </div>
              <div>
                <label className={labelCls}>Odometer (optional)</label>
                <input className={inputCls} type="number" value={formMileage} onChange={(e) => setFormMileage(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Notes (optional)</label>
                <textarea className={`${inputCls} min-h-[72px]`} value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={submitVehicle}
                className="admin-btn admin-btn-lg admin-btn-primary w-full"
              >
                {loading ? "Saving…" : "Create vehicle & continue"}
              </button>
            </div>
          )}

          {step === 2 && vehicleId && (
            <div className="space-y-4">
              <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
                Choose what lives on <span className="text-[var(--tx)] font-medium">{vehicleLabel}</span>. Quantities are assigned and current counts (crew updates counts when they check equipment).
              </p>
              <div className="rounded-xl border border-[var(--brd)] max-h-[340px] overflow-y-auto divide-y divide-[var(--brd)]/60">
                {catalog
                  .filter((r) => r.active)
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleItem(r.id)}
                        className="rounded border-[var(--brd)] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--tx)] truncate">{r.name}</p>
                        <p className="text-[10px] text-[var(--tx3)]">{r.category}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-[var(--tx3)]">Qty</span>
                        <input
                          type="number"
                          min={0}
                          disabled={!selectedIds.has(r.id)}
                          className="w-16 px-2 py-1 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[var(--tx)] text-center text-[12px]"
                          value={qtyById[r.id] ?? 0}
                          onChange={(e) => setQty(r.id, parseInt(e.target.value, 10) || 0)}
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-[12px] font-semibold text-[var(--tx3)]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={submitEquipment}
                  className="admin-btn admin-btn-lg admin-btn-primary flex-1"
                >
                  {loading ? "Saving…" : "Save equipment & continue"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && vehicleId && (
            <div className="space-y-4 max-w-lg">
              <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
                Pick the crew team that usually runs this truck. We save it as the vehicle&apos;s default team and set <strong className="text-[var(--tx)]">today&apos;s</strong> truck assignment so equipment resolution works even before the iPad is registered.
              </p>
              <div>
                <label className={labelCls}>Team</label>
                <select className={inputCls} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="px-4 py-2 text-[12px] font-semibold text-[var(--tx3)]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading || !teamId}
                  onClick={submitTeam}
                  className="admin-btn admin-btn-lg admin-btn-primary flex-1"
                >
                  {loading ? "Saving…" : "Link team & continue"}
                </button>
              </div>
            </div>
          )}

          {step === 4 && vehicleId && teamId && (
            <div className="space-y-4 max-w-lg">
              <p className="text-[12px] text-[var(--tx3)] leading-relaxed">
                Generate a one-time code. On the iPad, open <span className="font-mono text-[var(--tx)]">/crew/setup</span>, enter the code, and the tablet will store both truck and team. Crew should still log in with phone + PIN after setup.
              </p>
              <div>
                <label className={labelCls}>Device label (optional)</label>
                <input className={inputCls} value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Code valid for (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className={inputCls}
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(Math.min(168, Math.max(1, parseInt(e.target.value, 10) || 24)))}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(3)} className="px-4 py-2 text-[12px] font-semibold text-[var(--tx3)]">
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={submitCode}
                  className="admin-btn admin-btn-lg admin-btn-primary flex-1"
                >
                  {loading ? "Creating…" : "Generate setup code"}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-4 max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--grn)]/12 border border-[var(--grn)]/30 flex items-center justify-center mx-auto">
                <Icon name="check" className="w-8 h-8 text-[var(--grn)]" />
              </div>
              <h3 className="font-heading text-xl font-bold text-[var(--tx)]">You&apos;re almost there</h3>
              <p className="text-[13px] text-[var(--tx3)] leading-relaxed">
                Enter this code on the iPad at <span className="font-mono text-[var(--tx)]">/crew/setup</span>. The code is single-use and expires automatically.
              </p>
              {createdCode && (
                <div className="py-4 px-6 rounded-2xl bg-[var(--bg)] border border-[var(--gold)]/35">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--tx3)] mb-2">Setup code</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-[var(--accent-text)]">{createdCode}</p>
                </div>
              )}
              <p className="text-[11px] text-[var(--tx3)] text-left leading-relaxed">
                After setup: crew opens <span className="font-mono text-[var(--tx2)]">/crew/login</span>, enters team phone and PIN. The app resolves the truck from the registered device and from today&apos;s assignment if needed.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="admin-btn admin-btn-lg admin-btn-primary w-full"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
