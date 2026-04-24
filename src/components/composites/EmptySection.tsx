"use client";

import type { ReactNode } from "react";

type EmptySectionAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type EmptySectionProps = {
  title: string;
  description?: ReactNode;
  action?: EmptySectionAction;
  className?: string;
};

/**
 * One-line collapsed stand-in for an entire empty section. Use this when a
 * whole block would otherwise render with only placeholder values
 * (e.g. "Client sign-off" on a move where nothing was collected yet).
 *
 * Layout: title (t-heading) + description (t-body secondary) on the left,
 * optional action button right-aligned.
 */
export default function EmptySection({
  title,
  description,
  action,
  className,
}: EmptySectionProps) {
  const classes = [
    "flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-[var(--space-5)] py-[var(--space-4)]",
    "sm:flex-row sm:items-center sm:justify-between sm:gap-4",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="min-w-0 space-y-0.5">
        <p className="t-heading text-[var(--color-text-primary)] truncate">
          {title}
        </p>
        {description && (
          <p className="t-body text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>

      {action &&
        ("href" in action && action.href ? (
          <a
            href={action.href}
            className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-wine-subtle)]"
          >
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-wine-subtle)]"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
