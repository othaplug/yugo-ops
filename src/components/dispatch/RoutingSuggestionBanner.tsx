"use client";

import { useState, useEffect } from "react";
import { Path, X, Check, Lightbulb } from "@phosphor-icons/react";

interface RoutingSuggestion {
  id: string;
  suggestion: string;
  savings_km: number;
  savings_minutes: number;
}

export default function RoutingSuggestionBanner({ date }: { date: string }) {
  const [suggestion, setSuggestion] = useState<RoutingSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetch(`/api/dispatch/routing-suggestion?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.suggestion) setSuggestion(d);
      })
      .catch(() => {});
  }, [date]);

  if (!suggestion || dismissed) return null;

  async function handleAction(action: "apply" | "dismiss") {
    if (action === "apply") setApplying(true);
    try {
      await fetch("/api/dispatch/routing-suggestion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: suggestion!.id, action }),
      });
    } finally {
      setApplying(false);
      setDismissed(true);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 px-4 py-3 flex items-start gap-3">
      <span className="shrink-0 mt-0.5 text-[var(--yugo-primary-text)]">
        <Lightbulb size={20} weight="fill" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--yugo-primary-text)] mb-1">
          Routing Suggestion
        </p>
        <p className="text-base font-semibold text-[var(--tx)] leading-snug">{suggestion.suggestion}</p>
        <p className="text-sm text-[var(--tx3)] mt-1 flex items-center gap-1.5">
          <Path size={14} className="shrink-0" aria-hidden />
          Saves ~{suggestion.savings_km} km &nbsp;·&nbsp; ~{suggestion.savings_minutes} min in crew travel
        </p>
        <div className="flex gap-2 mt-2.5">
          <button
            onClick={() => handleAction("apply")}
            disabled={applying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #2C3E2D, #1e2d1f)" }}
          >
            <Check size={14} weight="bold" aria-hidden />
            {applying ? "Applying…" : "Apply Swap"}
          </button>
          <button
            onClick={() => handleAction("dismiss")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] transition-all"
          >
            <X size={14} aria-hidden />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
