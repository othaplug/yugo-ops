"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

export interface BarPoint {
  label: string;
  [key: string]: number | string;
}

export interface BarChartCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: string;
  rightSlot?: React.ReactNode;
  series: BarSeries[];
  data: BarPoint[];
  /** Format a y-axis tick value. Defaults to compact dollar format. */
  formatTick?: (v: number) => string;
  chartHeight?: number;
}

const defaultFormatTick = (v: number): string => {
  if (v === 0) return "$0";
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `$${v}`;
};

export const BarChartCard = React.forwardRef<HTMLDivElement, BarChartCardProps>(
  (
    {
      eyebrow,
      title,
      rightSlot,
      series,
      data,
      formatTick = defaultFormatTick,
      chartHeight = 140,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-5 flex flex-col gap-3",
          className,
        )}
        {...rest}
      >
        {(eyebrow || title || rightSlot) && (
          <header className="flex items-start justify-between gap-3">
            <div>
              {eyebrow && (
                <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                  {eyebrow}
                </div>
              )}
              {title && (
                <div className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-1 leading-tight">
                  {title}
                </div>
              )}
            </div>
            {rightSlot}
          </header>
        )}

        <GroupedBarChart
          series={series}
          data={data}
          formatTick={formatTick}
          chartHeight={chartHeight}
        />

        {/* Legend */}
        <div className="flex items-center gap-4 pt-1">
          {series.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-none"
                style={{ background: s.color }}
              />
              <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {children}
      </div>
    );
  },
);
BarChartCard.displayName = "BarChartCard";

/* ─────────────────────────────────────────────────────────────────────────
 * Inner SVG chart
 * ──────────────────────────────────────────────────────────────────────── */

function niceMax(raw: number): number {
  if (raw <= 0) return 500;
  const step = raw <= 1000 ? 250 : raw <= 3000 ? 500 : 1000;
  return Math.ceil(raw / step) * step;
}

function niceTicks(max: number): number[] {
  const step = max / 4;
  return [0, step, step * 2, step * 3, max];
}

interface GroupedBarChartProps {
  series: BarSeries[];
  data: BarPoint[];
  formatTick: (v: number) => string;
  chartHeight: number;
}

function GroupedBarChart({
  series,
  data,
  formatTick,
  chartHeight,
}: GroupedBarChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(480);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const PAD_LEFT = 38; // Y-axis label space
  const PAD_RIGHT = 4;
  const PAD_TOP = 8;
  const PAD_BOTTOM = 24; // X-axis label space
  const innerW = width - PAD_LEFT - PAD_RIGHT;
  const innerH = chartHeight;

  const rawMax = data.reduce((m, pt) => {
    const sum = series.reduce((s, sr) => s + ((pt[sr.key] as number) || 0), 0);
    return Math.max(m, sum);
  }, 0);
  const yMax = niceMax(rawMax);
  const ticks = niceTicks(yMax);

  const n = data.length;
  const groupW = innerW / n;
  const BAR_GAP = 1.5;
  const GROUP_PAD = Math.max(groupW * 0.18, 2);
  const barSlotW = (groupW - GROUP_PAD * 2) / series.length;
  const barW = Math.max(2, barSlotW - BAR_GAP);
  const RAD = Math.min(3, barW / 2);

  const toY = (v: number) => PAD_TOP + innerH - (v / yMax) * innerH;

  // Show x-axis label every other point, limited to day number
  const labelInterval = n <= 14 ? 1 : 2;

  return (
    <div ref={containerRef} className="w-full">
      <svg width="100%" height={chartHeight + PAD_TOP + PAD_BOTTOM} aria-hidden>
        {/* Grid lines */}
        {ticks.map((t) => {
          const y = toY(t);
          return (
            <g key={t}>
              <line
                x1={PAD_LEFT}
                x2={PAD_LEFT + innerW}
                y1={y}
                y2={y}
                stroke="var(--yu3-line-subtle)"
                strokeWidth={t === 0 ? 1 : 0.5}
                strokeDasharray={t === 0 ? undefined : "0"}
              />
              <text
                x={PAD_LEFT - 5}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9}
                fill="var(--yu3-ink-muted)"
                fontFamily="var(--font-body, sans-serif)"
              >
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((pt, gi) => {
          const groupX = PAD_LEFT + gi * groupW + GROUP_PAD;
          return (
            <g key={gi}>
              {series.map((sr, si) => {
                const val = (pt[sr.key] as number) || 0;
                const x = groupX + si * barSlotW + BAR_GAP / 2;
                const barH = Math.max(0, (val / yMax) * innerH);
                const y = toY(val);
                if (barH < 0.5) return null;
                // Rounded top rectangle via path
                const r = Math.min(RAD, barH / 2);
                const x1 = x;
                const x2 = x + barW;
                const yTop = y;
                const yBot = PAD_TOP + innerH;
                const d = `M ${x1} ${yBot} L ${x1} ${yTop + r} Q ${x1} ${yTop} ${x1 + r} ${yTop} L ${x2 - r} ${yTop} Q ${x2} ${yTop} ${x2} ${yTop + r} L ${x2} ${yBot} Z`;
                return (
                  <path key={sr.key} d={d} fill={sr.color} fillOpacity={0.85} />
                );
              })}
              {/* X-axis label */}
              {gi % labelInterval === 0 && (
                <text
                  x={groupX + (groupW - GROUP_PAD * 2) / 2}
                  y={PAD_TOP + innerH + PAD_BOTTOM - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--yu3-ink-muted)"
                  fontFamily="var(--font-body, sans-serif)"
                >
                  {/* Show just the day portion of the label (e.g. "4/24" → "24") */}
                  {String(pt.label).includes("/")
                    ? String(pt.label).split("/")[1]
                    : pt.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
