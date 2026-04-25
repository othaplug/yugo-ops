"use client";

import { toSentenceCase } from "@/lib/format-text";
import Link from "next/link";

export default function KpiCard({
  label,
  value,
  sub,
  subVariant = "default",
  delta,
  href,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  /** `tightCaps`: Brown, bold, uppercase, tight tracking (no sentence-casing). */
  subVariant?: "default" | "tightCaps";
  delta?: number;
  href?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const valueColor = accent
    ? "text-[var(--grn)]"
    : warn
      ? "text-[var(--red)]"
      : "text-[var(--yu3-ink-strong)]";

  const inner = (
    <div
      className={
        "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-lg)] p-5 md:p-6 flex flex-col gap-2 transition-colors " +
        (href
          ? "group cursor-pointer hover:border-[var(--yu3-line-strong)]"
          : "group cursor-default")
      }
    >
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[var(--yu3-ink-muted)]">
        {label}
      </p>
      <p
        className={`text-[28px] font-semibold leading-none [font-feature-settings:'tnum'_1] transition-opacity ${
          href ? "group-hover:opacity-80" : ""
        } ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={
            subVariant === "tightCaps"
              ? "text-[11px] font-semibold uppercase tracking-[0.08em] leading-snug text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]"
              : "text-[12px] text-[var(--yu3-ink-muted)]"
          }
        >
          {subVariant === "tightCaps" ? sub : toSentenceCase(sub)}
        </p>
      )}
      {delta !== undefined && delta !== 0 && (
        <div
          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
            delta >= 0 ? "text-[var(--grn)]" : "text-[var(--red)]"
          }`}
        >
          <span aria-hidden>{delta >= 0 ? "\u2191" : "\u2193"}</span>
          {delta >= 0 ? "+" : ""}
          {delta}% vs prev
        </div>
      )}
    </div>
  );

  if (href)
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  return inner;
}
