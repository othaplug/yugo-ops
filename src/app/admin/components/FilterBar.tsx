"use client";

import { ChevronDown } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: {
    key: string;
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
  }[];
  onClear?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

export default function FilterBar({ filters, onClear, hasActiveFilters, className = "" }: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 py-3 px-4 bg-[var(--bg)]/50 border-b border-[var(--brd)] ${className}`}>
      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-1.5">
          <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] shrink-0">
            {f.label}
          </label>
          <select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[100px]"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className={`text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)] cursor-pointer hover:text-[var(--gold)] transition-colors select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <ChevronDown className={`w-3 h-3 ${currentDir === "desc" ? "rotate-180" : ""}`} />
        )}
      </span>
    </th>
  );
}
