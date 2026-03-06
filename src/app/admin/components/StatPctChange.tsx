"use client";

/** Shows percentage increase/decrease with color. prev/curr can be numbers. */
export function StatPctChange({
  current,
  previous,
  className = "",
}: {
  current: number;
  previous: number;
  className?: string;
}) {
  if (previous === 0) {
    if (current === 0) return null;
    return <span className={`text-[10px] font-medium text-[var(--grn)] ${className}`}>+100%</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  if (pct === 0) return null;
  const isUp = pct > 0;
  const color = isUp ? "text-[var(--grn)]" : "text-[var(--red)]";
  const sign = isUp ? "+" : "";
  return (
    <span className={`text-[10px] font-medium ${color} ${className}`}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}
