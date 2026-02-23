"use client";

import { useState, useEffect } from "react";

const FALLBACK_ITEMS = [
  { label: "Truck in good condition", status: "ok" as const, note: null as string | null },
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

  const toggleItem = (index: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        status: next[index].status === "ok" ? "issue" : "ok",
        note: next[index].status === "ok" ? next[index].note : null,
      };
      return next;
    });
  };

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

  if (loading) {
    return (
      <div className="max-w-[420px] mx-auto rounded-xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
        <p className="text-[13px] text-[var(--tx3)]">Loading readiness check…</p>
      </div>
    );
  }

  return (
    <div className="max-w-[420px] mx-auto">
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)]">
          <h2 className="font-hero text-[16px] font-bold text-[var(--tx)]">Pre-Trip Readiness Check</h2>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Quick 60-second check before starting the day</p>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-2.5 px-4 rounded-lg border border-[var(--brd)] bg-[var(--bg)]"
              >
                <span className="text-[13px] text-[var(--tx)]">{item.label}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.map((x, j) => (j === i ? { ...x, status: "ok" as const } : x)))}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                      item.status === "ok"
                        ? "bg-[var(--grn)]/20 text-[var(--grn)] border border-[var(--grn)]/40"
                        : "bg-transparent text-[var(--tx3)] border border-[var(--brd)] hover:border-[var(--grn)]/40"
                    }`}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((p) => p.map((x, j) => (j === i ? { ...x, status: "issue" as const } : x)))}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${
                      item.status === "issue"
                        ? "bg-[var(--org)]/20 text-[var(--org)] border border-[var(--org)]/40"
                        : "bg-transparent text-[var(--tx3)] border border-[var(--brd)] hover:border-[var(--org)]/40"
                    }`}
                  >
                    Issue
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1.5 uppercase tracking-wider">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any notes about today's setup..."
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          </div>
          {error && (
            <div className="text-[12px] text-[var(--red)] bg-[var(--red)]/10 px-3 py-2 rounded-lg">{error}</div>
          )}
          {flaggedCount > 0 && (
            <p className="text-[11px] text-[var(--org)]">
              {flaggedCount} item{flaggedCount > 1 ? "s" : ""} flagged — dispatch will be notified
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-semibold text-[14px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting…" : "Complete & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
