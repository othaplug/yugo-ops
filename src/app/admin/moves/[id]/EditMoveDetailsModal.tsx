"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ModalOverlay from "../../components/ModalOverlay";
import { Icon } from "@/components/AppIcons";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { ChevronDown, ChevronRight } from "lucide-react";

const COMPLEXITY_PRESETS = ["White Glove", "Piano", "High Value Client", "Repeat Client", "Artwork", "Antiques", "Storage"];
const ACCESS_OPTIONS = ["Elevator", "Stairs", "Loading dock", "Parking", "Gate / Buzz code", "Ground floor", "Building access required"];

interface EditMoveDetailsModalProps {
  open: boolean;
  onClose: () => void;
  moveId: string;
  initial: {
    from_address?: string | null;
    to_address?: string | null;
    from_lat?: number | null;
    from_lng?: number | null;
    to_lat?: number | null;
    to_lng?: number | null;
    crew_id?: string | null;
    coordinator_name?: string | null;
    scheduled_date?: string | null;
    arrival_window?: string | null;
    from_access?: string | null;
    to_access?: string | null;
    access_notes?: string | null;
    complexity_indicators?: string[] | null;
    internal_notes?: string | null;
  };
  crews?: { id: string; name: string }[];
  isCompleted?: boolean;
  onSaved?: (updates: Record<string, unknown>) => void;
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputBase =
  "w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/30 outline-none transition-all";

export default function EditMoveDetailsModal({ open, onClose, moveId, initial, crews = [], isCompleted = false, onSaved }: EditMoveDetailsModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [fromAddress, setFromAddress] = useState(initial.from_address || "");
  const [toAddress, setToAddress] = useState(initial.to_address || "");
  const [fromLat, setFromLat] = useState<number | null>(initial.from_lat ?? null);
  const [fromLng, setFromLng] = useState<number | null>(initial.from_lng ?? null);
  const [toLat, setToLat] = useState<number | null>(initial.to_lat ?? null);
  const [toLng, setToLng] = useState<number | null>(initial.to_lng ?? null);
  const toDateInput = (d: string | null | undefined) => {
    if (!d) return "";
    const p = new Date(d);
    return isNaN(p.getTime()) ? "" : p.toISOString().slice(0, 10);
  };
  const parseAccessNotes = (s: string | null | undefined) => {
    if (!s || !s.trim()) return { fromAccess: "", toAccess: "", notesOnly: "" };
    const fromMatch = s.match(/^From:\s*(.+?)(?=\n|$)/m);
    const toMatch = s.match(/^To:\s*(.+?)(?=\n|$)/m);
    const fromAccess = fromMatch ? fromMatch[1].trim() : "";
    const toAccess = toMatch ? toMatch[1].trim() : "";
    let notesOnly = s
      .replace(/^From:\s*.+?(?=\n|$)/m, "")
      .replace(/^To:\s*.+?(?=\n|$)/m, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { fromAccess, toAccess, notesOnly };
  };
  const parsed = parseAccessNotes(initial.access_notes);
  const [scheduledDate, setScheduledDate] = useState(() => toDateInput(initial.scheduled_date));
  const [arrivalWindow, setArrivalWindow] = useState(initial.arrival_window || "");
  const [fromAccess, setFromAccess] = useState(initial.from_access || parsed.fromAccess);
  const [toAccess, setToAccess] = useState(initial.to_access || parsed.toAccess);
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>(Array.isArray(initial.complexity_indicators) ? initial.complexity_indicators : []);
  const [internalNotes, setInternalNotes] = useState(initial.internal_notes || "");
  const [customComplexity, setCustomComplexity] = useState("");
  const [crewId, setCrewId] = useState(initial.crew_id || "");
  const [coordinatorName, setCoordinatorName] = useState(initial.coordinator_name || "");
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  // Sync form state when modal opens. Only [open, moveId] so dependency array size never changes.
  useEffect(() => {
    if (!open) return;
    setFromAddress(initial.from_address || "");
    setToAddress(initial.to_address || "");
    setFromLat(initial.from_lat ?? null);
    setFromLng(initial.from_lng ?? null);
    setToLat(initial.to_lat ?? null);
    setToLng(initial.to_lng ?? null);
    setScheduledDate(toDateInput(initial.scheduled_date));
    setArrivalWindow(initial.arrival_window || "");
    const p = parseAccessNotes(initial.access_notes);
    setFromAccess(initial.from_access || p.fromAccess);
    setToAccess(initial.to_access || p.toAccess);
    setComplexityIndicators(Array.isArray(initial.complexity_indicators) ? initial.complexity_indicators : []);
    setInternalNotes(initial.internal_notes || "");
    setCrewId(initial.crew_id || "");
    setCoordinatorName(initial.coordinator_name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync only when open/moveId changes to keep deps array fixed size
  }, [open, moveId]);

  if (!open) return null;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    const updated_at = new Date().toISOString();
    const accessNotesMerged =
      [fromAccess.trim() && `From: ${fromAccess.trim()}`, toAccess.trim() && `To: ${toAccess.trim()}`].filter(Boolean).join("\n") || null;
    const { data, error } = await supabase
      .from("moves")
      .update({
        from_address: fromAddress.trim() || null,
        to_address: toAddress.trim() || null,
        delivery_address: toAddress.trim() || null,
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: toLat,
        to_lng: toLng,
        from_access: fromAccess.trim() || null,
        to_access: toAccess.trim() || null,
        scheduled_date: scheduledDate.trim() || null,
        scheduled_time: null,
        arrival_window: arrivalWindow.trim() || null,
        access_notes: accessNotesMerged,
        crew_id: crewId.trim() || null,
        coordinator_name: coordinatorName.trim() || null,
        complexity_indicators: complexityIndicators.length ? complexityIndicators : null,
        internal_notes: internalNotes.trim() || null,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast(error.message || "Failed to save", "alertTriangle");
      return;
    }
    if (data) {
      onSaved?.(data);
      onClose();
      router.refresh();
      toast("Move details updated", "check");
    }
  };

  const toggleComplexity = (preset: string) => {
    setComplexityIndicators((prev) => (prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]));
  };

  const addCustomComplexity = () => {
    const v = customComplexity.trim();
    if (v && !complexityIndicators.includes(v)) {
      setComplexityIndicators((prev) => [...prev, v]);
      setCustomComplexity("");
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit move details" maxWidth="lg">
      <form onSubmit={handleSave} className="flex flex-col min-h-0">
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Location */}
          <fieldset disabled={isCompleted} className={isCompleted ? "opacity-70" : ""}>
          <section className="space-y-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
              <Icon name="mapPin" className="w-3.5 h-3.5 text-[var(--gold)]" />
              Location
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <AddressAutocomplete
                  value={fromAddress}
                  onRawChange={setFromAddress}
                  onChange={(r) => {
                    setFromAddress(r.fullAddress);
                    setFromLat(r.lat);
                    setFromLng(r.lng);
                  }}
                  placeholder="Origin address"
                  label="From address"
                  className={inputBase}
                />
                <Field label="From access">
                  <select value={fromAccess} onChange={(e) => setFromAccess(e.target.value)} className={inputBase}>
                    <option value="">Select…</option>
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="space-y-3">
                <AddressAutocomplete
                  value={toAddress}
                  onRawChange={setToAddress}
                  onChange={(r) => {
                    setToAddress(r.fullAddress);
                    setToLat(r.lat);
                    setToLng(r.lng);
                  }}
                  placeholder="Destination address"
                  label="To address"
                  className={inputBase}
                />
                <Field label="To access">
                  <select value={toAccess} onChange={(e) => setToAccess(e.target.value)} className={inputBase}>
                    <option value="">Select…</option>
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          </section>
          </fieldset>

          {/* Schedule */}
          <fieldset disabled={isCompleted} className={isCompleted ? "opacity-70" : ""}>
          <section className="space-y-4 pt-4 border-t border-[var(--brd)]/60">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
              <Icon name="calendar" className="w-3.5 h-3.5 text-[var(--gold)]" />
              Schedule
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Date">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className={inputBase}
                />
              </Field>
              <Field label="Time window">
                <select value={arrivalWindow} onChange={(e) => setArrivalWindow(e.target.value)} className={inputBase}>
                  <option value="">Select window…</option>
                  {TIME_WINDOW_OPTIONS.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                  {arrivalWindow && !TIME_WINDOW_OPTIONS.includes(arrivalWindow) && (
                    <option value={arrivalWindow}>{arrivalWindow}</option>
                  )}
                </select>
              </Field>
            </div>
          </section>
          </fieldset>

          {/* Crew & Coordinator */}
          <section className="pt-4 border-t border-[var(--brd)]/60">
            {crews.length > 0 && (
              <fieldset disabled={isCompleted} className={isCompleted ? "opacity-70" : ""}>
                <Field label="Crew (for live tracking)">
                  <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={inputBase}>
                    <option value="">No crew assigned</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              </fieldset>
            )}
            <Field label="Coordinator" className={crews.length > 0 ? "mt-4" : ""}>
              <input
                type="text"
                value={coordinatorName}
                onChange={(e) => setCoordinatorName(e.target.value)}
                placeholder="Coordinator name"
                className={inputBase}
              />
            </Field>
          </section>

          {/* Optional: Complexity & Internal notes */}
          <section className="pt-4 border-t border-[var(--brd)]/60">
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="flex items-center gap-2 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--gold)] transition-colors"
            >
              {showOptional ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showOptional ? "Hide" : "Show"} optional details
            </button>
            {showOptional && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-[var(--brd)]/50">
                <Field label="Complexity indicators">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {COMPLEXITY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => toggleComplexity(preset)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                          complexityIndicators.includes(preset)
                            ? "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/40"
                            : "bg-[var(--bg)] text-[var(--tx2)] border border-[var(--brd)] hover:border-[var(--gold)]/40"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={customComplexity}
                      onChange={(e) => setCustomComplexity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomComplexity();
                        }
                      }}
                      placeholder="Add custom (Enter to add)"
                      className={`${inputBase} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={addCustomComplexity}
                      className="px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all shrink-0"
                    >
                      Add
                    </button>
                  </div>
                </Field>
                <Field label="Internal notes">
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Client preferences, special instructions, internal-only..."
                    rows={3}
                    className={`${inputBase} resize-none min-h-[72px]`}
                  />
                </Field>
              </div>
            )}
          </section>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-t border-[var(--brd)] bg-[var(--card)] flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-[12px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
