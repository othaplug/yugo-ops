"use client";

import { useState, useEffect, useCallback } from "react";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatCurrency } from "@/lib/format-currency";
import { InfoHint } from "@/components/ui/InfoHint";
import { PM_PRIMARY_REASON_CODES_ORDERED } from "@/lib/partners/pm-portal-move-types";

/* ─── Types ─── */

interface RateCardPartner {
  id: string; name: string; type?: string;
  pricing_tier: "standard" | "partner";
  template_id: string | null; global_discount_pct: number; rates_locked: boolean;
}
interface RateTemplate {
  id: string;
  template_name: string;
  template_slug: string;
  is_active: boolean;
  template_kind?: string | null;
  extras?: Record<string, unknown> | null;
}
interface DayRate { id: string; vehicle_type: string; full_day_price: number; half_day_price: number; stops_included_full: number; stops_included_half: number; pricing_tier: string; }
interface DeliveryRate { id: string; delivery_type: string; zone: number; price_min: number; price_max?: number | null; pricing_tier: string; }
interface Service { id: string; service_slug: string; service_name: string; price_min: number; price_max?: number | null; price_unit: string; pricing_tier: string; }
interface Overage { id: string; overage_tier: string; price_per_stop: number; pricing_tier: string; }
interface Zone {
  id: string;
  zone_number: number;
  zone_name: string;
  surcharge: number;
  pricing_tier: string;
  distance_min_km?: number | null;
  distance_max_km?: number | null;
  coverage_areas?: string | null;
}
interface VolumeBonus { id: string; min_deliveries: number; max_deliveries?: number | null; discount_pct: number; }
interface Override { id: string; rate_table: string; rate_record_id: string; override_field: string; override_value: number; is_locked: boolean; notes?: string | null; }

interface PmRateRow {
  id?: string;
  reason_code: string;
  unit_size: string;
  zone: string;
  base_rate: number;
  weekend_surcharge?: number;
  after_hours_premium?: number;
  holiday_surcharge?: number;
}

interface RateCardData {
  partner: RateCardPartner;
  template: RateTemplate | null;
  templates: RateTemplate[];
  dayRates: DayRate[]; deliveryRates: DeliveryRate[];
  services: Service[]; overages: Overage[]; zones: Zone[]; volumeBonuses: VolumeBonus[];
  overrides: Override[];
  mode: "template" | "no_template" | "detached";
  portfolioPartner?: boolean;
  pmContract?: Record<string, unknown> | null;
  pmRates?: PmRateRow[];
  pmAddons?: { addon_code: string; label: string; price: number; price_type: string }[];
}

const PM_REASON_LABELS: Record<string, string> = {
  tenant_move_out: "Tenant Move-Out",
  tenant_move_in: "Tenant Move-In",
  reno_move_out: "Reno Displacement (out)",
  reno_move_in: "Reno Return (in)",
  suite_transfer: "Suite Transfer",
  emergency_relocation: "Emergency",
  staging: "Staging Move",
  destaging: "Destaging",
  unit_turnover: "Unit Turnover",
  incentive_move: "Incentive Move",
  building_transfer: "Building Transfer",
  storage_move: "Storage Move",
  office_suite_setup: "Office Suite Setup",
  office_suite_clearout: "Office Suite Clearout",
  common_area: "Common Area",
  other: "Other",
  reno_bundle: "Bundle Reno (In + Out)",
};

const PM_UNIT_ORDER = ["studio", "1br", "2br", "3br", "4br_plus"] as const;

function pmUnitHeader(u: string): string {
  if (u === "4br_plus") return "4BR+";
  if (u === "1br") return "1BR";
  if (u === "2br") return "2BR";
  if (u === "3br") return "3BR";
  return "Studio";
}

interface EditingCell {
  rateTable: string; rateRecordId: string; field: string; fieldLabel: string;
  templateValue: number; currentOverride: Override | null;
}

/** Template fallback when pm_rate_cards has no reno_bundle rows yet */
const BUNDLE_RENO_BASE_BY_UNIT: Record<(typeof PM_UNIT_ORDER)[number], number> = {
  studio: 799,
  "1br": 1099,
  "2br": 1549,
  "3br": 2149,
  "4br_plus": 2899,
};
const BUNDLE_RENO_WEEKEND_SURCHARGE = 200;

interface PmRateEditState {
  /** Null when the matrix row was template-only (no pm_rate_cards id yet); save uses POST upsert. */
  rowId: string | null;
  reasonCode: string;
  unitLabel: string;
  unitSize: string;
  baseRate: number;
  weekendSurcharge: number;
}

function sortPmMatrixReasonCodes(codes: string[]): string[] {
  const primary = PM_PRIMARY_REASON_CODES_ORDERED as readonly string[];
  const idx = (c: string) => {
    const i = primary.indexOf(c);
    return i >= 0 ? i : 500;
  };
  return [...codes].sort((a, b) => {
    const d = idx(a) - idx(b);
    if (d !== 0) return d;
    const la = PM_REASON_LABELS[a] || a.replace(/_/g, " ");
    const lb = PM_REASON_LABELS[b] || b.replace(/_/g, " ");
    return la.localeCompare(lb);
  });
}

/* ─── Helper functions ─── */

function getEffectiveValue(
  rateTable: string, recordId: string, field: string,
  templateValue: number, overrides: Override[], discount: number
): { value: number; source: "override" | "discounted" | "template"; override: Override | null } {
  const ov = overrides.find(
    (o) => o.rate_table === rateTable && o.rate_record_id === recordId && o.override_field === field
  );
  if (ov) return { value: ov.override_value, source: "override", override: ov };
  if (discount > 0) return { value: Math.round(templateValue * (1 - discount / 100)), source: "discounted", override: null };
  return { value: templateValue, source: "template", override: null };
}

