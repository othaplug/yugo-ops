"use client";

import { useState, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatMoveHoursLabel } from "@/utils/format-move-hours";
import { formatPhoneDisplay } from "@/utils/format-phone";

const PM_UNIT_OPTS = [
  { id: "studio", label: "Studio" },
  { id: "1br", label: "1BR" },
  { id: "2br", label: "2BR" },
  { id: "3br", label: "3BR" },
  { id: "4br_plus", label: "4BR+" },
];

export type PartnerPropertyRow = {
  id: string;
  building_name: string;
  address: string;
  postal_code?: string | null;
  total_units?: number | null;
  unit_types?: string[] | null;
  has_loading_dock?: boolean | null;
  has_move_elevator?: boolean | null;
  elevator_type?: string | null;
  move_hours?: string | null;
  parking_type?: string | null;
  building_contact_name?: string | null;
  building_contact_phone?: string | null;
  notes?: string | null;
};

export type PartnerMoveForBuilding = {
  id: string;
  partner_property_id?: string | null;
  status?: string | null;
  scheduled_date?: string | null;
};

function elevatorSummary(p: PartnerPropertyRow): string {
  const t = (p.elevator_type || "").toLowerCase();
  if (t === "dedicated") return "Dedicated move elevator";
  if (t === "shared") return "Shared elevator";
  if (t === "none" || (!p.has_move_elevator && !t)) return "No elevator";
  if (p.has_move_elevator && t) return `${t.charAt(0).toUpperCase() + t.slice(1)} elevator`;
  return p.elevator_type || "—";
}

function parkingSummary(p: PartnerPropertyRow): string {
  const raw = (p.parking_type || "").trim().toLowerCase();
  if (!raw) return "—";
  if (raw === "dedicated" || raw.includes("dedicated")) return "Dedicated parking";
  if (raw === "street" || raw.includes("street")) return "Street parking";
  if (raw === "none" || raw === "no") return "No parking";
  return p.parking_type || "—";
}

function addressShowsPostal(address: string, postal: string | null | undefined): boolean {
  if (!postal?.trim()) return false;
  const norm = postal.replace(/\s/g, "").toUpperCase();
  const a = address.replace(/\s/g, "").toUpperCase();
  return a.includes(norm);
}

type BuildingFormState = {
  building_name: string;
  address: string;
  postal_code: string;
  total_units: string;
  unit_types: string[];
  has_loading_dock: boolean;
  has_move_elevator: boolean;
  elevator_type: string;
  move_hours: string;
  custom_move_hours: string;
  parking_type: string;
  building_contact_name: string;
  building_contact_phone: string;
  notes: string;
};

function emptyForm(): BuildingFormState {
  return {
    building_name: "",
    address: "",
    postal_code: "",
    total_units: "",
    unit_types: [],
    has_loading_dock: false,
    has_move_elevator: false,
    elevator_type: "",
    move_hours: "8to6",
    custom_move_hours: "",
    parking_type: "",
    building_contact_name: "",
    building_contact_phone: "",
    notes: "",
  };
}

function formFromProperty(p: PartnerPropertyRow): BuildingFormState {
  const mh = p.move_hours || "";
  const known = ["8to6", "24_7", "custom"];
  const isKnown = known.includes(mh);
  return {
    building_name: p.building_name || "",
    address: p.address || "",
    postal_code: p.postal_code || "",
    total_units: p.total_units != null ? String(p.total_units) : "",
    unit_types: Array.isArray(p.unit_types) ? [...p.unit_types] : [],
    has_loading_dock: !!p.has_loading_dock,
    has_move_elevator: !!p.has_move_elevator,
    elevator_type: p.elevator_type || "",
    move_hours: isKnown ? mh : "custom",
    custom_move_hours: isKnown ? "" : mh,
    parking_type: p.parking_type || "",
    building_contact_name: p.building_contact_name || "",
    building_contact_phone: p.building_contact_phone || "",
    notes: p.notes || "",
  };
}

