"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "../components/Toast";

/* ────────── helpers ────────── */
type Row = Record<string, unknown>;

function currency(n: number | string) {
  const v = Number(n);
  return isNaN(v) ? String(n) : v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TIER_BADGE: Record<string, string> = {
  A: "bg-[#C9A962]/15 text-[#C9A962] border-[#C9A962]/30",
  B: "bg-[#2D6A4F]/15 text-[#2D6A4F] border-[#2D6A4F]/30",
  C: "bg-[var(--tx3)]/10 text-[var(--tx3)] border-[var(--tx3)]/20",
  D: "bg-[var(--tx3)]/5 text-[var(--tx3)]/60 border-[var(--tx3)]/10",
};

/* ────────── API helpers ────────── */
async function fetchSection(section: string): Promise<Row[]> {
  const res = await fetch(`/api/admin/pricing?section=${section}`);
  if (!res.ok) throw new Error("Failed to fetch");
  const { data } = await res.json();
  return data || [];
}

async function saveRows(section: string, rows: Row[]) {
  const res = await fetch("/api/admin/pricing", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, rows }),
  });
  if (!res.ok) throw new Error("Failed to save");
}

async function addRow(section: string, row: Row): Promise<Row> {
  const res = await fetch("/api/admin/pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, row }),
  });
  if (!res.ok) throw new Error("Failed to add");
  const { data } = await res.json();
  return data;
}

async function deleteRow(section: string, id: string) {
  const res = await fetch("/api/admin/pricing", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, id }),
  });
  if (!res.ok) throw new Error("Failed to delete");
}

/* ────────── Editable Cell ────────── */
function EditCell({ value, onChange, type = "text", className = "" }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        className={`cursor-pointer hover:bg-[var(--gold)]/5 px-2 py-1 rounded transition-colors ${className}`}
      >
        {value}
      </span>
    );
  }
  return (
    <input
      ref={inputRef}
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { setEditing(false); if (local !== String(value)) onChange(local); }}
      onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (local !== String(value)) onChange(local); } if (e.key === "Escape") { setEditing(false); setLocal(String(value)); } }}
      className={`px-2 py-1 rounded border border-[var(--gold)] bg-[var(--card)] text-[var(--tx)] text-[12px] outline-none w-full ${className}`}
    />
  );
}

/* ────────── Accordion ────────── */
function Accordion({ title, subtitle, children, defaultOpen = false }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        open
          ? "border-[var(--gold)]/40 bg-[var(--card)] shadow-[0_0_0_1px_rgba(201,169,98,0.08),0_4px_24px_rgba(0,0,0,0.18)]"
          : "border-[var(--brd)] bg-[var(--card)] hover:border-[var(--gold)]/20 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {/* Gold accent bar */}
          <div
            className={`w-1 h-8 rounded-full shrink-0 transition-all duration-200 ${
              open ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
            }`}
          />
          <div>
            <h3 className={`text-[13px] font-bold tracking-wide transition-colors ${open ? "text-[var(--gold)]" : "text-[var(--tx)]"}`}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-[var(--tx3)] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            open ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "bg-[var(--bg)] text-[var(--tx3)]"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-[var(--brd)]/30">
          {children}
        </div>
      )}
    </div>
  );
}

