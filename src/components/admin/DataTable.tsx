"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  MagnifyingGlass as Search,
  CaretDown as ChevronDown,
  CaretUp as ChevronUp,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Download,
  Columns as Columns3,
  ArrowsDownUp as ArrowUpDown,
  Bookmark,
  BookmarkSimple as BookmarkCheck,
  ArrowCounterClockwise as RotateCcw,
} from "@phosphor-icons/react";

/* ════════════ Types ════════════ */

export interface ColumnDef<T> {
  id: string;
  label: string;
  accessor: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  defaultHidden?: boolean;
  /** Permanently invisible — used only for search indexing, never rendered or shown in column picker */
  alwaysHidden?: boolean;
  align?: "left" | "right" | "center";
  minWidth?: string;
  /** Default width in px for resizable columns */
  defaultWidth?: number;
  exportAccessor?: (row: T) => string | number;
}

export interface BulkAction {
  /** Visible label, or `aria-label` when `iconOnly` */
  label: string;
  icon?: ReactNode;
  /** Show only `icon` (uses `label` for accessibility) */
  iconOnly?: boolean;
  variant?: "danger" | "default";
  onClick: (selectedKeys: string[]) => void | Promise<void>;
}

/** North Star mobile list: bold primary, muted subtitle, strong amount, chips below. */
export interface MobileCardLayoutConfig {
  primaryColumnId: string;
  subtitleColumnId?: string;
  amountColumnId?: string;
  metaColumnIds?: string[];
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyField: keyof T | ((row: T) => string);
  searchable?: boolean;
  searchPlaceholder?: string;
  pagination?: boolean;
  defaultPerPage?: number;
  perPageOptions?: number[];
  exportable?: boolean;
  exportFilename?: string;
  columnToggle?: boolean;
  onRowClick?: (row: T) => void;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
  emptySubtext?: string;
  rowClassName?: (row: T) => string;
  renderRow?: (row: T, columns: ColumnDef<T>[]) => ReactNode;
  stickyHeader?: boolean;
  /** Alternating row backgrounds for easier horizontal scanning */
  striped?: boolean;
  tableId?: string;
  selectable?: boolean;
  /** When true (default), row selection & bulk actions are desktop/tablet only — mobile stays tap-to-open. */
  selectableDesktopOnly?: boolean;
  bulkActions?: BulkAction[];
  /** Optional mobile card column arrangement (client-first, amount right, actions never wrap into meta). */
  mobileCardLayout?: MobileCardLayoutConfig;
  /** Controlled sort — when provided, overrides internal sort state */
  sortCol?: string | null;
  sortDir?: "asc" | "desc";
  onSortChange?: (col: string, dir: "asc" | "desc") => void;
  /** Initial sort when no saved view exists (localStorage). Latest-first: e.g. created_at + desc */
  defaultSortCol?: string | null;
  defaultSortDir?: "asc" | "desc";
  /** Increment after a bulk action (e.g. delete) to clear row selection */
  clearSelectionSignal?: number;
}

/* ════════════ Types ─ View Snapshot ════════════ */

interface ViewSnapshot {
  sortCol: string | null;
  sortDir: "asc" | "desc";
  hiddenCols: string[];
  perPage: number;
  colOrder?: string[];
  v: 1;
}

/* ════════════ Helpers ════════════ */

const STORAGE_PREFIX = "yugo_dt_";

function loadViewSnapshot(tableId: string): ViewSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_view`);
    if (raw) return JSON.parse(raw) as ViewSnapshot;
  } catch { /* ignore */ }
  return null;
}

function saveViewSnapshot(tableId: string, snap: ViewSnapshot) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}_view`, JSON.stringify(snap));
  } catch { /* ignore */ }
}

function clearViewSnapshot(tableId: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tableId}_view`);
  } catch { /* ignore */ }
}

function hasViewSnapshot(tableId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`${STORAGE_PREFIX}${tableId}_view`);
}

function loadHidden(tableId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_hidden`);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveHidden(tableId: string, hidden: Set<string>) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${tableId}_hidden`,
      JSON.stringify([...hidden]),
    );
  } catch { /* ignore */ }
}

function loadPerPage(tableId: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_perPage`);
    if (raw) return Number(raw);
  } catch { /* ignore */ }
  return fallback;
}

function savePerPage(tableId: string, n: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}_perPage`, String(n));
  } catch { /* ignore */ }
}

function loadColWidths(tableId: string, colIds: string[], defaults: number[]): number[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_widths`);
    if (raw) {
      const stored: Record<string, number> = JSON.parse(raw);
      return colIds.map((id, i) => Math.max(40, stored[id] ?? defaults[i] ?? 100));
    }
  } catch { /* ignore */ }
  return defaults;
}

