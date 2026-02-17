"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ModalOverlay from "../../components/ModalOverlay";

const COMPLEXITY_PRESETS = ["White Glove", "Piano", "High Value Client", "Repeat Client", "Artwork", "Antiques", "Storage"];
const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const h12 = h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      times.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return times;
})();

interface EditMoveDetailsModalProps {
  open: boolean;
  onClose: () => void;
  moveId: string;
  initial: {
    from_address?: string | null;
    to_address?: string | null;
    crew_id?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    arrival_window?: string | null;
    from_access?: string | null;
    to_access?: string | null;
    access_notes?: string | null;
    complexity_indicators?: string[] | null;
    internal_notes?: string | null;
  };
  crews?: { id: string; name: string }[];
  onSaved?: (updates: Record<string, unknown>) => void;
}

export default function EditMoveDetailsModal({ open, onClose, moveId, initial, crews = [], onSaved }: EditMoveDetailsModalProps) {
  const router = useRouter();
  const supabase = createClient();
  const [fromAddress, setFromAddress] = useState(initial.from_address || "");
  const [toAddress, setToAddress] = useState(initial.to_address || "");
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
  const [scheduledTime, setScheduledTime] = useState(initial.scheduled_time || "");
  const [arrivalWindow, setArrivalWindow] = useState(initial.arrival_window || "");
  const [fromAccess, setFromAccess] = useState(initial.from_access || parsed.fromAccess);
  const [toAccess, setToAccess] = useState(initial.to_access || parsed.toAccess);
  const [accessNotes, setAccessNotes] = useState(parsed.notesOnly || (initial.access_notes ?? ""));
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>(Array.isArray(initial.complexity_indicators) ? initial.complexity_indicators : []);
  const [internalNotes, setInternalNotes] = useState(initial.internal_notes || "");
  const [customComplexity, setCustomComplexity] = useState("");
  const [crewId, setCrewId] = useState(initial.crew_id || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFromAddress(initial.from_address || "");
      setToAddress(initial.to_address || "");
      setScheduledDate(toDateInput(initial.scheduled_date));
      setScheduledTime(initial.scheduled_time || "");
      setArrivalWindow(initial.arrival_window || "");
      const p = parseAccessNotes(initial.access_notes);
      setFromAccess(initial.from_access || p.fromAccess);
      setToAccess(initial.to_access || p.toAccess);
      setAccessNotes(p.notesOnly || initial.access_notes || "");
      setComplexityIndicators(Array.isArray(initial.complexity_indicators) ? initial.complexity_indicators : []);
      setInternalNotes(initial.internal_notes || "");
      setCrewId(initial.crew_id || "");
    }
  }, [open, initial.from_address, initial.to_address, initial.crew_id, initial.scheduled_date, initial.scheduled_time, initial.arrival_window, initial.from_access, initial.to_access, initial.access_notes, initial.complexity_indicators, initial.internal_notes]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const updated_at = new Date().toISOString();
    const accessNotesMerged =
      [fromAccess.trim() && `From: ${fromAccess.trim()}`, toAccess.trim() && `To: ${toAccess.trim()}`, accessNotes.trim()].filter(Boolean).join("\n") || null;
    const { data } = await supabase
      .from("moves")
      .update({
        from_address: fromAddress.trim() || null,
        to_address: toAddress.trim() || null,
        delivery_address: toAddress.trim() || null,
        scheduled_date: scheduledDate.trim() || null,
        scheduled_time: scheduledTime.trim() || null,
        arrival_window: arrivalWindow.trim() || null,
        access_notes: accessNotesMerged,
        complexity_indicators: complexityIndicators.length ? complexityIndicators : null,
        internal_notes: internalNotes.trim() || null,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    setSaving(false);
    onClose();
    if (data) onSaved?.(data);
    router.refresh();
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Edit move details" maxWidth="md">
      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 items-end">
          <div className="flex-1 min-w-0 w-full">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">From address</label>
            <input
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              placeholder="Origin address"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div className="w-full sm:w-[140px]">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Access</label>
            <select
              value={fromAccess}
              onChange={(e) => setFromAccess(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value="">Select…</option>
              <option value="Elevator">Elevator</option>
              <option value="Stairs">Stairs</option>
              <option value="Loading dock">Loading dock</option>
              <option value="Parking">Parking</option>
              <option value="Gate / Buzz code">Gate / Buzz code</option>
              <option value="Ground floor">Ground floor</option>
              <option value="Building access required">Building access required</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 items-end">
          <div className="flex-1 min-w-0 w-full">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">To address</label>
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Destination address"
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div className="w-full sm:w-[140px]">
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Access</label>
            <select
              value={toAccess}
              onChange={(e) => setToAccess(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value="">Select…</option>
              <option value="Elevator">Elevator</option>
              <option value="Stairs">Stairs</option>
              <option value="Loading dock">Loading dock</option>
              <option value="Parking">Parking</option>
              <option value="Gate / Buzz code">Gate / Buzz code</option>
              <option value="Ground floor">Ground floor</option>
              <option value="Building access required">Building access required</option>
            </select>
          </div>
        </div>
        {crews.length > 0 && (
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Crew (for live tracking)</label>
            <select
              value={crewId}
              onChange={(e) => setCrewId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value="">No crew assigned</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Time</label>
            <select
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            >
              <option value="">Select time…</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              {scheduledTime && !TIME_OPTIONS.includes(scheduledTime) && (
                <option value={scheduledTime}>{scheduledTime}</option>
              )}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Arrival window</label>
          <input
            value={arrivalWindow}
            onChange={(e) => setArrivalWindow(e.target.value)}
            placeholder="e.g. 8:00 to 10:00 AM"
            className="w-full px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Property access & conditions (notes)</label>
          <textarea
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            placeholder="Elevator reserved, loading dock, stairs, parking, access notes..."
            rows={4}
            className="w-full min-h-[88px] px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none resize-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Complexity indicators</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {COMPLEXITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setComplexityIndicators((prev) => (prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]))}
                className={`px-2.5 py-1 rounded-full text-[9px] font-semibold border transition-colors ${complexityIndicators.includes(preset) ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]" : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
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
                if (e.key === "Enter" && customComplexity.trim()) {
                  e.preventDefault();
                  setComplexityIndicators((prev) => (prev.includes(customComplexity.trim()) ? prev : [...prev, customComplexity.trim()]));
                  setCustomComplexity("");
                }
              }}
              placeholder="Add custom (press Enter)"
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (customComplexity.trim() && !complexityIndicators.includes(customComplexity.trim())) {
                  setComplexityIndicators((prev) => [...prev, customComplexity.trim()]);
                  setCustomComplexity("");
                }
              }}
              className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
            >
              Add
            </button>
          </div>
          {complexityIndicators.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {complexityIndicators.map((ind) => (
                <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                  {ind}
                  <button type="button" onClick={() => setComplexityIndicators((prev) => prev.filter((p) => p !== ind))} className="hover:text-[var(--red)]" aria-label={`Remove ${ind}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Internal notes</label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Client preferences, special instructions, internal-only notes..."
            rows={4}
            className="w-full min-h-[88px] px-4 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none resize-none"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
