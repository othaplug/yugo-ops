"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "../primitives/Popover";
import { SearchInput } from "../primitives/Input";
import {
  ArrowUp,
  ArrowDown,
  EyeSlash,
  Sparkle,
  Funnel,
  DotsThreeVertical,
  MagnifyingGlass,
} from "../icons";
import { cn } from "../lib/cn";
import type { ColumnDef, SortDir } from "./types";

export interface ColumnMenuProps<Row> {
  column: ColumnDef<Row>;
  sortDir?: SortDir | null;
  onSort: (dir: SortDir) => void;
  onHide: () => void;
  onFilter?: () => void;
  onSearch?: () => void;
  onAnalyze?: () => void;
  trigger?: React.ReactNode;
}

export function ColumnMenu<Row>({
  column,
  sortDir,
  onSort,
  onHide,
  onFilter,
  onSearch,
  onAnalyze,
  trigger,
}: ColumnMenuProps<Row>) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center justify-center h-5 w-5 rounded-[var(--yu3-r-xs)] text-[var(--yu3-ink-faint)] opacity-0 group-hover/col:opacity-100 hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
            aria-label={`${column.shortLabel || "Column"} menu`}
          >
            <DotsThreeVertical size={12} weight="bold" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={4} className="w-[220px] p-1">
        {onSearch ? (
          <MenuItem
            icon={<MagnifyingGlass size={13} />}
            label={`Search ${column.shortLabel || column.id}`}
            onClick={() => {
              onSearch();
              setOpen(false);
            }}
          />
        ) : null}
        {onAnalyze ? (
          <MenuItem
            icon={<Sparkle size={13} className="text-[var(--yu3-wine)]" />}
            label="AI analyze"
            onClick={() => {
              onAnalyze();
              setOpen(false);
            }}
          />
        ) : null}
        {column.sortable !== false ? (
          <>
            <MenuItem
              icon={<ArrowUp size={13} />}
              label="Sort ascending"
              active={sortDir === "asc"}
              onClick={() => {
                onSort("asc");
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<ArrowDown size={13} />}
              label="Sort descending"
              active={sortDir === "desc"}
              onClick={() => {
                onSort("desc");
                setOpen(false);
              }}
            />
          </>
        ) : null}
        {onFilter ? (
          <MenuItem
            icon={<Funnel size={13} />}
            label="Filter…"
            onClick={() => {
              onFilter();
              setOpen(false);
            }}
          />
        ) : null}
        <Divider />
        <MenuItem
          icon={<EyeSlash size={13} />}
          label="Hide column"
          onClick={() => {
            onHide();
            setOpen(false);
          }}
          disabled={!!column.required}
        />
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full h-8 px-2 rounded-[var(--yu3-r-sm)] text-[12px] text-[var(--yu3-ink)]",
        "hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink-strong)]",
        active && "text-[var(--yu3-wine)]",
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      <span className="inline-flex items-center justify-center h-4 w-4 text-[var(--yu3-ink-muted)]">
        {icon}
      </span>
      <span className="flex-1 text-left truncate">{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--yu3-line-subtle)] -mx-1" />;
}

/**
 * HiddenColumnsMenu — list of currently hidden columns + an "Add column" shortcut.
 */
export function HiddenColumnsMenu<Row>({
  columns,
  hiddenIds,
  onShow,
}: {
  columns: ColumnDef<Row>[];
  hiddenIds: Set<string>;
  onShow: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const hidden = columns
    .filter((c) => hiddenIds.has(c.id))
    .filter((c) =>
      query
        ? String(c.shortLabel || c.id)
            .toLowerCase()
            .includes(query.toLowerCase())
        : true,
    );
  if (columns.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2 rounded-[var(--yu3-r-sm)] text-[12px] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)]"
        >
          <EyeSlash size={13} />
          <span>
            Hidden
            {hidden.length > 0 ? (
              <span className="ml-1 yu3-num text-[11px] text-[var(--yu3-wine)] font-semibold">
                ({hidden.length})
              </span>
            ) : null}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-2">
        <div className="mb-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find column…"
            onClear={() => setQuery("")}
          />
        </div>
        {hidden.length === 0 ? (
          <div className="text-[12px] text-[var(--yu3-ink-muted)] py-3 text-center">
            No hidden columns
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 max-h-[280px] overflow-auto">
            {hidden.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onShow(c.id)}
                className="flex items-center gap-2 w-full h-8 px-2 rounded-[var(--yu3-r-sm)] text-[12px] text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink-strong)]"
              >
                <span className="flex-1 text-left truncate">
                  {c.shortLabel || c.id}
                </span>
                <span className="text-[11px] text-[var(--yu3-wine)] font-semibold">
                  Show
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
