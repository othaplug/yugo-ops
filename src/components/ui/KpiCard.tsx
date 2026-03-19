"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from "lucide-react";

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
        className={`text-[9px] font-bold tracking-[0.16em] uppercase mb-2 transition-colors flex items-center gap-1 ${
          href
            ? "text-[var(--tx3)]/60 group-hover:text-[var(--tx3)]"
            : "text-[var(--tx3)]/60"
        }`}
      >
        {label}
        {href && (
          <ArrowUpRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 -translate-y-px group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        )}
      </p>
      <p
        className={`text-[28px] font-bold font-heading leading-none transition-opacity ${
          href ? "group-hover:opacity-75" : ""
        } ${valueColor}`}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[9px] text-[var(--tx3)] mt-1.5">{sub}</p>
      )}
      {delta !== undefined && delta !== 0 && (
        <div
          className={`inline-flex items-center gap-1 mt-2 text-[10px] font-semibold ${
            delta >= 0 ? "text-[var(--grn)]" : "text-red-500"
          }`}
        >
          {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta >= 0 ? "+" : ""}
          {delta}% vs prev
        </div>
      )}
      {delta === 0 && (
        <div className="inline-flex items-center gap-1 mt-2 text-[10px] text-[var(--tx3)]">
          <Minus className="w-3 h-3" />
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
