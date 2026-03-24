"use client";

import { useState, useEffect, useCallback } from "react";
import ModalOverlay from "../components/ModalOverlay";
import CreateButton from "../components/CreateButton";
import { useToast } from "../components/Toast";

/* ─── Types ─── */

interface RateTemplate {
  id: string; template_name: string; template_slug: string;
  description?: string; verticals_covered?: string[];
  is_active: boolean; partner_count: number;
  created_at: string; updated_at: string;
}

interface TemplateRates {
  template: RateTemplate;
  dayRates: any[]; deliveryRates: any[]; services: any[];
  overages: any[]; zones: any[]; volumeBonuses: any[];
  partners: any[];
}

const VEHICLE_LABELS: Record<string, string> = { sprinter: "Sprinter", "16ft": "16ft", "20ft": "20ft", "26ft": "26ft" };
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  single_item: "Single Item", multi_piece: "Multi-Piece", full_room: "Full Room Setup",
  multi_stop: "Multi-Stop", curbside: "Curbside Drop", oversized: "Oversized/Fragile",
  day_rate: "Day Rate", b2b: "B2B", b2b_delivery: "B2B", delivery: "Standard Delivery",
  designer: "Designer", retail: "Retail", hospitality: "Hospitality", gallery: "Gallery", project: "Project",
};
const OVERAGE_LABELS: Record<string, string> = {
  full_7_10: "Full Day 7–10 stops", full_11_plus: "Full Day 11+",
  half_4_6: "Half Day 4–6 stops", half_7_plus: "Half Day 7+",
};

/* ─── Template Rate Editor Modal ─── */

