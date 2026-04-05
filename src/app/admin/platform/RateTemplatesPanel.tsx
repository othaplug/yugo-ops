"use client";

import { useState, useEffect, useCallback } from "react";
import { organizationTypeLabel, VERTICAL_LABELS } from "@/lib/partner-type";
import ModalOverlay from "../components/ModalOverlay";
import CreateButton from "../components/CreateButton";
import { useToast } from "../components/Toast";
import { formatPlatformDisplay } from "@/lib/date-format";

/* ─── Types ─── */

interface RateTemplate {
  id: string; template_name: string; template_slug: string;
  description?: string; verticals_covered?: string[];
  is_active: boolean; partner_count: number;
  created_at: string; updated_at: string;
  template_kind?: string | null;
  extras?: Record<string, unknown> | null;
}

interface TemplateRates {
  template: RateTemplate;
  dayRates: any[]; deliveryRates: any[]; services: any[];
  overages: any[]; zones: any[]; volumeBonuses: any[];
  partners: any[];
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
  hosp_piece_chair: "Per piece (chairs, small)",
  hosp_piece_table: "Per piece (tables, large)",
  hosp_piece_kitchen: "Per piece (kitchen, heavy)",
  hosp_booth: "Booth / banquette",
  hosp_pos: "POS / electronics",
  hosp_display: "Display case",
  med_equipment_small: "Small equipment (<50 lbs)",
  med_equipment_medium: "Medium equipment (50–200 lbs)",
  med_equipment_large: "Large equipment (200–500 lbs)",
  med_equipment_heavy: "Heavy equipment (500+ lbs)",
  med_server_rack: "Server rack / data cabinet",
  med_imaging: "Imaging equipment",
};
const OVERAGE_LABELS: Record<string, string> = {
  full_7_10: "Full Day 7–10 stops",
  full_11_plus: "Full Day 11+",
  half_4_6: "Half Day 4–6 stops",
  half_7_plus: "Half Day 7+",
  art_extra_stop: "Extra stop (beyond included)",
  art_wait_30min: "Wait time (beyond 15 min at stop)",
  art_crew_hourly: "Additional crew member",
  art_stairs_flight: "Stairs (per flight, no elevator)",
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
      day_rates: [],
      delivery_rates: [],
      services: [],
      overages: [],
      zones: [],
      volume_bonuses: [],
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
    for (const r of data.volumeBonuses || []) {
      const d = getVal("volume_bonuses", r.id, "discount_pct", Number(r.discount_pct));
      if (d !== Number(r.discount_pct)) rates.volume_bonuses.push({ id: r.id, discount_pct: d });
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

  const templateKind = data.template.template_kind || "delivery";

  if (templateKind === "referral") {
    const ex = data.template.extras || {};
    const cs = ex.commission_structure as Record<string, unknown> | undefined;
    const rt = ex.referral_terms as Record<string, unknown> | undefined;
    const rates = cs?.rates as Record<string, number> | undefined;
    return (
      <ModalOverlay open onClose={onClose} title={`Edit: ${data.template.template_name}`} maxWidth="lg">
        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: "75vh" }}>
          <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
            Referral partners use commission structures instead of delivery rates. Commission JSON lives on the template; use the SQL editor or a future admin tool to change it.
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
            <table className="w-full text-[11px]">
              <thead>
                <tr>
                  <Th>Tier</Th>
                  <Th>Commission</Th>
                  <Th>Trigger</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--brd)]/30">
                <tr>
                  <td className="px-2 py-2 font-semibold text-[var(--tx)]">Essential</td>
                  <td className="px-2 py-2 text-[var(--tx)]">{rates?.essential != null ? `${Math.round(rates.essential * 100)}% of move value` : "—"}</td>
                  <td className="px-2 py-2 text-[var(--tx2)]">Move completed and paid</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-semibold text-[var(--tx)]">Signature</td>
                  <td className="px-2 py-2 text-[var(--tx)]">{rates?.signature != null ? `${Math.round(rates.signature * 100)}% of move value` : "—"}</td>
                  <td className="px-2 py-2 text-[var(--tx2)]">Move completed and paid</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-semibold text-[var(--tx)]">Estate</td>
                  <td className="px-2 py-2 text-[var(--tx)]">{rates?.estate != null ? `${Math.round(rates.estate * 100)}% of move value` : "—"}</td>
                  <td className="px-2 py-2 text-[var(--tx2)]">Move completed and paid</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-semibold text-[var(--tx)]">Flat per referral</td>
                  <td className="px-2 py-2 text-[var(--tx)]">{cs?.flat_rate != null ? `$${Number(cs.flat_rate)}` : "—"}</td>
                  <td className="px-2 py-2 text-[var(--tx2)]">Move completed and paid</td>
                </tr>
              </tbody>
            </table>
          </div>
          {rt && (
            <ul className="text-[11px] text-[var(--tx2)] space-y-1 list-disc pl-4">
              {rt.referral_code != null && <li>Referral code: {String(rt.referral_code)}</li>}
              {rt.validity_days != null && <li>Valid for: {String(rt.validity_days)} days from referral date</li>}
              {rt.payout_schedule != null && <li>Payout: {String(rt.payout_schedule)}</li>}
              {rt.minimum_payout != null && <li>Minimum payout: ${Number(rt.minimum_payout)} (rolls over if below)</li>}
            </ul>
          )}
        </div>
        <div className="border-t border-[var(--brd)] p-4 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
            Close
          </button>
        </div>
      </ModalOverlay>
    );
  }

  if (templateKind === "property_portfolio") {
    const ex = (data.template.extras || {}) as Record<string, unknown>;
    const moveRates = Array.isArray(ex.move_rates) ? (ex.move_rates as Record<string, unknown>[]) : [];
    const surcharges = Array.isArray(ex.surcharges) ? (ex.surcharges as { label: string; value: string }[]) : [];
    const addl = Array.isArray(ex.additional_services) ? (ex.additional_services as { label: string; value: string }[]) : [];
    const volDisc = Array.isArray(ex.volume_discounts) ? (ex.volume_discounts as { label: string; value: string }[]) : [];
    const unitCols = ["studio", "1br", "2br", "3br", "4br_plus"] as const;
    const hdr = (u: string) =>
      u === "studio" ? "Studio" : u === "1br" ? "1 BR" : u === "2br" ? "2 BR" : u === "3br" ? "3 BR" : "4 BR+";
    return (
      <>
        <ModalOverlay open onClose={onClose} title={`Edit: ${data.template.template_name}`} maxWidth="lg">
          <div className="flex flex-col" style={{ maxHeight: "80vh" }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div>
              <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Move rates by unit size</h3>
              <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <Th>Move reason</Th>
                      {unitCols.map((u) => (
                        <Th key={u}>{hdr(u)}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--brd)]/30">
                    {moveRates.map((row, i) => (
                      <tr key={String(row.reason_code ?? i)}>
                        <td className="px-2 py-2 font-semibold text-[var(--tx)]">{String(row.label || row.reason_code || "—")}</td>
                        {unitCols.map((u) => {
                          const v = row[u];
                          const n = typeof v === "number" ? v : v != null ? parseFloat(String(v)) : NaN;
                          return (
                            <td key={u} className="px-2 py-2 text-right tabular-nums text-[var(--tx)]">
                              {!Number.isNaN(n) ? `$${n}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {surcharges.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Surcharges</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <Th>Surcharge</Th>
                        <Th>Amount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {surcharges.map((s, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2 text-[var(--tx)]">{s.label}</td>
                          <td className="px-2 py-2 text-right font-semibold text-[var(--tx)]">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {addl.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Additional services</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <Th>Service</Th>
                        <Th>Price</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {addl.map((s, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2 text-[var(--tx)]">{s.label}</td>
                          <td className="px-2 py-2 text-right font-semibold text-[var(--tx)]">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {volDisc.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Volume discounts (reference)</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <Th>Volume</Th>
                        <Th>Discount</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {volDisc.map((s, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2 text-[var(--tx)]">{s.label}</td>
                          <td className="px-2 py-2 text-right font-semibold text-[var(--tx)]">{s.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div>
              <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Day rates (crew for a day)</h3>
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
                        <td className="px-2 py-2 font-semibold text-[var(--tx)]">{VEHICLE_LABELS[r.vehicle_type] || r.vehicle_type}</td>
                        <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
                        <EditableCell table="day_rates" id={r.id} field="full_day_price" original={r.full_day_price} />
                        <EditableCell table="day_rates" id={r.id} field="half_day_price" original={r.half_day_price} />
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)] text-center">{r.stops_included_full}</td>
                        <td className="px-2 py-2 text-[11px] text-[var(--tx3)] text-center">{r.stops_included_half}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {data.volumeBonuses.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold uppercase text-[var(--tx3)] mb-2">Volume tiers (% discount)</h3>
                <p className="text-[10px] text-[var(--tx3)] mb-2">Editable rows sync to partner rate cards; narrative above is reference-only.</p>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <Th>Min deliveries</Th>
                        <Th>Max</Th>
                        <Th>Discount %</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {data.volumeBonuses.map((r) => (
                        <tr key={r.id}>
                          <td className="px-2 py-2 text-[var(--tx)]">{r.min_deliveries}</td>
                          <td className="px-2 py-2 text-[var(--tx)]">{r.max_deliveries ?? "—"}</td>
                          <EditableCell table="volume_bonuses" id={r.id} field="discount_pct" original={r.discount_pct} isPercent />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--brd)] p-4 flex justify-between items-center gap-3">
            <div className="text-[10px] text-[var(--tx3)]">{data.template.partner_count} partner(s) on this template</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
        </ModalOverlay>
        {confirmOpen && (
          <ModalOverlay open onClose={() => setConfirmOpen(false)} title="Confirm template update" maxWidth="sm">
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
                This will update <strong className="text-[var(--tx)]">{data.template.template_name}</strong> template rates and affect{" "}
                <strong className="text-[var(--tx)]">{data.template.partner_count}</strong> partner(s).
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 py-2 rounded-lg text-[11px] border border-[var(--brd)] text-[var(--tx2)]">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirmSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50">
                  {saving ? "Saving…" : "Confirm & Save"}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}
      </>
    );
  }

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
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
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
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
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
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.price_unit.replace(/_/g, " ")}</td>
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
                  <tr><Th>Overage</Th><Th>Tier</Th><Th>Rate</Th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--brd)]/30">
                  {data.overages.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-[11px] font-semibold text-[var(--tx)]">{OVERAGE_LABELS[r.overage_tier] || r.overage_tier}</td>
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
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
                      <td className="px-2 py-2 text-[10px] text-[var(--tx3)] uppercase">{r.pricing_tier}</td>
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
              className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50"
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
              <button onClick={handleConfirmSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50">
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
          <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50">
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
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-white disabled:opacity-50">
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
                  <div className="text-[10px] text-[var(--tx3)]">{organizationTypeLabel(p.type)}</div>
                </div>
                <span className={`dt-badge tracking-[0.04em] ${p.pricing_tier === "partner" ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
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

export default function RateTemplatesPanel({ isSuperAdmin = false }: { isSuperAdmin?: boolean } = {}) {
  void isSuperAdmin;
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
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 md:mb-8">
        <div className="min-w-0">
          <h2 className="admin-section-h2 text-[clamp(1.125rem,2vw,1.35rem)]">Rate Card Templates</h2>
          <p className="text-[12px] md:text-[13px] text-[var(--tx3)] mt-1.5 max-w-2xl leading-relaxed">
            Industry templates applied to partners. Changes affect all partners on the template.
          </p>
        </div>
        <CreateButton onClick={() => setCreateOpen(true)} title="New Template" />
      </div>

      <div className="space-y-5 md:space-y-6">
        {templates.map((t) => (
          <div
            key={t.id}
            className="border border-[var(--brd)] rounded-2xl p-6 md:p-8 lg:p-10 bg-[var(--card)] w-full min-h-44 md:min-h-48 shadow-sm shadow-black/5"
          >
            {/* Top row: name + status badge */}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-heading font-bold text-[17px] md:text-[19px] text-[var(--tx)] leading-tight">{t.template_name}</span>
              <span className={`dt-badge ${t.is_active ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
                {t.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {/* Meta row */}
            {t.description && (
              <p className="text-[12px] md:text-[13px] text-[var(--tx3)] mb-4 leading-relaxed line-clamp-3 md:line-clamp-none max-w-4xl">
                {t.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] md:text-[12px] text-[var(--tx3)] mb-5">
              <span>{t.verticals_covered?.length || 0} verticals</span>
              <span className="text-[var(--brd)]">·</span>
              <button onClick={() => handleViewPartners(t.id)} className="text-[var(--gold)] hover:underline font-semibold">
                {loadingId === t.id + "_p" ? "Loading…" : `${t.partner_count} partner${t.partner_count !== 1 ? "s" : ""}`}
              </button>
              <span className="text-[var(--brd)]">·</span>
              <span>Updated {formatPlatformDisplay(t.updated_at, { month: "short", day: "numeric" })}</span>
            </div>
            {/* Action buttons row, full-width on mobile */}
            <div className="flex flex-wrap gap-2.5 md:gap-3">
              <button
                onClick={() => handleEditRates(t.id)}
                disabled={loadingId === t.id}
                className="px-4 py-2.5 rounded-lg text-[11px] md:text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50 transition-all min-h-[40px]"
              >
                {loadingId === t.id ? "Loading…" : "Edit Rates"}
              </button>
              <button
                type="button"
                onClick={() => setEditingNameFor(t)}
                className="px-4 py-2.5 rounded-lg text-[11px] md:text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)]/60 hover:text-[var(--tx)] transition-all min-h-[40px]"
              >
                Edit Name
              </button>
              <button
                onClick={() => handleDuplicate(t)}
                className="px-4 py-2.5 rounded-lg text-[11px] md:text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--brd)] hover:text-[var(--tx)] transition-all min-h-[40px]"
              >
                Duplicate
              </button>
              <button
                onClick={() => setDeletingTemplate(t)}
                className="px-4 py-2.5 rounded-lg text-[11px] md:text-[12px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all min-h-[40px]"
              >
                Delete
              </button>
            </div>
            {t.verticals_covered && t.verticals_covered.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 md:mt-6 pt-5 md:pt-6 border-t border-[var(--brd)]/30">
                {t.verticals_covered.map((v) => (
                  <span
                    key={v}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bgsub)] text-[10px] md:text-[11px] text-[var(--tx2)] font-medium leading-snug"
                  >
                    {VERTICAL_LABELS[v] || v.replace(/_/g, " ")}
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
