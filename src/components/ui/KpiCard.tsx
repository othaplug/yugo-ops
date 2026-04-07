"use client";

import { toSentenceCase } from "@/lib/format-text";
import Link from "next/link";

export default function KpiCard({
  label,
  value,
  sub,
  delta,
  href,
  accent = false,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  href?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const valueColor = accent
    ? "text-[var(--grn)]"
    : warn
      ? "text-[var(--red)]"
      : "text-[var(--tx)]";

  const inner = (
    <div className={href ? "group cursor-pointer" : "group cursor-default"}>
      <p
        className={`text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/78 mb-1 sm:mb-2 transition-colors ${
          href
            ? "group-hover:text-[var(--tx3)]/90"
            : ""
        }`}
      >
        {label}
      </p>
      <p
        className={`text-[20px] sm:text-[28px] font-bold font-heading leading-none transition-opacity ${
          href ? "group-hover:opacity-75" : ""
        } ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] text-[var(--tx3)] mt-1.5">{toSentenceCase(sub)}</p>
      )}
      {delta !== undefined && delta !== 0 && (
        <div
          className={`inline-flex items-center gap-1 mt-2 text-[10px] font-semibold ${
            delta >= 0 ? "text-[var(--grn)]" : "text-red-500"
          }`}
        >
          <span aria-hidden>{delta >= 0 ? "\u2191" : "\u2193"}</span>
          {delta >= 0 ? "+" : ""}
          {delta}% vs prev
        </div>
      )}
      {delta === 0 && (
        <div className="inline-flex items-center gap-1 mt-2 text-[10px] text-[var(--tx3)]">
          <span aria-hidden>—</span>
          No change
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
