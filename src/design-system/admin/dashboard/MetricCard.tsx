"use client";

import * as React from "react";
import { cn } from "../lib/cn";
import { TrendPill } from "../primitives/Badge";
import { Sparkline } from "../primitives/Sparkline";

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: string;
  value: string | number;
  valueHint?: React.ReactNode;
  trendPct?: number | null;
  series?: number[];
  rightSlot?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      eyebrow,
      title,
      value,
      valueHint,
      trendPct,
      series,
      rightSlot,
      footer,
      size = "md",
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const valueSize =
      size === "lg"
        ? "text-[36px]"
        : size === "sm"
          ? "text-[22px]"
          : "text-[28px]";
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-lg)] p-5 md:p-6 flex flex-col gap-3",
          className,
        )}
        {...rest}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            {eyebrow ? (
              <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                {eyebrow}
              </div>
            ) : null}
            {title ? (
              <h3 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-1 leading-tight">
                {title}
              </h3>
            ) : null}
          </div>
          {rightSlot}
        </header>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "yu3-num font-semibold text-[var(--yu3-ink-strong)] leading-none [font-feature-settings:'tnum'_1]",
                valueSize,
              )}
            >
              {value}
            </span>
            {typeof trendPct === "number" ? (
              <TrendPill delta={trendPct} />
            ) : null}
          </div>
          {series && series.length > 1 ? (
            <Sparkline values={series} width={120} height={36} />
          ) : null}
        </div>
        {valueHint ? (
          <div className="text-[12px] text-[var(--yu3-ink-muted)]">
            {valueHint}
          </div>
        ) : null}
        {children}
        {footer ? (
          <div className="border-t border-[var(--yu3-line-subtle)] pt-3 -mx-5 px-5 mt-1">
            {footer}
          </div>
        ) : null}
      </div>
    );
  },
);
MetricCard.displayName = "MetricCard";
