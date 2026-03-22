"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendUp as TrendingUp, TrendDown as TrendingDown, Warning as AlertTriangle, Download,
  CaretDown as ChevronDown, ArrowsDownUp as ArrowUpDown, MagnifyingGlass as Search, Plus, Trash as Trash2, Check, X, PencilSimple as Pencil,
} from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";
import type { CustomOverheadItem } from "@/lib/finance/calculateProfit";

/* ════════════ types ════════════ */
interface ProfitRow {
  id: string;
  jobKind: "move" | "delivery";
  move_code: string;
  date: string;
  client: string;
  type: string;
  tier: string | null;
  revenue: number;
  neighbourhood: string | null;
  actual_hours?: number | null;
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  processing: number;
  totalDirect: number;
  allocatedOverhead: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  hasOverride?: boolean;
}

type CostField = "labour" | "fuel" | "truck" | "supplies" | "processing";

interface Summary {
  avgGrossMargin: number;
  avgNetMargin: number;
  avgProfitPerMove: number;
  lowMarginCount: number;
  totalRevenue: number;
  totalDirectCost: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  moveCount: number;
  targetMargin: number;
}

interface OverheadData {
  total: number;
  perMove: number;
  breakEven: number;
  items: Record<string, number>;
}

/* ════════════ date ranges ════════════ */
function getRange(preset: string): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "this_month": return { from: fmt(new Date(y, m, 1)), to: fmt(now), label: "This Month" };
    case "last_month": return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)), label: "Last Month" };
    case "last_3": return { from: fmt(new Date(y, m - 2, 1)), to: fmt(now), label: "Last 3 Months" };
    case "last_6": return { from: fmt(new Date(y, m - 5, 1)), to: fmt(now), label: "Last 6 Months" };
    case "ytd": return { from: fmt(new Date(y, 0, 1)), to: fmt(now), label: "Year to Date" };
    default: return { from: fmt(new Date(y, m, 1)), to: fmt(now), label: "This Month" };
  }
}

const PRESETS = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_3", label: "Last 3 Months" },
  { id: "last_6", label: "Last 6 Months" },
  { id: "ytd", label: "Year to Date" },
];

