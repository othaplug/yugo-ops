"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { Plus, PencilSimple } from "@phosphor-icons/react";

const CATEGORIES = ["protection", "tools", "moving", "supplies", "tech"] as const;

type Row = {
  id: string;
  name: string;
  category: string;
  icon: string | null;
  default_quantity: number;
  replacement_cost: number | null;
  is_consumable: boolean;
  active: boolean;
  created_at?: string;
};

const inputCls =
  "w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)]/70 rounded-xl text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)]/50 outline-none";
const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-[var(--tx3)] mb-1.5";

export default function EquipmentCatalogPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("moving");
  const [icon, setIcon] = useState("");
  const [defaultQty, setDefaultQty] = useState("1");
  const [cost, setCost] = useState("");
  const [consumable, setConsumable] = useState(false);
  const [active, setActive] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/equipment-inventory")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setRows(d);
        else toast(typeof d.error === "string" ? d.error : "Failed to load catalog", "x");
      })
      .catch(() => toast("Failed to load", "x"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setCategory("moving");
    setIcon("");
    setDefaultQty("1");
    setCost("");
    setConsumable(false);
    setActive(true);
    setModalOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setName(r.name);
    setCategory(r.category);
    setIcon(r.icon || "");
    setDefaultQty(String(r.default_quantity));
    setCost(r.replacement_cost != null ? String(r.replacement_cost) : "");
    setConsumable(!!r.is_consumable);
    setActive(r.active !== false);
    setModalOpen(true);
  };

  const save = async () => {
    const n = name.trim();
    if (!n) {
      toast("Name required", "x");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...(editing ? { id: editing.id } : {}),
        name: n,
        category,
        icon: icon.trim() || null,
        default_quantity: Math.max(0, parseInt(defaultQty, 10) || 0),
        replacement_cost: cost.trim() === "" ? null : parseFloat(cost),
        is_consumable: consumable,
        active,
      };
      const res = await fetch("/api/admin/equipment-inventory", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Save failed", "x");
        return;
      }
      toast(editing ? "Item updated" : "Item added", "check");
      setModalOpen(false);
      load();
    } catch {
      toast("Save failed", "x");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-[12px] text-[var(--tx3)] py-4">Loading equipment catalog…</p>;
  }

  return (
    <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-[var(--brd)] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-bold text-[var(--tx)]">Equipment catalog</h2>
          <p className="text-[10px] text-[var(--tx3)] mt-0.5 leading-snug max-w-xl">
            Master list used when assigning gear to trucks. Crew counts pull from per-truck rows; changes here affect names and defaults for new assignments. Use truck onboarding or edit truck equipment to put items on a vehicle.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25 hover:bg-[var(--gold)]/25 transition-colors"
        >
          <Plus size={14} weight="bold" /> Add item
        </button>
      </div>
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[var(--card)] z-[1]">
            <tr className="text-left text-[var(--tx3)] border-b border-[var(--brd)]">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Default qty</th>
              <th className="py-2 pr-3">Cost</th>
              <th className="py-2 pr-3">Flags</th>
              <th className="py-2 pr-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 px-3 text-[var(--tx3)]">
                  No catalog items. Add your first piece of equipment or run database migrations to load seeds.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--brd)]/50">
                  <td className="py-2 px-3 font-medium text-[var(--tx)]">
                    {r.name}
                    {!r.active && (
                      <span className="ml-2 text-[9px] uppercase text-[var(--tx3)]">Inactive</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-[var(--tx2)]">{r.category}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.default_quantity}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.replacement_cost != null ? `$${Number(r.replacement_cost).toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-[var(--tx3)]">
                    {r.is_consumable ? "Consumable" : "—"}
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--gold)]/10"
                      aria-label={`Edit ${r.name}`}
                    >
                      <PencilSimple size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalOverlay
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit equipment item" : "Add equipment item"}
        maxWidth="md"
      >
        <div className="space-y-4 pt-1">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Furniture dolly" />
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Icon (Phosphor name, optional)</label>
            <input className={inputCls} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Package" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Default quantity on truck</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={defaultQty}
                onChange={(e) => setDefaultQty(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Replacement cost (CAD)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className={inputCls}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={consumable} onChange={(e) => setConsumable(e.target.checked)} className="rounded border-[var(--brd)]" />
            Consumable (tape, wrap, etc.)
          </label>
          <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-[var(--brd)]" />
            Active (inactive items stay in DB but won&apos;t seed new trucks)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-[12px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}
