"use client";

import React from "react";
import { formatMoveDate, parseDateOnly } from "@/lib/date-format";
import { calcHST, formatCurrency } from "@/lib/format-currency";
import {
  QUOTE_EYEBROW_CLASS,
  WINE,
  FOREST,
  TAX_RATE,
} from "./quote-shared";
import { ESTATE_ON_WINE } from "./estate-quote-ui";
import { premiumShellInk, type PremiumShellKind } from "./quote-premium-shell";

export type MoveProjectPhaseRow = Record<string, unknown> & {
  id?: string;
  phase_name?: string | null;
  days?: MoveProjectDayRow[];
};

export type MoveProjectDayRow = Record<string, unknown> & {
  id?: string;
  date?: string | null;
  label?: string | null;
  description?: string | null;
  crew_size?: number | null;
  truck_type?: string | null;
  estimated_hours?: number | null;
};

export type MoveProjectQuotePayload = {
  project: Record<string, unknown>;
  phases: MoveProjectPhaseRow[];
};

function dayNameShort(iso: string): string {
  const d = parseDateOnly(iso);
  if (!d) return "";
  return d.toLocaleDateString("en-CA", { weekday: "short" });
}

type Props = {
  data: MoveProjectQuotePayload;
  /** Residential premium shell; office uses fixed light styling. */
  shellKind: PremiumShellKind;
  /** Commercial quotes always use cream / forest styling (not wine). */
  forceOffice?: boolean;
};

