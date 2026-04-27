"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  variant?: "default" | "hero";
  className?: string;
  /** When false, title wraps (e.g. long org names on profile pages). Default: single-line truncate. */
  titleClamp?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  tabs,
  variant = "default",
  className,
  titleClamp = true,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-4",
        variant === "hero" && "pb-6",
        className,
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="yu3-t-eyebrow mb-2">{eyebrow}</div> : null}
          <h1
            className={cn(
              variant === "hero" ? "yu3-t-display" : "yu3-t-page",
              titleClamp ? "truncate" : "break-words whitespace-normal max-w-full",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className="yu3-t-body text-[var(--yu3-ink-muted)] mt-1 max-w-[720px]">
              {description}
            </p>
          ) : null}
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--yu3-ink-muted)]">
              {meta}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 flex-wrap">{actions}</div>
        ) : null}
      </div>
      {tabs ? <div className="mt-1">{tabs}</div> : null}
    </div>
  );
}

export function PageMetaDivider() {
  return (
    <span className="inline-block h-3 w-px bg-[var(--yu3-line)]" aria-hidden />
  );
}
