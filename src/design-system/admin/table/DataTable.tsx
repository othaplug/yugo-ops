"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../lib/cn";
import { Checkbox } from "../primitives/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../primitives/DropdownMenu";
import { SearchInput } from "../primitives/Input";
import { Button } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";
import { Skeleton } from "../primitives/Skeleton";
import { ColumnMenu, HiddenColumnsMenu } from "./ColumnMenu";
import { ViewSwitcher } from "./ViewSwitcher";
import { BulkBar } from "./BulkBar";
import { SavedViews } from "./SavedViews";
import { MobileRowCard } from "./MobileRowCard";
import {
  ArrowDown,
  ArrowUp,
  Funnel,
  DotsThreeVertical,
  Plus,
  DownloadSimple,
} from "../icons";
import type {
  BulkAction,
  ColumnDef,
  ColumnSort,
  RowAction,
  SavedView,
  SortDir,
  StageTone,
  ViewMode,
} from "./types";

export interface DataTableProps<Row> {
  columns: ColumnDef<Row>[];
  rows: Row[];
  rowId: (row: Row) => string;
  loading?: boolean;
  /** Global search value. Parent owns this so it can live in URL. */
  search?: string;
  onSearchChange?: (value: string) => void;
  sort?: ColumnSort | null;
  onSortChange?: (sort: ColumnSort | null) => void;
  /** Controlled column visibility. If omitted, the table owns it. */
  hiddenColumnIds?: string[];
  onHiddenColumnIdsChange?: (ids: string[]) => void;
  /** Controlled selection. Keyed by rowId(row). */
  selectedRowIds?: Set<string>;
  onSelectedRowIdsChange?: (ids: Set<string>) => void;
  bulkActions?: BulkAction<Row>[];
  rowActions?: RowAction<Row>[];
  onRowClick?: (row: Row) => void;
  emptyState?: React.ReactNode;
  /** Fixed row height — required for virtualization. */
  rowHeight?: number;
  /** Page header hooks (rendered above the table chrome). */
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  /** Render board cards (grouped by `board.groupBy`). */
  board?: {
    groupBy: (row: Row) => string;
    renderCard: (row: Row) => React.ReactNode;
    columns?: { id: string; label: string; tone?: StageTone }[];
  };
  /** Pipeline view (grouped columns of rows, used for stages). */
  pipeline?: {
    stages: { id: string; label: string; tone?: StageTone }[];
    stageForRow: (row: Row) => string;
    renderCard: (row: Row) => React.ReactNode;
  };
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  availableViews?: ViewMode[];
  savedViews?: SavedView[];
  activeSavedViewId?: string | null;
  onSelectSavedView?: (id: string) => void;
  onSaveView?: (name: string) => void;
  onDeleteSavedView?: (id: string) => void;
  onExport?: () => void;
  onNewRecord?: () => void;
  /** Text shown in search input */
  searchPlaceholder?: string;
  /** Toggle page-level chrome (header row w/ search, view switcher, saved views, export). */
  hideChrome?: boolean;
}