/* ════════════ label maps ════════════ */
const TYPE_LABELS: Record<string, string> = {
  local_move: "Residential", residential: "Residential", long_distance: "Long Distance",
  office_move: "Office", office: "Office", senior_move: "Senior Move",
  single_item: "Single Item", white_glove: "White Glove", specialty: "Specialty", partial: "Partial Move",
  delivery: "Standard Delivery", b2b: "B2B", b2b_delivery: "B2B",
  single_item_delivery: "Single Item", multi_piece: "Multi-Piece", multi_stop: "Multi-Stop",
  full_room: "Full Room Setup", day_rate: "Day Rate", project: "Project",
  designer: "Designer", retail: "Retail", hospitality: "Hospitality", gallery: "Gallery", other: "Other",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ════════════ helpers ════════════ */
const pct = (n: number) => `${n.toFixed(1)}%`;
/** Format YYYY-MM-DD as DD/MM/YY */
function formatTableDate(d: string | null | undefined): string {
  if (!d || d.length < 10) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y?.slice(-2) ?? ""}`;
}
const marginColor = (m: number, t: number) => m >= t ? "text-emerald-400" : m >= t - 5 ? "text-[var(--gold)]" : "text-red-400";
const marginBg = (m: number, t: number) =>
  m >= t ? "bg-emerald-500/10 border-emerald-500/20" : m >= t - 5 ? "bg-[var(--gold)]/10 border-[var(--gold)]/20" : "bg-red-500/10 border-red-500/20";

const TIER_COLORS: Record<string, string> = {
  curated: "#6B7280", essentials: "#6B7280",
  signature: "#C9A962", premier: "#C9A962",
  estate: "#2D6A4F",
};

/* ════════════ Inline Cost Cell ════════════ */
function EditableCostCell({
  value,
  field,
  row,
  onSaved,
}: {
  value: number;
  field: CostField;
  row: ProfitRow;
  onSaved: (rowId: string, field: CostField, newValue: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(String(value));
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 0);
  };

  const commit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const num = parseFloat(draft);
    if (isNaN(num) || num === value) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/profitability/${row.id}/costs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: row.jobKind, [field]: num }),
      });
      if (res.ok) {
        onSaved(row.id, field, num);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const cancel = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(e);
            if (e.key === "Escape") cancel(e);
          }}
          className="w-16 bg-[var(--bg)] border border-[var(--gold)] rounded px-1 py-0.5 text-[11px] text-[var(--tx)] tabular-nums outline-none"
          disabled={saving}
        />
        <button onClick={commit} className="text-emerald-400 hover:text-emerald-300 p-0.5" disabled={saving}>
          <Check weight="regular" className="w-3 h-3" />
        </button>
        <button onClick={cancel} className="text-[var(--tx3)] hover:text-red-400 p-0.5">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <span
      className="group/cell inline-flex items-center gap-1 cursor-pointer"
      title="Click to edit"
      onClick={startEdit}
    >
      <span className={`tabular-nums ${row.hasOverride ? "underline decoration-dotted decoration-[var(--gold)]" : ""}`}>
        {formatCurrency(value)}
      </span>
      <Pencil className="w-2.5 h-2.5 text-[var(--tx3)] opacity-0 group-hover/cell:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}

function makeBreakdown(source: ProfitRow[]) {
  const m: Record<string, { count: number; totalRev: number; totalCost: number; totalGP: number }> = {};
  for (const r of source) {
    const t = r.type || "other";
    if (!m[t]) m[t] = { count: 0, totalRev: 0, totalCost: 0, totalGP: 0 };
    m[t].count++;
    m[t].totalRev += r.revenue;  m[t].totalCost += r.totalDirect;  m[t].totalGP += r.grossProfit;
  }
  return Object.entries(m).map(([type, v]) => ({
    type, label: typeLabel(type), moves: v.count,
    avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
    avgCost:    v.count ? Math.round(v.totalCost / v.count) : 0,
    avgGP:      v.count ? Math.round(v.totalGP / v.count) : 0,
    margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
  }));
}

/* ════════════ Recharts: clean chart tooltip ════════════ */
interface TooltipPayload { name: string; value: number }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A1A1A] border border-[var(--brd)] rounded-lg px-3 py-2 shadow-lg text-[11px]">
      {label && <div className="text-[var(--tx3)] font-medium mb-1">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="text-[var(--tx)]">
          {p.name === "grossMargin" ? "Gross Margin" : p.name === "netMargin" ? "Net Margin" : p.name === "avgGP" ? "Avg Gross Profit" : p.name}
          {": "}
          <span className="font-semibold text-[var(--gold)]">
            {typeof p.value === "number" && (p.name.includes("Margin") || p.name === "grossMargin" || p.name === "netMargin")
              ? `${p.value}%`
              : formatCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ════════════ Overhead Editor ════════════ */
const STANDARD_OVERHEAD_FIELDS: { key: string; label: string; defaultVal: number }[] = [
  { key: "monthly_software_cost",     label: "Software & Tools",   defaultVal: 250 },
  { key: "monthly_auto_insurance",    label: "Auto Insurance",      defaultVal: 1000 },
  { key: "monthly_gl_insurance",      label: "GL Insurance",        defaultVal: 300 },
  { key: "monthly_marketing_budget",  label: "Marketing",           defaultVal: 1000 },
  { key: "monthly_office_admin",      label: "Office / Admin",      defaultVal: 350 },
  { key: "monthly_owner_draw",        label: "Owner Draw",          defaultVal: 0 },
];

const TRUCK_FLEET = [
  { key: "sprinter", label: "Sprinter",   monthlyDefault: 1300, dailyDefault: 65  },
  { key: "16ft",     label: "16 ft",      monthlyDefault: 1300, dailyDefault: 70  },
  { key: "20ft",     label: "20 ft",      monthlyDefault: 1700, dailyDefault: 80  },
  { key: "26ft",     label: "26 ft (per use)", monthlyDefault: 0, dailyDefault: 295 },
];

function OverheadEditor({
  config,
  onSaved,
}: {
  config: Record<string, string>;
  onSaved: () => void;
}) {
  const [standard, setStandard] = useState<Record<string, string>>(() =>
    Object.fromEntries(STANDARD_OVERHEAD_FIELDS.map((f) => [f.key, config[f.key] ?? String(f.defaultVal)]))
  );
  // Truck monthly & daily overrides
  const [truckMonthly, setTruckMonthly] = useState<Record<string, string>>(() =>
    Object.fromEntries(TRUCK_FLEET.map((t) => [t.key, config[`truck_monthly_cost_${t.key}`] ?? String(t.monthlyDefault)]))
  );
  const [truckWorkingDays, setTruckWorkingDays] = useState(config.truck_working_days_per_month ?? "22");
  const [customItems, setCustomItems] = useState<CustomOverheadItem[]>(() => {
    try { return JSON.parse(config.custom_overhead_items ?? "[]"); }
    catch { return []; }
  });
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Derived daily rate for display
  const derivedDaily = (key: string): number => {
    const monthly = parseFloat(truckMonthly[key] ?? "0");
    const days = parseFloat(truckWorkingDays) || 22;
    const t = TRUCK_FLEET.find((x) => x.key === key);
    if (monthly > 0) return Math.round((monthly / days) * 100) / 100;
    return t?.dailyDefault ?? 0;
  };

  const addCustom = () => {
    if (!newLabel.trim() || !newAmount) return;
    setCustomItems((prev) => [...prev, { id: Date.now().toString(), label: newLabel.trim(), amount: parseFloat(newAmount) || 0 }]);
    setNewLabel(""); setNewAmount("");
  };

  const removeCustom = (id: string) => setCustomItems((prev) => prev.filter((i) => i.id !== id));

  const handleSave = async () => {
    setSaving(true);
    const body: Record<string, string> = {
      ...standard,
      truck_working_days_per_month: truckWorkingDays,
      custom_overhead_items: JSON.stringify(customItems),
    };
    for (const t of TRUCK_FLEET) {
      body[`truck_monthly_cost_${t.key}`] = truckMonthly[t.key] ?? "0";
      // Also write derived daily so profitability route reads it directly
      body[`truck_daily_cost_${t.key}`] = String(derivedDaily(t.key));
    }
    await fetch("/api/admin/overhead-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  const truckMonthlyTotal = TRUCK_FLEET.reduce((s, t) => s + (parseFloat(truckMonthly[t.key] ?? "0") || 0), 0);
  const total =
    Object.values(standard).reduce((s, v) => s + (parseFloat(v) || 0), 0) +
    truckMonthlyTotal +
    customItems.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      {/* Standard items */}
      <div>
        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Fixed Monthly Costs</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STANDARD_OVERHEAD_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-[9px] font-medium text-[var(--tx3)] mb-1">{f.label}</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--tx3)]">$</span>
                <input
                  type="number" min="0" step="1"
                  value={standard[f.key] ?? "0"}
                  onChange={(e) => setStandard((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet / Truck costs */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">Fleet Monthly Costs</div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[9px] text-[var(--tx3)]">Working days/mo:</span>
            <input
              type="number" min="1" max="31" step="1" value={truckWorkingDays}
              onChange={(e) => setTruckWorkingDays(e.target.value)}
              className="w-14 px-2 py-1 text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded text-[var(--tx)] outline-none focus:border-[var(--gold)]"
            />
          </div>
        </div>
        <div className="space-y-2">
          {TRUCK_FLEET.map((t) => (
            <div key={t.key} className="flex items-center gap-3">
              <div className="w-24 text-[10px] font-medium text-[var(--tx)]">{t.label}</div>
              <div className="flex-1">
                <label className="block text-[8px] text-[var(--tx3)] mb-0.5">Monthly lease/rental</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--tx3)]">$</span>
                  <input
                    type="number" min="0" step="1"
                    value={truckMonthly[t.key] ?? String(t.monthlyDefault)}
                    onChange={(e) => setTruckMonthly((p) => ({ ...p, [t.key]: e.target.value }))}
                    className="w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors"
                  />
                </div>
              </div>
              <div className="w-32 text-right">
                <div className="text-[8px] text-[var(--tx3)] mb-0.5">Daily rate used</div>
                <div className="text-[12px] font-semibold text-[var(--gold)]">
                  {formatCurrency(derivedDaily(t.key))}<span className="text-[9px] text-[var(--tx3)] font-normal">/day</span>
                </div>
                {parseFloat(truckMonthly[t.key] ?? "0") === 0 && (
                  <div className="text-[8px] text-[var(--tx3)]">industry default</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom items */}
      {customItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tx3)]">Custom Items</div>
          {customItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text" value={item.label}
                onChange={(e) => setCustomItems((p) => p.map((i) => i.id === item.id ? { ...i, label: e.target.value } : i))}
                className="flex-1 px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors"
              />
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--tx3)]">$</span>
                <input
                  type="number" min="0" step="1" value={item.amount}
                  onChange={(e) => setCustomItems((p) => p.map((i) => i.id === item.id ? { ...i, amount: parseFloat(e.target.value) || 0 } : i))}
                  className="w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] outline-none focus:border-[var(--gold)] transition-colors"
                />
              </div>
              <button onClick={() => removeCustom(item.id)} className="text-[var(--tx3)] hover:text-red-400 transition-colors p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new custom item */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text" placeholder="New line item (e.g. Rent, Phone, Fuel Card...)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          className="flex-1 px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)] transition-colors"
        />
        <div className="relative w-28">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--tx3)]">$</span>
          <input
            type="number" min="0" step="1" placeholder="0"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            className="w-full pl-5 pr-2 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--gold)] transition-colors"
          />
        </div>
        <button
          onClick={addCustom}
          disabled={!newLabel.trim() || !newAmount}
          className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-[var(--gold)]/15 text-[var(--gold)] hover:bg-[var(--gold)]/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus weight="regular" className="w-3 h-3" /> Add
        </button>
      </div>

      {/* Footer: total + save */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--brd)]/40">
        <div className="text-[11px] text-[var(--tx3)]">
          Monthly total: <span className="font-semibold text-[var(--tx)]">{formatCurrency(total)}</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 text-[11px] font-semibold px-4 py-1.5 rounded-lg transition-all ${
            saved
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90"
          } disabled:opacity-50`}
        >
          {saved ? <><Check weight="regular" className="w-3.5 h-3.5" /> Saved</> : saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ════════════ column resize hook ════════════ */
function useColResize(count: number, initialWidths: number[]) {
  const [widths, setWidths] = useState<number[]>(initialWidths);
  const dragging = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragging.current.startX;
      setWidths((prev) => {
        const next = [...prev];
        next[dragging.current!.col] = Math.max(40, dragging.current!.startW + delta);
        return next;
      });
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const onMouseDown = (col: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = { col, startX: e.clientX, startW: widths[col] };
  };

  // Render a drag handle to place at the right edge of each <th>
  const Handle = ({ col }: { col: number }) => (
    <span
      onMouseDown={onMouseDown(col)}
      className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize select-none flex items-center justify-center group z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="w-px h-3/4 bg-[var(--brd)] group-hover:bg-[var(--gold)]/60 transition-colors rounded-full" />
    </span>
  );

  // Ensure widths array stays in sync with column count changes
  useEffect(() => {
    setWidths((prev) => {
      if (prev.length === count) return prev;
      const next = [...initialWidths];
      for (let i = 0; i < Math.min(prev.length, count); i++) next[i] = prev[i];
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return { widths, Handle };
}

/* ════════════ main component ════════════ */
export default function ProfitabilityClient() {
  const router = useRouter();
  const { toast: showToast } = useToast();

  // 14 columns (no Tier col; incl. conditional Supplies): ID,Date,Client,Type,Revenue,Hours,Labour,Fuel,Truck,Supplies,Proc,DirectCost,GrossProfit,Margin
  const COL_INITIAL = [72, 80, 150, 90, 76, 52, 76, 60, 60, 72, 60, 88, 92, 68];
  const { widths: colWidths, Handle: ColHandle } = useColResize(COL_INITIAL.length, COL_INITIAL);

  const [preset, setPreset] = useState("this_month");
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [overhead, setOverhead] = useState<OverheadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [showOverhead, setShowOverhead] = useState(false);
  const [overheadConfig, setOverheadConfig] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(20);
  const [tableTab, setTableTab] = useState<"all" | "moves" | "deliveries">("all");
  const [breakdownTab, setBreakdownTab] = useState<"moves" | "deliveries">("moves");

  // Optimistic local update when a cost cell is saved
  const handleCostSaved = useCallback((rowId: string, field: CostField, newValue: number) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: newValue, hasOverride: true };
      const { labour, fuel, truck, supplies, processing, revenue, allocatedOverhead } = updated;
      const totalDirect = labour + fuel + truck + supplies + processing;
      const grossProfit = revenue - totalDirect;
      const netProfit = grossProfit - allocatedOverhead;
      return {
        ...updated,
        totalDirect: Math.round(totalDirect),
        grossProfit: Math.round(grossProfit),
        netProfit: Math.round(netProfit),
        grossMargin: revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0,
        netMargin: revenue > 0 ? Math.round(((netProfit / revenue) * 100) * 10) / 10 : 0,
      };
    }));
    showToast("Cost override saved", "success");
  }, [showToast]);

  // silent=true → background refresh (realtime / interval) — never blanks the page
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { from, to } = getRange(preset);
    try {
      const [profRes, cfgRes] = await Promise.all([
        fetch(`/api/admin/profitability?from=${from}&to=${to}`),
        fetch("/api/admin/overhead-config"),
      ]);
      if (profRes.ok) {
        const data = await profRes.json();
        setRows(data.rows ?? []);
        setSummary(data.summary ?? null);
        setOverhead(data.overhead ?? null);
      }
      if (cfgRes.ok) {
        const { config } = await cfgRes.json();
        setOverheadConfig(config ?? {});
      }
    } catch { /* silent */ }
    if (!silent) setLoading(false);
  }, [preset]);

  // Always hold a ref to the latest fetchData so subscriptions never re-run
  const fetchDataRef = useRef(fetchData);
  useEffect(() => { fetchDataRef.current = fetchData; }, [fetchData]);

  // Preset change → show loading skeleton and refresh
  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime + polling: mount once, use ref so channel is never re-created
  useEffect(() => {
    const supabase = createClient();
    const silentRefresh = () => fetchDataRef.current(true);
    const channel = supabase.channel("profitability-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "moves" }, silentRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, silentRefresh)
      .subscribe();
    const interval = setInterval(silentRefresh, 60_000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── derived ─── */
  const target = summary?.targetMargin ?? 40;
  const moveRows      = useMemo(() => rows.filter((r) => r.jobKind === "move"),     [rows]);
  const deliveryRows  = useMemo(() => rows.filter((r) => r.jobKind === "delivery"), [rows]);

  const revenueSplit = useMemo(() => {
    const res = { count: 0, revenue: 0, gp: 0 };
    const b2b = { count: 0, revenue: 0, gp: 0 };
    for (const r of rows) {
      const bucket = r.jobKind === "move" ? res : b2b;
      bucket.count++;  bucket.revenue += r.revenue;  bucket.gp += r.grossProfit;
    }
    return {
      residential: { ...res, margin: res.revenue > 0 ? Math.round((res.gp / res.revenue) * 1000) / 10 : 0 },
      b2b:         { ...b2b, margin: b2b.revenue > 0 ? Math.round((b2b.gp / b2b.revenue) * 1000) / 10 : 0 },
      combined: {
        revenue: res.revenue + b2b.revenue, gp: res.gp + b2b.gp, count: res.count + b2b.count,
        margin: (res.revenue + b2b.revenue) > 0 ? Math.round(((res.gp + b2b.gp) / (res.revenue + b2b.revenue)) * 1000) / 10 : 0,
      },
    };
  }, [rows]);

  const tierBreakdown = useMemo(() => {
    const m: Record<string, { count: number; totalRev: number; totalCost: number; totalGP: number }> = {};
    for (const r of moveRows) {
      const t = r.tier || "none";
      if (!m[t]) m[t] = { count: 0, totalRev: 0, totalCost: 0, totalGP: 0 };
      m[t].count++;  m[t].totalRev += r.revenue;  m[t].totalCost += r.totalDirect;  m[t].totalGP += r.grossProfit;
    }
    return Object.entries(m).filter(([k]) => k !== "none").map(([tier, v]) => ({
      tier, moves: v.count,
      avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
      avgCost:    v.count ? Math.round(v.totalCost / v.count) : 0,
      avgGP:      v.count ? Math.round(v.totalGP / v.count) : 0,
      margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
    }));
  }, [moveRows]);

  const moveTypeBreakdown     = useMemo(() => makeBreakdown(moveRows),     [moveRows]);
  const deliveryTypeBreakdown = useMemo(() => makeBreakdown(deliveryRows), [deliveryRows]);

  // Margin flag breakdown using fixed 35%/25% thresholds (v2 pricing engine)
  const marginFlagBreakdown = useMemo(() => {
    const green  = rows.filter((r) => r.grossMargin >= 35);
    const yellow = rows.filter((r) => r.grossMargin >= 25 && r.grossMargin < 35);
    const red    = rows.filter((r) => r.grossMargin < 25);
    return { green, yellow, red, total: rows.length };
  }, [rows]);

  const neighbourhoodBreakdown = useMemo(() => {
    const m: Record<string, { count: number; totalRev: number; totalGP: number }> = {};
    for (const r of rows) {
      if (!r.neighbourhood) continue;
      if (!m[r.neighbourhood]) m[r.neighbourhood] = { count: 0, totalRev: 0, totalGP: 0 };
      m[r.neighbourhood].count++;
      m[r.neighbourhood].totalRev += r.revenue;
      m[r.neighbourhood].totalGP  += r.grossProfit;
    }
    return Object.entries(m).map(([area, v]) => ({
      area, moves: v.count,
      avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
      avgGP:      v.count ? Math.round(v.totalGP / v.count) : 0,
      margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
    })).sort((a, b) => b.margin - a.margin);
  }, [rows]);

  const monthlyTrend = useMemo(() => {
    const m: Record<string, { totalRev: number; totalDirect: number; totalOverhead: number; count: number }> = {};
    for (const r of rows) {
      const mo = r.date?.slice(0, 7) || "unknown";
      if (!m[mo]) m[mo] = { totalRev: 0, totalDirect: 0, totalOverhead: 0, count: 0 };
      m[mo].totalRev += r.revenue;  m[mo].totalDirect += r.totalDirect;  m[mo].totalOverhead += r.allocatedOverhead;  m[mo].count++;
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({
      month,
      grossMargin: v.totalRev > 0 ? Math.round((((v.totalRev - v.totalDirect) / v.totalRev) * 100) * 10) / 10 : 0,
      netMargin:   v.totalRev > 0 ? Math.round((((v.totalRev - v.totalDirect - v.totalOverhead) / v.totalRev) * 100) * 10) / 10 : 0,
      moves: v.count,
    }));
  }, [rows]);

  const tableSource = useMemo(() =>
    tableTab === "moves" ? moveRows : tableTab === "deliveries" ? deliveryRows : rows,
    [tableTab, rows, moveRows, deliveryRows]
  );

  const filteredRows = useMemo(() => {
    let r = tableSource;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) => (row.client ?? "").toLowerCase().includes(q) || (row.move_code ?? "").toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av ?? "").localeCompare(String(bv ?? "")) : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [tableSource, search, sortKey, sortAsc]);

  /* ─── CSV ─── */
  const exportCSV = () => {
    const headers = ["ID","Kind","Date","Client","Tier","Type","Revenue","Hours","Labour","Fuel","Truck","Supplies","Processing","Direct Cost","Gross Profit","Gross Margin %","Overhead Alloc","Net Profit","Net Margin %"];
    const csvRows = filteredRows.map((r) => [r.move_code, r.jobKind === "move" ? "Move" : "Partner Job", formatTableDate(r.date), `"${r.client}"`, r.tier ?? "", typeLabel(r.type), r.revenue, r.actual_hours ?? "", r.labour, r.fuel, r.truck, r.supplies, r.processing, r.totalDirect, r.grossProfit, r.grossMargin, r.allocatedOverhead, r.netProfit, r.netMargin].join(","));
    const blob = new Blob([headers.join(",") + "\n" + csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `profitability-${preset}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: string) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(false); } };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 cursor-pointer hover:text-[var(--tx)] select-none whitespace-nowrap" onClick={() => toggleSort(field)}>
      <span className="inline-flex items-center gap-0.5">{label}<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span>
    </th>
  );

  const TypeTable = ({ data }: { data: ReturnType<typeof makeBreakdown> }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead><tr>
          {["Type","Jobs","Avg Revenue","Avg Cost","Avg Profit","Margin"].map((h) => (
            <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {data.map((t) => (
            <tr key={t.type} className="border-t border-[var(--brd)]/50">
              <td className="py-1.5 px-2 font-medium text-[var(--tx)]">{t.label}</td>
              <td className="py-1.5 px-2 text-[var(--tx2)]">{t.moves}</td>
              <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgRevenue)}</td>
              <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgCost)}</td>
              <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(t.avgGP)}</td>
              <td className={`py-1.5 px-2 font-semibold ${marginColor(t.margin, target)}`}>{pct(t.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  /* ════════════ render ════════════ */
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-6 animate-fade-up">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Finance</p>
          <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Profitability</h1>
          <p className="text-[11px] text-[var(--tx3)] mt-2">Cost, profit, and margin from labour, truck, fuel, and supplies</p>
          <Link href="/admin/finance/forecast" className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-[var(--gold)] hover:underline">
            <TrendingUp size={10} weight="regular" className="text-current shrink-0" aria-hidden />
            View Revenue Forecast →
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2 py-1.5">
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => { setPreset(p.id); setVisibleCount(20); }}
                className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${preset === p.id ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] border border-[var(--brd)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg)] transition-colors">
            <Download weight="regular" className="w-3 h-3" /> Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-5">
          {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-[var(--card)] rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ─── Top Stats ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-t border-[var(--brd)]/30 pt-5">
            <StatCard label="Gross Margin" value={pct(summary?.avgGrossMargin ?? 0)} sub={getRange(preset).label}
              className={marginColor(summary?.avgGrossMargin ?? 0, target)} bgClass={marginBg(summary?.avgGrossMargin ?? 0, target)}
              icon={(summary?.avgGrossMargin ?? 0) >= target ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} />
            <StatCard label="Net Margin" value={pct(summary?.avgNetMargin ?? 0)} sub="After Overhead"
              className={marginColor(summary?.avgNetMargin ?? 0, target - 10)} bgClass={marginBg(summary?.avgNetMargin ?? 0, target - 10)}
              icon={(summary?.avgNetMargin ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} />
            <StatCard label="Avg Profit Per Job" value={formatCurrency(summary?.avgProfitPerMove ?? 0)} sub={`${summary?.moveCount ?? 0} completed jobs`}
              className="text-[var(--gold)]" bgClass="bg-[var(--gold)]/5 border-[var(--gold)]/15" />
            <StatCard label="Low Margin Alerts" value={String(summary?.lowMarginCount ?? 0)} sub="Jobs below 25% gross"
              className={summary?.lowMarginCount ? "text-red-400" : "text-emerald-400"}
              bgClass={summary?.lowMarginCount ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}
              icon={summary?.lowMarginCount ? <AlertTriangle className="w-4 h-4" /> : null} />
          </div>

          {/* ─── Margin Health Flags ─── */}
          {marginFlagBreakdown.total > 0 && (
            <div className="flex items-center gap-8 border-t border-[var(--brd)]/30 pt-4">
              {/* Green */}
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold font-heading text-[var(--tx)] leading-none">{marginFlagBreakdown.green.length}</span>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-400/80">
                      {Math.round((marginFlagBreakdown.green.length / marginFlagBreakdown.total) * 100)}%
                    </span>
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mt-0.5">Green · ≥35%</div>
                </div>
              </div>

              <div className="w-px h-7 bg-[var(--brd)]" />

              {/* Yellow */}
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[var(--gold)] shrink-0" />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-bold font-heading text-[var(--tx)] leading-none">{marginFlagBreakdown.yellow.length}</span>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--gold)]/80">
                      {Math.round((marginFlagBreakdown.yellow.length / marginFlagBreakdown.total) * 100)}%
                    </span>
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mt-0.5">Yellow · 25–34%</div>
                </div>
              </div>

              <div className="w-px h-7 bg-[var(--brd)]" />

              {/* Red */}
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${marginFlagBreakdown.red.length > 0 ? "bg-red-400" : "bg-[var(--tx3)]/30"}`} />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-[18px] font-bold font-heading leading-none ${marginFlagBreakdown.red.length > 0 ? "text-red-400" : "text-[var(--tx3)]"}`}>
                      {marginFlagBreakdown.red.length}
                    </span>
                    {marginFlagBreakdown.red.length > 0 && (
                      <span className="text-[9px] font-bold tracking-wider uppercase text-red-400/80">
                        {Math.round((marginFlagBreakdown.red.length / marginFlagBreakdown.total) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mt-0.5">Red · &lt;25%</div>
                </div>
              </div>
            </div>
          )}

          {(summary?.moveCount ?? 0) === 0 && (
            <p className="text-[12px] text-[var(--tx3)] border-t border-[var(--brd)]/30 pt-4">
              No completed jobs in this period. Try{" "}
              <button type="button" onClick={() => setPreset("last_3")} className="text-[var(--gold)] hover:underline font-medium">Last 3 Months</button>{" "}or{" "}
              <button type="button" onClick={() => setPreset("ytd")} className="text-[var(--gold)] hover:underline font-medium">Year to Date</button>.
            </p>
          )}

          {/* ─── Revenue Split ─── */}
          {(revenueSplit.b2b.count > 0 || revenueSplit.residential.count > 0) && (
            <div className="grid grid-cols-3 gap-3 border-t border-[var(--brd)]/30 pt-5">
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">Residential Moves</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.residential.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.residential.count} moves · {pct(revenueSplit.residential.margin)} margin</div>
              </div>
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">Partner Deliveries</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.b2b.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.b2b.count} deliveries · {pct(revenueSplit.b2b.margin)} margin</div>
              </div>
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">Combined</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.combined.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.combined.count} total · {pct(revenueSplit.combined.margin)} blended</div>
              </div>
            </div>
          )}

          {/* ─── Profit by Tier ─── */}
          {tierBreakdown.length > 0 && (
            <Section title="Profit by Tier">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierBreakdown} barCategoryGap="35%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" vertical={false} />
                      <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false}
                        tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip content={<ChartTooltip />} cursor={false} />
                      <Bar dataKey="avgGP" radius={[4, 4, 0, 0]} activeBar={false}>
                        {tierBreakdown.map((e) => <Cell key={e.tier} fill={TIER_COLORS[e.tier] || "#C9A962"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead><tr>
                      {["Tier","Moves","Avg Revenue","Avg Cost","Avg Profit","Margin"].map((h) => (
                        <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {tierBreakdown.map((t) => (
                        <tr key={t.tier} className="border-t border-[var(--brd)]/50">
                          <td className="py-1.5 px-2 capitalize font-medium text-[var(--tx)]">{t.tier}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{t.moves}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgRevenue)}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgCost)}</td>
                          <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(t.avgGP)}</td>
                          <td className={`py-1.5 px-2 font-semibold ${marginColor(t.margin, target)}`}>{pct(t.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}

          {/* ─── Profit by Job Type (tabbed) ─── */}
          {(moveTypeBreakdown.length > 0 || deliveryTypeBreakdown.length > 0) && (
            <Section title="Profit by Job Type">
              <div className="flex items-center gap-1 mb-5 bg-[var(--bg)] rounded-lg p-1 w-fit">
                {([
                  { key: "moves",      label: "Moves" },
                  { key: "deliveries", label: "Partner Jobs" },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setBreakdownTab(key)}
                    className={`text-[10px] px-4 py-1.5 rounded-md font-semibold transition-colors ${breakdownTab === key ? "bg-[var(--card)] text-[var(--tx)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}>
                    {label}
                  </button>
                ))}
              </div>
              {(breakdownTab === "moves" ? [moveTypeBreakdown, "#C9A962"] : [deliveryTypeBreakdown, "#2D6A4F"] as const).length > 0 && (() => {
                const data = breakdownTab === "moves" ? moveTypeBreakdown : deliveryTypeBreakdown;
                const color = breakdownTab === "moves" ? "#C9A962" : "#2D6A4F";
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} barCategoryGap="25%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                          <Tooltip content={<ChartTooltip />} cursor={false} />
                          <Bar dataKey="avgGP" fill={color} radius={[4, 4, 0, 0]} activeBar={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <TypeTable data={data} />
                  </div>
                );
              })()}
            </Section>
          )}

          {/* ─── Profit by Neighbourhood ─── */}
          {neighbourhoodBreakdown.length > 0 && (
            <Section title="Profit by Neighbourhood">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead><tr>
                    {["Area (FSA)","Jobs","Avg Revenue","Avg Gross Profit","Margin"].map((h) => (
                      <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {neighbourhoodBreakdown.slice(0, 15).map((n) => (
                      <tr key={n.area} className="border-t border-[var(--brd)]/50">
                        <td className="py-1.5 px-2 font-mono font-medium text-[var(--tx)]">{n.area}</td>
                        <td className="py-1.5 px-2 text-[var(--tx2)]">{n.moves}</td>
                        <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(n.avgRevenue)}</td>
                        <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(n.avgGP)}</td>
                        <td className={`py-1.5 px-2 font-semibold ${marginColor(n.margin, target)}`}>{pct(n.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ─── Monthly Trend ─── */}
          {monthlyTrend.length > 1 && (
            <Section title="Monthly Trend">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--brd)", strokeWidth: 1, strokeDasharray: "4 2" }} />
                    <Line type="monotone" dataKey="grossMargin" stroke="#C9A962" strokeWidth={2} dot={{ r: 3, fill: "#C9A962" }} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="netMargin"   stroke="#2D6A4F" strokeWidth={2} dot={{ r: 3, fill: "#2D6A4F" }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--tx3)]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#C9A962] rounded-full inline-block" />Gross Margin</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2D6A4F] rounded-full inline-block" />Net Margin</span>
              </div>
            </Section>
          )}

          {/* ─── Per-Job Profit Table ─── */}
          <Section title="Per-Job Profit Table">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--bg)] rounded-lg p-1">
                {([
                  { key: "all",        label: `All  (${rows.length})` },
                  { key: "moves",      label: `Moves  (${moveRows.length})` },
                  { key: "deliveries", label: `Partner Jobs  (${deliveryRows.length})` },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => { setTableTab(key); setVisibleCount(20); }}
                    className={`text-[10px] px-3 py-1.5 rounded-md font-semibold transition-colors ${tableTab === key ? "bg-[var(--card)] text-[var(--tx)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search weight="regular" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--tx3)]" />
                  <input type="text" placeholder="Search client or ID..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none w-52" />
                </div>
                <span className="text-[10px] text-[var(--tx3)]">{filteredRows.length} jobs</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[11px]" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--brd)]/40">
                    {([ 
                      <th key="id" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("move_code")}><span className="inline-flex items-center gap-0.5">ID<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={0} /></th>,
                      <th key="date" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("date")}><span className="inline-flex items-center gap-0.5">Date<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={1} /></th>,
                      <th key="client" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap">Client<ColHandle col={2} /></th>,
                      <th key="type" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap">Type<ColHandle col={3} /></th>,
                      <th key="rev" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("revenue")}><span className="inline-flex items-center gap-0.5">Revenue<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={4} /></th>,
                      <th key="hrs" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap">Hours<ColHandle col={5} /></th>,
                      <th key="lab" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("labour")}><span className="inline-flex items-center gap-0.5">Labour<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={6} /></th>,
                      <th key="fuel" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("fuel")}><span className="inline-flex items-center gap-0.5">Fuel<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={7} /></th>,
                      <th key="truck" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("truck")}><span className="inline-flex items-center gap-0.5">Truck<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={8} /></th>,
                      tableTab !== "deliveries" ? <th key="sup" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("supplies")}><span className="inline-flex items-center gap-0.5">Supplies<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={9} /></th> : null,
                      <th key="proc" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("processing")}><span className="inline-flex items-center gap-0.5">Proc.<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={10} /></th>,
                      <th key="dc" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("totalDirect")}><span className="inline-flex items-center gap-0.5">Direct Cost<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={11} /></th>,
                      <th key="gp" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("grossProfit")}><span className="inline-flex items-center gap-0.5">Gross Profit<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={12} /></th>,
                      <th key="mg" className="relative text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 whitespace-nowrap cursor-pointer hover:text-[var(--tx)] select-none" onClick={() => toggleSort("grossMargin")}><span className="inline-flex items-center gap-0.5">Margin<ArrowUpDown className="w-2.5 h-2.5 opacity-40" /></span><ColHandle col={13} /></th>,
                    ].filter(Boolean))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, visibleCount).map((r) => {
                    const href = r.jobKind === "move" ? `/admin/moves/${r.move_code || r.id}` : `/admin/deliveries/${r.move_code || r.id}`;
                    return (
                      <tr key={r.id} onClick={() => router.push(href)}
                        className={`border-t border-[var(--brd)]/40 cursor-pointer hover:bg-[var(--bg)] transition-colors ${r.grossMargin < 25 ? "border-l-2 border-l-red-500/50" : r.grossMargin > 60 ? "border-l-2 border-l-emerald-500/50" : ""}`}>
                        <td className="py-1.5 px-2 font-mono text-[10px] text-[var(--tx2)] overflow-hidden text-ellipsis whitespace-nowrap">{r.move_code || r.id.slice(0, 8)}</td>
                        <td className="py-1.5 px-2 text-[var(--tx3)] overflow-hidden text-ellipsis whitespace-nowrap">{formatTableDate(r.date)}</td>
                        <td className="py-1.5 px-2 overflow-hidden whitespace-nowrap">
                          <span className="font-medium text-[var(--tx)] truncate">{r.client}</span>
                          {r.tier && (
                            <span
                              className="ml-1.5 inline-flex items-center px-1 py-px rounded text-[8px] font-bold leading-none capitalize"
                              style={{ color: TIER_COLORS[r.tier] ?? "#C9A962", backgroundColor: `${TIER_COLORS[r.tier] ?? "#C9A962"}22` }}
                            >
                              {r.tier}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[var(--tx3)] overflow-hidden text-ellipsis whitespace-nowrap">{typeLabel(r.type)}</td>
                        <td className="py-1.5 px-2 font-medium text-[var(--tx)] overflow-hidden text-ellipsis whitespace-nowrap">{formatCurrency(r.revenue)}</td>
                        <td className="py-1.5 px-2 text-[var(--tx3)] tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">{r.actual_hours != null ? `${r.actual_hours}h` : "—"}</td>
                        <td className="py-1.5 px-2 text-red-400/80 overflow-hidden whitespace-nowrap"><EditableCostCell value={r.labour ?? 0} field="labour" row={r} onSaved={handleCostSaved} /></td>
                        <td className="py-1.5 px-2 text-red-400/80 overflow-hidden whitespace-nowrap"><EditableCostCell value={r.fuel} field="fuel" row={r} onSaved={handleCostSaved} /></td>
                        <td className="py-1.5 px-2 text-red-400/80 overflow-hidden whitespace-nowrap"><EditableCostCell value={r.truck} field="truck" row={r} onSaved={handleCostSaved} /></td>
                        {tableTab !== "deliveries" && <td className="py-1.5 px-2 text-red-400/80 overflow-hidden whitespace-nowrap"><EditableCostCell value={r.supplies} field="supplies" row={r} onSaved={handleCostSaved} /></td>}
                        <td className="py-1.5 px-2 text-red-400/80 overflow-hidden whitespace-nowrap"><EditableCostCell value={r.processing} field="processing" row={r} onSaved={handleCostSaved} /></td>
                        <td className="py-1.5 px-2 font-medium text-red-400 overflow-hidden text-ellipsis whitespace-nowrap">{formatCurrency(r.totalDirect)}</td>
                        <td className="py-1.5 px-2 font-medium text-emerald-400 overflow-hidden text-ellipsis whitespace-nowrap">{formatCurrency(r.grossProfit)}</td>
                        <td className={`py-1.5 px-2 font-bold overflow-hidden text-ellipsis whitespace-nowrap ${marginColor(r.grossMargin, target)}`}>{pct(r.grossMargin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visibleCount < filteredRows.length && (
              <div className="text-center pt-3">
                <button onClick={() => setVisibleCount((c) => c + 20)} className="text-[11px] font-medium text-[var(--gold)] hover:opacity-80 transition-opacity">
                  Load More ({filteredRows.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </Section>

          {/* ─── Monthly Overhead (editable) ─── */}
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl">
            <button onClick={() => setShowOverhead(!showOverhead)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--bg)]/30 transition-colors text-left rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-[var(--tx)]">Monthly Overhead</span>
                {overhead && (
                  <span className="text-[11px] text-[var(--tx3)]">{formatCurrency(overhead.total)}/mo ·{" "}
                    {formatCurrency(overhead.perMove)} per job · break-even {overhead.breakEven} jobs
                  </span>
                )}
              </div>
              <ChevronDown weight="regular" className={`w-4 h-4 text-[var(--tx3)] transition-transform shrink-0 ${showOverhead ? "rotate-180" : ""}`} />
            </button>

            {showOverhead && (
              <div className="px-5 pb-5 border-t border-[var(--brd)]/40">
                <p className="text-[10px] text-[var(--tx3)] pt-3 pb-4">
                  Edit your fixed monthly costs. Changes are saved to the platform and affect all profitability calculations immediately.
                </p>
                <OverheadEditor config={overheadConfig} onSaved={fetchData} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════ sub-components ════════════ */
function StatCard({ label, value, sub, className, bgClass, icon }: {
  label: string; value: string; sub: string; className: string; bgClass: string; icon?: React.ReactNode;
}) {
  void bgClass;
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">{label}</span>
        {icon && <span className={className}>{icon}</span>}
      </div>
      <div className={`text-2xl font-heading font-bold ${className}`}>{value}</div>
      <div className="text-[10px] text-[var(--tx3)] mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <h2 className="text-[13px] font-bold text-[var(--tx)] mb-4">{title}</h2>
      {children}
    </div>
  );
}

// Re-export for other consumers
export { TYPE_LABELS };
