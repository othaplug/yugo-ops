"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "../../components/Toast";
import { CaretRight, Check, Plus, WarningCircle } from "@phosphor-icons/react";

export type ConditionRating = "excellent" | "good" | "fair" | "poor" | "damaged";

export type GalleryItem = {
  id: string;
  project_id: string;
  title: string;
  artist: string | null;
  medium: string | null;
  dimensions: string | null;
  weight_kg: number | null;
  serial_number: string | null;
  insurance_value: string | null;
  crating_required: boolean;
  climate_sensitive: boolean;
  fragile: boolean;
  handling_notes: string | null;
  pre_condition: ConditionRating | null;
  pre_condition_notes: string | null;
  post_condition: ConditionRating | null;
  post_condition_notes: string | null;
  condition_discrepancy: boolean;
  sort_order: number;
};

const CONDITION_OPTIONS: { value: ConditionRating; label: string; color: string }[] = [
  { value: "excellent", label: "Excellent", color: "#22C55E" },
  { value: "good", label: "Good", color: "#3B82F6" },
  { value: "fair", label: "Fair", color: "#F59E0B" },
  { value: "poor", label: "Poor", color: "#F97316" },
  { value: "damaged", label: "Damaged", color: "#EF4444" },
];

const STATUS_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  damaged: "Damaged",
};

function ConditionDot({ rating }: { rating: ConditionRating | null }) {
  if (!rating) return <span className="text-[10px] text-[var(--tx3)]">-</span>;
  const opt = CONDITION_OPTIONS.find((o) => o.value === rating);
  return (
    <span
      className="inline-flex items-center gap-1 dt-badge tracking-[0.04em]"
      style={{ color: opt?.color || "#888" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opt?.color || "#888" }} />
      {STATUS_LABELS[rating]}
    </span>
  );
}