export function DataTable<Row>({
  columns,
  rows,
  rowId,
  loading = false,
  search = "",
  onSearchChange,
  sort,
  onSortChange,
  hiddenColumnIds,
  onHiddenColumnIdsChange,
  selectedRowIds,
  onSelectedRowIdsChange,
  bulkActions = [],
  rowActions = [],
  onRowClick,
  emptyState,
  rowHeight = 56,
  toolbarLeft,
  toolbarRight,
  board,
  pipeline,
  viewMode = "list",
  onViewModeChange,
  availableViews,
  savedViews = [],
  activeSavedViewId,
  onSelectSavedView,
  onSaveView,
  onDeleteSavedView,
  onExport,
  onNewRecord,
  searchPlaceholder = "Search records…",
  hideChrome = false,
}: DataTableProps<Row>) {
  /* ── State (uncontrolled fallbacks) ────────────────────────────────── */
  const [internalHidden, setInternalHidden] = React.useState<string[]>(() =>
    columns.filter((c) => c.hiddenByDefault).map((c) => c.id),
  );
  const hidden = new Set(hiddenColumnIds ?? internalHidden);

  const [internalSelection, setInternalSelection] = React.useState<Set<string>>(
    new Set(),
  );
  const selection = selectedRowIds ?? internalSelection;

  const setSelection = React.useCallback(
    (next: Set<string>) => {
      onSelectedRowIdsChange?.(next);
      if (!selectedRowIds) setInternalSelection(next);
    },
    [onSelectedRowIdsChange, selectedRowIds],
  );
  const setHidden = React.useCallback(
    (ids: string[]) => {
      onHiddenColumnIdsChange?.(ids);
      if (!hiddenColumnIds) setInternalHidden(ids);
    },
    [hiddenColumnIds, onHiddenColumnIdsChange],
  );

  const visibleColumns = columns.filter((c) => !hidden.has(c.id));

  /* ── Filtered / sorted rows (client) ───────────────────────────────── */
  const filteredRows = React.useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((row) =>
        visibleColumns.some((col) => {
          if (col.accessor) {
            const v = col.accessor(row);
            if (v == null) return false;
            return String(v).toLowerCase().includes(q);
          }
          return false;
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.columnId);
      if (col?.accessor) {
        const dir = sort.direction === "asc" ? 1 : -1;
        out = [...out].sort((a, b) => {
          const av = col.accessor!(a);
          const bv = col.accessor!(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number")
            return (av - bv) * dir;
          return String(av).localeCompare(String(bv)) * dir;
        });
      }
    }
    return out;
  }, [rows, visibleColumns, columns, search, sort]);

  /* ── Selection helpers ─────────────────────────────────────────────── */
  const allSelected =
    filteredRows.length > 0 &&
    filteredRows.every((r) => selection.has(rowId(r)));
  const someSelected =
    !allSelected && filteredRows.some((r) => selection.has(rowId(r)));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selection);
      filteredRows.forEach((r) => next.delete(rowId(r)));
      setSelection(next);
    } else {
      const next = new Set(selection);
      filteredRows.forEach((r) => next.add(rowId(r)));
      setSelection(next);
    }
  };
  const toggleRow = (row: Row) => {
    const id = rowId(row);
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };

  /* ── Virtualizer (desktop list) ────────────────────────────────────── */
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    estimateSize: () => rowHeight,
    getScrollElement: () => parentRef.current,
    overscan: 8,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  /* ── Sort click handler ────────────────────────────────────────────── */
  const handleSortClick = (col: ColumnDef<Row>) => {
    if (col.sortable === false) return;
    const current = sort?.columnId === col.id ? sort.direction : null;
    const next: ColumnSort | null =
      current === "asc"
        ? { columnId: col.id, direction: "desc" }
        : current === "desc"
          ? null
          : { columnId: col.id, direction: "asc" };
    onSortChange?.(next);
  };

  const selectedRows = filteredRows.filter((r) => selection.has(rowId(r)));

  /* ── Chrome (top row: search / view switcher / saved views / export / new) ─ */
  const chromeTop = !hideChrome ? (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-[180px]">
        {savedViews.length > 0 || onSaveView ? (
          <SavedViews
            views={savedViews}
            activeId={activeSavedViewId}
            onSelect={(id) => onSelectSavedView?.(id)}
            onSave={(name) => onSaveView?.(name)}
            onDelete={onDeleteSavedView}
          />
        ) : null}
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          onClear={() => onSearchChange?.("")}
          placeholder={searchPlaceholder}
          className="max-w-[320px]"
        />
        <HiddenColumnsMenu
          columns={columns}
          hiddenIds={hidden}
          onShow={(id) => setHidden(Array.from(hidden).filter((h) => h !== id))}
        />
        {toolbarLeft}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {toolbarRight}
        {onViewModeChange ? (
          <ViewSwitcher
            value={viewMode}
            onChange={onViewModeChange}
            available={availableViews}
          />
        ) : null}
        {onExport ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<DownloadSimple size={13} />}
            onClick={onExport}
          >
            Export
          </Button>
        ) : null}
        {onNewRecord ? (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus size={13} />}
            onClick={onNewRecord}
          >
            New
          </Button>
        ) : null}
      </div>
    </div>
  ) : null;

  /* ── Board view ─────────────────────────────────────────────────────── */
  if (viewMode === "board" && board) {
    const columnsDef: { id: string; label: string; tone?: StageTone }[] =
      board.columns ??
      Array.from(new Set(filteredRows.map((r) => board.groupBy(r)))).map(
        (id) => ({ id, label: id }),
      );
    return (
      <div className="flex flex-col">
        {chromeTop}
        <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-x-auto pb-2">
          {columnsDef.map((col) => {
            const colRows = filteredRows.filter(
              (r) => board.groupBy(r) === col.id,
            );
            return (
              <div
                key={col.id}
                className="bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] flex flex-col min-h-[200px]"
              >
                <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                  <div className="yu3-t-eyebrow flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          toneColor(col.tone) || "var(--yu3-ink-faint)",
                      }}
                    />
                    {col.label}
                  </div>
                  <span className="yu3-num text-[11px] text-[var(--yu3-ink-muted)] bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[4px] px-1.5 h-5 inline-flex items-center">
                    {colRows.length}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-2 px-2 pb-2 overflow-y-auto">
                  {colRows.map((row) => (
                    <div
                      key={rowId(row)}
                      onClick={() => onRowClick?.(row)}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                    >
                      {board.renderCard(row)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <BulkBar
          selectedCount={selection.size}
          totalCount={filteredRows.length}
          actions={bulkActions}
          rows={selectedRows}
          onClear={() => setSelection(new Set())}
        />
      </div>
    );
  }

  /* ── Pipeline view ─────────────────────────────────────────────────── */
  if (viewMode === "pipeline" && pipeline) {
    return (
      <div className="flex flex-col">
        {chromeTop}
        <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-2">
          {pipeline.stages.map((stage) => {
            const stageRows = filteredRows.filter(
              (r) => pipeline.stageForRow(r) === stage.id,
            );
            return (
              <div
                key={stage.id}
                className="bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] flex flex-col min-h-[200px]"
              >
                <div className="px-3 pt-3 pb-2 flex items-center justify-between sticky top-0 bg-[var(--yu3-bg-surface-sunken)] z-10">
                  <div className="flex flex-col">
                    <span className="yu3-t-eyebrow flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background:
                            toneColor(stage.tone) || "var(--yu3-ink-faint)",
                        }}
                      />
                      {stage.label}
                    </span>
                    <span className="yu3-num text-[11px] text-[var(--yu3-ink-muted)]">
                      {stageRows.length} record
                      {stageRows.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-2 px-2 pb-2 overflow-y-auto">
                  {stageRows.map((row) => (
                    <div
                      key={rowId(row)}
                      onClick={() => onRowClick?.(row)}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer"
                    >
                      {pipeline.renderCard(row)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <BulkBar
          selectedCount={selection.size}
          totalCount={filteredRows.length}
          actions={bulkActions}
          rows={selectedRows}
          onClear={() => setSelection(new Set())}
        />
      </div>
    );
  }

  /* ── List view (desktop table + mobile card list) ─────────────────── */
  const mobileList = (
    <div className="lg:hidden flex flex-col gap-2">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-3"
            >
              <Skeleton className="h-3 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))
        : filteredRows.map((row) => {
            const id = rowId(row);
            const selected = selection.has(id);
            return (
              <MobileRowCard
                key={id}
                title={cellAt<Row>(visibleColumns, row, 0) ?? id}
                subtitle={cellAt<Row>(visibleColumns, row, 1)}
                status={cellAt<Row>(visibleColumns, row, 2)}
                metrics={visibleColumns
                  .slice(3, 7)
                  .filter(Boolean)
                  .map((col) => ({
                    label: String(col.shortLabel || col.id),
                    value: col.cell(row),
                  }))}
                selected={selected}
                onClick={() => onRowClick?.(row)}
              />
            );
          })}
    </div>
  );

  const desktopTable = (
    <div
      ref={parentRef}
      className="hidden lg:block overflow-auto relative rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)]"
      style={{ maxHeight: "calc(100dvh - 240px)" }}
    >
      {/*
        min-w-full w-max: body virtualizer uses width:100% which otherwise resolves
        to the scrollport only; header grid can be wider. This aligns header + body
        widths so row borders and column backgrounds are continuous.
      */}
      <div className="min-w-full w-max">
        {/* Header */}
        <div className="sticky top-0 z-20 w-full border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)]">
        <div
          className="grid items-center h-11"
          style={{
            gridTemplateColumns: buildGridTemplate(visibleColumns, {
              hasSelection: bulkActions.length > 0,
              hasRowActions: rowActions.length > 0,
            }),
          }}
        >
          {bulkActions.length > 0 ? (
            <div className="flex items-center justify-center pl-3 pr-2">
              <Checkbox
                indeterminate={someSelected}
                checked={allSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </div>
          ) : null}
          {visibleColumns.map((col) => {
            const sortDir = sort?.columnId === col.id ? sort.direction : null;
            const sortable = col.sortable !== false;
            const align = col.align ?? "left";
            const headerShell = (
              <div className="inline-flex min-w-0 items-center gap-0.5 shrink-0">
                {col.filterable ? (
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-5 w-5 rounded-[var(--yu3-r-xs)] text-[var(--yu3-ink-faint)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
                    aria-label="Filter"
                  >
                    <Funnel size={10} weight="bold" />
                  </button>
                ) : null}
                <ColumnMenu
                  column={col}
                  sortDir={sortDir}
                  onSort={(dir) =>
                    onSortChange?.({ columnId: col.id, direction: dir })
                  }
                  onHide={() => setHidden([...Array.from(hidden), col.id])}
                  onSearch={
                    onSearchChange
                      ? () => {
                          /* focus global search; could focus a per-column input */
                        }
                      : undefined
                  }
                  onAnalyze={
                    col.numeric
                      ? () => {
                          /* placeholder; wired up by parent in later phase */
                        }
                      : undefined
                  }
                />
              </div>
            );
            return (
              <div
                key={col.id}
                className={cn(
                  "group/col flex h-11 min-w-0 px-3",
                  "relative z-[11] bg-[var(--yu3-bg-surface-sunken)]",
                  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--yu3-ink-muted)]",
                  align === "right" && "justify-end",
                  align === "center" && "justify-center",
                  align === "left" && "justify-start",
                )}
              >
                {align === "right" ? (
                  <div className="inline-flex min-w-0 max-w-full items-center gap-1">
                    <button
                      type="button"
                      disabled={!sortable}
                      onClick={() => handleSortClick(col)}
                      className={cn(
                        "inline-flex min-w-0 max-w-full items-center gap-1 select-none",
                        sortable && "hover:text-[var(--yu3-ink-strong)]",
                      )}
                    >
                      <span className="truncate">{col.header}</span>
                      {sortDir === "asc" ? (
                        <ArrowUp size={10} weight="bold" className="shrink-0" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown
                          size={10}
                          weight="bold"
                          className="shrink-0"
                        />
                      ) : null}
                    </button>
                    <div className="opacity-0 group-hover/col:opacity-100 transition-opacity">
                      {headerShell}
                    </div>
                  </div>
                ) : align === "center" ? (
                  <div className="inline-flex min-w-0 max-w-full items-center justify-center gap-1">
                    <button
                      type="button"
                      disabled={!sortable}
                      onClick={() => handleSortClick(col)}
                      className={cn(
                        "inline-flex min-w-0 items-center justify-center gap-1 select-none",
                        sortable && "hover:text-[var(--yu3-ink-strong)]",
                      )}
                    >
                      <span className="truncate">{col.header}</span>
                      {sortDir === "asc" ? (
                        <ArrowUp size={10} weight="bold" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown size={10} weight="bold" />
                      ) : null}
                    </button>
                    <div className="opacity-0 group-hover/col:opacity-100 transition-opacity">
                      {headerShell}
                    </div>
                  </div>
                ) : (
                  <div className="flex w-full min-w-0 items-center justify-between gap-1">
                    <button
                      type="button"
                      disabled={!sortable}
                      onClick={() => handleSortClick(col)}
                      className={cn(
                        "inline-flex min-w-0 flex-1 items-center gap-1 select-none text-left",
                        sortable && "hover:text-[var(--yu3-ink-strong)]",
                      )}
                    >
                      <span className="truncate">{col.header}</span>
                      {sortDir === "asc" ? (
                        <ArrowUp size={10} weight="bold" className="shrink-0" />
                      ) : sortDir === "desc" ? (
                        <ArrowDown
                          size={10}
                          weight="bold"
                          className="shrink-0"
                        />
                      ) : null}
                    </button>
                    <div className="shrink-0 opacity-0 group-hover/col:opacity-100 transition-opacity">
                      {headerShell}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rowActions.length > 0 ? (
            <div className="relative z-[11] w-9 shrink-0 self-stretch bg-[var(--yu3-bg-surface-sunken)]" />
          ) : null}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 h-12 px-3 border-b border-[var(--yu3-line-subtle)]"
            >
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-1/5" />
              <Skeleton className="h-3 w-1/6" />
            </div>
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-6">
          {emptyState ?? (
            <EmptyState
              title="No records"
              description="Try adjusting filters, or search with a different keyword."
            />
          )}
        </div>
      ) : (
        <div
          style={{
            height: totalSize,
            position: "relative",
            width: "100%",
          }}
        >
          {virtualItems.map((vi) => {
            const row = filteredRows[vi.index]!;
            const id = rowId(row);
            const selected = selection.has(id);
            return (
              <div
                key={id}
                data-selected={selected ? "true" : undefined}
                className={cn(
                  "z-0 grid items-center border-b border-[var(--yu3-line-subtle)] last:border-b-0",
                  "hover:bg-[var(--yu3-bg-surface-subtle)]",
                  selected && "bg-[var(--yu3-wine-wash)]",
                  "transition-colors",
                )}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: rowHeight,
                  transform: `translateY(${vi.start}px)`,
                  gridTemplateColumns: buildGridTemplate(visibleColumns, {
                    hasSelection: bulkActions.length > 0,
                    hasRowActions: rowActions.length > 0,
                  }),
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-yu3-noclick]"))
                    return;
                  onRowClick?.(row);
                }}
                role={onRowClick ? "button" : undefined}
              >
                {bulkActions.length > 0 ? (
                  <div
                    className="flex items-center justify-center pl-3 pr-2"
                    data-yu3-noclick
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleRow(row)}
                      aria-label={`Select row ${id}`}
                    />
                  </div>
                ) : null}
                {visibleColumns.map((col) => (
                  <div
                    key={col.id}
                    className={cn(
                      "min-w-0 px-3 truncate text-[13px] text-[var(--yu3-ink)]",
                      "flex items-center h-full",
                      col.numeric && "[font-feature-settings:'tnum'_1]",
                      col.align === "right" && "justify-end text-right",
                      col.align === "center" && "justify-center text-center",
                    )}
                  >
                    {col.cell(row)}
                  </div>
                ))}
                {rowActions.length > 0 ? (
                  <div
                    className="flex items-center justify-center"
                    data-yu3-noclick
                  >
                    <RowActionMenu actions={rowActions} row={row} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-w-0">
      {chromeTop}
      {desktopTable}
      {mobileList}
      <BulkBar
        selectedCount={selection.size}
        totalCount={filteredRows.length}
        actions={bulkActions}
        rows={selectedRows}
        onClear={() => setSelection(new Set())}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function buildGridTemplate<Row>(
  cols: ColumnDef<Row>[],
  opts: { hasSelection: boolean; hasRowActions: boolean },
) {
  const parts: string[] = [];
  if (opts.hasSelection) parts.push("40px");
  for (const c of cols) {
    if (c.width) parts.push(`${c.width}px`);
    else if (c.minWidth) parts.push(`minmax(${c.minWidth}px, 1fr)`);
    else parts.push("minmax(140px, 1fr)");
  }
  if (opts.hasRowActions) parts.push("40px");
  return parts.join(" ");
}

function cellAt<Row>(cols: ColumnDef<Row>[], row: Row, idx: number) {
  const col = cols[idx];
  if (!col) return null;
  return col.cell(row);
}

function toneColor(tone?: StageTone) {
  if (tone === "wine") return "var(--yu3-wine)";
  if (tone === "forest") return "var(--yu3-forest)";
  if (tone === "warning") return "var(--yu3-warning)";
  if (tone === "success") return "var(--yu3-success)";
  if (tone === "danger") return "var(--yu3-danger)";
  if (tone === "info") return "var(--yu3-info)";
  return undefined;
}

function RowActionMenu<Row>({
  actions,
  row,
}: {
  actions: RowAction<Row>[];
  row: Row;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          className="inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[color-mix(in_srgb,var(--yu3-ink)_9%,transparent)] hover:text-[var(--yu3-ink)]"
          aria-label="Row actions"
        >
          <DotsThreeVertical size={14} weight="bold" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[180px] max-w-[min(100vw,320px)] p-1"
        onPointerDownOutside={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((a) => (
          <DropdownMenuItem
            key={a.id}
            danger={a.danger}
            icon={a.icon}
            onSelect={() => {
              void a.run(row);
            }}
          >
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