function saveColWidths(tableId: string, colIds: string[], widths: number[]) {
  try {
    const obj: Record<string, number> = {};
    colIds.forEach((id, i) => { obj[id] = widths[i]; });
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}_widths`, JSON.stringify(obj));
  } catch { /* ignore */ }
}

function clearColWidths(tableId: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tableId}_widths`);
  } catch { /* ignore */ }
}

function loadColOrder(tableId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_order`);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* ignore */ }
  return null;
}

function saveColOrder(tableId: string, order: string[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}_order`, JSON.stringify(order));
  } catch { /* ignore */ }
}

function clearColOrder(tableId: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tableId}_order`);
  } catch { /* ignore */ }
}

/* ════════════ Component ════════════ */

export default function DataTable<T>({
  data,
  columns,
  keyField,
  searchable = true,
  searchPlaceholder = "Search…",
  pagination = true,
  defaultPerPage = 50,
  perPageOptions = [25, 50, 100],
  exportable = true,
  exportFilename = "export",
  columnToggle = true,
  onRowClick,
  emptyMessage = "No results",
  emptySubtext,
  rowClassName,
  renderRow,
  stickyHeader = true,
  striped = true,
  tableId = "default",
  selectable = false,
  selectableDesktopOnly = true,
  bulkActions = [],
  mobileCardLayout,
  sortCol: sortColProp,
  sortDir: sortDirProp,
  onSortChange,
  defaultSortCol = null,
  defaultSortDir = "asc",
  clearSelectionSignal,
}: DataTableProps<T>) {
  /* ── State ── */
  const [search, setSearch] = useState("");
  const [sortColInternal, setSortColInternal] = useState<string | null>(
    () => loadViewSnapshot(tableId)?.sortCol ?? defaultSortCol ?? null,
  );
  const [sortDirInternal, setSortDirInternal] = useState<"asc" | "desc">(
    () => loadViewSnapshot(tableId)?.sortDir ?? defaultSortDir,
  );
  const sortCol = sortColProp ?? sortColInternal;
  const sortDir = sortDirProp ?? sortDirInternal;
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(() => {
    const sv = loadViewSnapshot(tableId);
    return sv?.perPage ?? loadPerPage(tableId, defaultPerPage);
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const dataTableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (clearSelectionSignal == null || clearSelectionSignal === 0) return;
    setSelectedKeys(new Set());
  }, [clearSelectionSignal]);

  useEffect(() => {
    if (!selectable || selectedKeys.size === 0) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = dataTableContainerRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setSelectedKeys(new Set());
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [selectable, selectedKeys]);

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const sv = loadViewSnapshot(tableId);
    if (sv?.hiddenCols) return new Set(sv.hiddenCols);
    const stored = loadHidden(tableId);
    if (stored.size > 0) return stored;
    return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const [savedViewExists, setSavedViewExists] = useState(() => hasViewSnapshot(tableId));
  const [saveFlash, setSaveFlash] = useState(false);

  /* ── Column order ── */
  const [colOrder, setColOrder] = useState<string[]>(() => {
    const sv = loadViewSnapshot(tableId);
    if (sv?.colOrder) return sv.colOrder;
    const stored = loadColOrder(tableId);
    if (stored) return stored;
    return columns.map((c) => c.id);
  });

  /* Keep colOrder in sync if columns prop changes (new columns added).
   * Insert new ids where they belong in the column definition order — not at the end —
   * so e.g. "Contact Name" stays next to "Company" for users with saved table layouts. */
  useEffect(() => {
    const allIds = columns.map((c) => c.id);
    setColOrder((prev) => {
      const pruned = prev.filter((id) => allIds.includes(id));
      const added = allIds.filter((id) => !pruned.includes(id));
      if (added.length === 0) {
        return pruned.length === prev.length ? prev : pruned;
      }
      const addedSorted = [...added].sort((a, b) => allIds.indexOf(a) - allIds.indexOf(b));
      let merged = [...pruned];
      for (const addId of addedSorted) {
        const canonicalIndex = allIds.indexOf(addId);
        const beforeIds = allIds.slice(0, canonicalIndex);
        let insertAt = 0;
        for (let i = beforeIds.length - 1; i >= 0; i--) {
          const bid = beforeIds[i];
          const idx = merged.indexOf(bid);
          if (idx !== -1) {
            insertAt = idx + 1;
            break;
          }
        }
        merged.splice(insertAt, 0, addId);
      }
      return merged;
    });
  }, [columns]);

  /* ── Drag-to-reorder state ── */
  const dragColIdRef = useRef<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleDragStart = useCallback((colId: string) => (e: React.DragEvent) => {
    dragColIdRef.current = colId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", colId);
  }, []);

  const handleDragOver = useCallback((colId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragColIdRef.current && dragColIdRef.current !== colId) {
      setDragOverColId(colId);
    }
  }, []);

  const handleDrop = useCallback((targetColId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromId = dragColIdRef.current;
    if (!fromId || fromId === targetColId) return;
    setColOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(targetColId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      saveColOrder(tableId, next);
      return next;
    });
    dragColIdRef.current = null;
    setDragOverColId(null);
  }, [tableId]);

  const handleDragEnd = useCallback(() => {
    dragColIdRef.current = null;
    setDragOverColId(null);
  }, []);

  useEffect(() => { setPage(1); }, [search, data.length]);

  const getKey = useCallback(
    (row: T) =>
      typeof keyField === "function"
        ? keyField(row)
        : String(row[keyField]),
    [keyField],
  );

  /* ── Visible columns (respecting order + hidden) ── */
  const visibleCols = useMemo(() => {
    const colMap = new Map(columns.map((c) => [c.id, c]));
    const ordered = colOrder
      .map((id) => colMap.get(id))
      .filter((c): c is typeof columns[number] => !!c && !c.alwaysHidden && !hiddenCols.has(c.id));
    // Append any columns not yet in colOrder (safety net)
    const extra = columns.filter((c) => !c.alwaysHidden && !colOrder.includes(c.id) && !hiddenCols.has(c.id));
    return [...ordered, ...extra];
  }, [columns, hiddenCols, colOrder]);

  const mobileCols = useMemo(() => {
    const actionCol = visibleCols.find((c) => c.id === "actions");
    const dataCols = visibleCols.filter((c) => c.id !== "actions");
    if (mobileCardLayout) {
      const primary =
        dataCols.find((c) => c.id === mobileCardLayout.primaryColumnId) ?? dataCols[0];
      const subtitle = mobileCardLayout.subtitleColumnId
        ? dataCols.find((c) => c.id === mobileCardLayout.subtitleColumnId)
        : undefined;
      const amount = mobileCardLayout.amountColumnId
        ? dataCols.find((c) => c.id === mobileCardLayout.amountColumnId)
        : undefined;
      const used = new Set(
        [primary?.id, subtitle?.id, amount?.id].filter(Boolean) as string[],
      );
      let meta: ColumnDef<T>[];
      if (mobileCardLayout.metaColumnIds?.length) {
        meta = mobileCardLayout.metaColumnIds
          .map((id) => dataCols.find((c) => c.id === id))
          .filter((c): c is ColumnDef<T> => !!c);
      } else {
        meta = dataCols.filter((c) => !used.has(c.id));
      }
      return { actionCol, mode: "layout" as const, primary, subtitle, amount, meta };
    }
    return {
      actionCol,
      mode: "legacy" as const,
      primary: dataCols[0],
      statusCol: dataCols[1],
      valueCol: dataCols[2],
      meta: dataCols.slice(3, 7),
    };
  }, [visibleCols, mobileCardLayout]);

  /* ── Column resize ── */
  const colIds = useMemo(() => visibleCols.map((c) => c.id), [visibleCols]);
  const defaultWidths = useMemo(
    () => visibleCols.map((c) => c.defaultWidth ?? (c.minWidth ? parseInt(c.minWidth, 10) || 100 : 120)),
    [visibleCols],
  );
  const [colWidths, setColWidths] = useState<number[]>(() =>
    loadColWidths(tableId, colIds, defaultWidths),
  );
  const dragging = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const loaded = loadColWidths(tableId, colIds, defaultWidths);
    setColWidths((prev) => (prev.length !== colIds.length ? loaded : prev));
  }, [tableId, colIds.join(","), defaultWidths.join(",")]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragging.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[drag.col] = Math.max(40, drag.startW + delta);
        return next;
      });
    };
    const onUp = () => {
      if (dragging.current != null) {
        setColWidths((prev) => {
          saveColWidths(tableId, colIds, prev);
          return prev;
        });
        dragging.current = null;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [tableId, colIds]);

  const onResizeStart = useCallback((col: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { col, startX: e.clientX, startW: colWidths[col] };
  }, [colWidths]);

  const ResizeHandle = useCallback(({ col }: { col: number }) => (
    <span
      onMouseDown={onResizeStart(col)}
      className="absolute right-0 top-0 h-full w-2 -mr-1 cursor-col-resize select-none flex items-center justify-center group z-10 hover:bg-[var(--gold)]/5 transition-colors rounded"
      onClick={(e) => e.stopPropagation()}
      title="Drag to resize"
    >
      <span className="w-0.5 h-4 bg-[var(--brd)] group-hover:bg-[var(--gold)]/70 transition-colors rounded-full" />
    </span>
  ), [onResizeStart]);

  /* ── Search ── */
  const searchCols = useMemo(
    () => columns.filter((c) => c.searchable !== false),
    [columns],
  );

  const searched = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchCols.some((col) => {
        const val = col.accessor(row);
        return val != null && String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchCols]);

  /* ── Sort ── */
  const sorted = useMemo(() => {
    if (!sortCol) return searched;
    const col = columns.find((c) => c.id === sortCol);
    if (!col) return searched;
    return [...searched].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        const as = String(av);
        const bs = String(bv);
        const isoPrefix = /^\d{4}-\d{2}-\d{2}/;
        if (isoPrefix.test(as) && isoPrefix.test(bs)) {
          cmp = new Date(as).getTime() - new Date(bs).getTime();
        } else {
          cmp = as.localeCompare(bs);
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [searched, sortCol, sortDir, columns]);

  /* ── Pagination ── */
  const totalPages = pagination ? Math.max(1, Math.ceil(sorted.length / perPage)) : 1;
  const safePage = Math.min(page, totalPages);
  const paged = pagination
    ? sorted.slice((safePage - 1) * perPage, safePage * perPage)
    : sorted;

  const pageNumbers = useMemo(() => {
    const pages: (number | "…")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push("…");
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push("…");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  /* ── Selection helpers ── */
  const pagedKeys = useMemo(() => new Set(paged.map(getKey)), [paged, getKey]);
  const allPageSelected = selectable && pagedKeys.size > 0 && [...pagedKeys].every((k) => selectedKeys.has(k));
  const somePageSelected = selectable && [...pagedKeys].some((k) => selectedKeys.has(k));
  /** Gmail-style: after selecting the whole page, offer to select every row matching search/sort (all pages). */
  const canSelectAllInView =
    selectable &&
    pagination &&
    sorted.length > paged.length &&
    allPageSelected &&
    selectedKeys.size === pagedKeys.size;

  const selectAllSortedKeys = useCallback(() => {
    setSelectedKeys(new Set(sorted.map(getKey)));
  }, [sorted, getKey]);

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const k of pagedKeys) next.delete(k);
      } else {
        for (const k of pagedKeys) next.add(k);
      }
      return next;
    });
  }, [allPageSelected, pagedKeys]);

  const toggleRow = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /* ── Sort handler ── */
  const handleSort = useCallback(
    (colId: string) => {
      const nextDir = sortCol === colId && sortDir === "asc" ? "desc" : "asc";
      if (onSortChange) {
        onSortChange(colId, nextDir);
      } else {
        setSortColInternal(colId);
        setSortDirInternal(nextDir);
      }
      setPage(1);
    },
    [sortCol, sortDir, onSortChange],
  );

  /* ── Column toggle ── */
  const toggleCol = useCallback(
    (colId: string) => {
      setHiddenCols((prev) => {
        const next = new Set(prev);
        if (next.has(colId)) {
          next.delete(colId);
        } else {
          // Never hide if it would leave fewer than 2 visible columns
          const wouldBeVisible = columns.filter((c) => !next.has(c.id) && c.id !== colId).length;
          if (wouldBeVisible < 2) return prev;
          next.add(colId);
        }
        saveHidden(tableId, next);
        return next;
      });
    },
    [tableId, columns],
  );

  /* ── Per page ── */
  const changePerPage = useCallback(
    (n: number) => {
      setPerPage(n);
      savePerPage(tableId, n);
      setPage(1);
    },
    [tableId],
  );

  /* ── Save / Reset View ── */
  const handleSaveView = useCallback(() => {
    const snap: ViewSnapshot = {
      sortCol: sortCol ?? null,
      sortDir,
      hiddenCols: [...hiddenCols],
      perPage,
      colOrder,
      v: 1,
    };
    saveViewSnapshot(tableId, snap);
    setSavedViewExists(true);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 2000);
  }, [sortCol, sortDir, hiddenCols, perPage, colOrder, tableId]);

  const handleResetView = useCallback(() => {
    clearViewSnapshot(tableId);
    clearColWidths(tableId);
    clearColOrder(tableId);
    setSavedViewExists(false);
    setSortColInternal(null);
    setSortDirInternal("asc");
    const defaultHidden = new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
    setHiddenCols(defaultHidden);
    saveHidden(tableId, defaultHidden);
    setPerPage(defaultPerPage);
    savePerPage(tableId, defaultPerPage);
    setSearch("");
    setPage(1);
    setColWidths(defaultWidths);
    setColOrder(columns.map((c) => c.id));
  }, [tableId, columns, defaultPerPage, defaultWidths]);

  /* ── CSV export ── */
  const exportToCsv = useCallback(
    (rows: T[], filename: string) => {
      const headers = visibleCols.map((c) => c.label);
      const csvRows = rows.map((row) =>
        visibleCols
          .map((c) => {
            const val = c.exportAccessor ? c.exportAccessor(row) : c.accessor(row);
            const s = String(val ?? "");
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      );
      const csv = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    [visibleCols],
  );

  const handleExport = useCallback(() => {
    exportToCsv(sorted, `${exportFilename}.csv`);
  }, [sorted, exportFilename, exportToCsv]);

  const handleExportSelected = useCallback(
    (keys: string[]) => {
      const selectedRows = sorted.filter((row) => keys.includes(getKey(row)));
      exportToCsv(selectedRows, `${exportFilename}-selected-${selectedRows.length}.csv`);
    },
    [sorted, exportFilename, getKey, exportToCsv],
  );

  const effectiveBulkActions = useMemo(() => {
    const actions: BulkAction[] = [];
    if (selectable && exportable) {
      actions.push({
        label: "Export selected",
        icon: <Download className="w-3 h-3" />,
        onClick: handleExportSelected,
      });
    }
    return [...actions, ...bulkActions];
  }, [selectable, exportable, bulkActions, handleExportSelected]);

  /* ════════════ Render ════════════ */
  return (
    <div ref={dataTableContainerRef} className="space-y-0 w-full min-w-0 max-w-full">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-2 mb-4 relative">
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* Search, full width on mobile (no dead space on the right) */}
          {searchable && (
            <div className="relative flex-1 min-w-0 md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tx2)]" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full min-h-11 rounded-full border border-[var(--brd)] bg-[var(--card)] py-2.5 pl-10 pr-3 text-[13px] text-[var(--tx)] outline-none transition-colors placeholder:text-[var(--tx3)]/60 focus:border-[var(--gold)]/40 touch-manipulation"
              />
            </div>
          )}
          {exportable && (
            <button
              type="button"
              onClick={handleExport}
              title="Export CSV"
              className="md:hidden inline-flex items-center justify-center shrink-0 w-11 h-11 min-w-11 min-h-11 rounded-full border border-[var(--brd)] bg-[var(--card)] text-[var(--tx)] active:scale-[0.98] touch-manipulation"
            >
              <Download className="w-5 h-5" weight="regular" />
            </button>
          )}
          {columnToggle && (
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              title="Choose columns"
              aria-expanded={showColMenu}
              aria-label="Choose visible columns"
              className="md:hidden inline-flex items-center justify-center shrink-0 w-11 h-11 min-w-11 min-h-11 rounded-full border border-[var(--brd)] bg-[var(--card)] text-[var(--tx)] active:scale-[0.98] touch-manipulation"
            >
              <Columns3 className="w-5 h-5" weight="regular" />
            </button>
          )}
        </div>
        <div className="hidden md:flex w-full flex-wrap items-center justify-end gap-1.5">
          {/* Export */}
          {exportable && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--brd)] text-[10px] font-semibold leading-none text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]/40 transition-colors"
            >
              <Download className="w-3 h-3 shrink-0" /> Export
            </button>
          )}
          {/* Column toggle (desktop) */}
          {columnToggle && (
            <button
              type="button"
              onClick={() => setShowColMenu((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--brd)] text-[10px] font-semibold leading-none text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]/40 transition-colors"
            >
              <Columns3 className="w-3 h-3 shrink-0" /> Columns
            </button>
          )}

          {/* Save View / Reset */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetView}
              title="Reset to default view (columns, sort, page size)"
              className="inline-flex items-center justify-center gap-0 p-1 rounded-md text-[10px] font-semibold leading-none text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50 transition-colors min-w-[26px] min-h-[26px]"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
            </button>
            <button
              type="button"
              onClick={handleSaveView}
              title={savedViewExists ? "Update saved view" : "Save current view (sort, columns, page size)"}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold leading-none transition-all duration-200 ${
                saveFlash
                  ? "border-[var(--grn)]/40 bg-[var(--grn)]/10 text-[var(--grn)]"
                  : savedViewExists
                    ? "border-[var(--gold)]/30 bg-[var(--gold)]/[0.07] text-[var(--gold)]"
                    : "border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]/40"
              }`}
            >
              {saveFlash ? (
                <BookmarkCheck className="w-3 h-3 shrink-0" />
              ) : savedViewExists ? (
                <BookmarkCheck className="w-3 h-3 shrink-0" />
              ) : (
                <Bookmark className="w-3 h-3 shrink-0" />
              )}
              {saveFlash ? "Saved!" : "Save view"}
            </button>
          </div>
        </div>

        {showColMenu && columnToggle && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/25 md:bg-black/0"
              onClick={() => setShowColMenu(false)}
              aria-hidden
            />
            <div
              className="fixed z-50 left-3 right-3 max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain rounded-xl border border-[var(--brd)] bg-[var(--card)] shadow-2xl py-2 bottom-[max(0.75rem,calc(var(--admin-mobile-nav-bar)+env(safe-area-inset-bottom,0px)+8px))] md:absolute md:left-auto md:right-0 md:top-full md:mt-1.5 md:bottom-auto md:w-52 md:max-h-[min(70vh,420px)] md:py-1.5"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] md:hidden">
                Visible columns
              </p>
              {columns
                .filter((col) => !col.alwaysHidden)
                .map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-3 px-3 py-2.5 md:py-1.5 text-[13px] md:text-[11px] text-[var(--tx2)] hover:bg-[var(--bg)]/50 cursor-pointer transition-colors touch-manipulation"
                  >
                    <input
                      type="checkbox"
                      checked={!hiddenCols.has(col.id)}
                      onChange={() => toggleCol(col.id)}
                      className="w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--brd)] accent-[var(--gold)]"
                    />
                    {col.label}
                  </label>
                ))}
            </div>
          </>
        )}
      </div>

      {/* ── Bulk action bar (desktop/tablet only when selectableDesktopOnly) ── */}
      {selectable && selectedKeys.size > 0 && (
        <div
          className={`${
            selectableDesktopOnly ? "hidden md:flex" : "flex"
          } flex-row flex-wrap items-center gap-2 sm:gap-3 mb-2`}
        >
          <span className="text-[11px] font-semibold text-[var(--tx)] shrink-0">
            {selectedKeys.size} selected
          </span>
          {canSelectAllInView && (
            <button
              type="button"
              onClick={selectAllSortedKeys}
              className="text-[11px] font-semibold text-[var(--gold)] hover:underline shrink-0"
            >
              Select all {sorted.length} in view
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {effectiveBulkActions.map((action) => {
              const isIconOnly = action.iconOnly && action.icon;
              const base =
                action.variant === "danger"
                  ? "bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25 border border-[var(--red)]/25"
                  : "bg-[var(--card)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)]/50";
              return (
                <button
                  key={action.label}
                  type="button"
                  aria-label={isIconOnly ? action.label : undefined}
                  onClick={() => action.onClick([...selectedKeys])}
                  className={`inline-flex items-center justify-center rounded-lg text-[11px] font-semibold transition-colors ${
                    isIconOnly
                      ? `h-8 w-8 shrink-0 p-0 ${base}`
                      : `h-7 gap-1.5 px-3 ${base}`
                  }`}
                >
                  {action.icon}
                  {!isIconOnly ? action.label : null}
                </button>
              );
            })}
            <button
              type="button"
              aria-label="Clear selection"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedKeys(new Set());
              }}
              className="inline-flex items-center justify-center h-7 px-2.5 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--brd)]/30 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table header (desktop only) ── */}
      <div
        className={`hidden md:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pr-1 [-webkit-overflow-scrolling:touch] ${stickyHeader ? "max-h-[calc(100dvh-240px)] overflow-y-auto" : ""}`}
      >
        <table
          className={`border-collapse w-full min-w-[600px] ${striped ? "dt-striped" : ""}`}
          style={{ tableLayout: "fixed" }}
        >
          <colgroup>
            {selectable && <col style={{ width: 40 }} />}
            {colWidths.map((w, i) => {
              const col = visibleCols[i];
              const isLast = i === visibleCols.length - 1;
              const style: CSSProperties = isLast
                ? { width: "auto", minWidth: col?.minWidth ?? Math.max(w, 100) }
                : { width: w };
              if (!isLast && col?.minWidth) style.minWidth = col.minWidth;
              return <col key={col?.id ?? i} style={style} />;
            })}
          </colgroup>
          <thead className={stickyHeader ? "sticky top-0 z-10 bg-[var(--bg)] shadow-[0_1px_0_0_var(--brd)]" : ""}>
            <tr className="border-b border-[var(--brd)]/50">
              {selectable && (
                <th
                  className={`w-10 px-3 py-2.5 ${selectableDesktopOnly ? "hidden md:table-cell" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-[var(--brd)] accent-[var(--gold)]"
                  />
                </th>
              )}
              {visibleCols.map((col, idx) => {
                const isActive = sortCol === col.id;
                const isSortable = col.sortable !== false;
                const isDragOver = dragOverColId === col.id;
                return (
                  <th
                    key={col.id}
                    draggable
                    onDragStart={handleDragStart(col.id)}
                    onDragOver={handleDragOver(col.id)}
                    onDrop={handleDrop(col.id)}
                    onDragEnd={handleDragEnd}
                    onClick={isSortable ? () => handleSort(col.id) : undefined}
                    className={`dt-th relative select-none transition-colors ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    } ${
                      isSortable
                        ? "cursor-pointer hover:text-[var(--gold)]"
                        : "cursor-grab"
                    } ${
                      isActive
                        ? "text-[var(--gold)]"
                        : ""
                    } ${
                      isDragOver
                        ? "bg-[var(--gold)]/10 border-l-2 border-l-[var(--gold)]"
                        : ""
                    }`}
                    title="Drag to reorder"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isSortable && (
                        isActive ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                        )
                      )}
                    </span>
                    <ResizeHandle col={idx} />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + (selectable ? 1 : 0)}
                >
                  <div className="dt-empty">
                    <p className="dt-empty-title">{emptyMessage}</p>
                    {emptySubtext && (
                      <p className="dt-empty-sub">{emptySubtext}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : renderRow ? (
              paged.map((row) => (
                <tr key={getKey(row)} className="border-b border-[var(--brd)]/20">
                  {selectable && (
                    <td
                      className={`w-10 px-3 py-3 ${selectableDesktopOnly ? "hidden md:table-cell" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(getKey(row))}
                        onChange={() => toggleRow(getKey(row))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-[var(--brd)] accent-[var(--gold)] cursor-pointer"
                      />
                    </td>
                  )}
                  {renderRow(row, visibleCols)}
                </tr>
              ))
            ) : (
              paged.map((row) => {
                const rowKey = getKey(row);
                return (
                <tr
                  key={rowKey}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`dt-row-divider ${
                    onRowClick ? "dt-row-clickable" : ""
                  } ${selectable && selectedKeys.has(rowKey) ? "bg-[var(--gold)]/[0.04]" : ""} ${rowClassName ? rowClassName(row) : ""}`}
                >
                  {selectable && (
                    <td
                      className={`w-10 px-3 py-3 ${selectableDesktopOnly ? "hidden md:table-cell" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(rowKey)}
                        onChange={() => toggleRow(rowKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-[var(--brd)] accent-[var(--gold)] cursor-pointer"
                      />
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td
                      key={col.id}
                      className={`dt-td min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {col.render
                        ? col.render(row)
                        : <span className="uppercase text-[var(--tx)]">{String(col.accessor(row) ?? "-")}</span>}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile card view (< md screens) ── */}
      <div className="md:hidden">
        {paged.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">{emptyMessage}</p>
            {emptySubtext && (
              <p className="text-[12px] text-[var(--tx3)] mt-1">{emptySubtext}</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--brd)]/30">
            {paged.map((row) => {
              const rowKey = getKey(row);
              const showCheckbox = selectable && !selectableDesktopOnly;

              const renderCell = (col: ColumnDef<T> | undefined) => {
                if (!col) return null;
                return col.render ? (
                  col.render(row)
                ) : (
                  <span className="uppercase">{String(col.accessor(row) ?? "-")}</span>
                );
              };

              const rowShell = (inner: ReactNode) => (
                <div
                  key={rowKey}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`flex items-start gap-2.5 px-3 sm:px-4 py-4 touch-card-press ${
                    onRowClick ? "cursor-pointer active:bg-[var(--gdim)]" : ""
                  } ${rowClassName ? rowClassName(row) : ""} ${
                    showCheckbox && selectedKeys.has(rowKey) ? "bg-[var(--gold)]/[0.04]" : ""
                  }`}
                >
                  {showCheckbox && (
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(rowKey)}
                      onChange={() => toggleRow(rowKey)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 mt-1 rounded border-[var(--brd)] accent-[var(--gold)] cursor-pointer shrink-0"
                    />
                  )}
                  {inner}
                </div>
              );

              if (mobileCols.mode === "layout") {
                const { primary, subtitle, amount, meta, actionCol } = mobileCols;
                return rowShell(
                  <>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          {primary && (
                            <div className="text-[15px] font-semibold text-[var(--tx)] leading-snug">
                              {renderCell(primary)}
                            </div>
                          )}
                          {subtitle && (
                            <div className="text-[12px] text-[var(--tx2)] mt-0.5 [&_a]:underline-offset-2">
                              {renderCell(subtitle)}
                            </div>
                          )}
                        </div>
                        {amount && (
                          <div className="shrink-0 text-right min-w-0 max-w-[48%] pl-1 [&_span]:tabular-nums">
                            {renderCell(amount)}
                          </div>
                        )}
                      </div>
                      {meta.length > 0 && (
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1.5 items-center">
                          {meta.map((col) => {
                            const val = col.accessor(row);
                            if (val === null || val === undefined || val === "") return null;
                            return (
                              <span
                                key={col.id}
                                className="text-[11px] text-[var(--tx3)] leading-snug"
                              >
                                {renderCell(col)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-start gap-2 pt-0.5">
                      {actionCol?.render ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex justify-end min-w-0"
                        >
                          {actionCol.render(row)}
                        </div>
                      ) : null}
                      {onRowClick && (
                        <ChevronRight
                          className="w-5 h-5 text-[var(--tx3)] shrink-0 mt-0.5"
                          aria-hidden
                        />
                      )}
                    </div>
                  </>,
                );
              }

              const { primary: primaryCol, statusCol, valueCol, meta: metaCols, actionCol: legacyAction } =
                mobileCols;
              return rowShell(
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-[var(--tx)] leading-snug">
                      {primaryCol?.render
                        ? primaryCol.render(row)
                        : <span>{String(primaryCol?.accessor(row) ?? "-")}</span>}
                    </div>
                    {(statusCol || valueCol) && (
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                        {statusCol && (
                          <div className="text-[12px] text-[var(--tx2)] leading-snug">
                            {statusCol.render ? statusCol.render(row) : String(statusCol.accessor(row) ?? "")}
                          </div>
                        )}
                        {valueCol && (
                          <div className="text-[12px] text-[var(--tx2)] leading-snug">
                            {valueCol.render ? valueCol.render(row) : String(valueCol.accessor(row) ?? "")}
                          </div>
                        )}
                      </div>
                    )}
                    {metaCols.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {metaCols.map((col) => {
                          const val = col.accessor(row);
                          if (val === null || val === undefined || val === "") return null;
                          return (
                            <span
                              key={col.id}
                              className="text-[11px] text-[var(--tx3)] leading-snug"
                            >
                              {col.render ? col.render(row) : String(val)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-start gap-2 pt-0.5">
                    {legacyAction?.render ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex justify-end min-w-0 max-w-[120px]"
                      >
                        {legacyAction.render(row)}
                      </div>
                    ) : null}
                    {onRowClick && (
                      <ChevronRight
                        className="w-5 h-5 text-[var(--tx3)] shrink-0 mt-0.5"
                        aria-hidden
                      />
                    )}
                  </div>
                </>,
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination && sorted.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-[var(--brd)]/20 mt-1">
          <div className="text-[10px] text-[var(--tx3)]">
            Showing {(safePage - 1) * perPage + 1}–{Math.min(safePage * perPage, sorted.length)} of{" "}
            {sorted.length}{search.trim() && data.length !== sorted.length ? ` (filtered from ${data.length})` : ""}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-2 md:p-1.5 rounded-md text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </button>
            {pageNumbers.map((pn, i) =>
              pn === "…" ? (
                <span key={`e${i}`} className="px-1 text-[10px] text-[var(--tx3)]">
                  …
                </span>
              ) : (
                <button
                  key={pn}
                  type="button"
                  onClick={() => setPage(pn as number)}
                  className={`min-w-[36px] md:min-w-[28px] h-[36px] md:h-[28px] rounded-md text-[10px] font-semibold transition-colors touch-manipulation ${
                    safePage === pn
                      ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30"
                      : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50"
                  }`}
                >
                  {pn}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-2 md:p-1.5 rounded-md text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
            >
              <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </button>
            {/* Per page, desktop only */}
            <div className="hidden md:flex ml-2 items-center gap-1">
              <select
                value={perPage}
                onChange={(e) => changePerPage(Number(e.target.value))}
                className="text-[10px] bg-[var(--card)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx3)] focus:border-[var(--brd)] outline-none"
              >
                {perPageOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} per page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
