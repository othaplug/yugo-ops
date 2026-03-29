"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "../components/Toast";
import { Package, Plus, PencilSimple } from "@phosphor-icons/react";

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
];

function stringifyConfig(c: Record<string, unknown>) {
  return JSON.stringify(c, null, 2);
}

export default function DeliveryVerticalsPanel() {
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
      toast("Could not load delivery verticals (run DB migration?)", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setModal({
      id: "",
      code: "",
      name: "",
      description: "",
      icon: "",
      base_rate: 350,
      pricing_method: "dimensional",
      default_config: {
        unit_label: "item",
        unit_rate: 40,
        min_crew: 2,
        crew_hourly_rate: 80,
        stop_rate: 100,
        free_stops: 1,
        distance_free_km: 15,
        distance_per_km: 3,
        handling_rates: { threshold: 75, room_of_choice: 125 },
        truck_rates: { sprinter: 0, "16ft": 50, "20ft": 100, "26ft": 150 },
        complexity_premiums: { time_sensitive: 100, fragile: 75, stairs_per_flight: 50 },
      },
      active: true,
      sort_order: 0,
    });
  };

  const saveModal = async (v: Vertical) => {
    setSaving(true);
    try {
      const isNew = !v.id;
      const res = await fetch("/api/admin/delivery-verticals", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...(isNew ? {} : { id: v.id }),
          code: v.code.trim().toLowerCase().replace(/\s+/g, "_"),
          name: v.name.trim(),
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
            Delivery verticals
          </h2>
          <p className="text-[11px] text-[var(--tx3)] mt-1">
            B2B one-off quotes use these profiles. Coordinators pick a vertical on the quote form; rates are JSON so you can tune handling, stops, truck, and distance without code deploys.
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
          No verticals found. Apply migration <code className="text-[11px]">20260329140000_delivery_verticals_b2b.sql</code> or create one above.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--brd)] bg-[var(--bg2)]/60 text-left text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">
                <th className="px-4 py-2">Vertical</th>
                <th className="px-4 py-2">Base</th>
                <th className="px-4 py-2">Pricing</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--brd)]/50 last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-[var(--tx)]">{r.name}</span>
                    <div className="text-[10px] text-[var(--tx3)] font-mono">{r.code}</div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">${Number(r.base_rate).toFixed(0)}</td>
                  <td className="px-4 py-2.5 capitalize text-[var(--tx2)]">{r.pricing_method.replace(/_/g, " ")}</td>
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" role="dialog">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-3">
            <h3 className="text-[15px] font-bold text-[var(--tx)]">
              {modal.id ? "Edit vertical" : "Create vertical"}
            </h3>
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
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description || "");
  const [icon, setIcon] = useState(initial.icon || "");
  const [baseRate, setBaseRate] = useState(String(initial.base_rate));
  const [pricingMethod, setPricingMethod] = useState(initial.pricing_method);
  const [sortOrder, setSortOrder] = useState(String(initial.sort_order));
  const [active, setActive] = useState(initial.active);
  const [configStr, setConfigStr] = useState(stringifyConfig(initial.default_config || {}));
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const handleSave = () => {
    let default_config: Record<string, unknown>;
    try {
      default_config = JSON.parse(configStr) as Record<string, unknown>;
      setJsonErr(null);
    } catch {
      setJsonErr("Invalid JSON");
      return;
    }
    onSave({
      ...initial,
      code,
      name,
      description: description || null,
      icon: icon || null,
      base_rate: Number(baseRate) || 0,
      pricing_method: pricingMethod,
      sort_order: Number(sortOrder) || 0,
      active,
      default_config,
    });
  };

  return (
    <>
      <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Code (slug)</label>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={Boolean(initial.id)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] disabled:opacity-60"
        placeholder="rug_delivery"
      />
      <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
      />
      <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Description</label>
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
        placeholder="Phosphor name e.g. Package"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Base rate</label>
          <input
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
            type="number"
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Sort</label>
          <input
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            type="number"
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          />
        </div>
      </div>
      <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">Pricing method</label>
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
        Active
      </label>
      <label className="block text-[10px] font-bold uppercase text-[var(--tx3)]">default_config (JSON)</label>
      <textarea
        value={configStr}
        onChange={(e) => setConfigStr(e.target.value)}
        rows={12}
        className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[11px] font-mono"
      />
      {jsonErr && <p className="text-[11px] text-red-500">{jsonErr}</p>}
      <div className="flex justify-end gap-2 pt-2">
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
