"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useToast } from "../components/Toast";
import { Package, Plus, PencilSimple } from "@phosphor-icons/react";
import {
  applyDimensionalFormToConfig,
  configToDimensionalForm,
  defaultDimensionalForm,
  type DimensionalConfigForm,
  type DistanceZoneRow,
  type VolumeDiscountTierRow,
} from "@/lib/admin/delivery-vertical-config-ui";

type Vertical = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  base_rate: number;
  pricing_method: string;
  default_config: Record<string, unknown>;
  active: boolean;
  sort_order: number;
};

const METHOD_OPTIONS = [
  { value: "dimensional", label: "Dimensional" },
  { value: "per_unit", label: "Per unit" },
  { value: "per_item", label: "Per item" },
  { value: "hourly", label: "Hourly" },
  { value: "flat", label: "Flat" },
] as const;

function pricingModelLabel(method: string): string {
  const m = method.toLowerCase();
  const hit = METHOD_OPTIONS.find((o) => o.value === m);
  return hit?.label ?? method.replace(/_/g, " ");
}

/** Stable storage id derived from display name (create only; never shown in UI). */
function slugFromDisplayName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return s || "service";
}

function coalesceNum(raw: string, fallback: unknown): number {
  const t = raw.trim();
  if (t !== "") {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  const p = typeof fallback === "number" ? fallback : Number(fallback);
  return Number.isFinite(p) ? p : 0;
}

const DIM_METHODS = new Set(["dimensional", "per_unit", "per_item"]);

export default function DeliveryVerticalsPanel({ isSuperAdmin = false }: { isSuperAdmin?: boolean } = {}) {
  void isSuperAdmin;
  const { toast } = useToast();
  const [rows, setRows] = useState<Vertical[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Vertical | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/delivery-verticals", { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      setRows(Array.isArray(d.verticals) ? d.verticals : []);
    } catch {
      setRows([]);
      toast("Could not load delivery verticals.", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    const dim = defaultDimensionalForm();
    setModal({
      id: "",
      code: "",
      name: "",
      description: "",
      icon: "",
      base_rate: 350,
      pricing_method: "dimensional",
      default_config: applyDimensionalFormToConfig({}, dim),
      active: true,
      sort_order: 0,
    });
  };

  const saveModal = async (v: Vertical) => {
    const isNew = !v.id;
    const nameTrim = v.name.trim();
    if (!nameTrim) {
      toast("Enter a display name for this service.", "x");
      return;
    }
    setSaving(true);
    try {
      const codePayload = isNew
        ? slugFromDisplayName(nameTrim)
        : String(v.code || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");
      const res = await fetch("/api/admin/delivery-verticals", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(isNew ? {} : { id: v.id }),
          code: codePayload,
          name: nameTrim,
          description: v.description?.trim() || null,
          icon: v.icon?.trim() || null,
          base_rate: v.base_rate,
          pricing_method: v.pricing_method,
          default_config: v.default_config,
          active: v.active,
          sort_order: v.sort_order,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast(d.error || "Save failed", "x");
        return;
      }
      toast(isNew ? "Vertical created" : "Vertical updated", "check");
      setModal(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="admin-section-h2 flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--gold)]" weight="duotone" />
            B2B verticals
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-1">
            One-off B2B quotes pull base rates, item tiers, zone and schedule surcharges, per-line weight tiers, and volume discounts from here. Global accessory types that never count as billable pieces are edited under Pricing → B2B surcharges.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
        >
          <Plus className="w-4 h-4" />
          New vertical
        </button>
      </div>

      {loading ? (
        <p className="text-[12px] text-[var(--tx3)] py-6">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-6 text-[13px] text-[var(--tx2)]">
          No delivery verticals yet. Create one with the button above, or ask an administrator if this list should already be populated.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--brd)] bg-[var(--bg2)]/60 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                <th className="px-4 py-2">Service</th>
                <th className="px-4 py-2">Starting price</th>
                <th className="px-4 py-2">Pricing model</th>
                <th className="px-4 py-2">On list</th>
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--brd)]/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-[var(--tx)]">{r.name}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">${Number(r.base_rate).toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-[var(--tx2)]">{pricingModelLabel(r.pricing_method)}</td>
                  <td className="px-4 py-2.5">{r.active ? "Yes" : "No"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setModal(r)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--gold)] hover:underline"
                    >
                      <PencilSimple className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-vertical-modal-title"
        >
          <div className="relative my-auto flex min-h-0 w-full max-w-2xl flex-col rounded-2xl border border-[var(--brd)] bg-[var(--card)] shadow-xl max-h-[min(90dvh,calc(100dvh-2rem))]">
            <div className="shrink-0 border-b border-[var(--brd)]/60 px-5 py-4">
              <h3 id="delivery-vertical-modal-title" className="text-[15px] font-bold text-[var(--tx)]">
                {modal.id ? "Edit vertical" : "Create vertical"}
              </h3>
            </div>
            <VerticalEditForm
              initial={modal}
              onCancel={() => setModal(null)}
              onSave={saveModal}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function numInputCls() {
  return "w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]";
}

function VerticalEditForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: Vertical;
  onCancel: () => void;
  onSave: (v: Vertical) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description || "");
  const [icon, setIcon] = useState(initial.icon || "");
  const [baseRate, setBaseRate] = useState(String(initial.base_rate));
  const [pricingMethod, setPricingMethod] = useState(initial.pricing_method);
  const [sortOrder, setSortOrder] = useState(String(initial.sort_order));
  const [active, setActive] = useState(initial.active);
  const [dimForm, setDimForm] = useState<DimensionalConfigForm>(() => configToDimensionalForm(initial.default_config || {}));

  const showDimensionalBlock = DIM_METHODS.has(pricingMethod.toLowerCase());
  const showHourlyLabour = pricingMethod.toLowerCase() === "hourly";
  const showFlatNote = pricingMethod.toLowerCase() === "flat";

  useEffect(() => {
    setName(initial.name);
    setDescription(initial.description || "");
    setIcon(initial.icon || "");
    setBaseRate(String(initial.base_rate));
    setPricingMethod(initial.pricing_method);
    setSortOrder(String(initial.sort_order));
    setActive(initial.active);
    setDimForm(configToDimensionalForm(initial.default_config || {}));
  }, [initial]);

  const buildDefaultConfig = useCallback((): Record<string, unknown> => {
    const prev = initial.default_config || {};
    const pm = pricingMethod.toLowerCase();
    if (DIM_METHODS.has(pm)) {
      return applyDimensionalFormToConfig(prev, dimForm);
    }
    if (pm === "hourly") {
      return {
        ...prev,
        min_crew: coalesceNum(dimForm.minCrew, prev.min_crew),
        min_hours: coalesceNum(dimForm.minHours, prev.min_hours),
        crew_hourly_rate: coalesceNum(dimForm.crewHourlyRate, prev.crew_hourly_rate),
        stop_rate: coalesceNum(dimForm.stopRate, prev.stop_rate),
        free_stops: coalesceNum(dimForm.freeStops, prev.free_stops),
      };
    }
    if (pm === "flat") {
      const o = { ...prev };
      const tRaw = dimForm.targetMarginPercentDefault.trim();
      const tmg = tRaw === "" ? undefined : Number(tRaw);
      if (tmg !== undefined && Number.isFinite(tmg) && tmg > 0 && tmg <= 100) {
        o.target_margin_percent_default = tmg;
      } else {
        delete o.target_margin_percent_default;
      }
      if (dimForm.autoQuoteDisabled) o.auto_quote_disabled = true;
      else delete o.auto_quote_disabled;
      return o;
    }
    return { ...prev };
  }, [dimForm, initial.default_config, pricingMethod]);

  const handleSave = () => {
    onSave({
      ...initial,
      name,
      description: description || null,
      icon: icon || null,
      base_rate: Number(baseRate) || 0,
      pricing_method: pricingMethod,
      sort_order: Number(sortOrder) || 0,
      active,
      default_config: buildDefaultConfig(),
    });
  };

  const patchDim = useCallback((patch: Partial<DimensionalConfigForm>) => {
    setDimForm((f) => ({ ...f, ...patch }));
  }, []);

  const patchZoneRow = useCallback((idx: number, patch: Partial<DistanceZoneRow>) => {
    setDimForm((f) => ({
      ...f,
      distanceZones: f.distanceZones.map((z, i) => (i === idx ? { ...z, ...patch } : z)),
    }));
  }, []);

  const addZoneRow = useCallback(() => {
    setDimForm((f) => ({
      ...f,
      distanceZones: [...f.distanceZones, { minKm: "", maxKm: "", fee: "" }],
    }));
  }, []);

  const removeZoneRow = useCallback((idx: number) => {
    setDimForm((f) => ({
      ...f,
      distanceZones: f.distanceZones.filter((_, i) => i !== idx),
    }));
  }, []);

  const patchVolumeTierRow = useCallback((idx: number, patch: Partial<VolumeDiscountTierRow>) => {
    setDimForm((f) => ({
      ...f,
      volumeDiscountTiers: f.volumeDiscountTiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    }));
  }, []);

  const addVolumeTierRow = useCallback(() => {
    setDimForm((f) => ({
      ...f,
      volumeDiscountTiers: [...f.volumeDiscountTiers, { minMonthly: "", percentOff: "" }],
    }));
  }, []);

  const removeVolumeTierRow = useCallback((idx: number) => {
    setDimForm((f) => ({
      ...f,
      volumeDiscountTiers: f.volumeDiscountTiers.filter((_, i) => i !== idx),
    }));
  }, []);

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Display name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        />

        <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Short description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        />

        <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Icon hint</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          placeholder="Phosphor icon name, e.g. Armchair"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Starting price</label>
            <input
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              type="number"
              className={numInputCls()}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Sort order</label>
            <input
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              type="number"
              className={numInputCls()}
            />
          </div>
        </div>

        <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Pricing model</label>
        <select
          value={pricingMethod}
          onChange={(e) => setPricingMethod(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--gold)]" />
          Show on quote list
        </label>

        {showFlatNote && (
          <p className="text-[11px] text-[var(--tx3)] rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)]/40 px-3 py-2">
            Flat pricing uses the starting price only. Other rate options stay stored but are not applied for this model.
          </p>
        )}

        {showFlatNote && (
          <div className="space-y-3 rounded-xl border border-[var(--brd)]/60 bg-[var(--bg)]/20 p-3">
            <p className="text-[10px] font-bold uppercase text-[var(--tx3)]">Specialty / flat vertical</p>
            <Field
              label="Target margin % (default)"
              value={dimForm.targetMarginPercentDefault}
              onChange={(v) => patchDim({ targetMarginPercentDefault: v })}
              hint="Cost-plus specialty quotes (1–100)."
            />
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
              <input
                type="checkbox"
                checked={dimForm.autoQuoteDisabled}
                onChange={(e) => patchDim({ autoQuoteDisabled: e.target.checked })}
                className="accent-[var(--gold)]"
              />
              Disable auto-quote (coordinator manual scope only)
            </label>
          </div>
        )}

        {showHourlyLabour && (
          <div className="space-y-3 rounded-xl border border-[var(--brd)]/60 bg-[var(--bg)]/20 p-3">
            <p className="text-[10px] font-bold uppercase text-[var(--tx3)]">Labour and stops</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Crew size (min)" value={dimForm.minCrew} onChange={(v) => patchDim({ minCrew: v })} />
              <Field label="Minimum hours" value={dimForm.minHours} onChange={(v) => patchDim({ minHours: v })} />
              <Field label="Hourly rate (per person)" value={dimForm.crewHourlyRate} onChange={(v) => patchDim({ crewHourlyRate: v })} />
              <Field label="Extra stop fee" value={dimForm.stopRate} onChange={(v) => patchDim({ stopRate: v })} />
              <Field label="Stops included" value={dimForm.freeStops} onChange={(v) => patchDim({ freeStops: v })} />
            </div>
          </div>
        )}

        {showDimensionalBlock && (
          <div className="space-y-4 rounded-xl border border-[var(--brd)]/60 bg-[var(--bg)]/20 p-3">
            <p className="text-[10px] font-bold uppercase text-[var(--tx3)]">Dimensional pricing options</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">Unit label</label>
                <input
                  value={dimForm.unitLabel}
                  onChange={(e) => patchDim({ unitLabel: e.target.value })}
                  className={numInputCls()}
                  placeholder="piece, carton, item…"
                />
              </div>
              <Field label="Rate per unit" value={dimForm.unitRate} onChange={(v) => patchDim({ unitRate: v })} />
              <Field
                label="Items included in base"
                value={dimForm.itemsIncludedInBase}
                onChange={(v) => patchDim({ itemsIncludedInBase: v })}
                hint="Leave blank to charge rate-per-unit on all items (legacy)."
              />
              <Field
                label="Per-item rate after base"
                value={dimForm.perItemAfterBase}
                onChange={(v) => patchDim({ perItemAfterBase: v })}
                hint="Used with items included; extra pieces only."
              />
              <Field label="Skid fee (each)" value={dimForm.skidHandlingFee} onChange={(v) => patchDim({ skidHandlingFee: v })} />
              <Field
                label="Sprinter max units"
                value={dimForm.sprinterMaxUnits}
                onChange={(v) => patchDim({ sprinterMaxUnits: v })}
                hint="Before 16 ft truck is recommended."
              />
              <label className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--tx2)]">
                <input
                  type="checkbox"
                  checked={dimForm.assemblyIncluded}
                  onChange={(e) => patchDim({ assemblyIncluded: e.target.checked })}
                  className="accent-[var(--gold)]"
                />
                Assembly included in base (no assembly add-on)
              </label>
              <label className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--tx2)]">
                <input
                  type="checkbox"
                  checked={dimForm.useZoneDistance}
                  onChange={(e) => patchDim({ useZoneDistance: e.target.checked })}
                  className="accent-[var(--gold)]"
                />
                Zone distance fees (40 / 80 km bands on route km)
              </label>
              <Field label="Weekend surcharge" value={dimForm.scheduleWeekend} onChange={(v) => patchDim({ scheduleWeekend: v })} />
              <Field label="After-hours surcharge" value={dimForm.scheduleAfterHours} onChange={(v) => patchDim({ scheduleAfterHours: v })} />
              <Field label="Same-day surcharge" value={dimForm.scheduleSameDay} onChange={(v) => patchDim({ scheduleSameDay: v })} />
              <Field
                label="Medical combined (wknd or after-hrs)"
                value={dimForm.medicalCombinedSchedule}
                onChange={(v) => patchDim({ medicalCombinedSchedule: v })}
                hint="If set, replaces separate weekend/after-hours for medical."
              />
              <label className="col-span-2 flex items-center gap-2 text-[12px] text-[var(--tx2)]">
                <input
                  type="checkbox"
                  checked={dimForm.waiveAfterHours}
                  onChange={(e) => patchDim({ waiveAfterHours: e.target.checked })}
                  className="accent-[var(--gold)]"
                />
                Waive after-hours surcharge (e.g. restaurant)
              </label>
              <Field label="Minimum crew" value={dimForm.minCrew} onChange={(v) => patchDim({ minCrew: v })} />
              <Field label="Minimum job hours" value={dimForm.minHours} onChange={(v) => patchDim({ minHours: v })} />
              <Field label="Crew hourly (labour model)" value={dimForm.crewHourlyRate} onChange={(v) => patchDim({ crewHourlyRate: v })} />
              <Field label="Extra stop fee" value={dimForm.stopRate} onChange={(v) => patchDim({ stopRate: v })} />
              <Field label="Stops included" value={dimForm.freeStops} onChange={(v) => patchDim({ freeStops: v })} />
              <Field label="Included distance (km)" value={dimForm.distanceFreeKm} onChange={(v) => patchDim({ distanceFreeKm: v })} />
              <Field label="Per km after included" value={dimForm.distancePerKm} onChange={(v) => patchDim({ distancePerKm: v })} />
              <div className="col-span-2">
                <Field label="Minimum charge (optional)" value={dimForm.minCharge} onChange={(v) => patchDim({ minCharge: v })} hint="Leave blank to use starting price as the floor." />
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-1">Handling (flat fees)</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Threshold / dock pickup" value={dimForm.handlingThreshold} onChange={(v) => patchDim({ handlingThreshold: v })} />
              <Field label="Room of choice" value={dimForm.handlingRoomOfChoice} onChange={(v) => patchDim({ handlingRoomOfChoice: v })} />
              <Field label="Dock to dock" value={dimForm.handlingDockToDock} onChange={(v) => patchDim({ handlingDockToDock: v })} />
              <Field label="White glove" value={dimForm.handlingWhiteGlove} onChange={(v) => patchDim({ handlingWhiteGlove: v })} />
              <Field label="Hand-bomb (flat)" value={dimForm.handlingHandBomb} onChange={(v) => patchDim({ handlingHandBomb: v })} />
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-1">Truck surcharges</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sprinter van" value={dimForm.truckSprinter} onChange={(v) => patchDim({ truckSprinter: v })} />
              <Field label="16 ft truck" value={dimForm.truck16ft} onChange={(v) => patchDim({ truck16ft: v })} />
              <Field label="20 ft truck" value={dimForm.truck20ft} onChange={(v) => patchDim({ truck20ft: v })} />
              <Field label="26 ft truck" value={dimForm.truck26ft} onChange={(v) => patchDim({ truck26ft: v })} />
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-1">Add-ons</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Time-sensitive" value={dimForm.premTimeSensitive} onChange={(v) => patchDim({ premTimeSensitive: v })} />
              <Field label="Fragile items" value={dimForm.premFragile} onChange={(v) => patchDim({ premFragile: v })} />
              <Field label="Per flight of stairs" value={dimForm.premStairsPerFlight} onChange={(v) => patchDim({ premStairsPerFlight: v })} />
              <Field label="Assembly required" value={dimForm.premAssembly} onChange={(v) => patchDim({ premAssembly: v })} />
              <Field label="Debris removal" value={dimForm.premDebris} onChange={(v) => patchDim({ premDebris: v })} />
              <Field
                label="Art hanging (per piece)"
                value={dimForm.premArtHanging}
                onChange={(v) => patchDim({ premArtHanging: v })}
              />
              <Field
                label="Crating (per piece)"
                value={dimForm.premCrating}
                onChange={(v) => patchDim({ premCrating: v })}
              />
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-1">Weight surcharges (per line item)</p>
            <p className="text-[10px] text-[var(--tx3)] -mt-2">
              Per-piece surcharges by coordinator line weight (light / medium / heavy / extra heavy). Leave all blank to use legacy per-box tiers only.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Light tier" value={dimForm.weightLight} onChange={(v) => patchDim({ weightLight: v })} />
              <Field label="Medium tier" value={dimForm.weightMedium} onChange={(v) => patchDim({ weightMedium: v })} />
              <Field label="Heavy tier" value={dimForm.weightHeavy} onChange={(v) => patchDim({ weightHeavy: v })} />
              <Field label="Extra heavy tier" value={dimForm.weightExtraHeavy} onChange={(v) => patchDim({ weightExtraHeavy: v })} />
            </div>

            {dimForm.useZoneDistance && (
              <>
                <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Distance zones (route km)</p>
                <p className="text-[10px] text-[var(--tx3)] -mt-1">Each band adds its fee once when distance falls in range.</p>
                <div className="space-y-2">
                  {dimForm.distanceZones.map((z, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                      <Field label="Min km" value={z.minKm} onChange={(v) => patchZoneRow(i, { minKm: v })} />
                      <Field label="Max km" value={z.maxKm} onChange={(v) => patchZoneRow(i, { maxKm: v })} />
                      <Field label="Fee ($)" value={z.fee} onChange={(v) => patchZoneRow(i, { fee: v })} />
                      <button
                        type="button"
                        onClick={() => removeZoneRow(i)}
                        disabled={dimForm.distanceZones.length <= 1}
                        className="mb-0.5 px-2 py-2 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addZoneRow}
                    className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                  >
                    + Add zone
                  </button>
                </div>
              </>
            )}

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Volume discounts (monthly)</p>
            <p className="text-[10px] text-[var(--tx3)] -mt-1">Percent off when partner hits minimum deliveries per month. Leave empty for none.</p>
            <div className="space-y-2">
              {dimForm.volumeDiscountTiers.length === 0 ? (
                <p className="text-[10px] text-[var(--tx3)]">No tiers — model uses list price only.</p>
              ) : (
                dimForm.volumeDiscountTiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <Field
                      label="Min deliveries / mo"
                      value={t.minMonthly}
                      onChange={(v) => patchVolumeTierRow(i, { minMonthly: v })}
                    />
                    <Field label="Percent off" value={t.percentOff} onChange={(v) => patchVolumeTierRow(i, { percentOff: v })} />
                    <button
                      type="button"
                      onClick={() => removeVolumeTierRow(i)}
                      className="mb-0.5 px-2 py-2 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)]"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
              <button type="button" onClick={addVolumeTierRow} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                + Add volume tier
              </button>
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Large jobs (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Min crew at item count ≥"
                value={dimForm.largeJobItemThreshold}
                onChange={(v) => patchDim({ largeJobItemThreshold: v })}
                hint="e.g. 12 items → use min crew below."
              />
              <Field
                label="Crew size for large jobs"
                value={dimForm.largeJobMinCrew}
                onChange={(v) => patchDim({ largeJobMinCrew: v })}
                hint="e.g. 3"
              />
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Extra-heavy labour (400+ lb lines)</p>
            <p className="text-[10px] text-[var(--tx3)] -mt-1">Applied when any line is extra-heavy. Clear all three to remove.</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Extra crew count" value={dimForm.extraHeavyExtraCrew} onChange={(v) => patchDim({ extraHeavyExtraCrew: v })} />
              <Field label="$/hr per extra" value={dimForm.extraHeavyHourlyPerExtra} onChange={(v) => patchDim({ extraHeavyHourlyPerExtra: v })} />
              <Field label="Min hours" value={dimForm.extraHeavyMinHours} onChange={(v) => patchDim({ extraHeavyMinHours: v })} />
            </div>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Flooring-style load weight (optional)</p>
            <p className="text-[10px] text-[var(--tx3)] -mt-1">Uses total load lbs on the quote. Clear fields and uncheck to remove.</p>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Standard max lb (no fee)"
                value={dimForm.flooringStandardMaxLb}
                onChange={(v) => patchDim({ flooringStandardMaxLb: v })}
              />
              <Field
                label="Heavy max lb (upper band)"
                value={dimForm.flooringHeavyMaxLb}
                onChange={(v) => patchDim({ flooringHeavyMaxLb: v })}
              />
              <Field label="Heavy band fee ($)" value={dimForm.flooringHeavyFee} onChange={(v) => patchDim({ flooringHeavyFee: v })} />
              <Field label="Extra-heavy band fee ($)" value={dimForm.flooringExtraFee} onChange={(v) => patchDim({ flooringExtraFee: v })} />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
              <input
                type="checkbox"
                checked={dimForm.flooringExtraThreeCrew}
                onChange={(e) => patchDim({ flooringExtraThreeCrew: e.target.checked })}
                className="accent-[var(--gold)]"
              />
              Extra-heavy flooring load adds third crew (labour charge)
            </label>

            <p className="text-[10px] font-bold uppercase text-[var(--tx3)] pt-2">Specialty defaults (non-flat)</p>
            <p className="text-[10px] text-[var(--tx3)] -mt-1">
              For dimensional verticals that still use cost-plus or manual flows (optional).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Target margin % (default)"
                value={dimForm.targetMarginPercentDefault}
                onChange={(v) => patchDim({ targetMarginPercentDefault: v })}
                hint="1–100; used where vertical references margin."
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
              <input
                type="checkbox"
                checked={dimForm.autoQuoteDisabled}
                onChange={(e) => patchDim({ autoQuoteDisabled: e.target.checked })}
                className="accent-[var(--gold)]"
              />
              Disable auto-quote (coordinator manual scope only)
            </label>
          </div>
        )}
      </div>

      <div className="shrink-0 flex justify-end gap-2 border-t border-[var(--brd)]/60 px-5 py-3">
        <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg text-[11px] border border-[var(--brd)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold uppercase text-[var(--tx3)] mb-1">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} type="text" inputMode="decimal" className={numInputCls()} />
      {hint ? <p className="text-[10px] text-[var(--tx3)] mt-0.5">{hint}</p> : null}
    </div>
  );
}
