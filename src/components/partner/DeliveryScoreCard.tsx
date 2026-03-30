"use client";

import { CheckCircle, XCircle, Star, ChartBar } from "@phosphor-icons/react";
import { scoreLabel, scoreColor } from "@/lib/partners/deliveryScore";

interface Props {
  score: number;
  onTime: boolean;
  damageFree: boolean;
  rating: number | null;
}

export default function DeliveryScoreCard({ score, onTime, damageFree, rating }: Props) {
  const color = scoreColor(score);
  const label = scoreLabel(score);

  return (
    <div className="rounded-xl border border-[var(--brd)]/40 bg-[var(--card)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ChartBar size={14} color={color} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)]">
            Delivery Score
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-bold" style={{ color }}>{score}</span>
          <span className="text-[11px] text-[var(--tx3)]">/100</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden bg-[var(--brd)]/20"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${score}%`, background: color }}
          />
        </div>
        <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${onTime ? "text-[#22c55e]" : "text-[var(--tx3)] line-through"}`}>
          {onTime ? <CheckCircle size={13} weight="fill" color="#22c55e" /> : <XCircle size={13} color="#ef4444" />}
          On-time
        </span>
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${damageFree ? "text-[#22c55e]" : "text-[var(--tx3)] line-through"}`}>
          {damageFree ? <CheckCircle size={13} weight="fill" color="#22c55e" /> : <XCircle size={13} color="#ef4444" />}
          Damage-free
        </span>
        {rating != null && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--tx3)]">
            <Star size={13} color="#F59E0B" weight="fill" />
            {rating}/5 satisfaction
          </span>
        )}
      </div>
    </div>
  );
}
