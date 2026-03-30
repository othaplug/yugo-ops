"use client";

import { useState, useEffect, useCallback } from "react";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatCurrency } from "@/lib/format-currency";

/* ─── Types ─── */

interface RateCardPartner {
  id: string; name: string; type?: string;
  pricing_tier: "standard" | "partner";
  template_id: string | null; global_discount_pct: number; rates_locked: boolean;
}
interface RateTemplate { id: string; template_name: string; template_slug: string; is_active: boolean; }
interface DayRate { id: string; vehicle_type: string; full_day_price: number; half_day_price: number; stops_included_full: number; stops_included_half: number; pricing_tier: string; }
interface DeliveryRate { id: string; delivery_type: string; zone: number; price_min: number; price_max?: number | null; pricing_tier: string; }
interface Service { id: string; service_slug: string; service_name: string; price_min: number; price_max?: number | null; price_unit: string; pricing_tier: string; }
interface Overage { id: string; overage_tier: string; price_per_stop: number; pricing_tier: string; }
interface Zone { id: string; zone_number: number; zone_name: string; surcharge: number; pricing_tier: string; }
interface VolumeBonus { id: string; min_deliveries: number; max_deliveries?: number | null; discount_pct: number; }
interface Override { id: string; rate_table: string; rate_record_id: string; override_field: string; override_value: number; is_locked: boolean; notes?: string | null; }

interface RateCardData {
  partner: RateCardPartner;
  template: RateTemplate | null;
  templates: RateTemplate[];
  dayRates: DayRate[]; deliveryRates: DeliveryRate[];
  services: Service[]; overages: Overage[]; zones: Zone[]; volumeBonuses: VolumeBonus[];
  overrides: Override[];
  mode: "template" | "no_template" | "detached";
}

