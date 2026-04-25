"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatPhone } from "@/lib/phone";
import { SpinnerGap } from "@phosphor-icons/react";

export type HubSpotSuggestField = "business" | "contact" | "email" | "phone";

export type HubSpotSuggestRow = {
  hubspot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
};

export type UseHubSpotContactSuggestOptions = {
  query: string;
  activeField: HubSpotSuggestField | null;
  setActiveField: (field: HubSpotSuggestField | null) => void;
  onPick: (row: HubSpotSuggestRow) => void;
  debounceMs?: number;
  minQueryLength?: number;
};

export function applyHubSpotSuggestRow(row: HubSpotSuggestRow) {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
  const digits = (row.phone || "").replace(/\D/g, "").slice(-10);
  return {
    businessName: (row.company || "").trim(),
    contactName: fullName,
    email: (row.email || "").trim().toLowerCase(),
    phoneFormatted: digits ? formatPhone(digits) : "",
    title: (row.title || "").trim(),
    hubspotId: row.hubspot_id,
  };
}

export function useHubSpotContactSuggest({
  query,
  activeField,
  setActiveField,
  onPick,
  debounceMs = 320,
  minQueryLength = 2,
}: UseHubSpotContactSuggestOptions) {
  const rawId = useId();
  const listboxId = `hs-suggest-${rawId.replace(/:/g, "")}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HubSpotSuggestRow[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [noResults, setNoResults] = useState(false);

  useEffect(() => {
    if (!activeField || query.trim().length < minQueryLength) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      setNoResults(false);
      return;
    }

    const t = setTimeout(() => {
      const seq = ++seqRef.current;
      setLoading(true);
      setItems([]);
      setNoResults(false);
      void (async () => {
        try {
          const res = await fetch("/api/hubspot/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query.trim() }),
          });
          const data = (await res.json()) as { suggestions?: HubSpotSuggestRow[] };
          const next = Array.isArray(data.suggestions) ? data.suggestions : [];
          if (seq !== seqRef.current) return;
          setItems(next);
          setNoResults(next.length === 0);
          setOpen(true);
        } catch {
          if (seq === seqRef.current) {
            setItems([]);
            setNoResults(true);
            setOpen(true);
          }
        } finally {
          if (seq === seqRef.current) setLoading(false);
        }
      })();
    }, debounceMs);

    return () => clearTimeout(t);
  }, [query, activeField, debounceMs, minQueryLength]);

  useEffect(() => {
    setHighlight(0);
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = useCallback(
    (row: HubSpotSuggestRow) => {
      onPick(row);
      setOpen(false);
      setItems([]);
      setNoResults(false);
      setActiveField(null);
    },
    [onPick, setActiveField],
  );

  /** Close the typeahead when there are no HubSpot matches (user continues; server may create on save). */
  const dismissNoMatch = useCallback(() => {
    setOpen(false);
    setItems([]);
    setNoResults(false);
    setActiveField(null);
  }, [setActiveField]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || loading) {
        if (e.key === "Escape") setOpen(false);
        return;
      }
      const n = items.length;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (n === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((i) => (i + 1) % n);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((i) => (i - 1 + n) % n);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = items[highlight];
        if (row) pick(row);
      }
    },
    [open, loading, items, highlight, pick],
  );

  const bindField = useCallback(
    (field: HubSpotSuggestField) => ({
      onFocus: () => setActiveField(field),
      onKeyDown,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open && activeField === field,
      "aria-controls": listboxId,
    }),
    [setActiveField, onKeyDown, open, activeField, listboxId],
  );

  const renderDropdown = useCallback(
    (field: HubSpotSuggestField) => {
      if (!open || activeField !== field) return null;
      return (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 left-0 right-0 max-h-[240px] overflow-y-auto rounded-lg border border-[var(--brd)] bg-[var(--card)] shadow-lg"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-[var(--tx3)]">
              <SpinnerGap size={14} className="animate-spin shrink-0" aria-hidden />
              Searching HubSpot…
            </div>
          )}
          {!loading && items.length === 0 && noResults && (
            <div className="px-3 py-2.5 space-y-2 border-b border-[var(--brd)] last:border-0">
              <p className="text-[11px] text-[var(--tx3)] leading-snug">
                No matching contacts in HubSpot for this search. Keep editing; flows that sync to HubSpot will create or
                update a contact when you save (e.g. partner onboarding on activate).
              </p>
              <button
                type="button"
                onPointerDown={(ev) => ev.preventDefault()}
                onClick={dismissNoMatch}
                className="w-full text-left px-2 py-1.5 rounded-md text-[11px] font-semibold text-[var(--accent-text)] border border-[var(--gold)]/40 hover:bg-[var(--gold)]/10 transition-colors"
              >
                Ignore search — continue
              </button>
            </div>
          )}
          {!loading &&
            items.map((row, idx) => {
              const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ");
              const primary = row.company || fullName || row.email || "Contact";
              const secondary = [fullName, row.email, row.phone ? formatPhone(row.phone) : ""].filter(Boolean).join(" · ");
              const active = idx === highlight;
              return (
                <button
                  key={`${row.hubspot_id}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onPointerDown={(ev) => ev.preventDefault()}
                  onClick={() => pick(row)}
                  className={`flex w-full items-start gap-2 text-left px-3 py-2 border-b border-[var(--brd)] last:border-0 ${
                    active ? "bg-[var(--bg)]" : "hover:bg-[var(--bg)]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-[var(--tx)] truncate">{primary}</span>
                    {secondary ? <span className="block text-[10px] text-[var(--tx3)] truncate">{secondary}</span> : null}
                  </span>
                </button>
              );
            })}
        </div>
      );
    },
    [open, activeField, listboxId, loading, items, noResults, highlight, pick, dismissNoMatch],
  );

  return { containerRef, bindField, renderDropdown, onSuggestKeyDown: onKeyDown, listboxId, dismissNoMatch };
}
