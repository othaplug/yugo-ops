import type { ReactNode } from "react";

type EmptyFieldFallback = "hide" | "dash" | "text";

type EmptyFieldProps = {
  label: string;
  value: unknown;
  fallback?: EmptyFieldFallback;
  fallbackText?: string;
  className?: string;
};

const isPresent = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === "string" && v.trim() === "") return false;
  return true;
};

const labelClasses =
  "block mb-1 t-label text-[var(--color-text-secondary)]";

const valueClasses = "t-body text-[var(--color-text-primary)]";

const fallbackValueClasses =
  "t-body text-[var(--color-text-tertiary)]";

/**
 * Renders a labeled value. When the value is empty, behavior depends on
 * `fallback`:
 *   - "hide"  → renders nothing (default)
 *   - "dash"  → renders "—" in tertiary color (only when structure MUST be
 *              preserved, e.g. comparison tables)
 *   - "text"  → renders `fallbackText` in tertiary color
 *
 * Designed for detail pages where 40% of fields are missing per record.
 */
export default function EmptyField({
  label,
  value,
  fallback = "hide",
  fallbackText,
  className,
}: EmptyFieldProps) {
  const present = isPresent(value);

  if (!present && fallback === "hide") return null;

  const wrapperClass = ["space-y-0.5", className].filter(Boolean).join(" ");

  if (present) {
    return (
      <div className={wrapperClass}>
        <span className={labelClasses}>{label}</span>
        <span className={valueClasses}>
          {value as ReactNode}
        </span>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <span className={labelClasses}>{label}</span>
      <span className={fallbackValueClasses}>
        {fallback === "dash" ? "—" : fallbackText}
      </span>
    </div>
  );
}