interface EditingCell {
  rateTable: string; rateRecordId: string; field: string; fieldLabel: string;
  templateValue: number; currentOverride: Override | null;
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
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${isLocked ? "bg-[var(--gdim)] text-[var(--gold)]" : "bg-[var(--bldim)] text-[var(--blue)]"}`}>
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
  sprinter: "Sprinter", "16ft": "16ft", "20ft": "20ft", "26ft": "26ft",
};
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  single_item: "Single Item", multi_piece: "Multi-Piece", full_room: "Full Room Setup",
  multi_stop: "Multi-Stop", curbside: "Curbside Drop", oversized: "Oversized/Fragile",
  day_rate: "Day Rate", b2b: "B2B", b2b_delivery: "B2B", delivery: "Standard Delivery",
  designer: "Designer", retail: "Retail", hospitality: "Hospitality", gallery: "Gallery", project: "Project",
};
const OVERAGE_TIER_LABELS: Record<string, string> = {
  full_7_10: "Full Day 7–10 stops", full_11_plus: "Full Day 11+",
  half_4_6: "Half Day 4–6 stops", half_7_plus: "Half Day 7+",
};

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
            className="w-full px-3 py-2 text-[13px] font-semibold bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]"
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
            className="w-full px-3 py-2 text-[11px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)]"
          />
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
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
            className="w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]"
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
                    ? "bg-[var(--gold)] border-[var(--gold)] text-white"
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
            className="w-full px-3 py-2 text-[12px] bg-[var(--bgsub)] border border-[var(--brd)] rounded-lg focus:outline-none focus:border-[var(--brd)] text-[var(--tx)]"
          />
          <p className="text-[9px] text-[var(--tx3)] mt-1">Applied to all template rates. Overridden cells use their custom value instead.</p>
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
      <span className={isOverride ? "text-[var(--gold)] font-bold" : ""}>
        {formatCurrency(value)}{isOverride && <span className="ml-0.5 text-[9px]">✦</span>}
      </span>
    </td>
  );
}

/* ─── Main Component ─── */

export default function PartnerRateCardTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<RateCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
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
    if (!data) return;
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
  const discount = partner.global_discount_pct || 0;
  const tierLabel = partner.pricing_tier === "partner" ? "Partner ✦" : "Standard";
  const isDetached = !partner.template_id;

  /* ─── Section header ─── */
  const SectionHead = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mt-6 mb-2">
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">{label}</div>
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
  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
      <p className="text-[11px] text-[var(--tx3)] mb-4">
        Rates shown are base prices for standard access (elevator/ground). Walk-up, long carry, and heavy item surcharges may apply to per-delivery bookings.
      </p>
      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 mb-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60 mb-1">Rate Card</div>
            <h3 className="font-heading text-[17px] font-bold text-[var(--tx)]">{orgName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--tx2)]">
              {isDetached ? (
                <span className="px-2 py-0.5 rounded bg-[var(--bgsub)] border border-[var(--brd)] text-[9px] font-semibold text-[var(--org)]">
                  Custom rate card (not linked to template)
                </span>
              ) : (
                <>
                  <span><span className="text-[var(--tx3)]">Template:</span> <span className="font-semibold text-[var(--tx)]">{template?.template_name || "-"}</span></span>
                  <span><span className="text-[var(--tx3)]">Tier:</span> <span className="font-semibold text-[var(--gold)]">{tierLabel}</span></span>
                  {discount > 0 && (
                    <span><span className="text-[var(--tx3)]">Global discount:</span> <span className="font-semibold text-[var(--grn)]">−{discount}%</span></span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setSettingsOpen(true)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
            >
              {isDetached ? "Assign Template" : "Edit Settings"}
            </button>
            {!isDetached && (
              <button
                onClick={() => setDetachConfirm(true)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--org)] hover:text-[var(--org)] transition-all"
              >
                Detach from template
              </button>
            )}
          </div>
        </div>
      </div>

      {/* No template assigned */}
      {isDetached && overrides.length === 0 && (
        <div className="text-center py-10 text-[12px] text-[var(--tx3)]">
          No rate card configured yet.<br />
          <button onClick={() => setSettingsOpen(true)} className="mt-2 text-[var(--gold)] hover:underline font-semibold">
            Assign a template
          </button>{" "}to get started, or the partner will use the legacy per-org rate card.
        </div>
      )}

      {/* Day Rates */}
      {dayRates.length > 0 && (
        <>
          <SectionHead label="Day Rates" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Vehicle</Th>
                <Th right>Full Day</Th>
                <Th right>Half Day</Th>
                <Th>Status</Th>
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
                    <RateCell value={fd.value} source={fd.source} override={fd.override} onClick={() => openCell("day_rates", r.id, "full_day_price", `${VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type} Full Day`, r.full_day_price)} />
                    <RateCell value={hd.value} source={hd.source} override={hd.override} onClick={() => openCell("day_rates", r.id, "half_day_price", `${VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type} Half Day`, r.half_day_price)} />
                    <td className="px-3 py-2.5">
                      {hasOverride ? (
                        <StatusBadge source="override" isLocked={[fd.override, hd.override].some((o) => o?.is_locked)} />
                      ) : (
                        <span className="text-[9px] text-[var(--tx3)]">
                          {discount > 0 ? `Template (−${discount}%)` : "Template"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Overages */}
      {overages.length > 0 && (
        <>
          <SectionHead label="Stop Overages" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Tier</Th>
                <Th right>Per Stop</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {overages.map((r) => {
                const ps = eff("overages", r.id, "price_per_stop", r.price_per_stop);
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx)]">{OVERAGE_TIER_LABELS[r.overage_tier] || r.overage_tier}</td>
                    <RateCell value={ps.value} source={ps.source} override={ps.override} onClick={() => openCell("overages", r.id, "price_per_stop", `Overage: ${OVERAGE_TIER_LABELS[r.overage_tier] || r.overage_tier}`, r.price_per_stop)} />
                    <td className="px-3 py-2.5">
                      <StatusBadge source={ps.source} isLocked={ps.override?.is_locked} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Per-Delivery Rates */}
      {deliveryRates.length > 0 && (
        <>
          <SectionHead label="Per-Delivery Rates" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Zone</Th>
                <Th right>Price Min</Th>
                <Th right>Price Max</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {deliveryRates.map((r) => {
                const pm = eff("delivery_rates", r.id, "price_min", r.price_min);
                const pmx = r.price_max != null ? eff("delivery_rates", r.id, "price_max", r.price_max) : null;
                const hasOverride = pm.source === "override" || pmx?.source === "override";
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)]">Zone {r.zone}</td>
                    <RateCell value={pm.value} source={pm.source} override={pm.override} onClick={() => openCell("delivery_rates", r.id, "price_min", `${DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Z${r.zone} Min`, r.price_min)} />
                    {pmx ? (
                      <RateCell value={pmx.value} source={pmx.source} override={pmx.override} onClick={() => openCell("delivery_rates", r.id, "price_max", `${DELIVERY_TYPE_LABELS[r.delivery_type] ?? (r.delivery_type as string).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Z${r.zone} Max`, r.price_max!)} />
                    ) : (
                      <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">-</td>
                    )}
                    <td className="px-3 py-2.5">
                      <StatusBadge source={hasOverride ? "override" : pm.source} isLocked={[pm.override, pmx?.override].some((o) => o?.is_locked)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Zones */}
      {zones.filter((z) => z.surcharge > 0).length > 0 && (
        <>
          <SectionHead label="Zone Surcharges" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Zone</Th>
                <Th>Name</Th>
                <Th right>Surcharge</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {zones.filter((z) => z.surcharge > 0).map((r) => {
                const sc = eff("zones", r.id, "surcharge", r.surcharge);
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">Zone {r.zone_number}</td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--tx2)]">{r.zone_name}</td>
                    <RateCell value={sc.value} source={sc.source} override={sc.override} onClick={() => openCell("zones", r.id, "surcharge", `Zone ${r.zone_number} Surcharge`, r.surcharge)} />
                    <td className="px-3 py-2.5">
                      <StatusBadge source={sc.source} isLocked={sc.override?.is_locked} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Services */}
      {services.filter((s) => s.price_unit !== "percentage").length > 0 && (
        <>
          <SectionHead label="Add-On Services" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Service</Th>
                <Th>Unit</Th>
                <Th right>Price Min</Th>
                <Th right>Price Max</Th>
                <Th>Status</Th>
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
                    <td className="px-3 py-2.5 text-[10px] text-[var(--tx3)] uppercase">{r.price_unit.replace(/_/g, " ")}</td>
                    {pm ? (
                      <RateCell value={pm.value} source={pm.source} override={pm.override} onClick={() => openCell("services", r.id, "price_min", `${r.service_name} Min`, r.price_min)} />
                    ) : (
                      <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">Incl.</td>
                    )}
                    {pmx ? (
                      <RateCell value={pmx.value} source={pmx.source} override={pmx.override} onClick={() => openCell("services", r.id, "price_max", `${r.service_name} Max`, r.price_max!)} />
                    ) : (
                      <td className="px-3 py-2.5 text-right text-[11px] text-[var(--tx3)]">-</td>
                    )}
                    <td className="px-3 py-2.5">
                      <StatusBadge source={hasOverride ? "override" : (pm?.source ?? "template")} isLocked={[pm?.override, pmx?.override].some((o) => o?.is_locked)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Surcharge services (percentage) */}
      {services.filter((s) => s.price_unit === "percentage").length > 0 && (
        <>
          <SectionHead label="Surcharges (% of Base)" />
          <TableWrapper>
            <thead>
              <tr><Th>Surcharge</Th><Th right>Rate (%)</Th><Th>Status</Th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--brd)]/30">
              {services.filter((s) => s.price_unit === "percentage").map((r) => {
                const pm = eff("services", r.id, "price_min", r.price_min);
                return (
                  <tr key={r.id} className="hover:bg-[var(--bgsub)]/50 transition-colors">
                    <td className="px-3 py-2.5 text-[11px] font-semibold text-[var(--tx)]">{r.service_name}</td>
                    <td
                      onClick={() => openCell("services", r.id, "price_min", `${r.service_name} (%)`, r.price_min)}
                      className="px-3 py-2.5 text-right text-[11px] cursor-pointer hover:bg-[var(--bgsub)] transition-colors"
                    >
                      <span className={pm.source === "override" ? "text-[var(--gold)] font-bold" : "text-[var(--tx)]"}>
                        {pm.value}%{pm.source === "override" && <span className="ml-0.5 text-[9px]">✦</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge source={pm.source} isLocked={pm.override?.is_locked} /></td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrapper>
        </>
      )}

      {/* Volume Bonuses */}
      {volumeBonuses.length > 0 && (
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
            <span className="ml-1 text-[var(--gold)]">· {overrides.filter((o) => o.is_locked).length} locked ✦</span>
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
