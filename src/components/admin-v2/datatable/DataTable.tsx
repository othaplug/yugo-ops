"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  MagnifyingGlass,
  Rows,
  SquaresFour,
  FunnelSimple,
  Kanban,
  Warning,
  ArrowClockwise,
} from "@phosphor-icons/react"
import { Input } from "../primitives/Input"
import { Button } from "../primitives/Button"
import { Switch } from "../primitives/Switch"
import { ToggleGroup, ToggleGroupItem } from "../primitives/ToggleGroup"
import { EmptyState } from "../primitives/EmptyState"
import { Skeleton } from "../primitives/Skeleton"
import { cn } from "../lib/cn"
import type {
  BulkAction,
  ColumnConfig,
  RowKeyFn,
  SavedView,
} from "./types"
import { applyFilters, applyGroup, applySearch, applySort } from "./utils"
import { useTableState } from "./hooks/useTableState"
import { useTableSelection } from "./hooks/useTableSelection"
import { TableHeader } from "./parts/TableHeader"
import { TableRow } from "./parts/TableRow"
import { SelectionBar } from "./parts/SelectionBar"
import { FilterPopover, ActiveFilterChips } from "./parts/FilterPopover"
import { SavedViewsTabs } from "./parts/SavedViewsTabs"

export type TableViewMode = "list" | "board" | "pipeline"

export type DataTableProps<T> = {
  data: T[]
  columns: ColumnConfig<T>[]
  getRowId: RowKeyFn<T>
  stateKey: string
  moduleLabel?: string
  selectable?: boolean
  onRowClick?: (row: T) => void
  bulkActions?: BulkAction<T>[]
  savedViews?: SavedView[]
  defaultView?: string
  filterable?: boolean
  groupable?: boolean
  searchable?: boolean
  viewModes?: TableViewMode[]
  renderBoard?: (rows: T[]) => React.ReactNode
  renderPipeline?: (rows: T[]) => React.ReactNode
  renderMobileCard?: (row: T) => React.ReactNode
  emptyState?: React.ReactNode
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
  urlSync?: boolean
  className?: string
}

const ROW_HEIGHT = 64
const MOBILE_BP = 768
const VIRTUALIZATION_THRESHOLD = 100

