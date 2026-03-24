"use client";

import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { InternalConfigKeyHint } from "@/components/admin/InternalConfigKeyHint";
import { useToast } from "../components/Toast";
import {
  CaretDown,
  CaretUp,
  X,
  Plus,
  Truck,
  Users,
  Shield,
  CheckCircle,
  WarningCircle,
  CircleNotch,
} from "@phosphor-icons/react";

/* ────────── helpers ────────── */
type Row = Record<string, unknown>;

const PricingAdminContext = React.createContext<{ isSuperAdmin: boolean }>({ isSuperAdmin: false });

function usePricingAdmin() {
  return useContext(PricingAdminContext);
}

const MSG_CONFIG_MISSING =
  "This setting isn’t configured yet. Contact an administrator.";

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
async function parseJsonOrEmpty(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  try {
    return (await res.json()) as { error?: string } & Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchSection(section: string): Promise<Row[]> {
  const res = await fetch(`/api/admin/pricing?section=${encodeURIComponent(section)}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = await parseJsonOrEmpty(res);
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to load pricing");
  return (json.data as Row[]) || [];
}

async function saveRows(section: string, rows: Row[]) {
  const res = await fetch("/api/admin/pricing", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ section, rows }),
  });
  const json = await parseJsonOrEmpty(res);
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to save");
}

async function addRow(section: string, row: Row): Promise<Row> {
  const res = await fetch("/api/admin/pricing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ section, row }),
  });
  const json = await parseJsonOrEmpty(res);
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to add");
  const data = json.data as Row | undefined;
  if (!data) throw new Error("Failed to add");
  return data;
}

async function deleteRow(section: string, id: string) {
  const res = await fetch("/api/admin/pricing", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ section, id }),
  });
  const json = await parseJsonOrEmpty(res);
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to delete");
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
          <CaretDown size={14} weight="regular" className={`transition-transform duration-200 text-current ${open ? "rotate-180" : ""}`} />
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
type SaveOpts = { silent?: boolean };

function useSection(section: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState<Row[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSection(section);
      setRows(data);
      setPrev(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load " + section, "x");
    }
    setLoading(false);
  }, [section, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (updated?: Row[], opts?: SaveOpts) => {
    const toSave = updated || rows;
    setSaving(true);
    try {
      await saveRows(section, toSave);
      setPrev(toSave);
      if (!opts?.silent) toast("Saved", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const undo = () => { setRows(prev); };

  const add = async (row: Row): Promise<Row | null> => {
    try {
      const created = await addRow(section, row);
      setRows((r) => [...r, created]);
      toast("Added", "check");
      return created;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add", "x");
      return null;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteRow(section, id);
      setRows((r) => r.filter((row) => row.id !== id));
      toast("Removed", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "x");
    }
  };

  const updateRow = (id: string, field: string, value: string | number | boolean) => {
    setRows((r) => r.map((row) => row.id === id ? { ...row, [field]: value } : row));
  };

  return { rows, loading, saving, setRows, save, undo, add, remove, updateRow, reload: load };
}

/* ────────── Table wrapper ────────── */
const tbl = "w-full text-[12px]";
const th = "text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2";
const td = "py-1.5 px-2 border-t border-[var(--brd)]/50";

function SaveBar({
  onSave,
  onUndo,
  saving = false,
}: {
  onSave: () => void | Promise<void>;
  onUndo: () => void;
  saving?: boolean;
}) {
  const runSave = async () => {
    try {
      await Promise.resolve(onSave());
    } catch {
      /* errors are toasted inside useSection / handlers */
    }
  };
  return (
    <div className="flex items-center gap-2 pt-3">
      <button
        type="button"
        disabled={saving}
        onClick={() => void runSave()}
        className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onUndo}
        className="px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:bg-[var(--bg)] transition-colors disabled:opacity-40"
      >
        Undo
      </button>
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
    { label: "Top Tier", value: TIER_LABEL[String(data.mostQuotedTier || "")] || String(data.mostQuotedTier || "-") },
    { label: "Best Hood", value: data.highestConvertingHood || "-" },
    { label: "Lost Reason", value: data.topLostReason || "-" },
  ];

  return (
    <div className="flex flex-wrap gap-px mb-6 rounded-xl overflow-hidden border border-[var(--brd)] bg-[var(--brd)]">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="flex-1 min-w-[100px] bg-[var(--card)] px-4 py-3 flex flex-col gap-1"
        >
          <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--tx3)] leading-none">
            {m.label}
          </div>
          <div className="text-[18px] font-bold font-heading text-[var(--tx)] leading-tight break-words">
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────── S1: BASE RATES ────────── */
function BaseRatesSection() {
  const { rows, loading, save, undo, add, remove, updateRow, saving } = useSection("base-rates");
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S1.5: LABOUR & ESTATE PRICING ────────── */
function LabourPricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;
  const getVal = (key: string) => rows.find((r) => r.key === key);
  const labourRow = getVal("labour_rate_per_mover_hour");
  const rate = Number(labourRow?.value ?? 35);
  const estateSuppliesRow = getVal("estate_supplies_allowance");
  const estateSuppliesBase = Number(estateSuppliesRow?.value ?? 250);

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        Charged when actual crew × hours exceeds the move-size baseline. Higher = more sensitive to crew/hours. Lower = gentler adjustment.
      </p>
      {labourRow ? (
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-[var(--tx)]">Rate per extra mover-hour ($)</label>
          <EditCell value={rate} onChange={(v) => updateRow(String(labourRow.id), "value", v)} type="number" className="w-20 text-[var(--text-base)] font-bold text-[var(--gold)]" />
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
          <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="labour_rate_per_mover_hour" />
        </div>
      )}

      <p className="text-[11px] text-[var(--tx3)] mt-4">
        Estate tier only: base packing supplies allowance in dollars. Scaled by move size (2br→5br) and inventory complexity in the quote algorithm.
      </p>
      {estateSuppliesRow ? (
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-[var(--tx)]">Estate supplies base ($)</label>
          <EditCell value={estateSuppliesBase} onChange={(v) => updateRow(String(estateSuppliesRow.id), "value", v)} type="number" className="w-24 text-[var(--text-base)] font-bold text-[var(--gold)]" />
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
          <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="estate_supplies_allowance" />
        </div>
      )}

      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S2: TIER MULTIPLIERS ────────── */
function TierMultipliersSection() {
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const getVal = (key: string) => rows.find((r) => r.key === key);
  // Support both old and new config keys after migration
  const curM = Number(getVal("tier_essential_multiplier")?.value ?? getVal("tier_curated_multiplier")?.value ?? getVal("tier_essentials_multiplier")?.value) || 1;
  const sigM = Number(getVal("tier_signature_multiplier")?.value ?? getVal("tier_premier_multiplier")?.value) || 1.50;
  const estM = Number(getVal("tier_estate_multiplier")?.value) || 3.15;
  const minJob = Number(getVal("minimum_job_amount")?.value) || 549;
  const rounding = Number(getVal("rounding_nearest")?.value) || 50;
  const taxRate = Number(getVal("tax_rate")?.value) || 0.13;

  const previewBase = 1200;
  const preview = (m: number) => Math.round((previewBase * m) / rounding) * rounding;

  const tiers = [
    {
      key: getVal("tier_essential_multiplier") ? "tier_essential_multiplier" : getVal("tier_curated_multiplier") ? "tier_curated_multiplier" : "tier_essentials_multiplier",
      label: "Essential",
      desc: "Base rate, reliable move",
      m: curM,
    },
    {
      key: getVal("tier_signature_multiplier") ? "tier_signature_multiplier" : "tier_premier_multiplier",
      label: "Signature",
      desc: "Full wrapping, mattress covers, enhanced coverage",
      m: sigM,
    },
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
        <span className="ml-2">Essential = <b className="text-[var(--gold)]">{currency(preview(curM))}</b></span>
        <span className="ml-2">→ Signature = <b className="text-[var(--gold)]">{currency(preview(sigM))}</b></span>
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
              <EditCell value={c.val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="text-[var(--text-base)] font-bold text-[var(--tx)]" />
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S3: NEIGHBOURHOODS ────────── */
function NeighbourhoodsSection() {
  const { rows, loading, save, undo, add, remove, updateRow, saving } = useSection("neighbourhoods");
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S4: ACCESS SURCHARGES ────────── */
function AccessScoresSection() {
  const { rows, loading, save, undo, add, remove, updateRow, saving } = useSection("access-scores");
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S5: DATE FACTORS ────────── */
function DateFactorsSection() {
  const { rows, loading, save, undo, updateRow, saving } = useSection("date-factors");
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
      <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">{title}</h4>
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S6: SPECIALTY SURCHARGES ────────── */
function SpecialtySurchargesSection() {
  const { rows, loading, save, undo, add, remove, updateRow, saving } = useSection("surcharges");
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── S7: SINGLE ITEM RATES ────────── */
function SingleItemSection() {
  const { rows, loading, save, undo, add, remove, updateRow, saving } = useSection("single-item");
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
              <EditCell value={row.value as string} onChange={(v) => configSection.updateRow(String(row.id), "value", v)} type="number" className="text-[var(--text-base)] font-bold text-[var(--tx)]" />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving || configSection.saving}
          onClick={() => void save()}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-60 disabled:cursor-wait"
        >
          {saving ? "Saving…" : "Save Rates"}
        </button>
        <button
          type="button"
          disabled={saving || configSection.saving}
          onClick={() => void configSection.save()}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-60 disabled:cursor-wait"
        >
          {configSection.saving ? "Saving…" : "Save Config"}
        </button>
        <button
          type="button"
          disabled={saving || configSection.saving}
          onClick={() => { undo(); configSection.undo(); }}
          className="px-3 py-2 rounded-lg text-[11px] text-[var(--tx3)] disabled:opacity-40"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

/* ────────── S8: DEPOSIT RULES ────────── */
const BRACKETS = ["under_500", "500_999", "1000_2999", "3000_4999", "5000_plus"];
const BRACKET_LABELS: Record<string, string> = { under_500: "<$500", "500_999": "$500–999", "1000_2999": "$1K–2.9K", "3000_4999": "$3K–4.9K", "5000_plus": "$5K+" };
const SERVICE_TYPES = ["residential", "long_distance", "office", "single_item", "white_glove", "specialty"];

const DEPOSIT_TIER_KEYS = [
  { tier: "Essential", pctKey: "deposit_essential_pct", minKey: "deposit_essential_min", pctDefault: 10, minDefault: 150 },
  { tier: "Signature", pctKey: "deposit_signature_pct", minKey: "deposit_signature_min", pctDefault: 15, minDefault: 250 },
  { tier: "Estate", pctKey: "deposit_estate_pct", minKey: "deposit_estate_min", pctDefault: 25, minDefault: 500 },
] as const;

function DepositRulesSection() {
  const { rows, loading, save, undo, updateRow, saving } = useSection("deposit-rules");
  const configSection = useSection("config");
  const getCell = (service: string, bracket: string) => rows.find((r) => r.service_type === service && r.amount_bracket === bracket);
  const getConfig = (key: string) => configSection.rows.find((r: Row & { key?: string }) => r.key === key);

  if (loading || configSection.loading) return <Skeleton />;

  return (
    <div className="pt-4 space-y-4">
      <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold)]/5 px-4 py-3">
        <p className="font-semibold text-[var(--gold)] mb-2 text-[12px]">Residential (local), tier-based deposits</p>
        <p className="text-[11px] text-[var(--tx3)] mb-3">These values are used for quotes and payments. Editable below.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DEPOSIT_TIER_KEYS.map(({ tier, pctKey, minKey, pctDefault, minDefault }) => {
            const pctRow = getConfig(pctKey);
            const minRow = getConfig(minKey);
            return (
              <div key={tier} className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--bg)]/80 px-3 py-2 border border-[var(--brd)]/50">
                <span className="text-[11px] font-semibold text-[var(--tx2)] w-20">{tier}</span>
                <div className="flex items-center gap-1">
                  <EditCell
                    value={pctRow ? Number(pctRow.value) : pctDefault}
                    onChange={(v) => pctRow && configSection.updateRow(String(pctRow.id), "value", String(v))}
                    type="number"
                    className="w-10 font-semibold text-[var(--gold)] text-[11px]"
                  />
                  <span className="text-[10px] text-[var(--tx3)]">%</span>
                </div>
                <span className="text-[10px] text-[var(--tx3)]">min $</span>
                <EditCell
                  value={minRow ? Number(minRow.value) : minDefault}
                  onChange={(v) => minRow && configSection.updateRow(String(minRow.id), "value", String(v))}
                  type="number"
                  className="w-14 font-semibold text-[var(--gold)] text-[11px]"
                />
              </div>
            );
          })}
        </div>
      </div>
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
                {st === "residential" ? (
                  <td colSpan={BRACKETS.length} className={`${td} bg-[var(--gold)]/5 text-[11px] text-[var(--tx3)]`}>
                    Tier-based (Essential / Signature / Estate), defined above.
                  </td>
                ) : (
                  BRACKETS.map((b) => {
                    const cell = getCell(st, b);
                    if (!cell) return <td key={b} className={td}>-</td>;
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
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SaveBar
        saving={saving || configSection.saving}
        onSave={async () => {
          await save();
          await configSection.save();
        }}
        onUndo={() => {
          undo();
          configSection.undo();
        }}
      />
    </div>
  );
}

/* ────────── S9: OFFICE RATES ────────── */
function OfficeRatesSection() {
  const { rows, loading, save, undo, updateRow, saving } = useSection("office-rates");
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
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
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
const TIER_OPTIONS = ["essential", "signature", "estate"];

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
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState<Addon[]>([]);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pricing/addons", { credentials: "same-origin", cache: "no-store" });
      const json = await parseJsonOrEmpty(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to load");
      setRows((json.data as Addon[]) || []);
      setPrev((json.data as Addon[]) || []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load add-ons", "x");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing/addons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ rows }),
      });
      const json = await parseJsonOrEmpty(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to save");
      setPrev(rows);
      toast("Add-ons saved", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
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

  return { rows, loading, saving, save, undo, addAddon, softDelete, updateAddon, moveRow };
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
          <span key={s} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${SERVICE_TYPE_BADGES[s] || "bg-[var(--bg)] text-[var(--tx3)]"}`}>
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
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border capitalize transition-colors ${
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
  const { rows, loading, saving, save, undo, addAddon, softDelete, updateAddon, moveRow } = useAddons();
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
                        <EditCell value={a.unit_label || "-"} onChange={(v) => updateAddon(a.id, "unit_label", v === "-" ? "" : v)} className="text-[var(--tx3)]" />
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

      <SaveBar onSave={() => void save()} onUndo={undo} saving={saving} />
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
        <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Volume Benchmarks by Move Size</h4>
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
                    <th className={th}>Baseline Crew</th>
                    <th className={th}>Baseline Hours</th>
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
                      <td className={td}>
                        <EditCell value={Number(r.baseline_crew ?? 2)} onChange={(v) => bm.updateRow(String(r.id), "baseline_crew", Number(v))} type="number" className="w-14" />
                      </td>
                      <td className={td}>
                        <EditCell value={Number(r.baseline_hours ?? 4)} onChange={(v) => bm.updateRow(String(r.id), "baseline_hours", Number(v))} type="number" className="w-14" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SaveBar onSave={() => void bm.save()} onUndo={bm.undo} saving={bm.saving} />
          </>
        )}
      </div>

      {/* ── Item Weight Scores ── */}
      <div className="border-t border-[var(--brd)]/30 pt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Item Weight Scores</h4>
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
            <SaveBar onSave={() => void iw.save()} onUndo={iw.undo} saving={iw.saving} />
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
      <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Custom Items Used in Quotes/Moves</h4>
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
                  <td className={td}>{row.first_used ? new Date(row.first_used).toLocaleDateString() : "-"}</td>
                  <td className={td}>{row.last_used ? new Date(row.last_used).toLocaleDateString() : "-"}</td>
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
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
          <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Vehicle Types</h4>
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
                      <td className={td}><EditCell value={String(r.license_plate || "-")} onChange={(v) => fleet.updateRow(String(r.id), "license_plate", v === "-" ? "" : v)} className="text-[var(--tx3)] font-mono" /></td>
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
            <SaveBar onSave={() => void fleet.save()} onUndo={fleet.undo} saving={fleet.saving} />
          </>
        )}
      </div>

      <div className="border-t border-[var(--brd)]/30 pt-6">
        <h4 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Allocation Rules</h4>
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
                      <td className={td}><EditCell value={String(r.notes || "-")} onChange={(v) => rules.updateRow(String(r.id), "notes", v === "-" ? "" : v)} className="text-[var(--tx3)]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <SaveBar onSave={() => void rules.save()} onUndo={rules.undo} saving={rules.saving} />
          </>
        )}
      </div>
    </div>
  );
}