function TemplateRateEditor({
  data, onSave, onClose,
}: {
  data: TemplateRates;
  onSave: (rates: any, affected: number, locked: number) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"day" | "delivery" | "services" | "overages" | "zones">("day");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<any>(null);
  const [editedRates, setEditedRates] = useState<Record<string, any>>({});

  // Helper: set edited value
  const setVal = (table: string, id: string, field: string, val: string) => {
    setEditedRates((prev) => ({
      ...prev,
      [`${table}:${id}:${field}`]: parseFloat(val) || 0,
    }));
  };
  const getVal = (table: string, id: string, field: string, original: number): number => {
    const key = `${table}:${id}:${field}`;
    return editedRates[key] !== undefined ? editedRates[key] : original;
  };

  const preparePayload = () => {
    const rates: Record<string, any[]> = {
      day_rates: [], delivery_rates: [], services: [], overages: [], zones: [],
    };

    for (const r of data.dayRates) {
      const fd = getVal("day_rates", r.id, "full_day_price", r.full_day_price);
      const hd = getVal("day_rates", r.id, "half_day_price", r.half_day_price);
      if (fd !== r.full_day_price || hd !== r.half_day_price) {
        rates.day_rates.push({ id: r.id, full_day_price: fd, half_day_price: hd });
      }
    }
    for (const r of data.deliveryRates) {
      const pm = getVal("delivery_rates", r.id, "price_min", r.price_min);
      const pmx = r.price_max != null ? getVal("delivery_rates", r.id, "price_max", r.price_max) : r.price_max;
      if (pm !== r.price_min || pmx !== r.price_max) {
        rates.delivery_rates.push({ id: r.id, price_min: pm, price_max: pmx });
      }
    }
    for (const r of data.services) {
      const pm = getVal("services", r.id, "price_min", r.price_min);
      if (pm !== r.price_min) rates.services.push({ id: r.id, price_min: pm });
    }
    for (const r of data.overages) {
      const ps = getVal("overages", r.id, "price_per_stop", r.price_per_stop);
      if (ps !== r.price_per_stop) rates.overages.push({ id: r.id, price_per_stop: ps });
    }
    for (const r of data.zones) {
      const sc = getVal("zones", r.id, "surcharge", r.surcharge);
      if (sc !== r.surcharge) rates.zones.push({ id: r.id, surcharge: sc });
    }

    const hasChanges = Object.values(rates).some((arr) => arr.length > 0);
    return hasChanges ? rates : null;
  };

  const handleSaveClick = async () => {
    const payload = preparePayload();
    if (!payload) { toast("No changes to save", "x"); return; }
    setPendingSave(payload);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!pendingSave) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rate-templates/${data.template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates: pendingSave }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(`Template updated. ${json.affected_partners} partner(s) affected.`, "check");
      onSave(pendingSave, json.affected_partners, json.locked_overrides);
      setConfirmOpen(false);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const EditableCell = ({ table, id, field, original, isPercent = false }: { table: string; id: string; field: string; original: number; isPercent?: boolean }) => {
    const val = getVal(table, id, field, original);
    const changed = val !== original;
    return (
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          {!isPercent && <span className="text-[10px] text-[var(--tx3)]">$</span>}
          <input
            type="number"
            min={0}
            step={1}
            value={val}
            onChange={(e) => setVal(table, id, field, e.target.value)}
            className={`w-20 px-2 py-1 text-[11px] text-right rounded border focus:outline-none focus:border-[var(--brd)] bg-[var(--bgsub)] ${changed ? "border-[var(--gold)] text-[var(--gold)] font-semibold" : "border-[var(--brd)] text-[var(--tx)]"}`}
          />
          {isPercent && <span className="text-[10px] text-[var(--tx3)]">%</span>}
        </div>
      </td>
    );
  };

  const tabs = [
    { id: "day" as const, label: "Day Rates" },
    { id: "delivery" as const, label: "Delivery" },
    { id: "services" as const, label: "Services" },
    { id: "overages" as const, label: "Overages" },
    { id: "zones" as const, label: "Zones" },
  ];

  const Th = ({ children }: { children: React.ReactNode }) => (
    <th className="px-2 py-2.5 text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)] text-left whitespace-nowrap">
      {children}
    </th>
  );

  return (
    <ModalOverlay open onClose={onClose} title={`Edit: ${data.template.template_name}`} maxWidth="lg">
      <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
        {/* Tab bar */}
        <div className="flex gap-0.5 border-b border-[var(--brd)] px-5 pt-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 text-[10px] font-semibold transition-all border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-[var(--gold)] text-[var(--gold)]"
                  : "border-transparent text-[var(--tx3)] hover:text-[var(--tx2)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Day Rates */}
          {activeTab === "day" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <Th>Vehicle</Th>
                    <Th>Tier</Th>
                    <Th>Full Day</Th>
                    <Th>Half Day</Th>
                    <Th>Stops (Full)</Th>
                    <Th>Stops (Half)</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.dayRates.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">{VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.pricing_tier}</td>
                      <EditableCell table="day_rates" id={r.id} field="full_day_price" original={r.full_day_price} />
                      <EditableCell table="day_rates" id={r.id} field="half_day_price" original={r.half_day_price} />
                      <td className="px-2 py-2 text-[11px] text-[var(--tx3)] text-center">{r.stops_included_full}</td>
                      <td className="px-2 py-2 text-[11px] text-[var(--tx3)] text-center">{r.stops_included_half}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Delivery Rates */}
          {activeTab === "delivery" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr><Th>Type</Th><Th>Tier</Th><Th>Zone</Th><Th>Price Min</Th><Th>Price Max</Th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.deliveryRates.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">{DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.pricing_tier}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)]">Z{r.zone}</td>
                      <EditableCell table="delivery_rates" id={r.id} field="price_min" original={r.price_min} />
                      {r.price_max != null ? (
                        <EditableCell table="delivery_rates" id={r.id} field="price_max" original={r.price_max} />
                      ) : (
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">-</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Services */}
          {activeTab === "services" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr><Th>Service</Th><Th>Tier</Th><Th>Unit</Th><Th>Price Min</Th><Th>Price Max</Th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.services.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">{r.service_name}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.pricing_tier}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.price_unit.replace(/_/g, " ")}</td>
                      {r.price_unit === "percentage" ? (
                        <>
                          <EditableCell table="services" id={r.id} field="price_min" original={r.price_min} isPercent />
                          <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">-</td>
                        </>
                      ) : (
                        <>
                          <EditableCell table="services" id={r.id} field="price_min" original={r.price_min} />
                          {r.price_max != null ? (
                            <EditableCell table="services" id={r.id} field="price_max" original={r.price_max} />
                          ) : (
                            <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">-</td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overages */}
          {activeTab === "overages" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr><Th>Tier</Th><Th>Pricing Tier</Th><Th>Per Stop</Th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.overages.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">{OVERAGE_LABELS[r.overage_tier] || r.overage_tier}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.pricing_tier}</td>
                      <EditableCell table="overages" id={r.id} field="price_per_stop" original={r.price_per_stop} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Zones */}
          {activeTab === "zones" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className="w-full text-[11px]">
                <thead>
                  <tr><Th>Zone</Th><Th>Name</Th><Th>Tier</Th><Th>Min km</Th><Th>Max km</Th><Th>Surcharge</Th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.zones.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">Zone {r.zone_number}</td>
                      <td className="px-2 py-2 text-[11px] text-[var(--tx2)]">{r.zone_name}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] capitalize">{r.pricing_tier}</td>
                      <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{r.distance_min_km}</td>
                      <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">{r.distance_max_km ?? "∞"}</td>
                      {r.surcharge > 0 ? (
                        <EditableCell table="zones" id={r.id} field="surcharge" original={r.surcharge} />
                      ) : (
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)]">-</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--brd)] p-4 flex justify-between items-center gap-3">
          <div className="text-[10px] text-[var(--tx3)]">
            {data.template.partner_count} partner(s) using this template
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <ModalOverlay open onClose={() => setConfirmOpen(false)} title="Confirm template update" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
              This will update <strong className="text-[var(--tx)]">{data.template.template_name}</strong> template rates and affect{" "}
              <strong className="text-[var(--tx)]">{data.template.partner_count}</strong> partner(s).
            </p>
            <p className="text-[11px] text-[var(--tx3)] bg-[var(--bgsub)] rounded-lg p-3">
              Partners with locked overrides will not be changed. Partners with unlocked overrides will see template-based rates at their next rate refresh.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
                Cancel
              </button>
              <button onClick={handleConfirmSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white disabled:opacity-50">
                {saving ? "Saving…" : "Confirm & Save"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </ModalOverlay>
  );
}

/* ─── Create Template Modal ─── */

function CreateTemplateModal({
  existingTemplates,
  onCreated,
  onClose,
}: {
  existingTemplates: RateTemplate[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, ""));
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) { toast("Name and slug required", "x"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/rate-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_name: name.trim(), template_slug: slug.trim(), description: description.trim(), copy_from_id: copyFrom || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast("Template created", "check");
      onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create", "x");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay open onClose={onClose} title="Create New Template" maxWidth="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Template Name</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Furniture & Design"
            className="w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Slug (auto-generated)</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 text-[11px] font-mono bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx3)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-[11px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] resize-none placeholder:text-[var(--tx3)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Copy rates from (optional)</label>
          <select
            value={copyFrom}
            onChange={(e) => setCopyFrom(e.target.value)}
            className="w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]"
          >
            <option value="">- Start blank -</option>
            {existingTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.template_name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white disabled:opacity-50">
            {saving ? "Creating…" : "Create Template"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Edit Template Name Modal ─── */

function EditTemplateNameModal({
  template,
  onSaved,
  onClose,
}: {
  template: RateTemplate;
  onSaved: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(template.template_name);
  const [description, setDescription] = useState(template.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Template name is required", "x");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rate-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_name: trimmed, description: description.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast("Template updated", "check");
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay open onClose={onClose} title="Edit template name" maxWidth="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Template Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Furniture & Design"
            className="w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-[11px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] resize-none placeholder:text-[var(--tx3)]"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Delete Template Confirmation Modal ─── */

function DeleteTemplateModal({
  template,
  onDeleted,
  onClose,
}: {
  template: RateTemplate;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/rate-templates/${template.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError(json.error || "Partners are still using this template.");
          return;
        }
        throw new Error(json.error);
      }
      toast("Template deleted", "check");
      onDeleted();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "x");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalOverlay open onClose={onClose} title="Delete template" maxWidth="sm">
      <div className="p-5 space-y-4">
        <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
          Delete <strong className="text-[var(--tx)]">{template.template_name}</strong>? This can only be done if no partners are assigned to this template.
        </p>
        {error && (
          <p className="text-[11px] text-[var(--red)] bg-[var(--rdim)] rounded-lg p-3">{error}</p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]" disabled={deleting}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--red)] text-white disabled:opacity-50 hover:opacity-90"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── View Partners Modal ─── */

function ViewPartnersModal({ templateName, partners, onClose }: { templateName: string; partners: any[]; onClose: () => void }) {
  return (
    <ModalOverlay open onClose={onClose} title={`Partners, ${templateName}`} maxWidth="md">
      <div className="p-5">
        {partners.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)] text-center py-6">No partners using this template yet.</p>
        ) : (
          <div className="divide-y divide-[var(--brd)]/30">
            {partners.map((p) => (
              <a key={p.id} href={`/admin/clients/${p.id}`} className="flex items-center justify-between py-3 first:pt-0 hover:text-[var(--gold)] transition-colors">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--tx)]">{p.name}</div>
                  <div className="text-[10px] text-[var(--tx3)] capitalize">{p.type || "Partner"}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${p.pricing_tier === "partner" ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--bgsub)] text-[var(--tx3)]"}`}>
                  {p.pricing_tier === "partner" ? "Partner ✦" : "Standard"}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

/* ─── Main Panel ─── */

export default function RateTemplatesPanel() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRates | null>(null);
  const [viewingPartnersFor, setViewingPartnersFor] = useState<TemplateRates | null>(null);
  const [editingNameFor, setEditingNameFor] = useState<RateTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<RateTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rate-templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setTemplates(json.templates || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load templates", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleEditRates = async (templateId: string) => {
    setLoadingId(templateId);
    try {
      const res = await fetch(`/api/admin/rate-templates/${templateId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEditingTemplate(json);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load template rates", "x");
    } finally {
      setLoadingId(null);
    }
  };

  const handleViewPartners = async (templateId: string) => {
    setLoadingId(templateId + "_p");
    try {
      const res = await fetch(`/api/admin/rate-templates/${templateId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setViewingPartnersFor(json);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load partners", "x");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDuplicate = async (t: RateTemplate) => {
    const newName = `${t.template_name} (copy)`;
    const newSlug = `${t.template_slug}_copy_${Date.now()}`;
    const res = await fetch("/api/admin/rate-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_name: newName, template_slug: newSlug, description: t.description, copy_from_id: t.id }),
    });
    const json = await res.json();
    if (!res.ok) { toast(json.error || "Failed to duplicate", "x"); return; }
    toast(`Duplicated as "${newName}"`, "check");
    fetchTemplates();
  };

  if (loading) {
    return <div className="py-10 text-center text-[11px] text-[var(--tx3)]">Loading templates…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="admin-section-h2">Rate Card Templates</h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Industry templates applied to partners. Changes affect all partners on the template.</p>
        </div>
        <CreateButton onClick={() => setCreateOpen(true)} title="New Template" />
      </div>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="border border-[var(--brd)] rounded-xl p-4 bg-[var(--card)]">
            {/* Top row: name + status badge */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-heading font-bold text-[15px] text-[var(--tx)]">{t.template_name}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.is_active ? "bg-[var(--grdim)] text-[var(--grn)]" : "bg-[var(--rdim)] text-[var(--red)]"}`}>
                {t.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {/* Meta row */}
            {t.description && (
              <p className="text-[11px] text-[var(--tx3)] mb-2 line-clamp-2">{t.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--tx3)] mb-3">
              <span>{t.verticals_covered?.length || 0} verticals</span>
              <span>·</span>
              <button onClick={() => handleViewPartners(t.id)} className="text-[var(--gold)] hover:underline font-semibold">
                {loadingId === t.id + "_p" ? "Loading…" : `${t.partner_count} partner${t.partner_count !== 1 ? "s" : ""}`}
              </button>
              <span>·</span>
              <span>Updated {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            {/* Action buttons row, full-width on mobile */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleEditRates(t.id)}
                disabled={loadingId === t.id}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50 transition-all"
              >
                {loadingId === t.id ? "Loading…" : "Edit Rates"}
              </button>
              <button
                type="button"
                onClick={() => setEditingNameFor(t)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]/60 hover:text-[var(--tx)] transition-all"
              >
                Edit Name
              </button>
              <button
                onClick={() => handleDuplicate(t)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--brd)] hover:text-[var(--tx)] transition-all"
              >
                Duplicate
              </button>
              <button
                onClick={() => setDeletingTemplate(t)}
                className="px-3 py-1 rounded text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
              >
                Delete
              </button>
            </div>
            {t.verticals_covered && t.verticals_covered.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[var(--brd)]/30 overflow-hidden">
                {t.verticals_covered.map((v) => (
                  <span key={v} className="px-2 py-0.5 rounded bg-[var(--bgsub)] text-[9px] text-[var(--tx3)] font-medium capitalize">
                    {v.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {editingTemplate && (
        <TemplateRateEditor
          data={editingTemplate}
          onSave={() => fetchTemplates()}
          onClose={() => setEditingTemplate(null)}
        />
      )}

      {viewingPartnersFor && (
        <ViewPartnersModal
          templateName={viewingPartnersFor.template.template_name}
          partners={viewingPartnersFor.partners}
          onClose={() => setViewingPartnersFor(null)}
        />
      )}

      {createOpen && (
        <CreateTemplateModal
          existingTemplates={templates}
          onCreated={fetchTemplates}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {editingNameFor && (
        <EditTemplateNameModal
          template={editingNameFor}
          onSaved={fetchTemplates}
          onClose={() => setEditingNameFor(null)}
        />
      )}

      {deletingTemplate && (
        <DeleteTemplateModal
          template={deletingTemplate}
          onDeleted={fetchTemplates}
          onClose={() => setDeletingTemplate(null)}
        />
      )}
    </div>
  );
}