export default function PartnerBuildingsTab({
  partnerId,
  properties,
  moves = [],
}: {
  partnerId: string;
  properties: PartnerPropertyRow[];
  moves?: PartnerMoveForBuilding[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BuildingFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const statsByProperty = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, { completed: number; upcoming: number }>();
    for (const m of moves) {
      const pid = m.partner_property_id;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, { completed: 0, upcoming: 0 });
      const s = map.get(pid)!;
      const st = (m.status || "").toLowerCase();
      if (st === "completed") {
        s.completed += 1;
        continue;
      }
      if (st === "cancelled") continue;
      const d = m.scheduled_date ? new Date(m.scheduled_date) : null;
      if (d && !Number.isNaN(d.getTime()) && d >= today) s.upcoming += 1;
    }
    return map;
  }, [moves]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (p: PartnerPropertyRow) => {
    setEditingId(p.id);
    setForm(formFromProperty(p));
    setModalOpen(true);
  };

  const toggleUnit = (id: string) => {
    setForm((f) => ({
      ...f,
      unit_types: f.unit_types.includes(id) ? f.unit_types.filter((x) => x !== id) : [...f.unit_types, id],
    }));
  };

  const submit = useCallback(async () => {
    if (!form.building_name.trim() || !form.address.trim()) {
      toast("Building name and address are required", "x");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        building_name: form.building_name.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim() || null,
        total_units: form.total_units.trim() ? parseInt(form.total_units, 10) : null,
        unit_types: form.unit_types,
        has_loading_dock: form.has_loading_dock,
        has_move_elevator: form.has_move_elevator || (!!form.elevator_type && form.elevator_type !== "none"),
        elevator_type: form.elevator_type.trim() || null,
        move_hours: form.move_hours,
        custom_move_hours: form.custom_move_hours,
        parking_type: form.parking_type.trim() || null,
        building_contact_name: form.building_contact_name.trim() || null,
        building_contact_phone: form.building_contact_phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      const url = editingId
        ? `/api/admin/organizations/${partnerId}/partner-properties/${editingId}`
        : `/api/admin/organizations/${partnerId}/partner-properties`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast(editingId ? "Building updated" : "Building added", "check");
      setModalOpen(false);
      const next = new URLSearchParams(urlSearchParams.toString());
      next.set("tab", "buildings");
      next.delete("building");
      router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname, { scroll: false });
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  }, [editingId, form, partnerId, pathname, router, toast, urlSearchParams]);

  const viewMoves = (propertyId: string) => {
    router.push(`/admin/clients/${partnerId}?tab=moves&building=${encodeURIComponent(propertyId)}`);
  };

  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-[var(--tx)]">Properties ({properties.length})</h2>
          <p className="text-[11px] text-[var(--tx3)] mt-1 max-w-xl">
            Buildings and properties under contract. Add, edit, or view move history per building.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="shrink-0 px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white hover:opacity-90 transition-opacity"
        >
          + Add Building
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="text-[12px] text-[var(--tx3)] rounded-xl border border-[var(--brd)] bg-[var(--card)] p-6 text-center">
          No buildings on contract yet. Add a property with the button above or during onboarding.
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((p) => {
            const stats = statsByProperty.get(p.id) || { completed: 0, upcoming: 0 };
            const showPostalLine = p.postal_code && !addressShowsPostal(p.address, p.postal_code);
            return (
              <div key={p.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-[var(--tx)]">{p.building_name}</h3>
                    <p className="text-[12px] text-[var(--tx2)] mt-1">{p.address}</p>
                    {showPostalLine ? (
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5">{p.postal_code}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => viewMoves(p.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
                    >
                      View Moves
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]">Units</p>
                    <p className="text-[13px] font-semibold text-[var(--tx)] mt-1">{p.total_units != null ? p.total_units : "—"}</p>
                    {p.unit_types && p.unit_types.length > 0 ? (
                      <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {p.unit_types.map((u) => PM_UNIT_OPTS.find((o) => o.id === u)?.label ?? u).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]">Access</p>
                    <p className="text-[13px] font-semibold text-[var(--tx)] mt-1">{p.has_loading_dock ? "Loading dock" : "No dock"}</p>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">{elevatorSummary(p)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]">Move hours</p>
                    <p className="text-[13px] font-semibold text-[var(--tx)] mt-1">{formatMoveHoursLabel(p.move_hours)}</p>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">{parkingSummary(p)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]">Building contact</p>
                    <p className="text-[13px] font-semibold text-[var(--tx)] mt-1">{p.building_contact_name || "—"}</p>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">{formatPhoneDisplay(p.building_contact_phone || "") || "—"}</p>
                  </div>
                </div>

                {p.notes ? (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-[var(--tx2)]">
                    <span className="font-semibold text-[var(--tx)]">Notes: </span>
                    {p.notes}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-[var(--tx3)]">
                  <span>{stats.completed} moves completed</span>
                  <span>{stats.upcoming} upcoming</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ModalOverlay
          open
          onClose={() => !saving && setModalOpen(false)}
          title={editingId ? "Edit building" : "Add building"}
          maxWidth="md"
        >
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Building name</label>
              <input
                value={form.building_name}
                onChange={(e) => setForm((f) => ({ ...f, building_name: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Postal code</label>
                <input
                  value={form.postal_code}
                  onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Total units</label>
                <input
                  type="number"
                  min={0}
                  value={form.total_units}
                  onChange={(e) => setForm((f) => ({ ...f, total_units: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-[var(--tx2)] mb-2">Unit types offered</p>
              <div className="flex flex-wrap gap-3">
                {PM_UNIT_OPTS.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.unit_types.includes(u.id)}
                      onChange={() => toggleUnit(u.id)}
                      className="accent-[var(--gold)]"
                    />
                    {u.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_loading_dock}
                onChange={(e) => setForm((f) => ({ ...f, has_loading_dock: e.target.checked }))}
                className="accent-[var(--gold)]"
              />
              Loading dock
            </label>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Move elevator</label>
              <select
                value={form.elevator_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    elevator_type: e.target.value,
                    has_move_elevator: e.target.value !== "" && e.target.value !== "none",
                  }))
                }
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
              >
                <option value="">—</option>
                <option value="dedicated">Dedicated</option>
                <option value="shared">Shared</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Move hours</label>
              <select
                value={form.move_hours}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    move_hours: e.target.value,
                    ...(e.target.value !== "custom" ? { custom_move_hours: "" } : {}),
                  }))
                }
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
              >
                <option value="8to6">8:00 AM – 6:00 PM</option>
                <option value="24_7">24/7</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {form.move_hours === "custom" && (
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Custom move hours</label>
                <input
                  value={form.custom_move_hours}
                  onChange={(e) => setForm((f) => ({ ...f, custom_move_hours: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                  placeholder="e.g. 7 AM – 8 PM weekdays"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Parking</label>
              <input
                value={form.parking_type}
                onChange={(e) => setForm((f) => ({ ...f, parking_type: e.target.value }))}
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                placeholder="Dedicated loading / street / none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Contact name</label>
                <input
                  value={form.building_contact_name}
                  onChange={(e) => setForm((f) => ({ ...f, building_contact_name: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Contact phone</label>
                <input
                  type="tel"
                  value={form.building_contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, building_contact_phone: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-[13px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg text-[var(--tx)] resize-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save" : "Add building"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