/* ────────── S12: PACKAGE & TIER FEATURES ────────── */

const ICON_OPTIONS = [
  { name: "Truck", label: "Truck" },
  { name: "Users", label: "Users / Crew" },
  { name: "Shield", label: "Shield" },
  { name: "ShieldCheck", label: "Shield Check" },
  { name: "Package", label: "Package / Wrapping" },
  { name: "Home", label: "Home / Room" },
  { name: "Wrench", label: "Wrench / Tools" },
  { name: "MapPin", label: "Map Pin / GPS" },
  { name: "DollarSign", label: "Money / price" },
  { name: "Star", label: "Star / Premium" },
  { name: "Phone", label: "Phone / Coordinator" },
  { name: "Gift", label: "Gift / Perks" },
  { name: "ClipboardCheck", label: "Clipboard / Walkthrough" },
  { name: "Shirt", label: "Shirt / Wardrobe" },
  { name: "Trash2", label: "Trash / Removal" },
  { name: "Box", label: "Box / Supplies" },
  { name: "Thermometer", label: "Thermometer / Climate" },
  { name: "Eye", label: "Eye / Inspection" },
  { name: "Calendar", label: "Calendar / Schedule" },
  { name: "Clock", label: "Clock / Time" },
  { name: "CheckCircle", label: "Check Circle (default)" },
];