function StatusBadge({ source, isLocked }: { source: "override" | "discounted" | "template"; isLocked?: boolean }) {
  if (source === "override") {
    return (
      <span className={`inline-flex items-center gap-0.5 dt-badge tracking-[0.04em] text-[10px] ${isLocked ? "text-[var(--accent-text)]" : "text-[var(--blue)]"}`}>
        ✦ Custom{isLocked ? " (locked)" : ""}
      </span>
    );
  }
  if (source === "discounted") {
    return <span className="text-[9px] text-[var(--tx3)]">Template</span>;
  }
  return <span className="text-[9px] text-[var(--tx3)]">Template</span>;
}

const VEHICLE_LABELS: Record<string, string> = {
  sprinter: "Sprinter",
  "16ft": "16ft",
  "20ft": "20ft",
  "26ft": "26ft",
  "16ft_after_hours": "16ft (After Hours)",
  "20ft_after_hours": "20ft (After Hours)",
  "16ft_2crew": "16ft + 2 crew",
  "20ft_3crew": "20ft + 3 crew",
  "26ft_4crew": "26ft + 4 crew",
};
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  single_item: "Single Item",
  multi_piece: "Multi-Piece",
  full_room: "Full Room Setup",
  multi_stop: "Multi-Stop",
  curbside: "Curbside Drop",
  oversized: "Oversized/Fragile",
  day_rate: "Day Rate",
  b2b: "B2B",
  b2b_delivery: "B2B",
  delivery: "Standard Delivery",
  designer: "Designer",
  retail: "Retail",
  hospitality: "Hospitality",
  gallery: "Gallery",
  project: "Project",
  art_piece_small: "Per piece (small)",
  art_piece_medium: "Per piece (medium)",
  art_piece_large: "Per piece (large)",
  art_sculpture_3d: "Sculpture / 3D",
  hosp_piece_chair: "Per piece (chairs, small items)",
  hosp_piece_table: "Per piece (tables, large items)",
  hosp_piece_kitchen: "Per piece (kitchen equipment, heavy)",
  hosp_booth: "Booth / banquette",
  hosp_pos: "POS / electronics system",
  hosp_display: "Display case",
  med_equipment_small: "Small equipment (<50 lbs)",
  med_equipment_medium: "Medium equipment (50–200 lbs)",
  med_equipment_large: "Large equipment (200–500 lbs)",
  med_equipment_heavy: "Heavy equipment (500+ lbs)",
  med_server_rack: "Server rack / data cabinet",
  med_imaging: "Imaging equipment (MRI, CT, X-ray)",
};
const OVERAGE_TIER_LABELS: Record<string, string> = {
  full_7_10: "Full Day 7–10 stops",
  full_11_plus: "Full Day 11+",
  half_4_6: "Half Day 4–6 stops",
  half_7_plus: "Half Day 7+",
  art_extra_stop: "Extra stop (beyond included)",
  art_wait_30min: "Wait time (beyond 15 min at stop)",
  art_crew_hourly: "Additional crew member",
  art_stairs_flight: "Stairs (per flight, no elevator)",
};

function pricingTierLabel(tier: string): string {
  if (tier === "standard") return "Standard";
  if (tier === "partner") return "Partner / Premium";
  return tier.replace(/_/g, " ");
}

function pmExtrasToPmRows(extras: unknown): PmRateRow[] {
  if (!extras || typeof extras !== "object") return [];
  const mr = (extras as { move_rates?: unknown }).move_rates;
  if (!Array.isArray(mr)) return [];
  const units = ["studio", "1br", "2br", "3br", "4br_plus"] as const;
  const rows: PmRateRow[] = [];
  for (const entry of mr) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const reason = String(e.reason_code || "");
    if (!reason) continue;
    for (const u of units) {
      const v = e[u];
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isNaN(n)) continue;
      rows.push({
        reason_code: reason,
        unit_size: u,
        zone: "local",
        base_rate: n,
        weekend_surcharge: 100,
        after_hours_premium: 0.15,
        holiday_surcharge: 150,
      });
    }
  }
  return rows;
}

/* ─── Edit Override Modal ─── */

