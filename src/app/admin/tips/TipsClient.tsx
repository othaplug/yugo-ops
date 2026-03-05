"use client";

import { formatCurrency } from "@/lib/format-currency";

interface Tip {
  id: string;
  move_id: string;
  crew_id: string;
  crew_name: string | null;
  client_name: string | null;
  amount: number;
  processing_fee: number | null;
  net_amount: number | null;
  charged_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export default function TipsClient({
  tips,
  totalTips,
  avgTip,
  tipCount,
}: {
  tips: Tip[];
  totalTips: number;
  avgTip: number;
  tipCount: number;
}) {
  return (
    <div className="max-w-[1000px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <h1 className="font-heading text-[20px] font-bold text-[var(--tx)] mb-1">Tips</h1>
      <p className="text-[12px] text-[var(--tx3)] mb-5">Crew gratuities from completed moves</p>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Tips</div>
          <span className="text-xl font-bold font-heading text-[var(--gold)]">{formatCurrency(totalTips)}</span>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Average</div>
          <span className="text-xl font-bold font-heading text-[var(--tx)]">{formatCurrency(avgTip)}</span>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Count</div>
          <span className="text-xl font-bold font-heading text-[var(--tx)]">{tipCount}</span>
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="divide-y divide-[var(--brd)]/50">
          {tips.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
              No tips yet — tips appear here after clients leave gratuities on completed moves.
            </div>
          ) : (
            tips.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[var(--tx)]">{t.client_name || "—"}</div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                    {t.crew_name || "—"} · {formatDate(t.charged_at)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[14px] font-bold text-[var(--gold)] font-heading">{formatCurrency(t.amount)}</div>
                  {t.processing_fee != null && Number(t.processing_fee) > 0 && (
                    <div className="text-[9px] text-[var(--tx3)]">
                      Fee absorbed: {formatCurrency(Number(t.processing_fee))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