const ICON_KEYWORDS: Record<string, string[]> = {
  Truck: ["truck", "moving truck", "vehicle", "dedicated"],
  Users: ["crew", "movers", "team", "specialist", "coordinator"],
  Shield: ["protection", "valuation", "coverage", "insurance", "zero-damage", "mattress", "tv"],
  ShieldCheck: ["enhanced valuation", "full replacement", "full coverage"],
  Package: ["wrapping", "blankets", "padding", "packing", "crating", "supplies", "boxes", "materials"],
  Home: ["floor", "door", "wall", "room of choice", "placement", "doorway"],
  Wrench: ["disassembly", "reassembly", "assembly", "equipment", "tools"],
  MapPin: ["gps", "tracking", "real-time", "live"],
  DollarSign: ["flat price", "guaranteed", "price"],
  Star: ["white glove", "premium", "handling", "antique", "art"],
  Phone: ["concierge", "support", "contact"],
  Gift: ["perks", "offers", "partner", "exclusive"],
  ClipboardCheck: ["walkthrough", "inventory", "plan", "inspection"],
  Shirt: ["wardrobe", "clothes", "garment"],
  Trash2: ["debris", "removal", "packaging", "cleanup"],
  Box: ["box"],
  Thermometer: ["climate", "temperature", "controlled"],
  Eye: ["condition", "report"],
  Calendar: ["day support"],
  Clock: ["concierge support", "30 day", "post-move"],
};

function getAutoIcon(text: string): string {
  const lower = text.toLowerCase();
  for (const [icon, keywords] of Object.entries(ICON_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) return icon;
  }
  return "CheckCircle";
}

/** Mini icon preview rendered inline next to each feature row */
function IconPreview({ iconName }: { iconName: string }) {
  const cls = "text-current shrink-0";
  const s = 12;
  switch (iconName) {
    case "Truck": return <Truck size={s} className={cls} />;
    case "Users": return <Users size={s} className={cls} />;
    case "Shield": return <Shield size={s} className={cls} />;
    case "CheckCircle": return <CheckCircle size={s} className={cls} />;
    default: return <WarningCircle size={s} className={cls} />;
  }
}

const SERVICE_TYPE_META: { key: string; label: string; tiers: string[] }[] = [
  { key: "local_move",    label: "Residential (Local)",  tiers: ["essential", "signature", "estate"] },
  { key: "long_distance", label: "Long Distance",        tiers: ["custom"] },
  { key: "office_move",   label: "Office / Commercial",  tiers: ["custom"] },
  { key: "single_item",   label: "Single Item Delivery", tiers: ["custom"] },
  { key: "white_glove",   label: "White Glove",          tiers: ["custom"] },
  { key: "specialty",     label: "Specialty",            tiers: ["custom"] },
  { key: "event",         label: "Event",                tiers: ["custom"] },
  { key: "b2b_delivery",  label: "B2B One-Off",          tiers: ["custom"] },
];

const TIER_LABEL: Record<string, string> = {
  essential: "Essential",
  curated: "Essential",
  signature: "Signature",
  estate: "Estate",
  custom: "Package",
  // legacy keys
  essentials: "Essential",
  premier: "Signature",
};

const TIER_COLOR: Record<string, string> = {
  essential: "text-[var(--tx3)] border-[var(--brd)]",
  curated: "text-[var(--tx3)] border-[var(--brd)]",
  signature: "text-blue-400 border-blue-400/30",
  estate: "text-[var(--gold)] border-[var(--gold)]/30",
  custom: "text-[var(--tx2)] border-[var(--brd)]",
  // legacy keys
  essentials: "text-[var(--tx3)] border-[var(--brd)]",
  premier: "text-blue-400 border-blue-400/30",
};

