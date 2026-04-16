"use client";

import { useState, useEffect } from "react";
import { CaretRight } from "@phosphor-icons/react";

const FALLBACK_ITEMS = [
  { label: "Vehicle in good condition", status: "ok" as const, note: null as string | null },
  { label: "Equipment & supplies ready", status: "ok" as const, note: null as string | null },
  { label: "Dolly, straps, blankets", status: "ok" as const, note: null as string | null },
  { label: "First aid kit accessible", status: "ok" as const, note: null as string | null },
  { label: "Fuel level adequate", status: "ok" as const, note: null as string | null },
];

interface ReadinessCheckProps {
  onComplete: () => void;
}

export default function ReadinessCheck({ onComplete }: ReadinessCheckProps) {
  const [items, setItems] = useState<{ label: string; status: "ok" | "issue"; note: string | null }[]>(FALLBACK_ITEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crew/readiness")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items.map((i: { label: string }) => ({ label: i.label, status: "ok" as const, note: null })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/crew/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ label: i.label, status: i.status, note: i.note })),
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        setSubmitting(false);
        return;
      }
      onComplete();
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  const flaggedCount = items.filter((i) => i.status === "issue").length;

  const toggleBase =
    "min-h-9 min-w-[80px] px-3 py-2 text-[10px] font-bold uppercase leading-none tracking-[0.12em] border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C1A33]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]";

  if (loading) {
    return (
      <div className="max-w-[420px] mx-auto border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
        <p className="text-[13px] text-[var(--tx2)]">Loading readiness check…</p>
      </div>
    );
  }

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-hero text-[26px] font-bold text-[var(--tx)]">Pre-Trip Readiness Check</h2>
          <p className="text-[11px] text-[var(--tx2)] mt-0.5 leading-relaxed">
            Quick 60-second check before starting the day
          </p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-3 px-4 border border-[var(--brd)] bg-[var(--bg)]"
              >
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--tx)]">
                  {item.label}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.map((x, j) => (j === i ? { ...x, status: "ok" as const } : x)))}
                    className={`${toggleBase} ${
                      item.status === "ok"
                        ? "border-[#2C3E2D] bg-[#2C3E2D] text-white"
                        : "border-[var(--brd)] bg-transparent text-[var(--tx2)] hover:border-[#2C3E2D]/45 hover:text-[var(--tx)]"
                    }`}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.map((x, j) => (j === i ? { ...x, status: "issue" as const } : x)))}
                    className={`${toggleBase} ${
                      item.status === "issue"
                        ? "border-[#ef4444] bg-[#7f1d1d] text-white"
                        : "border-[var(--brd)] bg-transparent text-[var(--tx2)] hover:border-[var(--red)]/40 hover:text-[var(--red)]"
                    }`}
                  >
                    Issue
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="admin-premium-label admin-premium-label--tight">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any notes about today's setup..."
              className="admin-premium-input w-full text-[13px] text-[var(--tx)]"
            />
          </div>
          {error && (
            <div className="text-[12px] text-[var(--red)] bg-[var(--red)]/10 px-3 py-2 border border-[var(--red)]/25">
              {error}
            </div>
          )}
          {flaggedCount > 0 && (
            <p className="text-[11px] font-medium text-[var(--red)]">
              {flaggedCount} item{flaggedCount > 1 ? "s" : ""} flagged, dispatch will be notified
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="crew-premium-cta flex w-full min-h-12 items-center justify-center gap-1.5 px-4 py-3 font-bold text-[10px] uppercase leading-none tracking-[0.12em] text-white border border-[#2C3E2D]/30 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5C1A33]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"
          >
            {submitting ? (
              "Submitting…"
            ) : (
              <>
                Complete & continue
                <CaretRight size={12} weight="bold" className="shrink-0 opacity-90" aria-hidden />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