export const DataTable = <T,>({
  data,
  columns,
  getRowId,
  stateKey,
  moduleLabel = "rows",
  selectable = true,
  onRowClick,
  bulkActions,
  savedViews = [],
  defaultView,
  filterable = true,
  groupable = true,
  searchable = true,
  viewModes = ["list"],
  renderBoard,
  renderPipeline,
  renderMobileCard,
  emptyState,
  loading,
  error,
  onRetry,
  urlSync = true,
  className,
}: DataTableProps<T>) => {
  const defaultSort = React.useMemo(
    () =>
      columns
        .filter((c) => c.defaultSort)
        .map((c) => ({ columnId: c.id, direction: c.defaultSort! })),
    [columns],
  )

  const {
    state,
    query,
    setSort,
    toggleSort,
    setSortDirection,
    setFilters,
    setGroup,
    setView,
    setQuery,
  } = useTableState({
    stateKey,
    defaultSort,
    defaultView: defaultView ?? null,
    urlSync,
  })

  const [viewMode, setViewMode] = React.useState<TableViewMode>("list")
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Apply active saved view
  const activeSavedView = React.useMemo(
    () => savedViews.find((v) => v.id === state.view.id) ?? null,
    [savedViews, state.view.id],
  )

  React.useEffect(() => {
    if (!activeSavedView) return
    setFilters(activeSavedView.filters)
    setSort(activeSavedView.sort)
    if (activeSavedView.group) setGroup(activeSavedView.group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSavedView?.id])

  // Responsive column visibility based on priority
  const visibleColumns = React.useMemo(() => {
    return columns.filter((col) => {
      if (hiddenColumns.has(col.id)) return false
      if (isMobile && col.priority !== "p1" && col.type !== "actions")
        return false
      return true
    })
  }, [columns, hiddenColumns, isMobile])

  // Derive processed rows
  const processedRows = React.useMemo(() => {
    let rows = data
    if (state.filters.length) rows = applyFilters(rows, state.filters, columns)
    if (query) rows = applySearch(rows, query, columns)
    if (state.sort.length) rows = applySort(rows, state.sort, columns)
    return rows
  }, [data, state.filters, state.sort, query, columns])

  const rowIds = React.useMemo(
    () => processedRows.map(getRowId),
    [processedRows, getRowId],
  )

  const selection = useTableSelection({ rowIds })

  const selectedRows = React.useMemo(
    () => processedRows.filter((row) => selection.isSelected(getRowId(row))),
    [processedRows, selection, getRowId],
  )

  const groups = React.useMemo(
    () =>
      state.group.enabled && state.group.columnId
        ? applyGroup(processedRows, state.group.columnId, columns)
        : null,
    [processedRows, state.group, columns],
  )

  const showPagedVirtualization =
    !groups && processedRows.length > VIRTUALIZATION_THRESHOLD && !isMobile

  // Top bar and controls
  const groupableColumns = columns.filter(
    (c) => c.groupable && c.type !== "actions",
  )

  const topBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
      {viewModes.length > 1 ? (
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value) setViewMode(value as TableViewMode)
          }}
        >
          {viewModes.includes("list") ? (
            <ToggleGroupItem value="list" aria-label="List view">
              <Rows className="size-3.5" weight="bold" />
              List
            </ToggleGroupItem>
          ) : null}
          {viewModes.includes("board") ? (
            <ToggleGroupItem value="board" aria-label="Board view">
              <SquaresFour className="size-3.5" weight="bold" />
              Board
            </ToggleGroupItem>
          ) : null}
          {viewModes.includes("pipeline") ? (
            <ToggleGroupItem value="pipeline" aria-label="Pipeline view">
              <Kanban className="size-3.5" weight="bold" />
              Pipeline
            </ToggleGroupItem>
          ) : null}
        </ToggleGroup>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-2">
        {groupable && groupableColumns.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="body-sm text-fg-muted">Group</span>
            <Switch
              checked={state.group.enabled}
              onCheckedChange={(checked) => {
                setGroup({
                  enabled: Boolean(checked),
                  columnId: checked
                    ? state.group.columnId ?? groupableColumns[0]!.id
                    : state.group.columnId,
                })
              }}
              aria-label="Toggle grouping"
            />
            {state.group.enabled ? (
              <select
                value={state.group.columnId ?? groupableColumns[0]!.id}
                onChange={(event) =>
                  setGroup({ enabled: true, columnId: event.target.value })
                }
                className="h-8 rounded-sm border border-line-strong bg-surface px-2 body-sm text-fg outline-none focus:border-accent"
              >
                {groupableColumns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.header}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        {searchable ? (
          <Input
            size="sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            containerClassName="w-64"
            leadingIcon={<MagnifyingGlass className="size-3.5" />}
          />
        ) : null}

        {filterable ? (
          <FilterPopover
            columns={columns}
            filters={state.filters}
            onChange={setFilters}
            trigger={
              <Button
                size="sm"
                variant="secondary"
                aria-label="Filter"
                leadingIcon={<FunnelSimple className="size-3.5" weight="bold" />}
              >
                Filter
                {state.filters.length > 0 ? (
                  <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white">
                    {state.filters.length}
                  </span>
                ) : null}
              </Button>
            }
          />
        ) : null}
      </div>
    </div>
  )

  const savedTabs =
    savedViews.length > 0 ? (
      <SavedViewsTabs
        views={savedViews}
        activeId={state.view.id}
        onSelect={(id) => setView({ id })}
      />
    ) : null

  const activeFilterRow =
    state.filters.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <ActiveFilterChips
          filters={state.filters}
          columns={columns}
          onRemove={(index) =>
            setFilters(state.filters.filter((_, i) => i !== index))
          }
        />
        <button
          type="button"
          onClick={() => setFilters([])}
          className="body-xs text-fg-muted hover:text-fg"
        >
          Clear
        </button>
      </div>
    ) : null

  // ---- Body renderers ----
  const tableCols = visibleColumns
  const handleHideColumn = (columnId: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      next.add(columnId)
      return next
    })
  }

  const renderTableBody = (rows: T[]) => (
    <tbody>
      {rows.map((row) => {
        const id = getRowId(row)
        return (
          <TableRow
            key={id}
            row={row}
            rowId={id}
            columns={tableCols}
            selectable={selectable}
            selected={selection.isSelected(id)}
            onToggleSelect={(rid, event) => selection.toggle(rid, event)}
            onRowClick={onRowClick}
          />
        )
      })}
    </tbody>
  )

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: showPagedVirtualization ? processedRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const renderVirtualizedTable = () => {
    const items = rowVirtualizer.getVirtualItems()
    const totalSize = rowVirtualizer.getTotalSize()
    const paddingTop = items.length > 0 ? items[0]!.start : 0
    const paddingBottom =
      items.length > 0 ? totalSize - items[items.length - 1]!.end : 0

    return (
      <div
        ref={scrollRef}
        className="relative max-h-[640px] overflow-y-auto overflow-x-auto"
      >
        <table className="w-full border-separate border-spacing-0">
          <TableHeader
            columns={tableCols}
            sort={state.sort}
            selectable={selectable}
            selectionState={selection.headerState}
            onToggleAll={selection.toggleAll}
            onToggleSort={toggleSort}
            onSetSortDirection={setSortDirection}
            onHideColumn={handleHideColumn}
            hiddenColumns={hiddenColumns}
          />
          <tbody>
            {paddingTop > 0 ? (
              <tr style={{ height: `${paddingTop}px` }}>
                <td colSpan={tableCols.length + (selectable ? 1 : 0)} />
              </tr>
            ) : null}
            {items.map((virtualRow) => {
              const row = processedRows[virtualRow.index]!
              const id = getRowId(row)
              return (
                <TableRow
                  key={id}
                  row={row}
                  rowId={id}
                  columns={tableCols}
                  selectable={selectable}
                  selected={selection.isSelected(id)}
                  onToggleSelect={(rid, event) => selection.toggle(rid, event)}
                  onRowClick={onRowClick}
                />
              )
            })}
            {paddingBottom > 0 ? (
              <tr style={{ height: `${paddingBottom}px` }}>
                <td colSpan={tableCols.length + (selectable ? 1 : 0)} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    )
  }

  const renderSimpleTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <TableHeader
          columns={tableCols}
          sort={state.sort}
          selectable={selectable}
          selectionState={selection.headerState}
          onToggleAll={selection.toggleAll}
          onToggleSort={toggleSort}
          onSetSortDirection={setSortDirection}
          onHideColumn={handleHideColumn}
          hiddenColumns={hiddenColumns}
        />
        {renderTableBody(processedRows)}
      </table>
    </div>
  )

  const renderGroupedTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <TableHeader
          columns={tableCols}
          sort={state.sort}
          selectable={selectable}
          selectionState={selection.headerState}
          onToggleAll={selection.toggleAll}
          onToggleSort={toggleSort}
          onSetSortDirection={setSortDirection}
          onHideColumn={handleHideColumn}
          hiddenColumns={hiddenColumns}
        />
        {groups?.map((group) => (
          <React.Fragment key={group.id}>
            <tbody>
              <tr className="bg-surface-subtle">
                <td
                  colSpan={tableCols.length + (selectable ? 1 : 0)}
                  className="px-4 py-2 label-md text-fg-muted"
                >
                  {group.label}
                  <span className="ml-2 text-fg-subtle">({group.rows.length})</span>
                </td>
              </tr>
            </tbody>
            {renderTableBody(group.rows)}
          </React.Fragment>
        ))}
      </table>
    </div>
  )

  const renderMobileList = () => (
    <ul className="divide-y divide-line">
      {processedRows.map((row) => {
        const id = getRowId(row)
        const selected = selection.isSelected(id)
        const defaultCard = (
          <div className="space-y-1.5">
            {tableCols.map((col) => (
              <div
                key={col.id}
                className="flex items-start justify-between gap-3"
              >
                <span className="label-md text-fg-subtle shrink-0 min-w-[84px]">
                  {col.header}
                </span>
                <div className="text-right min-w-0 flex-1">
                  {col.render(row)}
                </div>
              </div>
            ))}
          </div>
        )
        return (
          <li
            key={id}
            tabIndex={0}
            role="button"
            onClick={() => onRowClick?.(row)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRowClick?.(row)
            }}
            className={cn(
              "cursor-pointer px-4 py-4 transition-colors outline-none",
              selected
                ? "bg-accent-subtle"
                : "bg-surface hover:bg-surface-subtle",
              "focus-visible:bg-surface-subtle",
            )}
          >
            {renderMobileCard ? renderMobileCard(row) : defaultCard}
          </li>
        )
      })}
    </ul>
  )

  // ---- Main state branches ----
  let body: React.ReactNode

  if (error) {
    body = (
      <EmptyState
        icon={<Warning className="size-5" weight="bold" />}
        title="Something went wrong"
        description={error.message || "Unable to load data."}
        action={
          onRetry ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={onRetry}
              leadingIcon={<ArrowClockwise className="size-3.5" weight="bold" />}
            >
              Retry
            </Button>
          ) : undefined
        }
      />
    )
  } else if (loading) {
    body = (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} height={ROW_HEIGHT - 8} />
        ))}
      </div>
    )
  } else if (processedRows.length === 0) {
    body =
      emptyState ?? (
        <EmptyState
          title={`No ${moduleLabel.toLowerCase()} to show`}
          description="Try adjusting filters or search."
        />
      )
  } else if (viewMode === "board" && renderBoard) {
    body = <div className="p-4">{renderBoard(processedRows)}</div>
  } else if (viewMode === "pipeline" && renderPipeline) {
    body = <div className="p-4">{renderPipeline(processedRows)}</div>
  } else if (isMobile) {
    body = renderMobileList()
  } else if (groups) {
    body = renderGroupedTable()
  } else if (showPagedVirtualization) {
    body = renderVirtualizedTable()
  } else {
    body = renderSimpleTable()
  }

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border border-line bg-surface",
        className,
      )}
    >
      {savedTabs}
      {topBar}
      {activeFilterRow}
      <div className="flex-1">{body}</div>

      {bulkActions && bulkActions.length > 0 ? (
        <SelectionBar
          moduleLabel={moduleLabel}
          selection={selection.selection}
          selectedRows={selectedRows}
          actions={bulkActions}
          onClear={selection.clear}
        />
      ) : null}
    </div>
  )
}
