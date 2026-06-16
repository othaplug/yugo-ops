"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import {
  WINE,
  FOREST,
  CREAM,
  FOREST_BODY,
  FOREST_MUTED,
  calculateDeposit,
} from "./quote-shared";
import YugoLogo from "@/components/YugoLogo";

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
  serviceType?: string;
  moveDate: string | null;
  onSelected?: () => void;
}

const HERO_BG = "#2B0416";
const HERO_TEXT = "#F9EDE4";

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
  baseTotalWithTax,
  baseDepositAmount,
  serviceType = "local_move",
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
      const res = await fetch(
        `/api/quotes/${encodeURIComponent(quoteId)}/select-scenario`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario_id: selected, token: publicActionToken }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Selection failed");
      onSelected?.();
      // Reload so server re-renders with accepted_scenario_id set → shows full quote page
      window.location.reload();
    } catch {
      setError(
        "We couldn't confirm that option just now. Please try again, or contact your move coordinator.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      {/* ── Deep-wine hero (matches the move quote page) ── */}
      <div
        className="px-5 pt-10 pb-12 text-center"
        style={{ background: HERO_BG, color: HERO_TEXT }}
      >
        <div className="max-w-2xl mx-auto flex flex-col items-center">
          <YugoLogo size={30} variant="cream" />
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase mt-7"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            Choose your moving date
          </p>
          <h1 className="font-hero text-[30px] md:text-[36px] leading-snug mt-1.5">
            Select your scheduling option
          </h1>
          <p
            className="text-[14px] leading-relaxed mt-3 max-w-md"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            We&rsquo;ve put together a few options for your move. Each includes
            the same white-glove service, choose the date that works best for you.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-9 space-y-7">
        {/* Scenario cards — premium, tier-style */}
        <div className="space-y-4">
          {scenarios.map((sc) => {
            const total = sc.total_price ?? baseTotalWithTax;
            const deposit =
              sc.deposit_amount ??
              (total != null
                ? calculateDeposit(
                    serviceType,
                    total,
                    undefined,
                    sc.scenario_date ?? moveDate,
                  )
                : baseDepositAmount);
            const fullPayment =
              total != null && deposit != null && deposit >= total - 0.5;
            const effectiveDate = sc.scenario_date ?? moveDate;
            const isSelected = selected === sc.id;
            const isRec = sc.is_recommended;

            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelected(sc.id)}
                className="w-full text-left rounded-2xl border p-6 transition-all"
                style={{
                  borderColor: isSelected
                    ? FOREST
                    : isRec
                      ? `${FOREST}66`
                      : "rgba(92,26,51,0.16)",
                  background: "#FFFFFF",
                  boxShadow: isSelected
                    ? `0 0 0 2px ${FOREST}, 0 10px 30px rgba(44,62,45,0.12)`
                    : "0 2px 16px rgba(92,26,51,0.06)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-hero text-[22px] leading-none"
                        style={{ color: WINE }}
                      >
                        {sc.label ?? `Option ${sc.scenario_number}`}
                      </span>
                      {isRec && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-full"
                          style={{ background: `${FOREST}14`, color: FOREST }}
                        >
                          Recommended
                        </span>
                      )}
                    </div>

                    {effectiveDate && (
                      <p className="text-[14px] font-medium" style={{ color: FOREST_BODY }}>
                        {fmtDate(effectiveDate)}
                        {sc.scenario_time && (
                          <span className="font-normal" style={{ color: FOREST_MUTED }}>
                            {" "}
                            · {fmtTime(sc.scenario_time)}
                          </span>
                        )}
                      </p>
                    )}

                    {sc.description && (
                      <p className="text-[13px] leading-relaxed" style={{ color: FOREST_MUTED }}>
                        {sc.description}
                      </p>
                    )}
                    {sc.conditions_note && (
                      <p className="text-[12px] leading-relaxed" style={{ color: FOREST_MUTED }}>
                        {sc.conditions_note}
                      </p>
                    )}
                  </div>

                  <div
                    className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: isSelected ? FOREST : `${FOREST}40`,
                      background: isSelected ? FOREST : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" weight="bold" />}
                  </div>
                </div>

                {total != null && (
                  <div
                    className="mt-5 pt-4 border-t flex items-end justify-between"
                    style={{ borderColor: "rgba(44,62,45,0.14)" }}
                  >
                    <div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.1em]"
                        style={{ color: FOREST_MUTED }}
                      >
                        Total (incl. HST)
                      </span>
                      <p className="text-[12px] mt-1" style={{ color: FOREST_MUTED }}>
                        {fullPayment
                          ? "Paid in full at booking"
                          : `${fmtCurrency(deposit)} to book · balance auto-charged 48h before your move`}
                      </p>
                    </div>
                    <span className="font-hero text-[30px] leading-none" style={{ color: WINE }}>
                      {fmtCurrency(total)}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <div className="space-y-3 pt-1">
          {error && <p className="text-[13px] text-center" style={{ color: WINE }}>{error}</p>}
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => void handleConfirm()}
            className="w-full py-4 rounded-xl font-bold text-[13px] tracking-[0.08em] uppercase transition-opacity disabled:opacity-40"
            style={{ background: FOREST, color: CREAM }}
          >
            {busy ? "Confirming…" : "Confirm my selection"}
          </button>
          <p className="text-[12px] text-center leading-relaxed" style={{ color: FOREST_MUTED }}>
            You&rsquo;ll review your contract and payment after selecting your
            preferred date. Payment is taken in full no later than 48 hours
            before your move.
          </p>
        </div>
      </div>
    </div>
  );
}