function EditOverrideModal({
  cell, discount, onSave, onReset, onClose,
}: {
  cell: EditingCell;
  discount: number;
  onSave: (value: number, isLocked: boolean, notes: string) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
}) {
  const discountedValue = discount > 0 ? Math.round(cell.templateValue * (1 - discount / 100)) : cell.templateValue;
  const [value, setValue] = useState<string>(
    cell.currentOverride ? String(cell.currentOverride.override_value) : String(discountedValue)
  );
  const [isLocked, setIsLocked] = useState(cell.currentOverride?.is_locked ?? false);
  const [notes, setNotes] = useState(cell.currentOverride?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setSaving(true);
    try { await onSave(num, isLocked, notes); } finally { setSaving(false); }
  };

  const handleReset = async () => {
    setResetting(true);
    try { await onReset(); } finally { setResetting(false); }
  };

  return (
    <ModalOverlay open onClose={onClose} title={`Edit Rate: ${cell.fieldLabel}`} maxWidth="sm">
      <div className="p-5 space-y-4">
        <div className="bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-[var(--tx3)]">Template rate</span>
            <span className="font-semibold text-[var(--tx)]">{formatCurrency(cell.templateValue)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-[var(--tx3)]">After discount ({discount}%)</span>
              <span className="font-semibold text-[var(--grn)]">{formatCurrency(discountedValue)}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Custom rate ($)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="admin-premium-input w-full font-semibold"
            autoFocus
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(e) => setIsLocked(e.target.checked)}
            className="w-4 h-4 rounded border border-[var(--brd)] bg-[var(--bgsub)] accent-[var(--gold)]"
          />
          <span className="text-[11px] text-[var(--tx2)]">
            Lock this rate, template updates won&apos;t affect it
          </span>
        </label>

        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Negotiated rate for Q1 2026"
            className="admin-premium-input w-full"
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save Override"}
          </button>
          {cell.currentOverride && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="w-full py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)] disabled:opacity-50 transition-all"
            >
              {resetting ? "Resetting…" : "Reset to Template"}
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 rounded-lg text-[11px] text-[var(--tx3)] hover:text-[var(--tx)]">
            Cancel
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function PmRateEditModal({
  state,
  onSave,
  onClose,
}: {
  state: PmRateEditState;
  onSave: (base: number, weekendSurcharge: number) => Promise<void>;
  onClose: () => void;
}) {
  const [baseStr, setBaseStr] = useState(String(state.baseRate));
  const [wkndStr, setWkndStr] = useState(String(state.weekendSurcharge));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseStr(String(state.baseRate));
    setWkndStr(String(state.weekendSurcharge));
  }, [state.rowId, state.unitSize, state.baseRate, state.weekendSurcharge]);

  const handleSave = async () => {
    const base = parseFloat(baseStr);
    const wknd = parseFloat(wkndStr);
    if (Number.isNaN(base) || base < 0 || Number.isNaN(wknd) || wknd < 0) return;
    setSaving(true);
    try {
      await onSave(base, wknd);
    } finally {
      setSaving(false);
    }
  };

  const reasonLabel = PM_REASON_LABELS[state.reasonCode] || state.reasonCode.replace(/_/g, " ");
  const title = `${reasonLabel} · ${state.unitLabel}`;

  return (
    <ModalOverlay open onClose={onClose} title={title} maxWidth="sm">
      <div className="p-5 space-y-4">
        <div className="flex justify-end">
          <InfoHint variant="admin" align="end" ariaLabel="Weekday and weekend rates">
            <p className="text-[11px] leading-relaxed">
              Weekday rate is the base. Weekend pricing adds the weekend amount on Fri to Sun (same rule as the partner portal).
            </p>
          </InfoHint>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Weekday base ($)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={baseStr}
            onChange={(e) => setBaseStr(e.target.value)}
            className="admin-premium-input w-full font-semibold"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Weekend add-on ($)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={wkndStr}
            onChange={(e) => setWkndStr(e.target.value)}
            className="admin-premium-input w-full font-semibold"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Settings Modal ─── */

function RateCardSettingsModal({
  partner, templates, onSave, onClose,
}: {
  partner: RateCardPartner;
  templates: RateTemplate[];
  onSave: (updates: { template_id?: string; global_discount_pct?: number; pricing_tier?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(partner.template_id || "");
  const [discount, setDiscount] = useState(String(partner.global_discount_pct || 0));
  const [tier, setTier] = useState(partner.pricing_tier || "partner");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        template_id: templateId || undefined,
        global_discount_pct: parseFloat(discount) || 0,
        pricing_tier: tier,
      });
    } finally { setSaving(false); }
  };

  return (
    <ModalOverlay open onClose={onClose} title="Rate Card Settings" maxWidth="sm">
      <div className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Template</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="admin-premium-input w-full"
          >
            <option value="">- No template -</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.template_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Pricing Tier</label>
          <div className="flex gap-2">
            {(["standard", "partner"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-semibold border transition-all ${
                  tier === t
                    ? "bg-[var(--admin-primary-fill)] border-[var(--gold)] text-[var(--btn-text-on-accent)]"
                    : "border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
                }`}
              >
                {t === "partner" ? "Partner ✦" : "Standard"}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-[var(--tx3)] mt-1">
            Partner: 10+ deliveries/month or annual commitment. Standard: all others.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx2)] mb-1.5">Global Discount (%)</label>
          <input
            type="number" min={0} max={100} step={1}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="admin-premium-input w-full"
          />
          <p className="text-[9px] text-[var(--tx3)] mt-1">Applied to all template rates. Overridden cells use their custom value instead.</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ─── Rate table cell ─── */

function RateCell({
  value, source, override, isHeader = false,
  onClick,
}: {
  value: number; source: "override" | "discounted" | "template"; override: Override | null;
  isHeader?: boolean; onClick?: () => void;
}) {
  const isOverride = source === "override";
  return (
    <td
      onClick={onClick}
      className={`px-3 py-2.5 text-right text-[11px] ${onClick ? "cursor-pointer hover:bg-[var(--bgsub)] transition-colors" : ""} ${isHeader ? "font-bold text-[var(--tx)]" : "text-[var(--tx)]"}`}
    >
      <span className={isOverride ? "text-[var(--accent-text)] font-bold" : ""}>
        {formatCurrency(value)}{isOverride && <span className="ml-0.5 text-[9px]">✦</span>}
      </span>
    </td>
  );
}

/* ─── Main Component ─── */

export default function PartnerRateCardTab({
  orgId,
  orgName,
  canEditRates = false,
}: {
  orgId: string;
  orgName: string;
  /** Super admin only: template overrides + PM contract matrix */
  canEditRates?: boolean;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<RateCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [pmEdit, setPmEdit] = useState<PmRateEditState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detachConfirm, setDetachConfirm] = useState(false);
  const [detaching, setDetaching] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partners/${orgId}/rate-card`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load rate card", "x");
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const eff = (table: string, id: string, field: string, val: number) => {
    if (!data) return { value: val, source: "template" as const, override: null };
    return getEffectiveValue(table, id, field, val, data.overrides, data.partner.global_discount_pct || 0);
  };

  const openCell = (table: string, id: string, field: string, label: string, templateVal: number) => {
    if (!canEditRates || !data) return;
    const existing = data.overrides.find(
      (o) => o.rate_table === table && o.rate_record_id === id && o.override_field === field
    ) || null;
    setEditingCell({ rateTable: table, rateRecordId: id, field, fieldLabel: label, templateValue: templateVal, currentOverride: existing });
  };

  const handleSaveOverride = async (value: number, isLocked: boolean, notes: string) => {
    if (!editingCell) return;
    const res = await fetch(`/api/admin/partners/${orgId}/rate-card/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rate_table: editingCell.rateTable,
        rate_record_id: editingCell.rateRecordId,
        override_field: editingCell.field,
        override_value: value,
        is_locked: isLocked,
        notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) { toast(json.error || "Failed to save", "x"); return; }
    toast("Override saved", "check");
    setEditingCell(null);
    fetchData();
  };

  const handleResetOverride = async () => {
    if (!editingCell?.currentOverride) return;
    const res = await fetch(`/api/admin/partners/${orgId}/rate-card/override`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override_id: editingCell.currentOverride.id }),
    });
    if (!res.ok) { toast("Failed to reset", "x"); return; }
    toast("Reset to template", "check");
    setEditingCell(null);
    fetchData();
  };

  const handleSavePmRate = async (base: number, weekendSurcharge: number) => {
    if (!pmEdit) return;
    const contractRow = data?.pmContract as { id?: unknown } | null | undefined;
    const contractId = typeof contractRow?.id === "string" ? contractRow.id : null;

    if (!pmEdit.rowId) {
      if (!contractId) {
        toast("No portfolio contract on file to save this rate", "x");
        return;
      }
      const res = await fetch(`/api/admin/partners/${orgId}/rate-card/pm-rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          reason_code: pmEdit.reasonCode,
          unit_size: pmEdit.unitSize,
          zone: "local",
          base_rate: base,
          weekend_surcharge: weekendSurcharge,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || "Failed to save", "x");
        return;
      }
      toast("Rate saved", "check");
      setPmEdit(null);
      fetchData();
      return;
    }

    const res = await fetch(`/api/admin/partners/${orgId}/rate-card/pm-rate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row_id: pmEdit.rowId,
        base_rate: base,
        weekend_surcharge: weekendSurcharge,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast(json.error || "Failed to save", "x");
      return;
    }
    toast("Rate updated", "check");
    setPmEdit(null);
    fetchData();
  };

  const handleSaveSettings = async (updates: Record<string, any>) => {
    const res = await fetch(`/api/admin/partners/${orgId}/rate-card`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) { toast("Failed to update settings", "x"); return; }
    toast("Settings updated", "check");
    setSettingsOpen(false);
    fetchData();
  };

  const handleDetach = async () => {
    setDetaching(true);
    try {
      const res = await fetch(`/api/admin/partners/${orgId}/rate-card/detach`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast(`Detached. ${json.overrides_created} rates copied as custom overrides.`, "check");
      setDetachConfirm(false);
      fetchData();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to detach", "x");
    } finally {
      setDetaching(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-[11px] text-[var(--tx3)]">
        Loading rate card…
      </div>
    );
  }

  if (!data) return null;

  const { partner, template, templates, dayRates, deliveryRates, services, overages, zones, volumeBonuses, overrides } = data;
  const portfolioPartner = !!data.portfolioPartner;
  const pmRates = (data.pmRates || []) as PmRateRow[];
  const pmAddons = data.pmAddons || [];
  const pmContract = data.pmContract;
  const pmContractId =
    pmContract && typeof (pmContract as { id?: unknown }).id === "string"
      ? (pmContract as { id: string }).id
      : null;
  const templateKind = template?.template_kind || "delivery";
  const templateSlug = template?.template_slug || "";
  const templateExtras = template?.extras ?? null;
  const isPmTemplate = templateSlug === "property_management";
  const localPmRates = pmRates.filter((r) => (r.zone || "local") === "local");
  const pmFallbackRows = portfolioPartner && isPmTemplate ? pmExtrasToPmRows(templateExtras) : [];
  const showContractMatrix = portfolioPartner && localPmRates.length > 0;
  const showTemplatePmMatrix = portfolioPartner && !showContractMatrix && pmFallbackRows.length > 0;
  const showPortfolioMatrix = showContractMatrix || showTemplatePmMatrix;
  const matrixSourceRows = showContractMatrix ? localPmRates : pmFallbackRows;
  const matrixByReason = new Map<string, Map<string, number>>();
  const matrixWeekendSur = new Map<string, Map<string, number>>();
  const matrixRowIds = new Map<string, Map<string, string>>();
  for (const r of matrixSourceRows) {
    if ((r.zone || "local") !== "local") continue;
    const rc = r.reason_code;
    if (!matrixByReason.has(rc)) matrixByReason.set(rc, new Map());
    matrixByReason.get(rc)!.set(r.unit_size, Number(r.base_rate));
    if (!matrixWeekendSur.has(rc)) matrixWeekendSur.set(rc, new Map());
    matrixWeekendSur.get(rc)!.set(r.unit_size, Number(r.weekend_surcharge ?? 0));
    if (r.id) {
      if (!matrixRowIds.has(rc)) matrixRowIds.set(rc, new Map());
      matrixRowIds.get(rc)!.set(r.unit_size, r.id);
    }
  }
  if (showPortfolioMatrix && !matrixByReason.has("reno_bundle")) {
    matrixByReason.set("reno_bundle", new Map());
    matrixWeekendSur.set("reno_bundle", new Map());
    for (const u of PM_UNIT_ORDER) {
      const b = BUNDLE_RENO_BASE_BY_UNIT[u];
      if (b == null) continue;
      matrixByReason.get("reno_bundle")!.set(u, b);
      matrixWeekendSur.get("reno_bundle")!.set(u, BUNDLE_RENO_WEEKEND_SURCHARGE);
    }
  }
  const matrixReasons = sortPmMatrixReasonCodes([...matrixByReason.keys()]);
  const sampleRow = showContractMatrix ? localPmRates[0] : matrixSourceRows[0];
  const showDayRatesSection = dayRates.length > 0 && (!showPortfolioMatrix || isPmTemplate);
  const showVolumeSection = volumeBonuses.length > 0 && (!showPortfolioMatrix || isPmTemplate);
  const suppressB2bTables = showPortfolioMatrix && !isPmTemplate;
  const discount = partner.global_discount_pct || 0;
  const tierLabel = partner.pricing_tier === "partner" ? "Partner ✦" : "Standard";
  const isDetached = !partner.template_id;
  const hideStatusColumn = templateSlug === "furniture_design";
  const showStatusCol = !hideStatusColumn;

  /* ─── Section header ─── */
  const SectionHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mt-6 mb-2">
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">{label}</div>
      <div className="flex-1 h-px bg-[var(--brd)]/40" />
    </div>
  );

  const TableWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
      <table className="w-full text-[11px]">
        {children}
      </table>
    </div>
  );

  const Th = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`px-3 py-2.5 text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)] ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );

  /* ─── Render ─── */
  const rateCardContextHint = showPortfolioMatrix
    ? showTemplatePmMatrix
      ? "Residential move pricing from the Property & Portfolio template (local zone). Activate a fixed-rate portfolio contract to store partner-specific rates in pm_rate_cards."
      : "Residential move pricing by move reason and unit size (local zone). The partner portal and PM pricing APIs use this matrix, not B2B per-piece delivery rates."
    : templateKind === "referral"
      ? "Referral partners earn commission on completed moves; delivery rate tables do not apply."
      : "Rates shown are base prices for standard access (elevator/ground). Walk-up, long carry, and heavy item surcharges may apply to per-delivery bookings.";

  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
      <div className="flex justify-end mb-3">
        <InfoHint variant="admin" align="end" ariaLabel="About this rate card">
          <p className="text-[11px] leading-relaxed">{rateCardContextHint}</p>
        </InfoHint>
      </div>
      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-1">Rate Card</div>
            <h3 className="font-heading text-[17px] font-bold text-[var(--tx)]">{orgName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--tx2)]">
              {isDetached ? (
                <span className="dt-badge tracking-[0.04em] text-[var(--org)]">
                  Custom rate card (not linked to template)
                </span>
              ) : (
                <>
                  <span><span className="text-[var(--tx3)]">Template:</span> <span className="font-semibold text-[var(--tx)]">{template?.template_name || "-"}</span></span>
                  <span><span className="text-[var(--tx3)]">Tier:</span> <span className="font-semibold text-[var(--accent-text)]">{tierLabel}</span></span>
                  {discount > 0 && (
                    <span><span className="text-[var(--tx3)]">Global discount:</span> <span className="font-semibold text-[var(--grn)]">−{discount}%</span></span>
                  )}
                </>
              )}
            </div>
          </div>
          {canEditRates ? (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--accent-text)] transition-all"
              >
                {isDetached ? "Assign Template" : "Edit Settings"}
              </button>
              {!isDetached && (
                <button
                  type="button"
                  onClick={() => setDetachConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--org)] hover:text-[var(--org)] transition-all"
                >
                  Detach from template
                </button>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-[var(--tx3)] shrink-0 max-w-[220px] text-right">
              Rate edits are limited to super admins.
            </p>
          )}
        </div>
      </div>

      {portfolioPartner && !showPortfolioMatrix && isPmTemplate && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
          No PM move rate matrix on contract{pmContract ? ` (${String((pmContract as { contract_number?: string }).contract_number || "")})` : ""} and no template fallback rows. Activate a fixed-rate portfolio contract (or re-run onboarding) so{" "}
          <span className="font-mono text-[10px]">pm_rate_cards</span> rows are seeded, or assign the Property & Portfolio template.
        </div>
      )}
      {portfolioPartner && !showPortfolioMatrix && !isPmTemplate && (
        <div className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-100">
          No PM move rate matrix found{pmContract ? ` for contract ${String((pmContract as { contract_number?: string }).contract_number || "")}` : ""}.
          Activate a fixed-rate portfolio contract (or re-run onboarding) so <span className="font-mono text-[10px]">pm_rate_cards</span> rows are seeded.
        </div>
      )}

      {templateKind === "referral" && templateExtras && (
        <div className="mb-8 space-y-4 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">Commission structure</div>
          {(() => {
            const cs = templateExtras.commission_structure as Record<string, unknown> | undefined;
            const rt = templateExtras.referral_terms as Record<string, unknown> | undefined;
            const rates = cs?.rates as Record<string, number> | undefined;
            const type = String(cs?.type || "percentage");
            return (
              <>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Tier</th>
                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Commission</th>
                        <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      <tr>
                        <td className="px-3 py-2 font-semibold text-[var(--tx)]">Essential</td>
                        <td className="px-3 py-2 text-[var(--tx)]">{rates?.essential != null ? `${Math.round(rates.essential * 100)}% of move value` : "—"}</td>
                        <td className="px-3 py-2 text-[var(--tx2)]">Move completed and paid</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-[var(--tx)]">Signature</td>
                        <td className="px-3 py-2 text-[var(--tx)]">{rates?.signature != null ? `${Math.round(rates.signature * 100)}% of move value` : "—"}</td>
                        <td className="px-3 py-2 text-[var(--tx2)]">Move completed and paid</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-[var(--tx)]">Estate</td>
                        <td className="px-3 py-2 text-[var(--tx)]">{rates?.estate != null ? `${Math.round(rates.estate * 100)}% of move value` : "—"}</td>
                        <td className="px-3 py-2 text-[var(--tx2)]">Move completed and paid</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-semibold text-[var(--tx)]">Flat per referral</td>
                        <td className="px-3 py-2 text-[var(--tx)]">
                          {cs?.flat_rate != null ? formatCurrency(Number(cs.flat_rate)) : "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--tx2)]">Move completed and paid</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-[var(--tx3)]">
                  Default model: <span className="font-semibold text-[var(--tx2)]">{type === "flat" ? "Flat per referral" : "Percentage-based tiers"}</span>
                  {cs?.note != null ? ` — ${String(cs.note)}` : ""}
                </p>
                {rt && (
                  <div className="rounded-lg border border-[var(--brd)] bg-[var(--bgsub)]/40 px-4 py-3 text-[11px] text-[var(--tx2)] space-y-1">
                    <div className="text-[10px] font-bold uppercase text-[var(--tx3)]">Referral terms</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {rt.referral_code != null && <li>Referral code: {String(rt.referral_code)}</li>}
                      {rt.validity_days != null && <li>Valid for: {String(rt.validity_days)} days from referral date</li>}
                      {rt.payout_schedule != null && <li>Payout: {String(rt.payout_schedule)}</li>}
                      {rt.minimum_payout != null && <li>Minimum payout: {formatCurrency(Number(rt.minimum_payout))} (rolls over if below)</li>}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {isPmTemplate && templateExtras && templateKind === "property_portfolio" && (
        <div className="mb-8 space-y-4">
          {Array.isArray((templateExtras as { surcharges?: unknown }).surcharges) &&
            ((templateExtras as { surcharges: { label: string; value: string }[] }).surcharges.length > 0) && (
            <>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">Template surcharges</div>
              <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Surcharge</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brd)]/30">
                    {(templateExtras as { surcharges: { label: string; value: string }[] }).surcharges.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[var(--tx)]">{row.label}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--tx)]">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {Array.isArray((templateExtras as { additional_services?: unknown }).additional_services) &&
            ((templateExtras as { additional_services: { label: string; value: string }[] }).additional_services.length > 0) && (
            <>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">Template additional services</div>
              <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Service</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brd)]/30">
                    {(templateExtras as { additional_services: { label: string; value: string }[] }).additional_services.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[var(--tx)]">{row.label}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--tx)]">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {Array.isArray((templateExtras as { volume_discounts?: unknown }).volume_discounts) &&
            ((templateExtras as { volume_discounts: { label: string; value: string }[] }).volume_discounts.length > 0) && (
            <>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">Template volume discounts</div>
              <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Monthly volume</th>
                      <th className="px-3 py-2.5 text-right text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">Discount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brd)]/30">
                    {(templateExtras as { volume_discounts: { label: string; value: string }[] }).volume_discounts.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-[var(--tx)]">{row.label}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[var(--tx)]">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {showPortfolioMatrix && (
        <div className="mb-8 space-y-4">
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82">
            Rate card — residential moves (local)
            {showTemplatePmMatrix ? (
              <span className="block mt-1 normal-case font-normal text-[var(--tx3)]">Showing template defaults until contract rates are seeded.</span>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <th className="px-3 py-2.5 text-left text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">
                    Move reason
                  </th>
                  {PM_UNIT_ORDER.map((u) => (
                    <th
                      key={u}
                      className="px-3 py-2.5 text-right text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)] whitespace-nowrap"
                    >
                      {pmUnitHeader(u)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brd)]/30">
                {matrixReasons.map((reason) => {
                  const row = matrixByReason.get(reason)!;
                  const wkndRow = matrixWeekendSur.get(reason);
                  const isBundleRow = reason === "reno_bundle";
                  return (
                    <tr key={reason} className="hover:bg-[var(--bgsub)]/40">
                      <td className="px-3 py-2.5 font-semibold text-[var(--tx)]">
                        {PM_REASON_LABELS[reason] || reason.replace(/_/g, " ")}
                      </td>
                      {PM_UNIT_ORDER.map((u) => {
                        const v = row.get(u);
                        const wkndSur = wkndRow?.get(u) ?? 0;
                        const rowId = matrixRowIds.get(reason)?.get(u);
                        const canClickPm =
                          canEditRates &&
                          v != null &&
                          !Number.isNaN(v) &&
                          (!!rowId || (isBundleRow && !!pmContractId));
                        const openPm = () => {
                          if (!canClickPm) return;
                          setPmEdit({
                            rowId: rowId ?? null,
                            reasonCode: reason,
                            unitLabel: pmUnitHeader(u),
                            unitSize: u,
                            baseRate: v!,
                            weekendSurcharge: wkndSur,
                          });
                        };
                        if (v == null || Number.isNaN(v)) {
                          return (
                            <td key={u} className="px-3 py-2.5 text-right tabular-nums text-[var(--tx3)]">
                              —
                            </td>
                          );
                        }
                        if (isBundleRow) {
                          const we = v + wkndSur;
                          const inner = (
                            <div className="tabular-nums font-medium text-[var(--tx)]">
                              {formatCurrency(we)}
                            </div>
                          );
                          return (
                            <td key={u} className="px-3 py-2.5 text-right">
                              {canClickPm ? (
                                <button
                                  type="button"
                                  onClick={openPm}
                                  className="w-full text-right cursor-pointer hover:bg-[var(--bgsub)]/80 rounded-md py-1.5 -my-1"
                                >
                                  {inner}
                                </button>
                              ) : (
                                inner
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={u} className="px-3 py-2.5 text-right tabular-nums">
                            {canClickPm ? (
                              <button
                                type="button"
                                onClick={openPm}
                                className="w-full text-right font-medium text-[var(--tx)] cursor-pointer hover:bg-[var(--bgsub)]/80 rounded-md py-1.5 -my-1"
                              >
                                {formatCurrency(v)}
                              </button>
                            ) : (
                              <span className="font-medium text-[var(--tx)]">{formatCurrency(v)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sampleRow && (
            <div className="rounded-lg border border-[var(--brd)] bg-[var(--bgsub)]/40 px-4 py-3 text-[11px] text-[var(--tx2)] space-y-1">
              <div>
                <span className="text-[var(--tx3)]">Weekend surcharge:</span>{" "}
                <span className="font-semibold text-[var(--tx)]">+{formatCurrency(Number(sampleRow.weekend_surcharge ?? 0))}</span>
              </div>
              <div>
                <span className="text-[var(--tx3)]">After-hours:</span>{" "}
                <span className="font-semibold text-[var(--tx)]">
                  +{Math.round(Number(sampleRow.after_hours_premium ?? 0) * 100)}%
                </span>
              </div>
              <div>
                <span className="text-[var(--tx3)]">Holiday:</span>{" "}
                <span className="font-semibold text-[var(--tx)]">+{formatCurrency(Number(sampleRow.holiday_surcharge ?? 0))}</span>
              </div>
              <div className="text-[10px] text-[var(--tx3)] pt-1">
                Mobilization and other contract add-ons appear below when configured on the contract.
              </div>
            </div>
          )}
          {pmAddons.length > 0 && (
            <div className="rounded-lg border border-[var(--brd)] overflow-hidden">
              <div className="px-3 py-2 text-[9px] font-bold uppercase text-[var(--tx3)] bg-[var(--bgsub)] border-b border-[var(--brd)]">
                Contract add-ons
              </div>
              <ul className="divide-y divide-[var(--brd)]/30">
                {pmAddons.map((a) => (
                  <li key={a.addon_code} className="px-3 py-2 flex justify-between text-[11px]">
                    <span className="text-[var(--tx)]">{a.label}</span>
                    <span className="font-semibold text-[var(--tx)]">{formatCurrency(a.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* No template assigned */}
      {isDetached && overrides.length === 0 && !showPortfolioMatrix && (
        <div className="text-center py-10 text-[12px] text-[var(--tx3)]">
          No rate card configured yet.<br />
          <button onClick={() => setSettingsOpen(true)} className="mt-2 text-[var(--accent-text)] hover:underline font-semibold">
            Assign a template
          </button>{" "}to get started, or the partner will use the legacy per-org rate card.
        </div>
      )}

      {/* Day Rates */}
      {showDayRatesSection && (
        <>
          <SectionHead label="Day Rates" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th>Tier</Th>
                <Th right>Full Day</Th>
                <Th right>Half Day</Th>
                <Th right>Stops (Full)</Th>
                <Th right>Stops (Half)</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {dayRates.map((r) => {
                const fd = eff("day_rates", r.id, "full_day_price", r.full_day_price);
                const hd = eff("day_rates", r.id, "half_day_price", r.half_day_price);
                const hasOverride = fd.source === "override" || hd.source === "override";
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">
                      {VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <RateCell value={fd.value} source={fd.source} override={fd.override} onClick={canEditRates ? () => openCell("day_rates", r.id, "full_day_price", `${VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type} Full Day`, r.full_day_price) : undefined} />
                    <RateCell value={hd.value} source={hd.source} override={hd.override} onClick={canEditRates ? () => openCell("day_rates", r.id, "half_day_price", `${VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type} Half Day`, r.half_day_price) : undefined} />
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--tx)]">{r.stops_included_full}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] tabular-nums text-[var(--tx)]">{r.stops_included_half}</td>
                    {showStatusCol ? (
                      <td className="px-3 py-2.5">
                        {hasOverride ? (
                          <StatusBadge source="override" isLocked={[fd.override, hd.override].some((o) => o?.is_locked)} />
                        ) : (
                          <span className="text-[9px] text-[var(--tx3)]">
                            {discount > 0 ? `Template (−${discount}%)` : "Template"}
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Overages */}
      {!suppressB2bTables && overages.length > 0 && (
        <>
          <SectionHead label="Stop Overages" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Overage</Th>
                <Th>Tier</Th>
                <Th right>Rate</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {overages.map((r) => {
                const ps = eff("overages", r.id, "price_per_stop", r.price_per_stop);
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx)]">{OVERAGE_TIER_LABELS[r.overage_tier] || r.overage_tier}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <RateCell value={ps.value} source={ps.source} override={ps.override} onClick={canEditRates ? () => openCell("overages", r.id, "price_per_stop", `Overage: ${OVERAGE_TIER_LABELS[r.overage_tier] || r.overage_tier}`, r.price_per_stop) : undefined} />
                    {showStatusCol ? (
                      <td className="px-3 py-2.5">
                        <StatusBadge source={ps.source} isLocked={ps.override?.is_locked} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Per-Delivery Rates */}
      {!suppressB2bTables && deliveryRates.length > 0 && (
        <>
          <SectionHead label="Per-Delivery Rates" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Tier</Th>
                <Th>Zone</Th>
                <Th right>Price Min</Th>
                <Th right>Price Max</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {deliveryRates.map((r) => {
                const pm = eff("delivery_rates", r.id, "price_min", r.price_min);
                const pmx = r.price_max != null ? eff("delivery_rates", r.id, "price_max", r.price_max) : null;
                const hasOverride = pm.source === "override" || pmx?.source === "override";
                const isQuote = r.delivery_type === "med_imaging" && Number(r.price_min) === 0;
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">Zone {r.zone}</td>
                    {isQuote ? (
                      <>
                        <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-[var(--tx2)]">Quote</td>
                        <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">—</td>
                      </>
                    ) : (
                      <>
                        <RateCell value={pm.value} source={pm.source} override={pm.override} onClick={canEditRates ? () => openCell("delivery_rates", r.id, "price_min", `${DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Z${r.zone} Min`, r.price_min) : undefined} />
                        {pmx ? (
                          <RateCell value={pmx.value} source={pmx.source} override={pmx.override} onClick={canEditRates ? () => openCell("delivery_rates", r.id, "price_max", `${DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Z${r.zone} Max`, r.price_max!) : undefined} />
                        ) : (
                          <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">-</td>
                        )}
                      </>
                    )}
                    {showStatusCol ? (
                      <td className="px-3 py-2.5">
                        <StatusBadge source={hasOverride ? "override" : pm.source} isLocked={[pm.override, pmx?.override].some((o) => o?.is_locked)} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Zones */}
      {!suppressB2bTables && zones.length > 0 && (
        <>
          <SectionHead label="Zones" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Zone</Th>
                <Th>Name</Th>
                <Th>Tier</Th>
                <Th>Distance</Th>
                <Th>Description</Th>
                <Th right>Surcharge</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {zones.map((r) => {
                const sc = eff("zones", r.id, "surcharge", r.surcharge);
                const minK = r.distance_min_km != null ? Number(r.distance_min_km) : null;
                const maxK = r.distance_max_km != null ? Number(r.distance_max_km) : null;
                const dist =
                  minK != null && !Number.isNaN(minK)
                    ? maxK != null && !Number.isNaN(maxK)
                      ? `${minK}–${maxK} km`
                      : `${minK}+ km`
                    : "—";
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">Zone {r.zone_number}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx2)]">{r.zone_name}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)] whitespace-nowrap">{dist}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx2)] max-w-[220px]">{r.coverage_areas || "—"}</td>
                    <RateCell value={sc.value} source={sc.source} override={sc.override} onClick={canEditRates ? () => openCell("zones", r.id, "surcharge", `Zone ${r.zone_number} Surcharge`, r.surcharge) : undefined} />
                    {showStatusCol ? (
                      <td className="px-3 py-2.5">
                        <StatusBadge source={sc.source} isLocked={sc.override?.is_locked} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Services */}
      {!suppressB2bTables && services.filter((s) => s.price_unit !== "percentage").length > 0 && (
        <>
          <SectionHead label="Add-On Services" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Tier</Th>
                <Th>Unit</Th>
                <Th right>Price Min</Th>
                <Th right>Price Max</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {services.filter((s) => s.price_unit !== "percentage").map((r) => {
                const pm = r.price_min > 0 ? eff("services", r.id, "price_min", r.price_min) : null;
                const pmx = r.price_max != null ? eff("services", r.id, "price_max", r.price_max) : null;
                const hasOverride = pm?.source === "override" || pmx?.source === "override";
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{r.service_name}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)] uppercase">{r.price_unit.replace(/_/g, " ")}</td>
                    {pm ? (
                      <RateCell value={pm.value} source={pm.source} override={pm.override} onClick={canEditRates ? () => openCell("services", r.id, "price_min", `${r.service_name} Min`, r.price_min) : undefined} />
                    ) : (
                      <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">Incl.</td>
                    )}
                    {pmx ? (
                      <RateCell value={pmx.value} source={pmx.source} override={pmx.override} onClick={canEditRates ? () => openCell("services", r.id, "price_max", `${r.service_name} Max`, r.price_max!) : undefined} />
                    ) : (
                      <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">-</td>
                    )}
                    {showStatusCol ? (
                      <td className="px-3 py-2.5">
                        <StatusBadge source={hasOverride ? "override" : (pm?.source ?? "template")} isLocked={[pm?.override, pmx?.override].some((o) => o?.is_locked)} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Surcharge services (percentage) */}
      {!suppressB2bTables && services.filter((s) => s.price_unit === "percentage").length > 0 && (
        <>
          <SectionHead label="Surcharges (% of Base)" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Surcharge</Th>
                <Th>Tier</Th>
                <Th right>Rate (%)</Th>
                {showStatusCol ? <Th>Status</Th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {services.filter((s) => s.price_unit === "percentage").map((r) => {
                const pm = eff("services", r.id, "price_min", r.price_min);
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{r.service_name}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">{pricingTierLabel(r.pricing_tier)}</td>
                    <td
                      onClick={canEditRates ? () => openCell("services", r.id, "price_min", `${r.service_name} (%)`, r.price_min) : undefined}
                      className={`px-3 py-2.5 text-right text-[11px] ${canEditRates ? "cursor-pointer hover:bg-[var(--bgsub)] transition-colors" : ""}`}
                    >
                      <span className={pm.source === "override" ? "text-[var(--accent-text)] font-bold" : "text-[var(--tx)]"}>
                        {pm.value}%{pm.source === "override" && <span className="ml-0.5 text-[9px]">✦</span>}
                      </span>
                    </td>
                    {showStatusCol ? (
                      <td className="px-3 py-2.5"><StatusBadge source={pm.source} isLocked={pm.override?.is_locked} /></td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Volume Bonuses */}
      {showVolumeSection && (
        <>
          <SectionHead label="Volume Bonuses" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Deliveries / Month</Th>
                <Th right>Discount</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {volumeBonuses.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5 text-[11px] text-[var(--tx)]">
                    {r.min_deliveries}{r.max_deliveries ? `–${r.max_deliveries}` : "+"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] font-semibold text-[var(--grn)]">
                    {r.discount_pct > 0 ? `${r.discount_pct}% off` : "Base rate"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Overrides count pill */}
      {overrides.length > 0 && (
        <div className="mt-4 text-[10px] text-[var(--tx3)] text-right">
          {overrides.length} custom override{overrides.length !== 1 ? "s" : ""} active
          {overrides.filter((o) => o.is_locked).length > 0 && (
            <span className="ml-1 text-[var(--accent-text)]">· {overrides.filter((o) => o.is_locked).length} locked ✦</span>
          )}
        </div>
      )}

      {/* Modals */}
      {editingCell && (
        <EditOverrideModal
          cell={editingCell}
          discount={discount}
          onSave={handleSaveOverride}
          onReset={handleResetOverride}
          onClose={() => setEditingCell(null)}
        />
      )}

      {pmEdit && (
        <PmRateEditModal
          state={pmEdit}
          onSave={handleSavePmRate}
          onClose={() => setPmEdit(null)}
        />
      )}

      {settingsOpen && (
        <RateCardSettingsModal
          partner={partner}
          templates={templates}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {detachConfirm && (
        <ModalOverlay open onClose={() => setDetachConfirm(false)} title="Detach from template?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
              This will copy all template rates as individual overrides for{" "}
              <strong className="text-[var(--tx)]">{orgName}</strong>. Template updates will no longer affect this partner.
            </p>
            <p className="text-[11px] text-[var(--tx3)] bg-[var(--bgsub)] rounded-lg p-3">
              This is intended for large enterprise accounts that need fully independent pricing. You can still edit every rate individually after detaching.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDetachConfirm(false)} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
                Cancel
              </button>
              <button
                onClick={handleDetach}
                disabled={detaching}
                className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--org)] text-white disabled:opacity-50"
              >
                {detaching ? "Detaching…" : "Detach from Template"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
