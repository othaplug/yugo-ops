"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { WINE, FOREST, CREAM, FOREST_BODY, FOREST_MUTED } from "./quote-shared";

export interface QuoteScenario {
  id: string;
  scenario_number: number;
  label: string | null;
  description: string | null;
  is_recommended: boolean;
  scenario_date: string | null;
  scenario_time: string | null;
  price: number | null;
  hst: number | null;
  total_price: number | null;
  deposit_amount: number | null;
  conditions_note: string | null;
  status: string;
}

interface Props {
  quoteId: string;
  publicActionToken: string;
  scenarios: QuoteScenario[];
  basePrice: number | null;
  baseTotalWithTax: number | null;
  baseDepositAmount: number | null;
  moveDate: string | null;
  onSelected?: () => void;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}

function fmtTime(t: string | null): string {
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const h = Number(m[1]);
  const min = m[2];
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${ampm}`;
}

function fmtCurrency(n: number | null): string {
  if (n == null) return "";
  return `$${Math.round(n).toLocaleString()}`;
}

export default function MultiScenarioSelector({
  quoteId,
  publicActionToken,
  scenarios,
  basePrice,
  baseTotalWithTax,
  baseDepositAmount,
  moveDate,
  onSelected,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/select-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: selected, token: publicActionToken }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Selection failed");
      onSelected?.();
      // Reload so server re-renders with accepted_scenario_id set → shows full quote page
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: CREAM }}
    >
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: FOREST_MUTED }}>
            Choose your moving date
          </p>
          <h1 className="text-2xl font-bold leading-snug" style={{ color: WINE }}>
            Select a scheduling option
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: FOREST_BODY }}>
            We&rsquo;ve put together a few options for your move. Select the one that works best for you — all include the same service.
          </p>
        </div>

        {/* Scenario cards */}
        <div className="space-y-3">
          {scenarios.map((sc) => {
            const effectiveTotal = sc.total_price ?? baseTotalWithTax;
            const effectiveDeposit = sc.deposit_amount ?? baseDepositAmount;
            const effectiveDate = sc.scenario_date ?? moveDate;
            const isSelected = selected === sc.id;

            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelected(sc.id)}
                className="w-full text-left rounded-xl border-2 p-4 transition-all"
                style={{
                  borderColor: isSelected ? FOREST : `${FOREST}30`,
                  background: isSelected ? `${FOREST}08` : "white",
                  boxShadow: isSelected ? `0 0 0 2px ${FOREST}20` : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base" style={{ color: WINE }}>
                        {sc.label ?? `Option ${sc.scenario_number}`}
                      </span>
                      {sc.is_recommended && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: `${FOREST}18`, color: FOREST }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>

                    {effectiveDate && (
                      <p className="text-sm font-medium" style={{ color: FOREST_BODY }}>
                        {fmtDate(effectiveDate)}
                        {sc.scenario_time && <span className="text-sm ml-2 font-normal" style={{ color: FOREST_MUTED }}> · {fmtTime(sc.scenario_time)}</span>}
                      </p>
                    )}

                    {sc.description && (
                      <p className="text-sm leading-snug" style={{ color: FOREST_MUTED }}>
                        {sc.description}
                      </p>
                    )}

                    {sc.conditions_note && (
                      <p className="text-xs leading-snug" style={{ color: FOREST_MUTED }}>
                        {sc.conditions_note}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: isSelected ? FOREST : `${FOREST}40`,
                        background: isSelected ? FOREST : "transparent",
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" weight="bold" />}
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                {effectiveTotal != null && (
                  <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: `${FOREST}18` }}>
                    <span className="text-sm" style={{ color: FOREST_MUTED }}>Total (incl. HST)</span>
                    <div className="text-right">
                      <span className="text-lg font-bold" style={{ color: WINE }}>
                        {fmtCurrency(effectiveTotal)}
                      </span>
                      {effectiveDeposit != null && (
                        <p className="text-xs" style={{ color: FOREST_MUTED }}>
                          Deposit: {fmtCurrency(effectiveDeposit)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => void handleConfirm()}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-opacity disabled:opacity-40"
            style={{ background: FOREST, color: CREAM }}
          >
            {busy ? "Confirming…" : "Confirm my selection"}
          </button>
          <p className="text-xs text-center" style={{ color: FOREST_MUTED }}>
            You&rsquo;ll review the contract and deposit after selecting your preferred date.
          </p>
        </div>
      </div>
    </div>
  );
}