function AddItemForm({
  projectId,
  onAdded,
  onCancel,
}: {
  projectId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [insuranceValue, setInsuranceValue] = useState("");
  const [fragile, setFragile] = useState(false);
  const [crating, setCrating] = useState(false);
  const [climateSensitive, setClimateSensitive] = useState(false);
  const [handlingNotes, setHandlingNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/gallery/projects/${projectId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim() || null,
          medium: medium.trim() || null,
          dimensions: dimensions.trim() || null,
          insurance_value: insuranceValue.trim() || null,
          fragile,
          crating_required: crating,
          climate_sensitive: climateSensitive,
          handling_notes: handlingNotes.trim() || null,
        }),
      });
      if (res.ok) {
        toast("Item added", "check");
        onAdded();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to add item", "x");
      }
    } catch { toast("Failed to add item", "x"); }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--brd)]/50 space-y-3">
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/82 mb-2">Add Item</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Untitled #1"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Artist</label>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist name"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Medium</label>
          <input
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="Oil on canvas"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Dimensions</label>
          <input
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            placeholder="24 × 36 in"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Insurance Value</label>
          <input
            value={insuranceValue}
            onChange={(e) => setInsuranceValue(e.target.value)}
            placeholder="$12,500 CAD"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Handling Notes</label>
          <input
            value={handlingNotes}
            onChange={(e) => setHandlingNotes(e.target.value)}
            placeholder="Keep upright, do not stack"
            className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        {[
          { key: "fragile", label: "Fragile", val: fragile, set: setFragile },
          { key: "crating", label: "Crating Required", val: crating, set: setCrating },
          { key: "climate", label: "Climate-Sensitive", val: climateSensitive, set: setClimateSensitive },
        ].map(({ key, label, val, set }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${val ? "bg-[var(--admin-primary-fill)] border-[var(--gold)]" : "border-[var(--brd)] bg-[var(--card)]"}`}
              onClick={() => set(!val)}
            >
              {val && (
                <Check size={10} color="white" weight="bold" />
              )}
            </div>
            <span className="text-[11px] font-medium text-[var(--tx2)]">{label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="admin-btn admin-btn-primary"
        >
          {saving ? "Adding…" : "Add Item"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConditionReportForm({
  item,
  phase,
  projectId,
  onSaved,
  onCancel,
}: {
  item: GalleryItem;
  phase: "pre" | "post";
  projectId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const existingRating = phase === "pre" ? item.pre_condition : item.post_condition;
  const existingNotes = phase === "pre" ? item.pre_condition_notes : item.post_condition_notes;

  const [condition, setCondition] = useState<ConditionRating | "">(existingRating || "");
  const [notes, setNotes] = useState(existingNotes || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!condition) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {
        itemId: item.id,
        [`${phase}_condition`]: condition,
        [`${phase}_condition_notes`]: notes.trim() || null,
        [`${phase}_condition_at`]: now,
      };
      const res = await fetch(`/api/gallery/projects/${projectId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        toast("Condition report saved", "check");
        onSaved();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to save", "x");
      }
    } catch { toast("Failed to save", "x"); }
    setSaving(false);
  };

  return (
    <div className="mt-3 bg-[var(--bg)] rounded-xl p-3 border border-[var(--brd)]/40 space-y-3">
      <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/82">
        {phase === "pre" ? "Pre-Transport Condition" : "Post-Transport Condition"}
      </div>
      <div className="flex flex-wrap gap-2">
        {CONDITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCondition(opt.value)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border"
            style={{
              borderColor: condition === opt.value ? opt.color : "var(--brd)",
              background: condition === opt.value ? opt.color + "22" : "transparent",
              color: condition === opt.value ? opt.color : "var(--tx3)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Condition notes (optional)…"
        rows={2}
        className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none focus:border-[var(--gold)] resize-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !condition}
          className="admin-btn admin-btn-sm admin-btn-primary"
        >
          {saving ? "Saving…" : "Save Report"}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-[11px] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function GalleryItemsPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [conditionPhase, setConditionPhase] = useState<{ id: string; phase: "pre" | "post" } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(() => {
    setLoading(true);
    fetch(`/api/gallery/projects/${projectId}/items`)
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleDelete = async (itemId: string) => {
    if (!confirm("Remove this item?")) return;
    setDeletingId(itemId);
    try {
      const res = await fetch(`/api/gallery/projects/${projectId}/items?itemId=${itemId}`, { method: "DELETE" });
      if (res.ok) { toast("Item removed", "check"); fetchItems(); }
      else toast("Failed to remove", "x");
    } catch { toast("Failed to remove", "x"); }
    setDeletingId(null);
  };

  const discrepancyCount = items.filter((i) => i.condition_discrepancy).length;
  const conditionedCount = items.filter((i) => i.pre_condition || i.post_condition).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-0.5">Artwork Items</div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--tx3)]">
            <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
            {conditionedCount > 0 && (
              <span>· {conditionedCount} with condition reports</span>
            )}
            {discrepancyCount > 0 && (
              <span className="font-bold text-[#EF4444]">· {discrepancyCount} discrepanc{discrepancyCount !== 1 ? "ies" : "y"}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--gold)]/10 text-[var(--accent-text)] text-[11px] font-semibold hover:bg-[var(--gold)]/20 transition-colors"
        >
          <Plus size={12} weight="regular" className="text-current" />
          Add Item
        </button>
      </div>

      {/* Add item form */}
      {showAddForm && (
        <AddItemForm
          projectId={projectId}
          onAdded={() => { setShowAddForm(false); fetchItems(); }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Items list */}
      {loading ? (
        <div className="py-6 text-center text-[12px] text-[var(--tx3)]">Loading items…</div>
      ) : items.length === 0 && !showAddForm ? (
        <div className="py-6 text-center text-[12px] text-[var(--tx3)]">
          No items yet. Add artwork to track condition reports.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isConditionForm = conditionPhase?.id === item.id;
            const hasDiscrepancy = item.condition_discrepancy;

            return (
              <div
                key={item.id}
                className={`rounded-xl border transition-colors ${
                  hasDiscrepancy
                    ? "border-[#EF4444]/30 bg-[#EF4444]/5"
                    : "border-[var(--brd)]/50 bg-[var(--card)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3"
                >
                  {/* Flags */}
                  <div className="shrink-0 flex gap-1">
                    {item.fragile && (
                      <span className="dt-badge tracking-[0.04em] text-[#F59E0B]">FRAGILE</span>
                    )}
                    {item.crating_required && (
                      <span className="dt-badge tracking-[0.04em] text-[#8B5CF6]">CRATING</span>
                    )}
                    {item.climate_sensitive && (
                      <span className="dt-badge tracking-[0.04em] text-[#3B82F6]">CLIMATE</span>
                    )}
                    {hasDiscrepancy && (
                      <span className="dt-badge tracking-[0.04em] text-[#EF4444]">DISCREPANCY</span>
                    )}
                  </div>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--tx)] truncate">{item.title}</p>
                    <p className="text-[10px] text-[var(--tx3)] truncate mt-0.5">
                      {[item.artist, item.medium, item.dimensions].filter(Boolean).join(" · ") || "No details"}
                    </p>
                  </div>

                  {/* Condition badges */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <div className="text-[9px] text-[var(--tx3)] text-right">
                      <div>Pre: <ConditionDot rating={item.pre_condition} /></div>
                      <div className="mt-0.5">Post: <ConditionDot rating={item.post_condition} /></div>
                    </div>
                  </div>

                  <CaretRight weight="regular" className={`w-4 h-4 text-[var(--tx3)] transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`} aria-hidden />
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--brd)]/30 pt-3 space-y-3">
                    {/* Item details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      {item.insurance_value && (
                        <div>
                          <p className="text-[9px] font-bold uppercase text-[var(--tx3)]/82">Insurance Value</p>
                          <p className="font-semibold text-[var(--tx)]">{item.insurance_value}</p>
                        </div>
                      )}
                      {item.serial_number && (
                        <div>
                          <p className="text-[9px] font-bold uppercase text-[var(--tx3)]/82">Serial / Reg #</p>
                          <p className="font-semibold text-[var(--tx)]">{item.serial_number}</p>
                        </div>
                      )}
                      {item.weight_kg != null && (
                        <div>
                          <p className="text-[9px] font-bold uppercase text-[var(--tx3)]/82">Weight</p>
                          <p className="font-semibold text-[var(--tx)]">{item.weight_kg} kg</p>
                        </div>
                      )}
                      {item.handling_notes && (
                        <div className="col-span-2 sm:col-span-3">
                          <p className="text-[9px] font-bold uppercase text-[var(--tx3)]/82">Handling Notes</p>
                          <p className="text-[var(--tx2)]">{item.handling_notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Condition report summary */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <div className="flex-1 min-w-[160px] bg-[var(--bg)] rounded-lg p-3">
                        <div className="text-[9px] font-bold uppercase text-[var(--tx3)]/82 mb-1">Pre-Transport</div>
                        {item.pre_condition ? (
                          <>
                            <ConditionDot rating={item.pre_condition} />
                            {item.pre_condition_notes && (
                              <p className="text-[10px] text-[var(--tx3)] mt-1">{item.pre_condition_notes}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-[var(--tx3)]">Not recorded</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setConditionPhase(
                            isConditionForm && conditionPhase?.phase === "pre" ? null : { id: item.id, phase: "pre" }
                          )}
                          className="mt-2 text-[10px] font-semibold text-[var(--accent-text)] hover:opacity-80 transition-opacity"
                        >
                          {item.pre_condition ? "Update" : "Record Condition"}
                        </button>
                      </div>
                      <div className="flex-1 min-w-[160px] bg-[var(--bg)] rounded-lg p-3">
                        <div className="text-[9px] font-bold uppercase text-[var(--tx3)]/82 mb-1">Post-Transport</div>
                        {item.post_condition ? (
                          <>
                            <ConditionDot rating={item.post_condition} />
                            {item.post_condition_notes && (
                              <p className="text-[10px] text-[var(--tx3)] mt-1">{item.post_condition_notes}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-[var(--tx3)]">Not recorded</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setConditionPhase(
                            isConditionForm && conditionPhase?.phase === "post" ? null : { id: item.id, phase: "post" }
                          )}
                          className="mt-2 text-[10px] font-semibold text-[var(--accent-text)] hover:opacity-80 transition-opacity"
                        >
                          {item.post_condition ? "Update" : "Record Condition"}
                        </button>
                      </div>
                    </div>

                    {/* Condition form */}
                    {isConditionForm && conditionPhase && (
                      <ConditionReportForm
                        item={item}
                        phase={conditionPhase.phase}
                        projectId={projectId}
                        onSaved={() => { setConditionPhase(null); fetchItems(); }}
                        onCancel={() => setConditionPhase(null)}
                      />
                    )}

                    {hasDiscrepancy && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20">
                        <WarningCircle size={14} color="#EF4444" />
                        <span className="text-[11px] font-semibold text-[#EF4444]">
                          Condition discrepancy: {item.pre_condition} → {item.post_condition}
                        </span>
                      </div>
                    )}

                    {/* Delete */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-[10px] font-semibold text-[var(--red)] hover:opacity-80 transition-opacity disabled:opacity-40"
                      >
                        {deletingId === item.id ? "Removing…" : "Remove item"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
