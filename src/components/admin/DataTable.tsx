"use client";

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Columns3,
  ArrowUpDown,
} from "lucide-react";

/* ════════════ Types ════════════ */

export interface ColumnDef<T> {
  id: string;
  label: string;
  accessor: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  defaultHidden?: boolean;
  align?: "left" | "right" | "center";
  minWidth?: string;
  exportAccessor?: (row: T) => string | number;
}

export interface BulkAction {
  label: string;
  icon?: ReactNode;
  variant?: "danger" | "default";
  onClick: (selectedKeys: string[]) => void | Promise<void>;
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
  tableId?: string;
  selectable?: boolean;
  bulkActions?: BulkAction[];
}

/* ════════════ Helpers ════════════ */

const STORAGE_PREFIX = "yugo_dt_";

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
  emptyIcon,
  emptyMessage = "No results",
  emptySubtext,
  rowClassName,
  renderRow,
  stickyHeader = false,
  tableId = "default",
  selectable = false,
  bulkActions = [],
}: DataTableProps<T>) {
  /* ── State ── */
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(() => loadPerPage(tableId, defaultPerPage));
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    const stored = loadHidden(tableId);
    if (stored.size > 0) return stored;
    return new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id));
  });
  const [showColMenu, setShowColMenu] = useState(false);

  useEffect(() => { setPage(1); }, [search, data.length]);

  const getKey = useCallback(
    (row: T) =>
      typeof keyField === "function"
        ? keyField(row)
        : String(row[keyField]),
    [keyField],
  );

  /* ── Visible columns ── */
  const visibleCols = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols],
  );

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
        cmp = String(av).localeCompare(String(bv));
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
      if (sortCol === colId) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(colId);
        setSortDir("asc");
      }
      setPage(1);
    },
    [sortCol],
  );

  /* ── Column toggle ── */
  const toggleCol = useCallback(
    (colId: string) => {
      setHiddenCols((prev) => {
        const next = new Set(prev);
        if (next.has(colId)) next.delete(colId);
        else next.add(colId);
        saveHidden(tableId, next);
        return next;
      });
    },
    [tableId],
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
    <div className="space-y-0">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        {/* Search */}
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--tx3)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]/50 focus:border-[var(--brd)] outline-none transition-colors"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Export */}
          {exportable && (
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]/40 transition-colors"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          )}
          {/* Column toggle */}
          {columnToggle && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]/40 transition-colors"
              >
                <Columns3 className="w-3 h-3" /> Columns
              </button>
              {showColMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowColMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-xl py-1.5">
                    {columns.map((col) => (
                      <label
                        key={col.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 text-[11px] text-[var(--tx2)] hover:bg-[var(--bg)]/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col.id)}
                          onChange={() => toggleCol(col.id)}
                          className="w-3.5 h-3.5 rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--brd)] accent-[var(--gold)]"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectable && selectedKeys.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-2 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/20">
          <span className="text-[11px] font-semibold text-[var(--gold)]">{selectedKeys.size} selected</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {effectiveBulkActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => action.onClick([...selectedKeys])}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                  action.variant === "danger"
                    ? "bg-[var(--red)]/10 text-[var(--red)] hover:bg-[var(--red)]/20 border border-[var(--red)]/20"
                    : "bg-[var(--card)] text-[var(--tx2)] hover:text-[var(--tx)] border border-[var(--brd)]"
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedKeys(new Set())}
              className="text-[10px] text-[var(--tx3)] hover:text-[var(--tx)] px-2 py-1.5 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Table header ── */}
      <div className={`overflow-x-auto ${stickyHeader ? "max-h-[calc(100vh-240px)] overflow-y-auto" : ""}`}>
        <table className="w-full border-collapse min-w-[600px]">
          <thead className={stickyHeader ? "sticky top-0 z-10 bg-[var(--bg)]" : ""}>
            <tr className="border-b border-[var(--brd)]/50">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-[var(--brd)] accent-[var(--gold)]"
                  />
                </th>
              )}
              {visibleCols.map((col) => {
                const isActive = sortCol === col.id;
                const isSortable = col.sortable !== false;
                return (
                  <th
                    key={col.id}
                    onClick={isSortable ? () => handleSort(col.id) : undefined}
                    className={`text-[9px] font-bold tracking-[0.12em] uppercase py-2.5 px-3 whitespace-nowrap select-none transition-colors ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    } ${
                      isSortable
                        ? "cursor-pointer hover:text-[var(--gold)]"
                        : ""
                    } ${
                      isActive
                        ? "text-[var(--gold)]"
                        : "text-[var(--tx3)]/60"
                    }`}
                    style={col.minWidth ? { minWidth: col.minWidth } : undefined}
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
                  className="py-16 text-center"
                >
                  {emptyIcon && <div className="flex justify-center mb-2">{emptyIcon}</div>}
                  <p className="text-[13px] text-[var(--tx3)]">{emptyMessage}</p>
                  {emptySubtext && (
                    <p className="text-[11px] text-[var(--tx3)]/60 mt-1">{emptySubtext}</p>
                  )}
                </td>
              </tr>
            ) : renderRow ? (
              paged.map((row) => (
                <tr key={getKey(row)}>
                  {selectable && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(getKey(row))}
                        onChange={() => toggleRow(getKey(row))}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-[var(--brd)] accent-[var(--gold)]"
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
                  className={`border-b border-[var(--brd)]/20 ${
                    onRowClick ? "cursor-pointer admin-row-hover" : ""
                  } ${selectable && selectedKeys.has(rowKey) ? "bg-[var(--gold)]/[0.04]" : ""} ${rowClassName ? rowClassName(row) : ""}`}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(rowKey)}
                        onChange={() => toggleRow(rowKey)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-[var(--brd)] accent-[var(--gold)]"
                      />
                    </td>
                  )}
                  {visibleCols.map((col) => (
                    <td
                      key={col.id}
                      className={`py-3 px-3 text-[12px] ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {col.render
                        ? col.render(row)
                        : <span className="capitalize">{String(col.accessor(row) ?? "—")}</span>}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
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
              className="p-1.5 rounded-md text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
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
                  className={`min-w-[28px] h-[28px] rounded-md text-[10px] font-semibold transition-colors ${
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
              className="p-1.5 rounded-md text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {/* Per page */}
            <div className="ml-2 flex items-center gap-1">
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