function TierFeaturesSection() {
  const { rows, loading, save, undo, add, remove, updateRow, reload, saving } = useSection("tier-features");
  const [activeSvc, setActiveSvc] = useState("local_move");
  const [newFeature, setNewFeature] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();

  // Icon map: feature row ID → Lucide icon name, persisted in platform_config
  const [iconMap, setIconMap] = useState<Record<string, string>>({});
  const [iconMapRowId, setIconMapRowId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/pricing?section=config")
      .then((r) => r.json())
      .then(({ data }) => {
        const row = (data as Row[])?.find((r) => r.key === "tier_feature_icons");
        if (row) {
          setIconMapRowId(String(row.id));
          try { setIconMap(JSON.parse(row.value as string) as Record<string, string>); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore */ });
  }, []);

  const saveIconMap = useCallback(async (map: Record<string, string>) => {
    const value = JSON.stringify(map);
    if (iconMapRowId) {
      await saveRows("config", [{ id: iconMapRowId, key: "tier_feature_icons", value }]);
    } else {
      const created = await addRow("config", { key: "tier_feature_icons", value });
      if (created?.id) setIconMapRowId(String(created.id));
    }
  }, [iconMapRowId]);

  const setFeatureIcon = (featureId: string, iconName: string) => {
    setIconMap((prev) => ({ ...prev, [featureId]: iconName }));
    setDirty(true);
  };

  const meta = SERVICE_TYPE_META.find((m) => m.key === activeSvc)!;

  const featuresFor = (tier: string) =>
    rows
      .filter((r) => r.service_type === activeSvc && r.tier === tier)
      .sort((a, b) => Number(a.display_order) - Number(b.display_order));

  const handleUpdate = (id: string, field: string, value: string | number | boolean) => {
    updateRow(id, field, value);
    setDirty(true);
  };

  const handleAdd = async (tier: string) => {
    const feat = (newFeature[tier] ?? "").trim();
    if (!feat) return;
    const existing = featuresFor(tier);
    const newRow = await add({
      service_type: activeSvc,
      tier,
      feature: feat,
      display_order: existing.length + 1,
      active: true,
    });
    // Auto-suggest icon based on feature text
    if (newRow?.id) {
      const autoIcon = getAutoIcon(feat);
      setIconMap((prev) => ({ ...prev, [String(newRow.id)]: autoIcon }));
      setDirty(true);
    }
    setNewFeature((prev) => ({ ...prev, [tier]: "" }));
  };

  const handleMoveUp = (id: string, tier: string) => {
    const list = featuresFor(tier);
    const idx = list.findIndex((r) => r.id === id);
    if (idx <= 0) return;
    const above = list[idx - 1];
    const cur = list[idx];
    updateRow(String(cur.id), "display_order", Number(above.display_order));
    updateRow(String(above.id), "display_order", Number(cur.display_order));
    setDirty(true);
  };

  const handleMoveDown = (id: string, tier: string) => {
    const list = featuresFor(tier);
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= list.length - 1) return;
    const below = list[idx + 1];
    const cur = list[idx];
    updateRow(String(cur.id), "display_order", Number(below.display_order));
    updateRow(String(below.id), "display_order", Number(cur.display_order));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await save(undefined, { silent: true });
    } catch {
      return;
    }
    try {
      await saveIconMap(iconMap);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save icon settings", "x");
      return;
    }
    setDirty(false);
    await reload();
    toast("Saved", "check");
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    toast("Feature removed", "check");
  };

  if (loading) return <Skeleton />;

  return (
    <div className="pt-4 space-y-5">
      {/* Service type tabs */}
      <div className="flex flex-wrap gap-1.5">
        {SERVICE_TYPE_META.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setActiveSvc(m.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
              activeSvc === m.key
                ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40"
                : "bg-transparent text-[var(--tx3)] border-[var(--brd)] hover:border-[var(--gold)]/20 hover:text-[var(--tx2)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Tier columns */}
      <div className={`grid gap-4 ${meta.tiers.length === 3 ? "grid-cols-3" : "grid-cols-1 max-w-md"}`}>
        {meta.tiers.map((tier) => {
          const features = featuresFor(tier);
          return (
            <div key={tier} className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] overflow-hidden">
              {/* Tier header */}
              <div className={`px-3 py-2 border-b border-[var(--brd)] flex items-center justify-between`}>
                <span className={`text-[10px] font-bold tracking-wider uppercase ${TIER_COLOR[tier]?.split(" ")[0] ?? "text-[var(--tx2)]"}`}>
                  {TIER_LABEL[tier] ?? tier}
                </span>
                <span className="text-[10px] text-[var(--tx3)]">{features.filter((f) => f.active).length} items</span>
              </div>

              {/* Feature list */}
              <div className="divide-y divide-[var(--brd)]/40">
                {features.length === 0 && (
                  <p className="text-[11px] text-[var(--tx3)] px-3 py-3 italic">No features yet</p>
                )}
                {features.map((f, idx) => {
                  const featureId = String(f.id);
                  const currentIcon = iconMap[featureId] ?? getAutoIcon(String(f.feature));
                  return (
                  <div key={featureId} className="flex items-center gap-2 px-3 py-2 group">
                    {/* Toggle active */}
                    <button
                      type="button"
                      title={f.active ? "Disable" : "Enable"}
                      onClick={() => handleUpdate(featureId, "active", !f.active)}
                      className={`w-3.5 h-3.5 rounded-full shrink-0 border transition-colors ${
                        f.active
                          ? "bg-[var(--grn)] border-[var(--grn)]"
                          : "bg-transparent border-[var(--brd)] opacity-40"
                      }`}
                    />

                    {/* Icon selector */}
                    <div className="shrink-0 relative" title="Icon for 'Your Move Includes' section">
                      <select
                        value={currentIcon}
                        onChange={(e) => setFeatureIcon(featureId, e.target.value)}
                        className="appearance-none w-[28px] h-[20px] opacity-0 absolute inset-0 cursor-pointer z-10"
                        title="Select icon"
                      />
                      <span className="flex items-center justify-center w-[20px] h-[20px] rounded bg-[var(--gold)]/10 text-[var(--gold)] pointer-events-none">
                        <IconPreview iconName={currentIcon} />
                      </span>
                    </div>

                    {/* Feature text */}
                    <div className={`flex-1 min-w-0 ${!f.active ? "opacity-40 line-through" : ""}`}>
                      <EditCell
                        value={String(f.feature)}
                        onChange={(v) => {
                          handleUpdate(featureId, "feature", v);
                          // Auto-suggest new icon if not manually set
                          if (!iconMap[featureId]) {
                            setIconMap((prev) => ({ ...prev, [featureId]: getAutoIcon(v) }));
                          }
                        }}
                        className={`text-[12px] w-full ${!f.active ? "text-[var(--tx3)]" : "text-[var(--tx)]"}`}
                      />
                    </div>

                    {/* Icon dropdown label (visible on hover) */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <select
                        value={currentIcon}
                        onChange={(e) => setFeatureIcon(featureId, e.target.value)}
                        className="text-[9px] bg-[var(--bg)] border border-[var(--brd)] rounded px-1 py-0.5 text-[var(--tx3)] cursor-pointer"
                        title="Icon for this feature"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.name} value={opt.name}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Reorder + delete, visible on hover */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(featureId, tier)}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-[var(--gold)]/10 text-[var(--tx3)] disabled:opacity-20"
                        title="Move up"
                      >
                        <CaretUp size={10} weight="regular" className="text-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(featureId, tier)}
                        disabled={idx === features.length - 1}
                        className="p-0.5 rounded hover:bg-[var(--gold)]/10 text-[var(--tx3)] disabled:opacity-20"
                        title="Move down"
                      >
                        <CaretDown size={10} weight="regular" className="text-current" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(featureId)}
                        className="p-0.5 rounded hover:bg-red-500/10 text-[var(--tx3)] hover:text-red-400 ml-0.5"
                        title="Remove feature"
                      >
                        <X size={10} weight="regular" className="text-current" />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Add new feature */}
              <div className="px-3 py-2 border-t border-[var(--brd)]/40 flex gap-1.5">
                <input
                  type="text"
                  value={newFeature[tier] ?? ""}
                  onChange={(e) => setNewFeature((prev) => ({ ...prev, [tier]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd(tier); }}
                  placeholder="Add feature…"
                  className="flex-1 text-[11px] bg-transparent border-none outline-none placeholder:text-[var(--tx3)]/50 text-[var(--tx)]"
                />
                <button
                  type="button"
                  onClick={() => handleAdd(tier)}
                  className="text-[var(--gold)] hover:text-[var(--gold2)] transition-colors"
                  title="Add"
                >
                  <Plus size={13} weight="regular" className="text-current" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tip about residential dynamic values */}
      {activeSvc === "local_move" && (
        <p className="text-[10px] text-[var(--tx3)] leading-relaxed">
          <span className="text-[var(--gold)]">Tip:</span> Use{" "}
          <code className="bg-[var(--bg)] px-1 py-0.5 rounded text-[10px]">Professional movers</code> and{" "}
          <code className="bg-[var(--bg)] px-1 py-0.5 rounded text-[10px]">Dedicated moving truck</code>{" "}
          as placeholders, the system replaces them with the actual crew count and truck size at quote time.
        </p>
      )}

      {dirty && <SaveBar onSave={handleSave} onUndo={() => { undo(); setDirty(false); }} saving={saving} />}
    </div>
  );
}

/* ────────── SUPPLIES & CRATING ────────── */
function SuppliesAndCratingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const getVal = (key: string) => rows.find((r) => r.key === key);
  const suppliesRow = getVal("estate_supplies_by_size");
  const cratingRow = getVal("crating_prices");

  const SUPPLIES_DEFAULTS: Record<string, number> = {
    studio: 250, "1br": 300, "2br": 375, "3br": 575, "4br": 850, "5br_plus": 1100, partial: 150,
  };
  const SUPPLIES_LABELS: Record<string, string> = {
    studio: "Studio", "1br": "1 Bedroom", "2br": "2 Bedroom", "3br": "3 Bedroom",
    "4br": "4 Bedroom", "5br_plus": "5 Bedroom+", partial: "Partial Move",
  };
  const CRATING_DEFAULTS: Record<string, number> = { small: 175, medium: 250, large: 350, oversized: 500 };
  const CRATING_LABELS: Record<string, string> = {
    small: 'Small (under 24")', medium: 'Medium (24–48")', large: 'Large (48–72")', oversized: 'Oversized (72"+)',
  };

  const parseJson = (row: Row | undefined, defaults: Record<string, number>) => {
    try { return row?.value ? (JSON.parse(String(row.value)) as Record<string, number>) : defaults; }
    catch { return defaults; }
  };

  const suppliesMap = parseJson(suppliesRow, SUPPLIES_DEFAULTS);
  const cratingMap = parseJson(cratingRow, CRATING_DEFAULTS);

  const handleSuppliesChange = (key: string, val: string) => {
    if (!suppliesRow) return;
    const updated = { ...suppliesMap, [key]: Number(val) || 0 };
    updateRow(String(suppliesRow.id), "value", JSON.stringify(updated));
  };

  const handleCratingChange = (key: string, val: string) => {
    if (!cratingRow) return;
    const updated = { ...cratingMap, [key]: Number(val) || 0 };
    updateRow(String(cratingRow.id), "value", JSON.stringify(updated));
  };

  return (
    <div className="pt-4 space-y-5">
      {/* Estate Supplies */}
      <div>
        <p className="text-[11px] font-semibold text-[var(--tx)] mb-2">Estate Supplies Allowance</p>
        <p className="text-[10px] text-[var(--tx3)] mb-3">
          Included in Estate tier price. Covers boxes, tape, bubble wrap, wardrobe boxes, mattress bags, packing paper.
        </p>
        <table className={tbl}>
          <thead><tr><th className={th}>Move Size</th><th className={th}>Allowance ($)</th></tr></thead>
          <tbody>
            {Object.entries(SUPPLIES_LABELS).map(([key, label]) => (
              <tr key={key}>
                <td className={td}><span className="text-[12px] font-medium text-[var(--tx)]">{label}</span></td>
                <td className={td}>
                  <EditCell
                    value={suppliesMap[key] ?? SUPPLIES_DEFAULTS[key]}
                    onChange={(v) => handleSuppliesChange(key, v)}
                    type="number"
                    className="font-semibold text-[var(--gold)]"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!suppliesRow && (
          <div className="mt-2">
            <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
            <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="estate_supplies_by_size" />
          </div>
        )}
      </div>

      {/* Crating Rates */}
      <div>
        <p className="text-[11px] font-semibold text-[var(--tx)] mb-2">Custom Crating Rates</p>
        <p className="text-[10px] text-[var(--tx3)] mb-3">
          Per-piece cost applied when coordinator marks crating required on a quote. Applies to all service tiers.
        </p>
        <table className={tbl}>
          <thead><tr><th className={th}>Crate Size</th><th className={th}>Price per Piece ($)</th><th className={th}>Notes</th></tr></thead>
          <tbody>
            {Object.entries(CRATING_LABELS).map(([key, label]) => (
              <tr key={key}>
                <td className={td}><span className="text-[12px] font-medium text-[var(--tx)]">{label}</span></td>
                <td className={td}>
                  <EditCell
                    value={cratingMap[key] ?? CRATING_DEFAULTS[key]}
                    onChange={(v) => handleCratingChange(key, v)}
                    type="number"
                    className="font-semibold text-[var(--gold)]"
                  />
                </td>
                <td className={td}>
                  <span className="text-[10px] text-[var(--tx3)]">
                    {key === "small" ? "Art under 24in" : key === "medium" ? "Art/mirrors 24–48in" : key === "large" ? "Furniture/sculptures 48–72in" : "72in+"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cratingRow && (
          <div className="mt-2">
            <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
            <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="crating_prices" />
          </div>
        )}
      </div>

      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── INVENTORY MODIFIER FLOOR/CAP (Section 1 + 10) ────────── */
function InventoryModifierSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const getVal = (key: string) => rows.find((r) => r.key === key);
  const floorRow = getVal("inventory_modifier_floor");
  const capRow   = getVal("inventory_modifier_cap");
  const floor    = Number(floorRow?.value ?? 0.65);
  const cap      = Number(capRow?.value ?? 1.50);

  return (
    <div className="pt-4 space-y-5">
      <p className="text-[11px] text-[var(--tx3)]">
        Controls the minimum and maximum price adjustment from inventory volume. Floor 0.65 = light moves get up to 35% discount. Cap 1.50 = heavy moves pay up to 50% more.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {floorRow ? (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--tx)]">Floor (minimum)</label>
            <EditCell value={floor} onChange={(v) => updateRow(String(floorRow.id), "value", v)} type="number" className="w-20 text-[var(--text-base)] font-bold text-[var(--grn)]" />
            <p className="text-[9px] text-[var(--tx3)]">e.g. 0.65 → 35% max discount</p>
          </div>
        ) : (
          <div className="col-span-2">
            <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
            <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="inventory_modifier_floor" />
          </div>
        )}
        {capRow ? (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--tx)]">Cap (maximum)</label>
            <EditCell value={cap} onChange={(v) => updateRow(String(capRow.id), "value", v)} type="number" className="w-20 text-[var(--text-base)] font-bold text-amber-600" />
            <p className="text-[9px] text-[var(--tx3)]">e.g. 1.50 → 50% max premium</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
            <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="inventory_modifier_cap" />
          </div>
        )}
      </div>

      {/* Live preview */}
      {floorRow && capRow && (
        <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-[11px] space-y-1">
          <p className="font-semibold text-[var(--tx)]">Live example, 2BR base $1,199</p>
          <p className="text-[var(--tx3)]">Light move (17 items): modifier ≈ {floor} → <span className="font-semibold text-[var(--tx)]">{currency(Math.round(1199 * floor))}</span></p>
          <p className="text-[var(--tx3)]">Heavy move (55+ items): modifier ≈ {cap} → <span className="font-semibold text-[var(--tx)]">{currency(Math.round(1199 * cap))}</span></p>
        </div>
      )}

      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── DISTANCE INTELLIGENCE + DEADHEAD (Section 4 + 10) ────────── */
function DistanceDeadheadSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const getNum = (key: string, fallback: number) => Number(rows.find((r) => r.key === key)?.value ?? fallback);
  const getRow = (key: string) => rows.find((r) => r.key === key);

  const modifiers = [
    { key: "dist_mod_ultra_short", label: "≤2 km (ultra-short)",  fallback: 0.92, hint: "−8% discount" },
    { key: "dist_mod_short",       label: "≤5 km (short)",         fallback: 0.95, hint: "−5% discount" },
    { key: "dist_mod_medium",      label: "≤40 km (medium)",        fallback: 1.08, hint: "+8% surcharge" },
    { key: "dist_mod_long",        label: "≤60 km (long)",          fallback: 1.15, hint: "+15% surcharge" },
    { key: "dist_mod_very_long",   label: "≤100 km (very long)",    fallback: 1.25, hint: "+25% surcharge" },
    { key: "dist_mod_extreme",     label: ">100 km (extreme)",       fallback: 1.35, hint: "+35% surcharge" },
  ];

  const deadheadFreeKmRow = getRow("deadhead_free_km");
  const deadheadPerKmRow  = getRow("deadhead_per_km");
  const deadheadFreeKm    = getNum("deadhead_free_km", 15);
  const deadheadPerKm     = getNum("deadhead_per_km", 2.50);

  return (
    <div className="pt-4 space-y-6">
      {/* Distance modifiers */}
      <div>
        <h4 className="text-[11px] font-bold text-[var(--tx)] mb-1">Distance Modifiers</h4>
        <p className="text-[11px] text-[var(--tx3)] mb-3">
          Applied multiplicatively to base rate. Replaces the old flat per-km surcharge. Baseline (6–20 km) = ×1.0.
        </p>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="text-left pb-1 text-[var(--tx3)] font-medium pr-4">Distance range</th>
              <th className="text-left pb-1 text-[var(--tx3)] font-medium pr-4">Modifier</th>
              <th className="text-left pb-1 text-[var(--tx3)] font-medium">Effect on $1,199 base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--brd)]">
            {modifiers.map(({ key, label, fallback, hint }) => {
              const row = getRow(key);
              const val = getNum(key, fallback);
              return (
                <tr key={key}>
                  <td className="py-1.5 pr-4 text-[var(--tx2)]">{label}</td>
                  <td className="py-1.5 pr-4">
                    {row ? (
                      <EditCell value={val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="w-16" />
                    ) : (
                      <div>
                        <span>{fallback}</span>
                        <span className="text-[10px] text-[var(--tx3)] ml-1">(default)</span>
                        <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                      </div>
                    )}
                  </td>
                  <td className={`py-1.5 text-[9px] font-medium ${val < 1 ? "text-emerald-600" : val > 1 ? "text-amber-600" : "text-[var(--tx3)]"}`}>
                    {currency(Math.round(1199 * val))} &nbsp;{hint}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!modifiers.some(({ key }) => getRow(key)) && (
          <div className="mt-2">
            <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
            <InternalConfigKeyHint
              isSuperAdmin={isSuperAdmin}
              configKey="dist_mod_ultra_short, dist_mod_short, …"
            />
          </div>
        )}
      </div>

      {/* Deadhead */}
      <div>
        <h4 className="text-[11px] font-bold text-[var(--tx)] mb-1">Deadhead Surcharge</h4>
        <p className="text-[11px] text-[var(--tx3)] mb-3">
          Charged when pickup address is more than the free-zone km from Yugo base (507 King St E). Crew travel cost. Applied flat, not multiplied by tier.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--tx)]">Free zone (km)</label>
            {deadheadFreeKmRow ? (
              <EditCell value={deadheadFreeKm} onChange={(v) => updateRow(String(deadheadFreeKmRow.id), "value", v)} type="number" className="w-16" />
            ) : (
              <div>
                <span className="text-[10px] text-[var(--tx)]">15</span>
                <span className="text-[10px] text-[var(--tx3)] ml-1">(default)</span>
                <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="deadhead_free_km" />
              </div>
            )}
            <p className="text-[9px] text-[var(--tx3)]">No charge within this radius</p>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-[var(--tx)]">Rate per excess km ($)</label>
            {deadheadPerKmRow ? (
              <EditCell value={deadheadPerKm} onChange={(v) => updateRow(String(deadheadPerKmRow.id), "value", v)} type="number" className="w-16" />
            ) : (
              <div>
                <span className="text-[10px] text-[var(--tx)]">2.50</span>
                <span className="text-[10px] text-[var(--tx3)] ml-1">(default)</span>
                <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="deadhead_per_km" />
              </div>
            )}
            <p className="text-[9px] text-[var(--tx3)]">Charged per km beyond free zone</p>
          </div>
        </div>
        {/* Deadhead examples */}
        <div className="mt-3 rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 text-[11px] space-y-0.5">
          <p className="font-semibold text-[var(--tx)] mb-1">Examples</p>
          {[
            { label: "Midtown Toronto (8 km)", km: 8 },
            { label: "Etobicoke (20 km)", km: 20 },
            { label: "Mississauga (25 km)", km: 25 },
            { label: "Markham (35 km)", km: 35 },
          ].map(({ label, km }) => {
            const charge = km > deadheadFreeKm ? Math.round((km - deadheadFreeKm) * deadheadPerKm) : 0;
            return (
              <div key={label} className="flex justify-between text-[var(--tx3)]">
                <span>{label}</span>
                <span className={charge > 0 ? "text-amber-600 font-medium" : ""}>{charge > 0 ? `+${currency(charge)}` : "$0"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── WHITE GLOVE (platform_config) ────────── */
function WhiteGlovePricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const fields = [
    { key: "white_glove_declared_value_threshold", label: "Declared value threshold ($)", hint: "Above this, the premium below is added to the Essential-tier price." },
    { key: "white_glove_declared_value_premium", label: "Declared value premium ($)", hint: "Flat add-on when declared value exceeds the threshold." },
    { key: "white_glove_minimum_price", label: "Minimum subtotal ($)", hint: "Floor before tax; uses same residential base + tier multipliers as local moves." },
  ];

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        White glove quotes use the residential algorithm (base rate × neighbourhood × tier × inventory). These knobs only adjust the premium and floor.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {fields.map(({ key, label, hint }) => {
          const row = rows.find((r) => r.key === key);
          const val = Number(row?.value ?? (key.includes("threshold") ? 5000 : key.includes("premium") ? 50 : 250));
          return (
            <div key={key} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
              <p className="text-[10px] text-[var(--tx3)] mb-2">{hint}</p>
              {row ? (
                <EditCell value={val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="text-[15px] font-bold text-[var(--gold)]" />
              ) : (
                <div>
                  <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                  <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── B2B ONE-OFF BASE (platform_config) ────────── */
function B2BOneOffPricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;
  const row = rows.find((r) => r.key === "b2b_oneoff_base");

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        B2B one-off quotes multiply this base by the distance band modifier (see <b className="text-[var(--tx)]">Distance Intelligence</b>), then add access and weight surcharges (
        <b className="text-[var(--tx)]">B2B Surcharges</b>), parking, long carry, and truck size.
      </p>
      {row ? (
        <div className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-4 max-w-xs">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Base fee ($)</div>
          <EditCell
            value={Number(row.value ?? 350)}
            onChange={(v) => updateRow(String(row.id), "value", v)}
            type="number"
            className="text-[16px] font-bold text-[var(--gold)]"
          />
        </div>
      ) : (
        <div>
          <p className="text-[11px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
          <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey="b2b_oneoff_base" />
        </div>
      )}
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── EVENT PRICING (platform_config) ────────── */
function EventPricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const groups: { title: string; keys: { key: string; label: string }[] }[] = [
    {
      title: "Crew hourly & minimums",
      keys: [
        { key: "event_base_hourly_rate", label: "Base hourly rate ($/crew-hr)" },
        { key: "event_luxury_hourly_rate", label: "Luxury hourly rate ($/crew-hr)" },
        { key: "event_min_hours_standard", label: "Min billable hours (standard)" },
        { key: "event_min_hours_luxury", label: "Min billable hours (luxury)" },
      ],
    },
    {
      title: "Setup fees (when setup is selected)",
      keys: [
        { key: "event_setup_fee_1hr", label: "1 hr setup ($)" },
        { key: "event_setup_fee_2hr", label: "2 hr setup ($)" },
        { key: "event_setup_fee_3hr", label: "3 hr setup ($)" },
        { key: "event_setup_fee_halfday", label: "Half-day setup ($)" },
        { key: "event_setup_fee_fullday", label: "Full-day setup ($)" },
      ],
    },
    {
      title: "Return leg & deposit",
      keys: [
        { key: "event_return_discount", label: "Return leg as fraction of delivery (0–1)" },
        { key: "event_min_deposit", label: "Minimum deposit ($)" },
      ],
    },
  ];

  return (
    <div className="pt-4 space-y-6">
      <p className="text-[11px] text-[var(--tx3)]">
        Event quotes combine delivery + return legs (with return discount), optional paid setup, truck/parking/long-carry (shared with other services where noted), and add-ons.
      </p>
      {groups.map((g) => (
        <div key={g.title}>
          <h4 className="text-[11px] font-bold text-[var(--tx)] mb-3">{g.title}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.keys.map(({ key, label }) => {
              const row = rows.find((r) => r.key === key);
              const val = Number(row?.value ?? 0);
              return (
                <div key={key} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
                  {row ? (
                    <EditCell
                      value={val}
                      onChange={(v) => updateRow(String(row.id), "value", v)}
                      type="number"
                      className="text-[var(--text-base)] font-bold text-[var(--gold)]"
                    />
                  ) : (
                    <div>
                      <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                      <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── SPECIALTY PROJECT & EQUIPMENT (JSON + scalars) ────────── */
function SpecialtyPricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const configSection = useSection("config");
  const [baseRows, setBaseRows] = useState<{ key: string; label: string; basePrice: number }[]>([]);
  const [equipRows, setEquipRows] = useState<{ key: string; label: string; surcharge: number }[]>([]);
  const [loadingJson, setLoadingJson] = useState(true);
  const [savingJson, setSavingJson] = useState(false);
  const { toast } = useToast();

  const loadJson = useCallback(() => {
    setLoadingJson(true);
    fetch("/api/admin/pricing/specialty-project-bases", { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.baseRows) setBaseRows(d.baseRows);
        if (d.equipRows) setEquipRows(d.equipRows);
      })
      .catch(() => toast("Failed to load specialty pricing", "x"))
      .finally(() => setLoadingJson(false));
  }, [toast]);

  useEffect(() => {
    loadJson();
  }, [loadJson]);

  const saveJson = async () => {
    setSavingJson(true);
    try {
      const res = await fetch("/api/admin/pricing/specialty-project-bases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ baseRows, equipRows }),
      });
      const json = await parseJsonOrEmpty(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to save specialty tables");
      toast("Specialty tables saved", "check");
      loadJson();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save specialty tables", "x");
    } finally {
      setSavingJson(false);
    }
  };

  const updateBase = (key: string, basePrice: number) => {
    setBaseRows((prev) => prev.map((r) => (r.key === key ? { ...r, basePrice } : r)));
  };
  const updateEquip = (key: string, surcharge: number) => {
    setEquipRows((prev) => prev.map((r) => (r.key === key ? { ...r, surcharge } : r)));
  };

  const scalarKeys = [
    { key: "specialty_crating_per_piece", label: "Crating per piece ($)" },
    { key: "specialty_climate_surcharge", label: "Climate control surcharge ($)" },
    { key: "specialty_minimum_price", label: "Minimum subtotal ($)" },
    { key: "distance_base_km", label: "Free km before distance add-on" },
    { key: "distance_rate_per_km", label: "$ per km beyond free km" },
  ];

  const scalarFallbacks: Record<string, number> = {
    specialty_crating_per_piece: 300,
    specialty_climate_surcharge: 150,
    specialty_minimum_price: 500,
    distance_base_km: 30,
    distance_rate_per_km: 4.5,
  };

  if (configSection.loading) return <Skeleton />;

  return (
    <div className="pt-4 space-y-6">
      <p className="text-[11px] text-[var(--tx3)]">
        Project-type bases scale with timeline hours. Equipment surcharges add per selected item. Values here merge with built-in defaults when a key is omitted from JSON.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scalarKeys.map(({ key, label }) => {
          const row = configSection.rows.find((r) => r.key === key);
          const val = Number(row?.value ?? scalarFallbacks[key] ?? 0);
          return (
            <div key={key} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
              {row ? (
                <EditCell
                  value={val}
                  onChange={(v) => configSection.updateRow(String(row.id), "value", v)}
                  type="number"
                  className="text-[var(--text-base)] font-bold text-[var(--gold)]"
                />
              ) : (
                <div>
                  <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                  <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={configSection.saving || savingJson}
          onClick={() => void configSection.save()}
          className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-60 disabled:cursor-wait"
        >
          {configSection.saving ? "Saving…" : "Save scalars"}
        </button>
        <button
          type="button"
          disabled={configSection.saving || savingJson}
          onClick={() => configSection.undo()}
          className="px-3 py-2 rounded-lg text-[11px] text-[var(--tx3)] disabled:opacity-40"
        >
          Undo
        </button>
      </div>

      {loadingJson ? (
        <Skeleton />
      ) : (
        <>
          <div>
            <h4 className="text-[11px] font-bold text-[var(--tx)] mb-2">Project-type base prices</h4>
            <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-lg border border-[var(--brd)]">
              <table className={tbl}>
                <thead>
                  <tr>
                    <th className={th}>Project</th>
                    <th className={th}>Base ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {baseRows.map((r) => (
                    <tr key={r.key}>
                      <td className={td}>
                        <span className="text-[12px] text-[var(--tx)]">{r.label}</span>
                      </td>
                      <td className={td}>
                        <EditCell
                          type="number"
                          value={r.basePrice}
                          onChange={(v) => updateBase(r.key, parseFloat(v) || 0)}
                          className="font-semibold text-[var(--gold)]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-[var(--tx)] mb-2">Equipment surcharges</h4>
            <div className="overflow-x-auto max-h-[240px] overflow-y-auto rounded-lg border border-[var(--brd)]">
              <table className={tbl}>
                <thead>
                  <tr>
                    <th className={th}>Equipment</th>
                    <th className={th}>Surcharge ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {equipRows.map((r) => (
                    <tr key={r.key}>
                      <td className={td}>
                        <span className="text-[12px] text-[var(--tx)]">{r.label}</span>
                      </td>
                      <td className={td}>
                        <EditCell
                          type="number"
                          value={r.surcharge}
                          onChange={(v) => updateEquip(r.key, parseFloat(v) || 0)}
                          className="font-semibold text-[var(--gold)]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void saveJson()}
            disabled={savingJson || configSection.saving}
            className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 disabled:cursor-wait"
          >
            {savingJson ? "Saving…" : "Save specialty tables"}
          </button>
        </>
      )}
    </div>
  );
}

/* ────────── LABOUR-ONLY (platform_config) ────────── */
function LabourOnlyPricingSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { rows, loading, save, undo, updateRow, saving } = useSection("config");
  if (loading) return <Skeleton />;

  const fields = [
    { key: "labour_only_rate", label: "Rate per mover-hour ($)", hint: "Crew × hours × this rate (per mover)." },
    { key: "labour_only_truck_fee", label: "Truck fee when required ($)", hint: "Added when customer selects truck on site." },
    { key: "labour_only_visit2_discount", label: "Visit 2 discount (0–1)", hint: "Second visit labour subtotal multiplier before truck/access." },
    { key: "storage_weekly_rate", label: "Storage between visits ($/week)", hint: "Used when storage between labour visits is selected." },
  ];

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        Labour-only quotes bill crew time at one or two visits, optional truck, access, parking/long carry, and optional short-term storage.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(({ key, label, hint }) => {
          const row = rows.find((r) => r.key === key);
          const fallback =
            key === "labour_only_rate"
              ? 85
              : key === "labour_only_truck_fee"
                ? 150
                : key === "labour_only_visit2_discount"
                  ? 0.85
                  : 75;
          const val = Number(row?.value ?? fallback);
          return (
            <div key={key} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
              <p className="text-[10px] text-[var(--tx3)] mb-2">{hint}</p>
              {row ? (
                <EditCell value={val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="text-[15px] font-bold text-[var(--gold)]" />
              ) : (
                <div>
                  <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                  <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ════════════════════════════════════════
   ENGINE CONFIG v2
   ════════════════════════════════════════ */
function EngineConfigSection() {
  const { isSuperAdmin } = usePricingAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSection("config").then(setRows).catch(() => {});
  }, []);

  const updateRow = (id: string, key: string, value: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r));
  };

  const undo = () => {
    fetchSection("config").then(setRows).catch(() => {});
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveRows("config", rows);
      toast("Engine config saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const FIELDS: { key: string; label: string; hint: string; type?: "number" | "json" }[] = [
    // Market stack
    { key: "market_stack_cap", label: "Market Stack Cap", hint: "Maximum combined neighbourhood × day × season multiplier (default 1.38). Prevents excessive compounding." },
    // Labour rates per tier
    { key: "labour_rate_essential", label: "Labour Rate, Essential ($/mover-hr)", hint: "Hourly rate applied to extra mover-hours above baseline for Essential tier." },
    { key: "labour_rate_signature", label: "Labour Rate, Signature ($/mover-hr)", hint: "Higher rate for Signature tier overages, premium clients pay more for extra time." },
    { key: "labour_rate_estate", label: "Labour Rate, Estate ($/mover-hr)", hint: "Highest rate for Estate tier overages." },
    // Deadhead
    { key: "deadhead_rate_per_km", label: "Deadhead Rate ($/km)", hint: "Cost per km beyond the free zone. Crew travel from 507 King St E." },
    { key: "deadhead_free_zone_km", label: "Deadhead Free Zone (km)", hint: "Jobs within this radius from HQ have no deadhead charge (default 15 km)." },
    // Mobilization
    { key: "mobilization_25_35", label: "Mobilization Fee, 25–35 km ($)", hint: "Flat fee for jobs 25–35 km from HQ." },
    { key: "mobilization_35_50", label: "Mobilization Fee, 35–50 km ($)", hint: "Flat fee for jobs 35–50 km from HQ." },
    { key: "mobilization_50plus", label: "Mobilization Fee, 50+ km ($)", hint: "Flat fee for jobs beyond 50 km from HQ." },
    // Cost tracking
    { key: "cost_per_mover_hour", label: "Cost Per Mover-Hour ($)", hint: "Internal labour cost per mover per hour (for margin calculations, not pricing)." },
    { key: "fuel_cost_per_km", label: "Fuel Cost Per km ($)", hint: "Round-trip fuel cost per km (default $0.45). Used for margin estimates." },
    // Minimum hours
    { key: "minimum_hours_by_size", label: "Minimum Billable Hours (JSON by size)", hint: '{"studio":2,"1br":3,"2br":4,"3br":5.5,"4br":7,"5br_plus":8.5,"partial":2}', type: "json" },
    // Truck costs (for margin)
    { key: "truck_costs_per_job", label: "Truck Cost Per Job (JSON)", hint: '{"sprinter":90,"16ft":115,"20ft":150,"24ft":175,"26ft":200}', type: "json" },
    // Change request rates
    { key: "change_request_rate_essential", label: "Change Request Rate, Essential ($/hr)", hint: "Hourly rate for post-booking change requests on Essential moves." },
    { key: "change_request_rate_signature", label: "Change Request Rate, Signature ($/hr)", hint: "Hourly rate for change requests on Signature moves." },
    { key: "change_request_rate_estate", label: "Change Request Rate, Estate ($/hr)", hint: "Hourly rate for change requests on Estate moves." },
    // Margin targets (soft targets — warnings only, never override pricing)
    { key: "margin_target_essential", label: "Margin Target, Essential (%)", hint: "Soft target margin % for Essential moves. Warnings shown when below threshold. Never inflates prices automatically." },
    { key: "margin_target_signature", label: "Margin Target, Signature (%)", hint: "Soft target margin % for Signature moves." },
    { key: "margin_target_estate", label: "Margin Target, Estate (%)", hint: "Soft target margin % for Estate moves." },
    { key: "margin_warning_threshold", label: "Margin Warning Threshold (%)", hint: "Show a warning when estimated margin falls below this %. Default 35." },
    { key: "margin_critical_threshold", label: "Margin Critical Threshold (%)", hint: "Show a critical alert when estimated margin falls below this %. Default 25." },
  ];

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        Controls the Pricing Engine v2 algorithm: market stack cap, tiered labour rates, deadhead/mobilization thresholds, and internal cost model for margin calculations.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, hint, type }) => {
          const row = rows.find((r) => r.key === key);
          const val = String(row?.value ?? "");
          return (
            <div key={key} className={`rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3 ${type === "json" ? "md:col-span-2" : ""}`}>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
              <p className="text-[10px] text-[var(--tx3)] mb-2">{hint}</p>
              {row ? (
                type === "json" ? (
                  <textarea
                    rows={2}
                    value={val}
                    onChange={(e) => updateRow(String(row.id), "value", e.target.value)}
                    className="w-full bg-[var(--bg2)] border border-[var(--brd)] rounded px-2 py-1.5 text-[11px] font-mono text-[var(--tx)] outline-none focus:border-[var(--gold)] resize-none"
                  />
                ) : (
                  <EditCell value={val} onChange={(v) => updateRow(String(row.id), "value", v)} type="number" className="text-[15px] font-bold text-[var(--gold)]" />
                )
              ) : (
                <div>
                  <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                  <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ════════════════════════════════════════
   MAIN EXPORT
   ════════════════════════════════════════ */
export default function PricingControlPanel({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  return (
    <PricingAdminContext.Provider value={{ isSuperAdmin }}>
    <div className="space-y-2.5">
      <AnalyticsDashboard />

      <Accordion title="Base Rates (Residential)" subtitle={`Move size → base price, crew, hours`} defaultOpen>
        <BaseRatesSection />
      </Accordion>

      <Accordion title="Labour Pricing" subtitle="Rate per extra mover-hour above baseline (Prompt 89)">
        <LabourPricingSection />
      </Accordion>

      <Accordion title="Tier Multipliers" subtitle="Essential, Signature, Estate pricing tiers">
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

      <Accordion title="White Glove" subtitle="Declared value premium and floor (uses residential base × tiers)">
        <WhiteGlovePricingSection />
      </Accordion>

      <Accordion title="Specialty" subtitle="Project bases, equipment surcharges, crating & climate, used by specialty quotes">
        <SpecialtyPricingSection />
      </Accordion>

      <Accordion title="Event" subtitle="Hourly rates, setup fees, return discount, minimum deposit">
        <EventPricingSection />
      </Accordion>

      <Accordion title="B2B One-Off" subtitle="Base fee × distance band; pair with B2B surcharges + distance modifiers">
        <B2BOneOffPricingSection />
      </Accordion>

      <Accordion title="Deposit Rules" subtitle="Residential = tier-based (Essential/Signature/Estate). Other types = matrix below">
        <DepositRulesSection />
      </Accordion>

      <Accordion title="Office / Commercial Rates" subtitle="Per sq ft, workstation, IT equipment">
        <OfficeRatesSection />
      </Accordion>

      <Accordion title="Add-Ons" subtitle="Optional services, tiered & per-unit pricing">
        <AddOnsSection />
      </Accordion>

      <Accordion title="Inventory Modifier Floor & Cap" subtitle="Light move discount floor (0.65) and heavy move premium cap (1.50)">
        <InventoryModifierSection />
      </Accordion>

      <Accordion title="Distance Intelligence & Deadhead" subtitle="Short-move discounts, long-distance surcharges, crew deadhead cost">
        <DistanceDeadheadSection />
      </Accordion>

      <Accordion title="Inventory & Volume" subtitle="Item weight scores and volume benchmarks per move size">
        <InventoryVolumeSection />
      </Accordion>

      <Accordion title="Package & Tier Features" subtitle="What's included in each move package, shown on customer quotes">
        <TierFeaturesSection />
      </Accordion>

      <Accordion title="Labour-only" subtitle="Per mover-hour, truck, second-visit discount, storage between visits">
        <LabourOnlyPricingSection />
      </Accordion>

      <Accordion title="B2B Surcharges" subtitle="Access and weight surcharges for per-delivery B2B bookings. Day rates do not apply these.">
        <B2BSurchargesSection />
      </Accordion>

      <Accordion title="Supplies & Crating" subtitle="Estate packing supplies allowance by move size + custom crating rates per piece">
        <SuppliesAndCratingSection />
      </Accordion>

      <Accordion title="Engine Configuration (v2)" subtitle="Market stack cap, tiered labour rates, deadhead, mobilization, cost tracking, minimum hours">
        <EngineConfigSection />
      </Accordion>

      <Accordion title="System Learning, Calibration Suggestions" subtitle="AI-generated config proposals based on last 30 completed jobs per category">
        <CalibrationSection />
      </Accordion>

      <Accordion title="Payment & Processing Recovery" subtitle="Credit card fee recovery baked into tier prices, invisible to clients">
        <ProcessingRecoverySection />
      </Accordion>
    </div>
    </PricingAdminContext.Provider>
  );
}

/* ────────── PAYMENT & PROCESSING RECOVERY ────────── */
function ProcessingRecoverySection() {
  const { isSuperAdmin } = usePricingAdmin();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [orig, setOrig] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSection("payment_recovery")
      .then((r) => { setRows(r); setOrig(r); })
      .catch(() => toast("Failed to load payment config", "x"));
  }, [toast]);

  const updateRow = (id: string, field: string, val: unknown) =>
    setRows((prev) => prev.map((r) => (String(r.id) === id ? { ...r, [field]: val } : r)));

  const undo = () => setRows(orig);

  const save = async () => {
    setSaving(true);
    try {
      await saveRows("payment_recovery", rows);
      setOrig(rows);
      toast("Payment settings saved", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const FIELDS: { key: string; label: string; hint: string }[] = [
    {
      key: "processing_recovery_rate",
      label: "Processing Recovery Rate",
      hint: "Credit card processing rate to absorb into tier prices (e.g. 0.029 = 2.9%). Applied after gap caps, before rounding, invisible to clients.",
    },
    {
      key: "processing_recovery_flat",
      label: "Processing Recovery Flat ($/transaction)",
      hint: "Flat per-transaction recovery in dollars (e.g. 0.30). Added before the rate recovery calculation.",
    },
    {
      key: "payment_method",
      label: "Payment Method Mode",
      hint: "\"card_only\" = card on file required for all clients. \"card_and_etransfer\" = re-enable e-transfer as fallback option.",
    },
  ];

  return (
    <div className="pt-4 space-y-4">
      <p className="text-[11px] text-[var(--tx3)]">
        Processing cost recovery is baked silently into tier prices after gap caps are applied, then absorbed by the $50 rounding step. Clients never see a separate fee line item.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, hint }) => {
          const row = rows.find((r) => r.key === key);
          const val = String(row?.value ?? "");
          return (
            <div key={key} className="rounded-lg bg-[var(--bg)] border border-[var(--brd)] p-3">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1">{label}</div>
              <p className="text-[10px] text-[var(--tx3)] mb-2">{hint}</p>
              {row ? (
                <EditCell value={val} onChange={(v) => updateRow(String(row.id), "value", v)} className="text-[15px] font-bold text-[var(--gold)]" />
              ) : (
                <div>
                  <p className="text-[10px] text-[var(--tx3)]">{MSG_CONFIG_MISSING}</p>
                  <InternalConfigKeyHint isSuperAdmin={isSuperAdmin} configKey={key} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save()} onUndo={undo} saving={saving} />
    </div>
  );
}

/* ────────── B2B SURCHARGES (platform_config JSON) ────────── */
function B2BSurchargesSection() {
  const [access, setAccess] = useState<{ key: string; label: string; surcharge: number }[]>([]);
  const [weight, setWeight] = useState<{ key: string; label: string; surcharge: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/admin/pricing/b2b-surcharges")
      .then((r) => r.json())
      .then((d) => {
        if (d.access) setAccess(d.access);
        if (d.weight) setWeight(d.weight);
      })
      .catch(() => toast("Failed to load B2B surcharges", "x"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing/b2b-surcharges", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ access, weight }),
      });
      const json = await parseJsonOrEmpty(res);
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed to save");
      toast("B2B surcharges saved", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "x");
    } finally {
      setSaving(false);
    }
  };

  const updateAccess = (key: string, surcharge: number) => {
    setAccess((prev) => prev.map((a) => (a.key === key ? { ...a, surcharge } : a)));
  };
  const updateWeight = (key: string, surcharge: number) => {
    setWeight((prev) => prev.map((w) => (w.key === key ? { ...w, surcharge } : w)));
  };

  if (loading) return <div className="text-[11px] text-[var(--tx3)] py-4">Loading…</div>;

  return (
    <div className="space-y-6">
      <p className="text-[11px] text-[var(--tx3)]">
        Rates shown on the rate card are base prices for standard access (elevator/ground). Walk-up, long carry, and heavy item surcharges may apply to per-delivery bookings.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">B2B Access Surcharges</h4>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                <th className="text-left py-2 font-semibold text-[var(--tx)]">Access Type</th>
                <th className="text-right py-2 font-semibold text-[var(--tx)]">Surcharge</th>
              </tr>
            </thead>
            <tbody>
              {access.map((a) => (
                <tr key={a.key} className="border-b border-[var(--brd)]/50">
                  <td className="py-2 text-[var(--tx)]">{a.label}</td>
                  <td className="py-2 text-right">
                    <EditCell type="number" value={a.surcharge} onChange={(v) => updateAccess(a.key, parseInt(v, 10) || 0)} className="text-right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h4 className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">B2B Weight Surcharges</h4>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--brd)]">
                <th className="text-left py-2 font-semibold text-[var(--tx)]">Category</th>
                <th className="text-right py-2 font-semibold text-[var(--tx)]">Surcharge</th>
              </tr>
            </thead>
            <tbody>
              {weight.map((w) => (
                <tr key={w.key} className="border-b border-[var(--brd)]/50">
                  <td className="py-2 text-[var(--tx)]">{w.label}</td>
                  <td className="py-2 text-right">
                    <EditCell type="number" value={w.surcharge} onChange={(v) => updateWeight(w.key, parseInt(v, 10) || 0)} className="text-right" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90 disabled:opacity-50">
        {saving ? "Saving…" : "Save B2B Surcharges"}
      </button>
    </div>
  );
}

/* ────────── CALIBRATION SUGGESTIONS (System Learning) ────────── */
interface CalibrationSuggestion {
  id: string;
  type: string;
  move_size: string | null;
  service_type: string | null;
  current_value: string;
  suggested_value: string;
  confidence: "low" | "medium" | "high";
  reason: string;
  sample_size: number;
  status: "pending" | "applied" | "dismissed";
  created_at: string;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  high:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low:    "bg-[var(--tx3)]/10 text-[var(--tx3)] border-[var(--tx3)]/20",
};

const TYPE_LABELS: Record<string, string> = {
  hours_baseline:     "Hours",
  truck_threshold:    "Truck",
  crew_recommendation: "Crew",
};

const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1BR",
  "2br": "2BR",
  "3br": "3BR",
  "4br": "4BR",
  "5br_plus": "5BR+",
  partial: "Partial",
};

function CalibrationSection() {
  const [suggestions, setSuggestions] = useState<CalibrationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [dismissModal, setDismissModal] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/calibration?status=pending", { credentials: "same-origin" });
      const json = await res.json() as { data?: CalibrationSuggestion[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSuggestions(json.data ?? []);
    } catch {
      toast("Failed to load calibration suggestions", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id: string, action: "apply" | "dismiss", reason?: string) {
    setActing(id);
    try {
      const res = await fetch("/api/admin/calibration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id, action, dismissed_reason: reason }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast(action === "apply" ? "Calibration applied" : "Suggestion dismissed", "check");
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast(String(e), "x");
    } finally {
      setActing(null);
      setDismissModal(null);
      setDismissReason("");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[var(--tx3)] text-[13px]">
        <CircleNotch size={16} className="animate-spin" />
        Loading calibration data…
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="py-8 text-center">
        <CheckCircle size={32} className="mx-auto mb-3 text-emerald-400" />
        <p className="text-[13px] font-semibold text-[var(--tx)]">All calibrations are current</p>
        <p className="text-[11px] text-[var(--tx3)] mt-1">No suggestions pending. The system will surface recommendations after 20+ completed jobs per category.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[12px] text-[var(--tx3)]">
          Based on the last 30 completed jobs per category. Suggestions require 20+ data points to generate.
        </p>
        <span className="text-[11px] font-bold text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/20 px-2 py-0.5 rounded-full">
          {suggestions.length} pending
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--brd)]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[var(--brd)] bg-[var(--bg)]/40">
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Type</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Move Size</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Current</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Suggested</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Confidence</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Sample</th>
              <th className="text-left py-3 px-4 font-semibold text-[var(--tx3)] uppercase tracking-wider text-[10px]">Reason</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id} className="border-b border-[var(--brd)]/50 hover:bg-[var(--gold)]/3 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-semibold text-[var(--tx)]">
                    {TYPE_LABELS[s.type] ?? s.type}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--tx)]">
                  {s.move_size ? MOVE_SIZE_LABELS[s.move_size] ?? s.move_size : "-"}
                </td>
                <td className="py-3 px-4 text-[var(--tx3)]">{s.current_value}</td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-[var(--gold)]">{s.suggested_value}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONFIDENCE_BADGE[s.confidence] ?? CONFIDENCE_BADGE.low}`}>
                    {s.confidence.charAt(0).toUpperCase() + s.confidence.slice(1)}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--tx3)]">{s.sample_size} jobs</td>
                <td className="py-3 px-4 text-[var(--tx3)] max-w-[260px]">{s.reason}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => handleAction(s.id, "apply")}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                    >
                      {acting === s.id ? "…" : "Apply"}
                    </button>
                    <button
                      type="button"
                      disabled={acting === s.id}
                      onClick={() => { setDismissModal(s.id); setDismissReason(""); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:border-[var(--tx3)] hover:text-[var(--tx)] transition-colors whitespace-nowrap"
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

      {/* Dismiss reason modal */}
      {dismissModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-[15px] font-bold text-[var(--tx)] mb-2">Dismiss suggestion</h3>
            <p className="text-[12px] text-[var(--tx3)] mb-4">Optional: add a reason so the system learns what to ignore.</p>
            <textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="e.g. This size category had unusual data due to holiday period…"
              className="w-full h-20 px-3 py-2 rounded-xl border border-[var(--brd)] bg-[var(--bg)] text-[var(--tx)] text-[12px] resize-none outline-none focus:border-[var(--gold)] transition-colors"
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => handleAction(dismissModal, "dismiss", dismissReason || undefined)}
                className="flex-1 px-4 py-2 rounded-xl text-[12px] font-bold bg-[var(--tx3)]/10 text-[var(--tx)] hover:bg-[var(--tx3)]/20 transition-colors"
              >
                Confirm Dismiss
              </button>
              <button
                type="button"
                onClick={() => setDismissModal(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
