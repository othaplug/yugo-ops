import type { ReactNode } from "react";

/**
 * Shared admin page chrome: optional kicker, serif title, description, optional actions.
 * Uses semantic tokens so light/dark track ThemeContext.
 */
export default function AdminPageHeader({
  kicker,
  title,
  description,
  meta,
  actions,
  className = "",
}: {
  kicker?: string;
  title: ReactNode;
  description?: string;
  /** e.g. date line, weather — rendered below title */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`min-w-0 space-y-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {kicker ? (
            <p className="ty-label-upper mb-1.5 [letter-spacing:0.14em]">{kicker}</p>
          ) : null}
          <h1 className="admin-page-hero text-[var(--text-primary)]">{title}</h1>
          {meta ? <div className="mt-1 min-w-0">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? (
        <p className="ty-body max-w-xl text-[var(--text-secondary)] leading-relaxed">{description}</p>
      ) : null}
    </header>
  );
}
