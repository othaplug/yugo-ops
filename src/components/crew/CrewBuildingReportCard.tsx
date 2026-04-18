"use client";

import { useState, useCallback } from "react";
import { Buildings, CheckCircle } from "@phosphor-icons/react";

const ELEVATOR_OPTIONS: { value: string; label: string }[] = [
  { value: "standard", label: "Standard: freight or elevator direct to floor" },
  { value: "split_transfer", label: "Transfer between elevators once" },
  { value: "multi_transfer", label: "Multiple transfers" },
  { value: "no_freight", label: "No freight elevator (residential only)" },
  { value: "stairs_only", label: "Stairs only" },
];

export default function CrewBuildingReportCard({
  moveId,
  address,
  lat,
  lng,
}: {
  moveId: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const [elevator, setElevator] = useState("standard");
  const [commercial, setCommercial] = useState(false);
  const [dock, setDock] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [complexity, setComplexity] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/crew/building-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId,
          address,
          lat: lat ?? null,
          lng: lng ?? null,
          elevator_system: elevator,
          has_commercial_tenants: commercial,
          loading_dock_shared_or_restricted: dock,
          narrow_hallways: narrow,
          complexity_rating: complexity,
          crew_notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      setDone(true);
    } catch {
      setErr("Could not save");
    } finally {
      setSaving(false);
    }
  }, [moveId, address, lat, lng, elevator, commercial, dock, narrow, complexity, notes]);

  if (done) {
    return (
      <div className="mx-2 rounded-2xl border border-[#2C3E2D]/30 bg-[#2C3E2D]/8 px-4 py-3 flex items-start gap-3">
        <CheckCircle size={22} weight="bold" className="text-[#243524] shrink-0 mt-0.5" aria-hidden />
        <p className="text-[12px] text-[var(--tx)] leading-snug">
          Building notes saved. Thank you for helping the next crew.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-2 rounded-2xl border border-[var(--brd)]/60 bg-[#FAF7F2] px-4 py-3 space-y-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5C1A33]/10 text-[#5C1A33]">
          <Buildings size={20} weight="bold" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">
            Building report (optional)
          </p>
          <p className="text-[11px] text-[var(--tx2)] mt-1 leading-snug">
            Document access for future quotes at this address. About 30 seconds.
          </p>
        </div>
      </div>
      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        Elevator situation
        <select
          value={elevator}
          onChange={(e) => setElevator(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[12px] text-[var(--tx)]"
        >
          {ELEVATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-[#2C3E2D]"
          checked={commercial}
          onChange={(e) => setCommercial(e.target.checked)}
        />
        <span>Commercial tenants on lower floors (retail, grocery, food)</span>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-[#2C3E2D]"
          checked={dock}
          onChange={(e) => setDock(e.target.checked)}
        />
        <span>Shared loading dock or dock wait time</span>
      </label>
      <label className="flex items-start gap-2.5 text-[12px] text-[var(--tx)] cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 accent-[#2C3E2D]"
          checked={narrow}
          onChange={(e) => setNarrow(e.target.checked)}
        />
        <span>Narrow hallways or tight turns</span>
      </label>
      <div>
        <p className="text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide mb-1.5">
          Access difficulty (1 easy to 5 very hard)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setComplexity(n)}
              className={`min-w-[40px] h-9 rounded-lg text-[12px] font-bold border transition-colors ${
                complexity === n
                  ? "border-[#2C3E2D] bg-[#2C3E2D]/15 text-[#243524]"
                  : "border-[var(--brd)] bg-white text-[var(--tx2)]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wide">
        Notes for future crews
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Dock level, concierge steps, elevator bank, fob rules"
          className="mt-1 w-full rounded-lg border border-[var(--brd)] bg-white px-2.5 py-2 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
        />
      </label>
      {err ? (
        <p className="text-[11px] text-red-700">{err}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="crew-premium-cta w-full py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save building report"}
        </button>
      </div>
    </div>
  );
}