/* ────────── Section hook ────────── */
function useSection(section: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [prev, setPrev] = useState<Row[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSection(section);
      setRows(data);
      setPrev(data);
    } catch { toast("Failed to load " + section, "x"); }
    setLoading(false);
  }, [section, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (updated?: Row[]) => {
    const toSave = updated || rows;
    try {
      await saveRows(section, toSave);
      setPrev(toSave);
      toast("Saved", "check");
    } catch { toast("Failed to save", "x"); }
  };

  const undo = () => { setRows(prev); };

  const add = async (row: Row) => {
    try {
      const created = await addRow(section, row);
      setRows((r) => [...r, created]);
      toast("Added", "check");
    } catch { toast("Failed to add", "x"); }
  };

  const remove = async (id: string) => {
    try {
      await deleteRow(section, id);
      setRows((r) => r.filter((row) => row.id !== id));
      toast("Removed", "check");
    } catch { toast("Failed to delete", "x"); }
  };

  const updateRow = (id: string, field: string, value: string | number | boolean) => {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  return { rows, loading, setRows, save, undo, add, remove, updateRow, reload: load };
}

/* ────────── Table wrapper ────────── */
const tbl = "w-full text-[12px]";
const th = "text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2";
const td = "py-1.5 px-2 border-t border-[var(--brd)]/50";

function SaveBar({ onSave, onUndo }: { onSave: () => void; onUndo: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-3">
      <button type="button" onClick={onSave} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">Save</button>
      <button type="button" onClick={onUndo} className="px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:bg-[var(--bg)] transition-colors">Undo</button>
    </div>
  );
}

function Skeleton() {
  return <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-[var(--bg)] rounded-lg animate-pulse" />)}</div>;
}

/* ────────── ANALYTICS ────────── */
function AnalyticsDashboard() {
  const [data, setData] = useState<Record<string, string | number> | null>(null);

  useEffect(() => {
    fetch("/api/admin/pricing/analytics").then((r) => r.ok ? r.json() : null).then(setData).catch(() => {});
  }, []);

  if (!data) return null;

  const metrics = [
    { label: "Quotes (30d)", value: data.quotesSent || 0 },
    { label: "Conversion", value: `${data.conversionRate || 0}%` },
    { label: "Avg Quote", value: currency(Number(data.avgQuoteAmount) || 0) },
    { label: "Top Tier", value: data.mostQuotedTier || "—" },
    { label: "Best Hood", value: data.highestConvertingHood || "—" },
    { label: "Lost Reason", value: data.topLostReason || "—" },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
      {metrics.map((m) => (
        <div key={m.label} className="bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
          <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)]/60 whitespace-nowrap">{m.label}</div>
          <div className="text-[13px] font-bold text-[var(--tx)] mt-0.5 truncate">{m.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ────────── S1: BASE RATES ────────── */
function BaseRatesSection() {
  const { rows, loading, save, undo, add, remove, updateRow } = useSection("base-rates");
  const LABELS: Record<string, string> = { studio: "Studio", "1br": "1 Bedroom", "2br": "2 Bedroom", "3br": "3 Bedroom", "4br": "4 Bedroom", "5br_plus": "5+ Bedroom", partial: "Partial Move" };
  const [adding, setAdding] = useState(false);
  const [newSize, setNewSize] = useState("");

  if (loading) return <Skeleton />;
  return (
    <div className="pt-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Move Size</th><th className={th}>Base Rate ($)</th><th className={th}>Min Crew</th><th className={th}>Est. Hours</th><th className={th} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className={td}><span className="text-[12px] font-medium text-[var(--tx)]">{LABELS[String(r.move_size)] || String(r.move_size)}</span></td>
              <td className={td}><EditCell value={Number(r.base_price)} onChange={(v) => updateRow(String(r.id), "base_price", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}><EditCell value={Number(r.min_crew)} onChange={(v) => updateRow(String(r.id), "min_crew", Number(v))} type="number" /></td>
              <td className={td}><EditCell value={Number(r.estimated_hours)} onChange={(v) => updateRow(String(r.id), "estimated_hours", Number(v))} type="number" /></td>
              <td className={td}><button type="button" onClick={() => remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding ? (
        <div className="flex items-center gap-2 mt-3">
          <input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g. townhouse" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none focus:border-[var(--brd)]" />
          <button type="button" onClick={async () => { if (newSize.trim()) { await add({ move_size: newSize.trim(), base_price: 0, min_crew: 2, estimated_hours: 0 }); setNewSize(""); setAdding(false); } }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Move Size</button>
      )}
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S2: TIER MULTIPLIERS ────────── */
function TierMultipliersSection() {
  const { rows, loading, save, undo, updateRow } = useSection("config");
  if (loading) return <Skeleton />;

  const getVal = (key: string) => rows.find((r) => r.key === key);
  const essM = Number(getVal("tier_essentials_multiplier")?.value) || 1;
  const premM = Number(getVal("tier_premier_multiplier")?.value) || 1.35;
  const estM = Number(getVal("tier_estate_multiplier")?.value) || 1.85;
  const minJob = Number(getVal("minimum_job_amount")?.value) || 549;
  const rounding = Number(getVal("rounding_nearest")?.value) || 50;
  const taxRate = Number(getVal("tax_rate")?.value) || 0.13;

  const previewBase = 1200;
  const preview = (m: number) => Math.round((previewBase * m) / rounding) * rounding;

  const tiers = [
    { key: "tier_essentials_multiplier", label: "Essentials", desc: "Base rate — standard service", m: essM },
    { key: "tier_premier_multiplier", label: "Premier", desc: "Full wrapping, mattress covers, etc.", m: premM },
    { key: "tier_estate_multiplier", label: "Estate", desc: "Full packing, white glove, coordinator", m: estM },
  ];

  return (
    <div className="pt-4 space-y-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Tier</th><th className={th}>Multiplier</th><th className={th}>Description</th></tr></thead>
        <tbody>
          {tiers.map((t) => {
            const row = getVal(t.key);
            if (!row) return null;
            return (
              <tr key={t.key}>
                <td className={td}><span className="font-semibold text-[var(--tx)]">{t.label}</span></td>
                <td className={td}><EditCell value={`${t.m}x`} onChange={(v) => updateRow(String(row.id), "value", v.replace("x", ""))} className="font-semibold text-[var(--gold)]" /></td>
                <td className={td}><span className="text-[var(--tx3)]">{t.desc}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="bg-[var(--bg)] rounded-lg px-4 py-3 text-[11px] text-[var(--tx3)]">
        <span className="font-semibold text-[var(--tx)]">Live preview</span> (base ${previewBase.toLocaleString()}):
        <span className="ml-2">Essentials = <b className="text-[var(--gold)]">{currency(preview(essM))}</b></span>
        <span className="ml-2">→ Premier = <b className="text-[var(--gold)]">{currency(preview(premM))}</b></span>
        <span className="ml-2">→ Estate = <b className="text-[var(--gold)]">{currency(preview(estM))}</b></span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { key: "minimum_job_amount", label: "Minimum job ($)", val: minJob },
          { key: "rounding_nearest", label: "Round to nearest ($)", val: rounding },
          { key: "tax_rate", label: "Tax rate", val: taxRate },
        ].map((c) => {
          const row = getVal(c.key);
          if (!row) return null;
          return (
            <div key={c.key} className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{c.label}</div>
              <EditCell value={c.val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="text-[14px] font-bold text-[var(--tx)]" />
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S3: NEIGHBOURHOODS ────────── */
function NeighbourhoodsSection() {
  const { rows, loading, save, undo, add, remove, updateRow } = useSection("neighbourhoods");
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ postal_prefix: "", neighbourhood_name: "", tier: "C", multiplier: "1.00" });

  if (loading) return <Skeleton />;

  const filtered = rows.filter((r) => {
    const matchesSearch = !search || String(r.postal_prefix).toLowerCase().includes(search.toLowerCase()) || String(r.neighbourhood_name).toLowerCase().includes(search.toLowerCase());
    const matchesTier = !filterTier || r.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search postal code or name…" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none focus:border-[var(--brd)] flex-1 min-w-[180px]" />
        <div className="flex gap-1">
          {["", "A", "B", "C", "D"].map((t) => (
            <button key={t} type="button" onClick={() => setFilterTier(t)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${filterTier === t ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:bg-[var(--bg2)]"}`}>
              {t || "All"}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        <table className={tbl}>
          <thead className="sticky top-0 bg-[var(--card)]"><tr><th className={th}>Postal</th><th className={th}>Neighbourhood</th><th className={th}>Tier</th><th className={th}>Multiplier</th><th className={th} /></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={String(r.id)}>
                <td className={td}><span className="font-mono text-[11px]">{String(r.postal_prefix)}</span></td>
                <td className={td}><span className="text-[12px]">{String(r.neighbourhood_name)}</span></td>
                <td className={td}><span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${TIER_BADGE[String(r.tier)] || TIER_BADGE.C}`}>{String(r.tier)}</span></td>
                <td className={td}><EditCell value={Number(r.multiplier)} onChange={(v) => updateRow(String(r.id), "multiplier", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
                <td className={td}><button type="button" onClick={() => remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input value={newRow.postal_prefix} onChange={(e) => setNewRow({ ...newRow, postal_prefix: e.target.value.toUpperCase() })} placeholder="M5R" className="w-20 px-2 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none" />
          <input value={newRow.neighbourhood_name} onChange={(e) => setNewRow({ ...newRow, neighbourhood_name: e.target.value })} placeholder="Neighbourhood" className="flex-1 min-w-[120px] px-2 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none" />
          <select value={newRow.tier} onChange={(e) => setNewRow({ ...newRow, tier: e.target.value })} className="px-2 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none">
            <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
          </select>
          <input value={newRow.multiplier} onChange={(e) => setNewRow({ ...newRow, multiplier: e.target.value })} placeholder="1.00" className="w-16 px-2 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none" type="number" step="0.01" />
          <button type="button" onClick={async () => { await add({ postal_prefix: newRow.postal_prefix, neighbourhood_name: newRow.neighbourhood_name, tier: newRow.tier, multiplier: Number(newRow.multiplier) }); setNewRow({ postal_prefix: "", neighbourhood_name: "", tier: "C", multiplier: "1.00" }); setAdding(false); }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Neighbourhood</button>
      )}
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S4: ACCESS SURCHARGES ────────── */
function AccessScoresSection() {
  const { rows, loading, save, undo, add, remove, updateRow } = useSection("access-scores");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");

  if (loading) return <Skeleton />;
  return (
    <div className="pt-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Access Type</th><th className={th}>Surcharge ($)</th><th className={th}>Notes</th><th className={th} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className={td}><span className="text-[12px]">{String(r.access_type).replace(/_/g, " ")}</span></td>
              <td className={td}><EditCell value={Number(r.surcharge)} onChange={(v) => updateRow(String(r.id), "surcharge", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}><EditCell value={String(r.notes || "")} onChange={(v) => updateRow(String(r.id), "notes", v)} className="text-[var(--tx3)]" /></td>
              <td className={td}><button type="button" onClick={() => remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding ? (
        <div className="flex items-center gap-2 mt-3">
          <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. rooftop_access" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none flex-1" />
          <button type="button" onClick={async () => { if (newType.trim()) { await add({ access_type: newType.trim(), surcharge: 0, notes: "" }); setNewType(""); setAdding(false); } }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Access Type</button>
      )}
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S5: DATE FACTORS ────────── */
function DateFactorsSection() {
  const { rows, loading, save, undo, updateRow } = useSection("date-factors");
  if (loading) return <Skeleton />;

  const byType = (type: string) => rows.filter((r) => r.factor_type === type);
  const LABELS: Record<string, string> = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
    friday: "Friday", saturday: "Saturday", sunday: "Sunday",
    peak_jun_aug: "Peak (Jun–Aug)", shoulder_sep_nov: "Shoulder (Sep–Nov)",
    off_peak_jan_mar: "Off-peak (Jan–Mar)", spring_apr_may: "Spring (Apr–May)",
    month_end: "Month-end (last 3 days)", last_minute_7days: "Last-minute (<7 days)",
    early_bird_30plus: "Early bird (>30 days)",
  };

  const renderGroup = (title: string, type: string) => (
    <div>
      <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">{title}</h4>
      <table className={tbl}>
        <thead><tr><th className={th}>Condition</th><th className={th}>Multiplier</th></tr></thead>
        <tbody>
          {byType(type).map((r) => (
            <tr key={String(r.id)}>
              <td className={td}>{LABELS[String(r.factor_value)] || String(r.factor_value)}</td>
              <td className={td}><EditCell value={Number(r.multiplier)} onChange={(v) => updateRow(String(r.id), "multiplier", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="pt-4 space-y-6">
      {renderGroup("Day of Week", "day_of_week")}
      <div className="border-t border-[var(--brd)]/30 pt-5">{renderGroup("Seasonal", "season")}</div>
      <div className="border-t border-[var(--brd)]/30 pt-5">{renderGroup("Special Conditions", "month_period")}</div>
      <div className="border-t border-[var(--brd)]/30 pt-5">{renderGroup("Urgency", "urgency")}</div>
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S6: SPECIALTY SURCHARGES ────────── */
function SpecialtySurchargesSection() {
  const { rows, loading, save, undo, add, remove, updateRow } = useSection("surcharges");
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState("");

  if (loading) return <Skeleton />;
  return (
    <div className="pt-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Item Type</th><th className={th}>Surcharge ($)</th><th className={th}>Specialty Crew?</th><th className={th} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className={td}><span className="text-[12px]">{String(r.item_type).replace(/_/g, " ")}</span></td>
              <td className={td}><EditCell value={Number(r.surcharge)} onChange={(v) => updateRow(String(r.id), "surcharge", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!r.requires_specialty_crew}
                  onClick={() => updateRow(String(r.id), "requires_specialty_crew", !r.requires_specialty_crew)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${r.requires_specialty_crew ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${r.requires_specialty_crew ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </td>
              <td className={td}><button type="button" onClick={() => remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding ? (
        <div className="flex items-center gap-2 mt-3">
          <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="e.g. piano_baby_grand" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none flex-1" />
          <button type="button" onClick={async () => { if (newType.trim()) { await add({ item_type: newType.trim(), surcharge: 0, requires_specialty_crew: false }); setNewType(""); setAdding(false); } }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="mt-3 text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Item Type</button>
      )}
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S7: SINGLE ITEM RATES ────────── */
function SingleItemSection() {
  const { rows, loading, save, undo, add, remove, updateRow } = useSection("single-item");
  const configSection = useSection("config");
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");

  if (loading || configSection.loading) return <Skeleton />;

  const configRows = configSection.rows;
  const getConf = (key: string) => configRows.find((r) => r.key === key);

  return (
    <div className="pt-4 space-y-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Category</th><th className={th}>Min ($)</th><th className={th}>Max ($)</th><th className={th}>Weight Class</th><th className={th} /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className={td}><span className="text-[12px]">{String(r.item_category).replace(/_/g, " ")}</span></td>
              <td className={td}><EditCell value={Number(r.base_price_min)} onChange={(v) => updateRow(String(r.id), "base_price_min", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}><EditCell value={Number(r.base_price_max)} onChange={(v) => updateRow(String(r.id), "base_price_max", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}><EditCell value={String(r.weight_class || "")} onChange={(v) => updateRow(String(r.id), "weight_class", v)} className="text-[var(--tx3)]" /></td>
              <td className={td}><button type="button" onClick={() => remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {adding ? (
        <div className="flex items-center gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none flex-1" />
          <button type="button" onClick={async () => { if (newCat.trim()) { await add({ item_category: newCat.trim(), base_price_min: 0, base_price_max: 0, weight_class: "varies" }); setNewCat(""); setAdding(false); } }} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Category</button>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "single_item_distance_base", label: "Free km included" },
          { key: "single_item_distance_rate", label: "$/km over base" },
          { key: "assembly_disassembly", label: "Disassembly ($)" },
          { key: "assembly_assembly", label: "Assembly ($)" },
          { key: "assembly_both", label: "Both ($)" },
          { key: "stair_carry_per_flight", label: "Stair carry/flight ($)" },
        ].map((c) => {
          const row = getConf(c.key);
          if (!row) return null;
          return (
            <div key={c.key} className="bg-[var(--bg)] rounded-lg p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{c.label}</div>
              <EditCell value={row.value as string} onChange={(v) => configSection.updateRow(String(row.id), "value", v)} type="number" className="text-[14px] font-bold text-[var(--tx)]" />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={() => save()} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]">Save Rates</button>
        <button type="button" onClick={() => configSection.save()} className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]">Save Config</button>
        <button type="button" onClick={() => { undo(); configSection.undo(); }} className="px-3 py-2 rounded-lg text-[11px] text-[var(--tx3)]">Undo</button>
      </div>
    </div>
  );
}

/* ────────── S8: DEPOSIT RULES ────────── */
const BRACKETS = ["under_500", "500_999", "1000_2999", "3000_4999", "5000_plus"];
const BRACKET_LABELS: Record<string, string> = { under_500: "<$500", "500_999": "$500–999", "1000_2999": "$1K–2.9K", "3000_4999": "$3K–4.9K", "5000_plus": "$5K+" };
const SERVICE_TYPES = ["residential", "long_distance", "office", "single_item", "white_glove", "specialty"];

function DepositRulesSection() {
  const { rows, loading, save, undo, updateRow } = useSection("deposit-rules");
  if (loading) return <Skeleton />;

  const getCell = (service: string, bracket: string) => rows.find((r) => r.service_type === service && r.amount_bracket === bracket);

  return (
    <div className="pt-4">
      <div className="overflow-x-auto">
        <table className={tbl}>
          <thead>
            <tr>
              <th className={th}>Service Type</th>
              {BRACKETS.map((b) => <th key={b} className={th}>{BRACKET_LABELS[b]}</th>)}
            </tr>
          </thead>
          <tbody>
            {SERVICE_TYPES.map((st) => (
              <tr key={st}>
                <td className={`${td} font-medium capitalize`}>{st.replace(/_/g, " ")}</td>
                {BRACKETS.map((b) => {
                  const cell = getCell(st, b);
                  if (!cell) return <td key={b} className={td}>—</td>;
                  return (
                    <td key={b} className={td}>
                      <div className="flex items-center gap-1">
                        <select
                          value={String(cell.deposit_type)}
                          onChange={(e) => updateRow(String(cell.id), "deposit_type", e.target.value)}
                          className="bg-transparent text-[10px] text-[var(--tx3)] outline-none border-none cursor-pointer"
                        >
                          <option value="full">Full</option>
                          <option value="flat">Flat $</option>
                          <option value="percent">%</option>
                        </select>
                        {cell.deposit_type !== "full" && (
                          <EditCell value={Number(cell.deposit_value)} onChange={(v) => updateRow(String(cell.id), "deposit_value", Number(v))} type="number" className="w-12 font-semibold text-[var(--gold)]" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S9: OFFICE RATES ────────── */
function OfficeRatesSection() {
  const { rows, loading, save, undo, updateRow } = useSection("office-rates");
  if (loading) return <Skeleton />;

  return (
    <div className="pt-4">
      <table className={tbl}>
        <thead><tr><th className={th}>Parameter</th><th className={th}>Value</th><th className={th}>Unit</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className={td}><span className="text-[12px] capitalize">{String(r.parameter).replace(/_/g, " ")}</span></td>
              <td className={td}><EditCell value={Number(r.value)} onChange={(v) => updateRow(String(r.id), "value", Number(v))} type="number" className="font-semibold text-[var(--gold)]" /></td>
              <td className={td}><span className="text-[11px] text-[var(--tx3)]">{String(r.unit)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <SaveBar onSave={() => save()} onUndo={undo} />
    </div>
  );
}

/* ────────── S10: ADD-ONS ────────── */
const SERVICE_TYPE_BADGES: Record<string, string> = {
  local_move: "bg-blue-500/15 text-blue-400 border-blue-400/30",
  long_distance: "bg-purple-500/15 text-purple-400 border-purple-400/30",
  office_move: "bg-orange-500/15 text-orange-400 border-orange-400/30",
  single_item: "bg-teal-500/15 text-teal-400 border-teal-400/30",
  white_glove: "bg-pink-500/15 text-pink-400 border-pink-400/30",
  specialty: "bg-indigo-500/15 text-indigo-400 border-indigo-400/30",
  b2b_delivery: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  local_move: "Residential",
  long_distance: "Long Distance",
  office_move: "Office",
  single_item: "Single Item",
  white_glove: "White Glove",
  specialty: "Specialty",
  b2b_delivery: "B2B",
};

const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS);
const TIER_OPTIONS = ["essentials", "premier", "estate"];

const FILTER_TABS = [
  { key: "", label: "All" },
  { key: "local_move", label: "Residential" },
  { key: "office_move", label: "Office" },
  { key: "single_item", label: "Single Item" },
  { key: "white_glove", label: "White Glove" },
];

type Addon = Row & {
  id: string;
  name: string;
  slug: string;
  price: number;
  price_type: string;
  unit_label: string | null;
  tiers: { label: string; price: number }[] | null;
  percent_value: number | null;
  applicable_service_types: string[];
  excluded_tiers: string[] | null;
  is_popular: boolean;
  active: boolean;
  display_order: number;
};

function useAddons() {
  const [rows, setRows] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [prev, setPrev] = useState<Addon[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing/addons");
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setRows(data || []);
      setPrev(data || []);
    } catch { toast("Failed to load add-ons", "x"); }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      const res = await fetch("/api/admin/pricing/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error();
      setPrev(rows);
      toast("Add-ons saved", "check");
    } catch { toast("Failed to save", "x"); }
  };

  const undo = () => setRows(prev);

  const addAddon = async (row: Partial<Addon>) => {
    try {
      const res = await fetch("/api/admin/pricing/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row }),
      });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setRows((r) => [...r, data]);
      toast("Added", "check");
    } catch { toast("Failed to add", "x"); }
  };

  const softDelete = async (id: string) => {
    try {
      const res = await fetch("/api/admin/pricing/addons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setRows((r) => r.map((a) => a.id === id ? { ...a, active: false } : a));
      toast("Deactivated", "check");
    } catch { toast("Failed to deactivate", "x"); }
  };

  const updateAddon = (id: string, field: string, value: unknown) => {
    setRows((r) => r.map((a) => a.id === id ? { ...a, [field]: value } : a));
  };

  const moveRow = (id: string, direction: -1 | 1) => {
    setRows((r) => {
      const idx = r.findIndex((a) => a.id === id);
      if (idx < 0) return r;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= r.length) return r;
      const next = [...r];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next.map((a, i) => ({ ...a, display_order: i }));
    });
  };

  return { rows, loading, save, undo, addAddon, softDelete, updateAddon, moveRow };
}

function TierEditor({ tiers, onChange }: { tiers: { label: string; price: number }[] | null; onChange: (t: { label: string; price: number }[]) => void }) {
  const [items, setItems] = useState(tiers || []);
  useEffect(() => setItems(tiers || []), [tiers]);

  const update = (idx: number, field: "label" | "price", val: string) => {
    const next = items.map((t, i) => i === idx ? { ...t, [field]: field === "price" ? Number(val) : val } : t);
    setItems(next);
    onChange(next);
  };

  return (
    <div className="space-y-1 pl-4 border-l-2 border-[var(--gold)]/30">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={t.label} onChange={(e) => update(i, "label", e.target.value)} className="flex-1 px-2 py-1 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded outline-none text-[var(--tx)]" />
          <span className="text-[10px] text-[var(--tx3)]">$</span>
          <input type="number" value={t.price} onChange={(e) => update(i, "price", e.target.value)} className="w-16 px-2 py-1 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded outline-none text-[var(--gold)] font-semibold" />
          <button type="button" onClick={() => { const next = items.filter((_, j) => j !== i); setItems(next); onChange(next); }} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button>
        </div>
      ))}
      <button type="button" onClick={() => { const next = [...items, { label: "", price: 0 }]; setItems(next); onChange(next); }} className="text-[10px] text-[var(--gold)] hover:underline mt-1">+ Add tier</button>
    </div>
  );
}

function ServiceTypeMultiSelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex flex-wrap gap-1 min-h-[24px] cursor-pointer">
        {selected.length === 0 && <span className="text-[9px] text-[var(--tx3)]">None</span>}
        {selected.map((s) => (
          <span key={s} className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold border ${SERVICE_TYPE_BADGES[s] || "bg-[var(--bg)] text-[var(--tx3)]"}`}>
            {SERVICE_TYPE_LABELS[s] || s}
          </span>
        ))}
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg p-2 min-w-[160px]">
          {ALL_SERVICE_TYPES.map((st) => (
            <label key={st} className="flex items-center gap-2 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(st)}
                onChange={() => onChange(selected.includes(st) ? selected.filter((s) => s !== st) : [...selected, st])}
                className="accent-[var(--gold)] w-3 h-3"
              />
              <span className="text-[10px] text-[var(--tx)]">{SERVICE_TYPE_LABELS[st]}</span>
            </label>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="mt-1 text-[9px] text-[var(--tx3)] hover:text-[var(--tx)]">Close</button>
        </div>
      )}
    </div>
  );
}

function ExcludedTiersSelect({ selected, onChange }: { selected: string[] | null; onChange: (v: string[]) => void }) {
  const vals = selected || [];
  return (
    <div className="flex flex-wrap gap-1">
      {TIER_OPTIONS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(vals.includes(t) ? vals.filter((v) => v !== t) : [...vals, t])}
          className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border capitalize transition-colors ${
            vals.includes(t)
              ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
              : "bg-[var(--bg)] text-[var(--tx3)] border-[var(--brd)] hover:border-[var(--gold)]/40"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function AddOnsSection() {
  const { rows, loading, save, undo, addAddon, softDelete, updateAddon, moveRow } = useAddons();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  if (loading) return <Skeleton />;

  const filtered = rows.filter((a) => {
    if (!showInactive && !a.active) return false;
    if (search && !String(a.name).toLowerCase().includes(search.toLowerCase())) return false;
    if (filter && !(a.applicable_service_types || []).includes(filter)) return false;
    return true;
  });

  const activeCount = rows.filter((a) => a.active).length;

  return (
    <div className="pt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search add-ons…" className="px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none focus:border-[var(--brd)] flex-1 min-w-[160px]" />
        <div className="flex gap-1 flex-wrap">
          {FILTER_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setFilter(t.key)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${filter === t.key ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:bg-[var(--bg2)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={() => setShowInactive(!showInactive)} className="accent-[var(--gold)] w-3 h-3" />
          <span className="text-[9px] text-[var(--tx3)]">Show inactive</span>
        </label>
      </div>

      {adding ? (
        <div className="flex items-center gap-2 p-3 bg-[var(--bg)] rounded-lg border border-[var(--brd)]">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add-on name" className="flex-1 px-3 py-1.5 border border-[var(--brd)] rounded-lg text-[12px] bg-[var(--card)] text-[var(--tx)] outline-none" />
          <button
            type="button"
            onClick={async () => {
              if (newName.trim()) {
                const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                await addAddon({
                  name: newName.trim(),
                  slug,
                  price: 0,
                  price_type: "flat",
                  applicable_service_types: ["local_move"],
                  display_order: rows.length,
                  active: true,
                  is_popular: false,
                  show_on_quote_page: true,
                  show_on_admin_form: true,
                });
                setNewName("");
                setAdding(false);
              }
            }}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
          >
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-[var(--tx3)]">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="text-[11px] font-semibold text-[var(--gold)] hover:underline">+ Add Add-On</button>
      )}

      <div className="text-[9px] text-[var(--tx3)]">{activeCount} active add-ons · {filtered.length} shown</div>

      <div className="overflow-x-auto">
        <table className={tbl}>
          <thead className="sticky top-0 bg-[var(--card)]">
            <tr>
              <th className={th} style={{ width: 32 }} />
              <th className={th}>Name</th>
              <th className={th}>Price</th>
              <th className={th}>Type</th>
              <th className={th}>Unit</th>
              <th className={th}>Applies To</th>
              <th className={th}>Excluded Tiers</th>
              <th className={`${th} text-center`}>Popular</th>
              <th className={`${th} text-center`}>Active</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const isTiered = a.price_type === "tiered";
              const isPercent = a.price_type === "percent";
              const tiersOpen = expandedTiers.has(a.id);

              return (
                <React.Fragment key={a.id}>
                  <tr className={!a.active ? "opacity-40" : ""}>
                    <td className={td}>
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => moveRow(a.id, -1)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-[9px] leading-none">▲</button>
                        <button type="button" onClick={() => moveRow(a.id, 1)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-[9px] leading-none">▼</button>
                      </div>
                    </td>
                    <td className={td}>
                      <EditCell value={String(a.name)} onChange={(v) => updateAddon(a.id, "name", v)} className="font-medium text-[var(--tx)]" />
                      {a.description ? <div className="text-[9px] text-[var(--tx3)] pl-2 truncate max-w-[200px]">{String(a.description)}</div> : null}
                    </td>
                    <td className={td}>
                      {isTiered ? (
                        <button type="button" onClick={() => setExpandedTiers((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })} className="text-[11px] text-[var(--gold)] hover:underline">
                          {(a.tiers || []).length} tiers ▾
                        </button>
                      ) : isPercent ? (
                        <div className="flex items-center gap-1">
                          <EditCell value={Number(a.percent_value || 0) * 100} onChange={(v) => updateAddon(a.id, "percent_value", Number(v) / 100)} type="number" className="w-12 font-semibold text-[var(--gold)]" />
                          <span className="text-[10px] text-[var(--tx3)]">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[var(--tx3)]">$</span>
                          <EditCell value={Number(a.price)} onChange={(v) => updateAddon(a.id, "price", Number(v))} type="number" className="font-semibold text-[var(--gold)]" />
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <select
                        value={a.price_type}
                        onChange={(e) => updateAddon(a.id, "price_type", e.target.value)}
                        className="bg-transparent text-[10px] text-[var(--tx3)] outline-none border-none cursor-pointer"
                      >
                        <option value="flat">Flat</option>
                        <option value="per_unit">Per unit</option>
                        <option value="tiered">Tiered</option>
                        <option value="percent">Percent</option>
                      </select>
                    </td>
                    <td className={td}>
                      {(a.price_type === "per_unit" || a.price_type === "flat") && (
                        <EditCell value={a.unit_label || "—"} onChange={(v) => updateAddon(a.id, "unit_label", v === "—" ? "" : v)} className="text-[var(--tx3)]" />
                      )}
                    </td>
                    <td className={td}>
                      <ServiceTypeMultiSelect
                        selected={a.applicable_service_types || []}
                        onChange={(v) => updateAddon(a.id, "applicable_service_types", v)}
                      />
                    </td>
                    <td className={td}>
                      <ExcludedTiersSelect
                        selected={a.excluded_tiers}
                        onChange={(v) => updateAddon(a.id, "excluded_tiers", v.length > 0 ? v : null)}
                      />
                    </td>
                    <td className={`${td} text-center`}>
                      <button type="button" role="switch" aria-checked={!!a.is_popular} onClick={() => updateAddon(a.id, "is_popular", !a.is_popular)} className={`relative w-8 h-4 rounded-full transition-colors ${a.is_popular ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${a.is_popular ? "translate-x-4" : ""}`} />
                      </button>
                    </td>
                    <td className={`${td} text-center`}>
                      <button type="button" role="switch" aria-checked={!!a.active} onClick={() => updateAddon(a.id, "active", !a.active)} className={`relative w-8 h-4 rounded-full transition-colors ${a.active ? "bg-green-500" : "bg-[var(--brd)]"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${a.active ? "translate-x-4" : ""}`} />
                      </button>
                    </td>
                    <td className={td}>
                      <button type="button" onClick={() => softDelete(a.id)} className="text-[var(--tx3)] hover:text-red-400 text-[11px]" title="Deactivate">×</button>
                    </td>
                  </tr>
                  {isTiered && tiersOpen && (
                    <tr>
                      <td />
                      <td colSpan={9} className="py-2 px-2">
                        <TierEditor tiers={a.tiers} onChange={(t) => updateAddon(a.id, "tiers", t)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <SaveBar onSave={save} onUndo={undo} />
    </div>
  );
}

/* ────────── 12. INVENTORY & VOLUME ────────── */

function InventoryVolumeSection() {
  const bm = useSection("volume-benchmarks");
  const iw = useSection("item-weights");
  const [itemSearch, setItemSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const WEIGHT_OPTS = [0.5, 1.0, 2.0, 3.0];
  const CATEGORY_OPTS = ["furniture", "appliance", "electronics", "decor", "other"];
  const ROOM_OPTS = ["bedroom", "living_room", "dining_room", "kitchen", "office", "outdoor", "kids", "garage", "specialty", "other"];

  const filteredItems = iw.rows.filter((r) => {
    if (!showInactive && !r.active) return false;
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return String(r.item_name).toLowerCase().includes(q) || String(r.slug).includes(q) || String(r.category).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* ── Volume Benchmarks ── */}
      <div>
        <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Volume Benchmarks by Move Size</h4>
        <p className="text-[9px] text-[var(--tx3)] mb-3">
          These benchmarks define the &quot;standard&quot; inventory for each move size. The algorithm compares the client&apos;s actual inventory score to the benchmark.
        </p>
        {bm.loading ? (
          <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={tbl}>
                <thead>
                  <tr>
                    <th className={th}>Move Size</th>
                    <th className={th}>Std Items</th>
                    <th className={th}>Item Score</th>
                    <th className={th}>Boxes</th>
                    <th className={th}>Box Score</th>
                    <th className={th}>Benchmark</th>
                    <th className={th}>Min Mod</th>
                    <th className={th}>Max Mod</th>
                    <th className={th}>Min Items</th>
                  </tr>
                </thead>
                <tbody>
                  {bm.rows.map((r) => (
                    <tr key={String(r.id)}>
                      <td className={`${td} font-medium text-[var(--tx)]`}>{String(r.move_size)}</td>
                      <td className={td}>
                        <EditCell value={Number(r.std_major_items)} onChange={(v) => bm.updateRow(String(r.id), "std_major_items", Number(v))} type="number" className="w-12" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.std_item_score)} onChange={(v) => bm.updateRow(String(r.id), "std_item_score", Number(v))} type="number" className="w-14" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.assumed_boxes)} onChange={(v) => bm.updateRow(String(r.id), "assumed_boxes", Number(v))} type="number" className="w-12" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.box_score)} onChange={(v) => bm.updateRow(String(r.id), "box_score", Number(v))} type="number" className="w-14" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.benchmark_score)} onChange={(v) => bm.updateRow(String(r.id), "benchmark_score", Number(v))} type="number" className="w-14 font-bold text-[var(--gold)]" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.min_modifier)} onChange={(v) => bm.updateRow(String(r.id), "min_modifier", Number(v))} type="number" className="w-14" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.max_modifier)} onChange={(v) => bm.updateRow(String(r.id), "max_modifier", Number(v))} type="number" className="w-14" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.min_items_for_adjustment)} onChange={(v) => bm.updateRow(String(r.id), "min_items_for_adjustment", Number(v))} type="number" className="w-12" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SaveBar onSave={() => bm.save()} onUndo={bm.undo} />
          </>
        )}
      </div>

      {/* ── Item Weight Scores ── */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Item Weight Scores</h4>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)] cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[var(--gold)]" />
              Show inactive
            </label>
            <button
              type="button"
              onClick={() => iw.add({ item_name: "New Item", slug: `custom-${Date.now()}`, weight_score: 1.0, category: "furniture", is_common: false, active: true, display_order: 999 })}
              className="text-[10px] font-bold text-[var(--gold)] hover:text-[var(--gold)]/80 flex items-center gap-0.5"
            >
              + Add Item
            </button>
          </div>
        </div>

        <input
          type="text"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="Search items…"
          className="w-full mb-3 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none"
        />

        {iw.loading ? (
          <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className={tbl}>
                <thead>
                  <tr className="bg-[var(--bg)]">
                    <th className={th}>Item Name</th>
                    <th className={th}>Slug</th>
                    <th className={th}>Weight</th>
                    <th className={th}>Category</th>
                    <th className={`${th} text-center`}>Common</th>
                    <th className={`${th} text-center`}>Active</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((r) => (
                    <tr key={String(r.id)} className={!r.active ? "opacity-40" : ""}>
                      <td className={td}>
                        <EditCell value={String(r.item_name)} onChange={(v) => iw.updateRow(String(r.id), "item_name", v)} className="font-medium text-[var(--tx)]" />
                      </td>
                      <td className={td}>
                        <span className="text-[10px] font-mono text-[var(--tx3)]">{String(r.slug)}</span>
                      </td>
                      <td className={td}>
                        <select
                          value={Number(r.weight_score)}
                          onChange={(e) => iw.updateRow(String(r.id), "weight_score", Number(e.target.value))}
                          className={`bg-transparent text-[11px] outline-none border-none cursor-pointer font-bold ${
                            Number(r.weight_score) >= 2 ? "text-orange-400" : Number(r.weight_score) <= 0.5 ? "text-[var(--tx3)]" : "text-[var(--gold)]"
                          }`}
                        >
                          {WEIGHT_OPTS.map((w) => (
                            <option key={w} value={w}>×{w}</option>
                          ))}
                        </select>
                      </td>
                      <td className={td}>
                        <select
                          value={String(r.category)}
                          onChange={(e) => iw.updateRow(String(r.id), "category", e.target.value)}
                          className="bg-transparent text-[10px] text-[var(--tx3)] outline-none border-none cursor-pointer"
                        >
                          {CATEGORY_OPTS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className={`${td} text-center`}>
                        <button type="button" role="switch" aria-checked={!!r.is_common} onClick={() => iw.updateRow(String(r.id), "is_common", !r.is_common)} className={`relative w-8 h-4 rounded-full transition-colors ${r.is_common ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${r.is_common ? "translate-x-4" : ""}`} />
                        </button>
                      </td>
                      <td className={`${td} text-center`}>
                        <button type="button" role="switch" aria-checked={!!r.active} onClick={() => iw.updateRow(String(r.id), "active", !r.active)} className={`relative w-8 h-4 rounded-full transition-colors ${r.active ? "bg-green-500" : "bg-[var(--brd)]"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${r.active ? "translate-x-4" : ""}`} />
                        </button>
                      </td>
                      <td className={td}>
                        <button type="button" onClick={() => iw.remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]" title="Delete">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[9px] text-[var(--tx3)] mt-1">{filteredItems.length} items shown</div>
            <SaveBar onSave={() => iw.save()} onUndo={iw.undo} />
          </>
        )}
      </div>

      {/* ── Custom Items Used ── */}
      <CustomItemsUsedSection onAddToMaster={() => { iw.reload?.(); }} />
    </div>
  );
}

function CustomItemsUsedSection({ onAddToMaster }: { onAddToMaster?: () => void }) {
  const [items, setItems] = useState<{ item_name: string; weight_used: number; times_used: number; first_used: string; last_used: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState<{ item_name: string; weight_used: number } | null>(null);
  const [addForm, setAddForm] = useState({ item_name: "", weight_score: 1, category: "furniture", room: "other", is_common: false });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/pricing/custom-items");
      const d = await r.json();
      setItems(d.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddToMaster = async () => {
    if (!addModal) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/pricing/custom-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_to_master",
          item_name: addForm.item_name || addModal.item_name,
          weight_score: addForm.weight_score,
          category: addForm.category,
          room: addForm.room,
          is_common: addForm.is_common,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast("Added to master list", "check");
      setAddModal(null);
      fetchItems();
      onAddToMaster?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async (itemName: string) => {
    try {
      const r = await fetch("/api/admin/pricing/custom-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", item_name: itemName }),
      });
      if (!r.ok) throw new Error("Failed");
      toast("Dismissed", "check");
      fetchItems();
    } catch {
      toast("Failed to dismiss", "x");
    }
  };

  const openAddModal = (item: { item_name: string; weight_used: number }) => {
    setAddModal(item);
    setAddForm({
      item_name: item.item_name,
      weight_score: item.weight_used,
      category: "furniture",
      room: "other",
      is_common: false,
    });
  };

  const WEIGHT_OPTS = [0.5, 1.0, 2.0, 3.0];
  const CATEGORY_OPTS = ["furniture", "appliance", "electronics", "decor", "other"];
  const ROOM_OPTS = ["bedroom", "living_room", "dining_room", "kitchen", "office", "outdoor", "kids", "garage", "specialty", "other"];

  return (
    <div className="border-t border-[var(--brd)]/30 pt-6">
      <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Custom Items Used in Quotes/Moves</h4>
      <p className="text-[9px] text-[var(--tx3)] mb-3">
        Items coordinators entered that are not in the master list. Add popular ones to item_weights.
      </p>
      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-[var(--tx3)]">No custom items used yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
          <table className={tbl}>
            <thead>
              <tr className="bg-[var(--bg)]">
                <th className={th}>Item Name</th>
                <th className={th}>Weight Used</th>
                <th className={th}>Times Used</th>
                <th className={th}>First Used</th>
                <th className={th}>Last Used</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.item_name}>
                  <td className={`${td} font-medium text-[var(--tx)]`}>{row.item_name}</td>
                  <td className={td}>{row.weight_used} ({row.weight_used >= 2 ? "Heavy" : row.weight_used <= 0.5 ? "Light" : "Medium"})</td>
                  <td className={td}>{row.times_used}</td>
                  <td className={td}>{row.first_used ? new Date(row.first_used).toLocaleDateString() : "—"}</td>
                  <td className={td}>{row.last_used ? new Date(row.last_used).toLocaleDateString() : "—"}</td>
                  <td className={td}>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openAddModal(row)}
                        className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        Add to Master List
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDismiss(row.item_name)}
                        className="text-[10px] text-[var(--tx3)] hover:text-[var(--red)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 w-full max-w-md shadow-xl">
            <h3 className="text-[13px] font-bold text-[var(--tx)] mb-3">Add to Master List</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] font-semibold text-[var(--tx3)] mb-1">Item name</label>
                <input
                  type="text"
                  value={addForm.item_name}
                  onChange={(e) => setAddForm((p) => ({ ...p, item_name: e.target.value }))}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--tx3)] mb-1">Weight score</label>
                <select
                  value={addForm.weight_score}
                  onChange={(e) => setAddForm((p) => ({ ...p, weight_score: Number(e.target.value) }))}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
                >
                  {WEIGHT_OPTS.map((w) => (
                    <option key={w} value={w}>{w} ({w >= 2 ? "Heavy" : w <= 0.5 ? "Light" : "Medium"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--tx3)] mb-1">Category</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
                >
                  {CATEGORY_OPTS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-[var(--tx3)] mb-1">Room</label>
                <select
                  value={addForm.room}
                  onChange={(e) => setAddForm((p) => ({ ...p, room: e.target.value }))}
                  className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)]"
                >
                  {ROOM_OPTS.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.is_common}
                  onChange={(e) => setAddForm((p) => ({ ...p, is_common: e.target.checked }))}
                  className="accent-[var(--gold)]"
                />
                Is common (show in quick-add)
              </label>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setAddModal(null)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-[var(--tx2)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToMaster}
                disabled={saving || !addForm.item_name.trim()}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save to Master List"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── 13. FLEET & VEHICLES ────────── */

function FleetVehiclesSection() {
  const fleet = useSection("fleet-vehicles");
  const rules = useSection("truck-rules");

  const VEHICLE_TYPES = ["sprinter", "16ft", "20ft", "24ft", "26ft"];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Vehicle Types</h4>
          <button type="button" onClick={() => fleet.add({ vehicle_type: `custom-${Date.now()}`, display_name: "New Vehicle", cargo_cubic_ft: 0, capacity_lbs: 0, is_available: true, display_order: 99 })} className="text-[10px] font-bold text-[var(--gold)] hover:text-[var(--gold)]/80 flex items-center gap-0.5">+ Add Vehicle</button>
        </div>
        {fleet.loading ? <p className="text-[11px] text-[var(--tx3)]">Loading…</p> : (
          <>
            <div className="overflow-x-auto rounded-lg border border-[var(--brd)]">
              <table className={tbl}>
                <thead><tr className="bg-[var(--bg)]">
                  <th className={th}>Type</th>
                  <th className={th}>Display Name</th>
                  <th className={th}>Cargo (cu ft)</th>
                  <th className={th}>Capacity (lbs)</th>
                  <th className={th}>Plate</th>
                  <th className={`${th} text-center`}>Available</th>
                  <th className={th} />
                </tr></thead>
                <tbody>
                  {fleet.rows.map((r) => (
                    <tr key={String(r.id)} className={!r.is_available ? "opacity-40" : ""}>
                      <td className={`${td} font-mono text-[10px] text-[var(--gold)]`}>{String(r.vehicle_type)}</td>
                      <td className={td}><EditCell value={String(r.display_name)} onChange={(v) => fleet.updateRow(String(r.id), "display_name", v)} className="font-medium text-[var(--tx)]" /></td>
                      <td className={td}><EditCell value={Number(r.cargo_cubic_ft)} onChange={(v) => fleet.updateRow(String(r.id), "cargo_cubic_ft", Number(v))} type="number" className="w-16" /></td>
                      <td className={td}><EditCell value={Number(r.capacity_lbs)} onChange={(v) => fleet.updateRow(String(r.id), "capacity_lbs", Number(v))} type="number" className="w-16" /></td>
                      <td className={td}><EditCell value={String(r.license_plate || "—")} onChange={(v) => fleet.updateRow(String(r.id), "license_plate", v === "—" ? "" : v)} className="text-[var(--tx3)] font-mono" /></td>
                      <td className={`${td} text-center`}>
                        <button type="button" role="switch" aria-checked={!!r.is_available} onClick={() => fleet.updateRow(String(r.id), "is_available", !r.is_available)} className={`relative w-8 h-4 rounded-full transition-colors ${r.is_available ? "bg-green-500" : "bg-[var(--brd)]"}`}>
                          <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${r.is_available ? "translate-x-4" : ""}`} />
                        </button>
                      </td>
                      <td className={td}><button type="button" onClick={() => fleet.remove(String(r.id))} className="text-[var(--tx3)] hover:text-red-400 text-[11px]">×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SaveBar onSave={() => fleet.save()} onUndo={fleet.undo} />
          </>
        )}
      </div>

      <div className="border-t border-[var(--brd)]/30 pt-6">
        <h4 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Allocation Rules</h4>
        <p className="text-[9px] text-[var(--tx3)] mb-3">Maps move size + inventory level to recommended vehicle(s).</p>
        {rules.loading ? <p className="text-[11px] text-[var(--tx3)]">Loading…</p> : (
          <>
            <div className="overflow-x-auto">
              <table className={tbl}>
                <thead><tr>
                  <th className={th}>Move Size</th>
                  <th className={th}>Inventory</th>
                  <th className={th}>Primary</th>
                  <th className={th}>Secondary</th>
                  <th className={th}>Notes</th>
                </tr></thead>
                <tbody>
                  {rules.rows.map((r) => (
                    <tr key={String(r.id)}>
                      <td className={`${td} font-medium text-[var(--tx)]`}>{String(r.move_size)}</td>
                      <td className={`${td} text-[var(--tx3)]`}>{String(r.inventory_range)}</td>
                      <td className={td}>
                        <select value={String(r.primary_vehicle)} onChange={(e) => rules.updateRow(String(r.id), "primary_vehicle", e.target.value)} className="bg-transparent text-[11px] text-[var(--gold)] font-bold outline-none border-none cursor-pointer">
                          {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className={td}>
                        <select value={String(r.secondary_vehicle || "")} onChange={(e) => rules.updateRow(String(r.id), "secondary_vehicle", e.target.value || "")} className="bg-transparent text-[11px] text-[var(--tx3)] outline-none border-none cursor-pointer">
                          <option value="">None</option>
                          {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>
                      <td className={td}><EditCell value={String(r.notes || "—")} onChange={(v) => rules.updateRow(String(r.id), "notes", v === "—" ? "" : v)} className="text-[var(--tx3)]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SaveBar onSave={() => rules.save()} onUndo={rules.undo} />
          </>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════════ */
export default function PricingControlPanel() {
  return (
    <div className="space-y-2.5">
      <AnalyticsDashboard />

      <Accordion title="Base Rates (Residential)" subtitle={`Move size → base price, crew, hours`} defaultOpen>
        <BaseRatesSection />
      </Accordion>

      <Accordion title="Tier Multipliers" subtitle="Essentials, Premier, Estate pricing tiers">
        <TierMultipliersSection />
      </Accordion>

      <Accordion title="Neighbourhood Tiers" subtitle="Postal code pricing adjustments (GTA)">
        <NeighbourhoodsSection />
      </Accordion>

      <Accordion title="Access Surcharges" subtitle="Walk-ups, long carries, parking">
        <AccessScoresSection />
      </Accordion>

      <Accordion title="Date & Season Factors" subtitle="Day of week, seasonal, urgency multipliers">
        <DateFactorsSection />
      </Accordion>

      <Accordion title="Specialty Item Surcharges" subtitle="Pianos, pool tables, safes, artwork">
        <SpecialtySurchargesSection />
      </Accordion>

      <Accordion title="Single Item Delivery Rates" subtitle="Category pricing, distance, assembly">
        <SingleItemSection />
      </Accordion>

      <Accordion title="Deposit Rules" subtitle="Service type × amount bracket matrix">
        <DepositRulesSection />
      </Accordion>

      <Accordion title="Office / Commercial Rates" subtitle="Per sq ft, workstation, IT equipment">
        <OfficeRatesSection />
      </Accordion>

      <Accordion title="Add-Ons" subtitle="Optional services, tiered & per-unit pricing">
        <AddOnsSection />
      </Accordion>

      <Accordion title="Inventory & Volume" subtitle="Item weight scores and volume benchmarks per move size">
        <InventoryVolumeSection />
      </Accordion>
    </div>
  );
}
