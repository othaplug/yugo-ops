"use client";

import type { ReactNode } from "react";

type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  illustration?: ReactNode;
  className?: string;
};

/**
 * Centered empty-state container for an entire empty page or panel.
 * Use for "No quotes yet", "No claims filed", etc. Prefer EmptySection
 * for an empty block inside a larger page.
 */
export default function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  illustration,
  className,
}: EmptyStateProps) {
  const classes = [
    "mx-auto flex max-w-[320px] flex-col items-center justify-center gap-[var(--space-3)] py-[var(--space-10)] text-center",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const renderAction = (a: EmptyStateAction, primary: boolean) => {
    const base =
      "inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[13px] font-semibold transition-colors";
    const style = primary
      ? "bg-[var(--color-wine)] text-white hover:bg-[var(--color-wine-hover)]"
      : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]";
    const cls = `${base} ${style}`;

    if ("href" in a && a.href) {
      return (
        <a key={a.label} href={a.href} className={cls}>
          {a.label}
        </a>
      );
    }
    return (
      <button key={a.label} type="button" onClick={a.onClick} className={cls}>
        {a.label}
      </button>
    );
  };

  return (
    <div className={classes}>
      {illustration && <div className="mb-[var(--space-2)]">{illustration}</div>}
      <h3 className="t-heading text-[var(--color-text-primary)]">{title}</h3>
      {description && (
        <p className="t-body text-[var(--color-text-secondary)]">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-[var(--space-2)] flex flex-wrap items-center justify-center gap-[var(--space-2)]">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
}
