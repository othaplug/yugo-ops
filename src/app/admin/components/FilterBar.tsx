"use client";

import { CaretDown as ChevronDown } from "@phosphor-icons/react";
import { Select } from "@/design-system/admin/primitives";

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
    <div
      className={`flex flex-wrap items-center gap-2 border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)]/50 px-4 py-2.5 ${className}`}
    >
      {filters.map((f) => (
        <div key={f.key} className="flex items-center gap-1.5">
          <label className="shrink-0 yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
            {f.label}
          </label>
          <Select
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="h-8 min-w-[7.5rem] max-w-full flex-1 pr-7 text-[13px] sm:min-w-[8.5rem]"
            aria-label={f.label}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      {hasActiveFilters && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="sidebar-nav-lift rounded-[var(--yu3-r-sm)] px-2 py-1 text-[10px] font-semibold text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-wine)]"
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
      className={`cursor-pointer select-none border-b border-[var(--yu3-line)] px-3 py-2.5 text-left yu3-t-eyebrow text-[var(--yu3-ink-muted)] transition-colors hover:text-[var(--yu3-wine)] ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <ChevronDown
            className={`h-3 w-3 ${currentDir === "desc" ? "rotate-180" : ""}`}
          />
        )}
      </span>
    </th>
  );
}
