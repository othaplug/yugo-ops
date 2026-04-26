"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { Sparkline } from "../primitives/Sparkline";
import { TrendPill } from "../primitives/Badge";

export type KpiTile = {
  id: string;
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  trendPct?: number | null;
  spark?: number[] | null;
  onClick?: () => void;
  /** e.g. filterable dispatch stats: wine border and fill */
  selected?: boolean;
  /** Optional Tailwind class for the value (e.g. status color when not selected) */
  valueClassName?: string;
};

export interface KpiStripProps extends React.HTMLAttributes<HTMLDivElement> {
  tiles: KpiTile[];
  columns?: 2 | 3 | 4 | 5;
  /**
   * `pills` (default) — compact inline label + value; extra detail, trend, spark on hover.
   * `grid` — large metric cards (legacy / dense dashboards).
   */
  variant?: "grid" | "pills";
  /** Merged into each grid card wrapper (`variant="grid"` only). e.g. `border-0` for borderless tiles. */
  gridCardClassName?: string;
}

function formatLabelForPill(label: string) {
  const t = label.trimEnd();
  if (t.endsWith(":")) return t;
  return `${t}:`;
}

function KpiPill({ tile }: { tile: KpiTile }) {
  const interactive = !!tile.onClick;
  const Wrapper: React.ElementType = interactive ? "button" : "div";
  const hasTrend = typeof tile.trendPct === "number";
  const hasSpark = tile.spark != null && tile.spark.length > 1;
  const hasMetaBelow = tile.hint != null || hasTrend || hasSpark;
  const selected = Boolean(tile.selected);

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={tile.onClick}
      aria-pressed={
        interactive && typeof tile.selected === "boolean" ? selected : undefined
      }
      className={cn(
        "group relative inline-flex min-w-0 max-w-full flex-col items-stretch",
        "rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)]",
        "bg-[var(--yu3-bg-surface)]",
        "shadow-sm",
        "pl-2.5 pr-2.5 py-1.5",
        "hover:pl-3.5 hover:pr-3.5 hover:py-2",
        "hover:border-[var(--yu3-line)]",
        "hover:shadow-md",
        "active:scale-[0.99]",
        "text-left",
        "transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        selected &&
          "border-[var(--yu3-wine)] bg-[var(--yu3-wine-wash)] hover:border-[var(--yu3-wine)]",
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-nowrap items-baseline justify-center gap-1.5 sm:gap-2">
        <span
          className={cn(
            "shrink-0 text-[12px] font-medium leading-tight normal-case sm:text-[13px]",
            selected ? "text-[var(--yu3-wine)]" : "text-[var(--yu3-ink-muted)]",
          )}
        >
          {formatLabelForPill(tile.label)}
        </span>
        <span
          className={cn(
            "yu3-num min-w-0 text-[12px] font-semibold leading-tight [font-feature-settings:'tnum'_1] sm:text-[13px]",
            selected
              ? "text-[var(--yu3-wine)]"
              : tile.valueClassName
                ? tile.valueClassName
                : "text-[var(--yu3-ink-strong)]",
          )}
        >
          {tile.value}
        </span>
      </div>
      {hasMetaBelow ? (
        <div
          className={cn(
            "max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            "group-hover:max-h-52 group-hover:opacity-100 group-hover:pt-1.5",
          )}
        >
          <div className="space-y-2 border-t border-[var(--yu3-line-subtle)] pt-1.5">
            {tile.hint != null ? (
              <div className="min-w-0 text-[10px] font-medium leading-snug text-[var(--yu3-ink-faint)]">
                {tile.hint}
              </div>
            ) : null}
            {hasTrend || hasSpark ? (
              <div className="flex min-w-0 items-end justify-between gap-2">
                {hasTrend ? (
                  <div className="shrink-0">
                    <TrendPill delta={tile.trendPct!} />
                  </div>
                ) : (
                  <span className="shrink-0" />
                )}
                {hasSpark ? (
                  <Sparkline
                    values={tile.spark!}
                    width={88}
                    height={24}
                    className="shrink-0"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Wrapper>
  );
}

export const KpiStrip = React.forwardRef<HTMLDivElement, KpiStripProps>(
  ({ tiles, columns = 4, variant = "pills", className, gridCardClassName, ...rest }, ref) => {
    if (variant === "pills") {
      return (
        <div
          ref={ref}
          className={cn(
            "flex flex-wrap items-start gap-2",
            "sm:flex-nowrap sm:overflow-x-auto sm:pb-0.5",
            className,
          )}
          role="list"
          {...rest}
        >
          {tiles.map((tile) => (
            <div key={tile.id} className="shrink-0" role="listitem">
              <KpiPill tile={tile} />
            </div>
          ))}
        </div>
      );
    }

    const gridCls =
      columns === 5
        ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        : columns === 4
          ? "grid-cols-2 md:grid-cols-2 xl:grid-cols-4"
          : columns === 3
            ? "grid-cols-1 md:grid-cols-3"
            : "grid-cols-1 md:grid-cols-2";

    return (
      <div ref={ref} className={cn("grid gap-3", gridCls, className)} {...rest}>
        {tiles.map((tile) => (
          <KpiTileCard key={tile.id} tile={tile} className={gridCardClassName} />
        ))}
      </div>
    );
  },
);
KpiStrip.displayName = "KpiStrip";

function KpiTileCard({ tile, className }: { tile: KpiTile; className?: string }) {
  const interactive = !!tile.onClick;
  const Wrapper: React.ElementType = interactive ? "button" : "div";
  return (
    <Wrapper
      onClick={tile.onClick}
      className={cn(
        "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-lg)] p-5 md:p-6 flex flex-col gap-2 text-left",
        "transition-colors",
        interactive &&
          "hover:border-[var(--yu3-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
        className,
      )}
    >
      <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
        {tile.label}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div
          className={cn(
            "yu3-num text-[28px] font-semibold leading-none [font-feature-settings:'tnum'_1]",
            tile.valueClassName ?? "text-[var(--yu3-ink-strong)]",
          )}
        >
          {tile.value}
        </div>
        {typeof tile.trendPct === "number" ? (
          <TrendPill delta={tile.trendPct} />
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-[12px] text-[var(--yu3-ink-muted)] leading-tight">
          {tile.hint}
        </div>
        {tile.spark && tile.spark.length > 1 ? (
          <Sparkline values={tile.spark} width={96} height={28} />
        ) : null}
      </div>
    </Wrapper>
  );
}
