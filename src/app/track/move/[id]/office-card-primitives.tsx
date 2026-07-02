/**
 * Shared card primitives for the office relocation track page. Every
 * section (reservation, balance, crew, prep, change requests) wraps in
 * the same cream OfficeCard so the whole page reads as one document,
 * not a stack of competing widgets.
 *
 * Import these from within OfficeReservationCard, TrackMoveClient, etc.
 * The tokens are frozen here so a future palette tweak lands in one
 * file, not spread across seven surfaces.
 */

import type { ReactNode } from "react";

export const OFFICE_TOKENS = {
  forest: "#2C3E2D",
  wine: "#66143D",
  cream: "#FFFDF8",
  creamLine: "rgba(44, 62, 45, 0.10)",
  creamSubtle: "rgba(44, 62, 45, 0.55)",
  creamFade: "rgba(44, 62, 45, 0.35)",
  successGreen: "#2D7A4F",
} as const;

/**
 * The base card. One border, one soft shadow, one radius. Every section
 * uses this — the difference is the content, not the shell.
 */
export function OfficeCard({
  children,
  className = "",
  as: Tag = "section",
  ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
  ariaLabelledBy?: string;
}) {
  return (
    <Tag
      className={`rounded-2xl px-5 py-5 sm:px-6 sm:py-6 ${className}`}
      style={{
        backgroundColor: OFFICE_TOKENS.cream,
        border: `1px solid ${OFFICE_TOKENS.creamLine}`,
        boxShadow:
          "0 1px 2px rgba(44, 62, 45, 0.04), 0 12px 32px rgba(44, 62, 45, 0.05)",
      }}
      aria-labelledby={ariaLabelledBy}
    >
      {children}
    </Tag>
  );
}

/**
 * Header row for a card: small uppercase eyebrow + serif title, optional
 * right slot for a status pill / meta.
 */
export function OfficeCardHeader({
  eyebrow,
  title,
  right,
  titleId,
}: {
  eyebrow: string;
  title: string;
  right?: ReactNode;
  titleId?: string;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: OFFICE_TOKENS.creamSubtle }}
        >
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className="font-hero text-[22px] sm:text-[24px] leading-tight mt-1"
          style={{ color: OFFICE_TOKENS.forest }}
        >
          {title}
        </h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function OfficeCardDivider() {
  return (
    <div
      className="my-5 h-px w-full"
      style={{ backgroundColor: OFFICE_TOKENS.creamLine }}
      aria-hidden
    />
  );
}

export function OfficeStatusPill({ status }: { status: string }) {
  const label =
    status === "in_progress"
      ? "In motion"
      : status === "completed"
        ? "Complete"
        : "Confirmed";
  const color =
    status === "completed" ? OFFICE_TOKENS.successGreen : OFFICE_TOKENS.wine;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