export default function MoveProjectQuoteTimeline({ data, shellKind, forceOffice }: Props) {
  const p = data.project;
  const phases = data.phases ?? [];
  const totalDays = typeof p.total_days === "number" ? p.total_days : 0;
  const paymentSchedule = (p.payment_schedule as { milestone?: string; amount?: number }[] | null) ?? [];
  const totalPrice = typeof p.total_price === "number" ? p.total_price : null;

  if (phases.length === 0) return null;

  const office = !!forceOffice;
  const ink = office ? null : premiumShellInk(shellKind);

  if (office) {
    return (
      <section className="py-10 px-5 md:px-8 rounded-xl border border-[var(--brd)] bg-[#F9EDE4]/90">
        <div className="max-w-3xl mx-auto">
          <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: WINE }}>
            Your schedule
          </p>
          <h2 className="text-2xl font-serif mb-6" style={{ color: "#2B0416" }}>
            Relocation schedule — {totalDays || phases.reduce((a, ph) => a + (ph.days?.length ?? 0), 0)} days
          </h2>
          {phases.map((phase) => (
            <div key={String(phase.id ?? phase.phase_name)} className="mb-8">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: WINE }}>
                {String(phase.phase_name ?? "Phase")}
              </h3>
              {(phase.days ?? []).map((day) => (
                <div key={String(day.id ?? day.date)} className="flex gap-5 mb-5">
                  <div className="w-16 shrink-0 text-right">
                    {day.date && (
                      <>
                        <p className="text-xl font-serif" style={{ color: "#2B0416" }}>
                          {parseDateOnly(day.date)?.getDate() ?? ""}
                        </p>
                        <p className="text-[10px] uppercase opacity-60" style={{ color: "#2B0416" }}>
                          {dayNameShort(day.date)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="border-l pl-5 pb-3 flex-1 min-w-0" style={{ borderColor: `${WINE}33` }}>
                    <p className="text-[15px] font-medium" style={{ color: "#2B0416" }}>
                      {String(day.label ?? "Day")}
                    </p>
                    {day.description && (
                      <p className="text-[13px] mt-1 leading-relaxed opacity-75" style={{ color: "#2B0416" }}>
                        {String(day.description)}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-[11px] opacity-55" style={{ color: "#2B0416" }}>
                      {typeof day.crew_size === "number" && <span>{day.crew_size} crew</span>}
                      {day.truck_type && <span>{String(day.truck_type)} truck</span>}
                      {typeof day.estimated_hours === "number" && <span>~{day.estimated_hours} hours</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {totalPrice != null && totalPrice > 0 && (
            <div className="border-t pt-6 mt-6" style={{ borderColor: `${WINE}33` }}>
              <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: WINE }}>
                Your investment
              </p>
              <div className="flex justify-between gap-4 text-xl font-serif" style={{ color: "#2B0416" }}>
                <span>Project total (pre-tax)</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>
              <p className="text-[13px] mt-1 opacity-65" style={{ color: "#2B0416" }}>
                + {formatCurrency(calcHST(totalPrice))} HST · Total {formatCurrency(Math.round(totalPrice * (1 + TAX_RATE)))}
              </p>
            </div>
          )}
          {paymentSchedule.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: WINE }}>
                Payment schedule
              </p>
              {paymentSchedule.map((m, i) => (
                <div key={i} className="flex justify-between text-[13px]" style={{ color: "#2B0416" }}>
                  <span className="opacity-75">{m.milestone ?? "Milestone"}</span>
                  <span className="font-medium">{formatCurrency(Number(m.amount) || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const kicker = shellKind === "wine" ? ESTATE_ON_WINE.kicker : ink?.muted ?? FOREST;
  const title = shellKind === "wine" ? ESTATE_ON_WINE.primary : ink?.primary ?? "#2C3E2D";
  const body = shellKind === "wine" ? ESTATE_ON_WINE.body : ink?.body ?? FOREST;
  const muted = shellKind === "wine" ? `${ESTATE_ON_WINE.secondary}` : ink?.muted ?? FOREST;
  const rule = shellKind === "wine" ? "rgba(102,20,61,0.35)" : `${FOREST}33`;

  return (
    <section className="py-12 px-5 md:px-10">
      <div className="max-w-3xl mx-auto">
        <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: kicker }}>
          Your schedule
        </p>
        <h2 className="text-2xl md:text-3xl font-serif mb-8 leading-tight" style={{ color: title }}>
          {totalDays || phases.reduce((a, ph) => a + (ph.days?.length ?? 0), 0)} days, handled with intention
        </h2>

        {phases.map((phase) => (
          <div key={String(phase.id ?? phase.phase_name)} className="mb-10">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] mb-4" style={{ color: kicker }}>
              {String(phase.phase_name ?? "Phase")}
            </h3>
            {(phase.days ?? []).map((day) => (
              <div key={String(day.id ?? day.date)} className="flex gap-6 mb-6">
                <div className="w-16 shrink-0 text-right md:w-20">
                  {day.date && (
                    <>
                      <p className="text-2xl font-serif" style={{ color: title }}>
                        {parseDateOnly(day.date)?.getDate() ?? ""}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide opacity-50" style={{ color: muted }}>
                        {dayNameShort(day.date)}
                      </p>
                      <p className="text-[10px] mt-0.5 opacity-40" style={{ color: muted }}>
                        {formatMoveDate(day.date)}
                      </p>
                    </>
                  )}
                </div>
                <div className="border-l pl-6 pb-4 flex-1 min-w-0" style={{ borderColor: rule }}>
                  <p className="text-lg font-medium leading-snug" style={{ color: body }}>
                    {String(day.label ?? "Day")}
                  </p>
                  {day.description && (
                    <p className="text-sm mt-1 leading-relaxed opacity-70" style={{ color: muted }}>
                      {String(day.description)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-2 text-[11px] opacity-50" style={{ color: muted }}>
                    {typeof day.crew_size === "number" && <span>{day.crew_size} crew</span>}
                    {day.truck_type && <span>{String(day.truck_type)} truck</span>}
                    {typeof day.estimated_hours === "number" && <span>~{day.estimated_hours} hours</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {totalPrice != null && totalPrice > 0 && (
          <div className="border-t pt-8 mt-8" style={{ borderColor: rule }}>
            <p className={`${QUOTE_EYEBROW_CLASS} mb-3`} style={{ color: kicker }}>
              Your investment
            </p>
            <div className="flex justify-between gap-4 text-2xl font-serif" style={{ color: title }}>
              <span>Project (pre-tax)</span>
              <span>{formatCurrency(totalPrice)}</span>
            </div>
            <p className="text-sm mt-1 opacity-60" style={{ color: muted }}>
              + {formatCurrency(calcHST(totalPrice))} HST · Total {formatCurrency(Math.round(totalPrice * (1 + TAX_RATE)))}
            </p>
          </div>
        )}

        {paymentSchedule.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: kicker }}>
              Payment schedule
            </p>
            {paymentSchedule.map((m, i) => (
              <div key={i} className="flex justify-between text-sm" style={{ color: body }}>
                <span className="opacity-70">{m.milestone ?? "Milestone"}</span>
                <span>{formatCurrency(Number(m.amount) || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
