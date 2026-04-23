"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ArrowsDownUp,
  CaretDown,
  EyeSlash,
  Funnel,
  MagnifyingGlass,
  Sparkle,
} from "@phosphor-icons/react"
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../../primitives/Dropdown"
import { Checkbox } from "../../primitives/Checkbox"
import { cn } from "../../lib/cn"
import type { ColumnConfig, SortDirection, SortState } from "../types"

type HeaderCheckboxState = "none" | "some" | "all"

export type TableHeaderProps<T> = {
  columns: ColumnConfig<T>[]
  sort: SortState
  selectable?: boolean
  selectionState?: HeaderCheckboxState
  onToggleAll?: () => void
  onToggleSort: (columnId: string, options?: { append?: boolean }) => void
  onSetSortDirection: (
    columnId: string,
    direction: SortDirection | null,
    options?: { append?: boolean },
  ) => void
  onAiAnalyze?: (columnId: string) => void
  onFilterColumn?: (columnId: string) => void
  onHideColumn?: (columnId: string) => void
  hiddenColumns?: Set<string>
  hasActionsColumn?: boolean
  className?: string
}

const indexForSort = (columnId: string, sort: SortState) =>
  sort.findIndex((s) => s.columnId === columnId)

export const TableHeader = <T,>({
  columns,
  sort,
  selectable = true,
  selectionState = "none",
  onToggleAll,
  onToggleSort,
  onSetSortDirection,
  onAiAnalyze,
  onFilterColumn,
  onHideColumn,
  hiddenColumns,
  hasActionsColumn,
  className,
}: TableHeaderProps<T>) => {
  const visibleColumns = columns.filter(
    (c) => !hiddenColumns || !hiddenColumns.has(c.id),
  )

  return (
    <thead
      className={cn(
        "sticky top-0 z-10 bg-surface-subtle border-b border-line",
        className,
      )}
    >
      <tr className="h-11">
        {selectable ? (
          <th
            scope="col"
            className="w-10 px-3 text-left align-middle"
            aria-label="Select all"
          >
            <div className="flex items-center justify-center">
              <Checkbox
                size="sm"
                checked={
                  selectionState === "all"
                    ? true
                    : selectionState === "some"
                      ? "indeterminate"
                      : false
                }
                onCheckedChange={() => onToggleAll?.()}
                aria-label="Select all rows"
              />
            </div>
          </th>
        ) : null}

        {visibleColumns.map((column) => {
          const sortIdx = indexForSort(column.id, sort)
          const active = sortIdx !== -1
          const direction = active ? sort[sortIdx]!.direction : null
          const alignClass =
            column.align === "right"
              ? "justify-end text-right"
              : column.align === "center"
                ? "justify-center text-center"
                : "justify-start text-left"
          const isActionsCol = column.type === "actions"

          const inner = (
            <span
              className={cn(
                "inline-flex w-full items-center gap-1.5 select-none",
                alignClass,
                column.sortable !== false && !isActionsCol
                  ? "cursor-pointer hover:text-fg"
                  : "",
              )}
            >
              <span className="label-md text-fg-muted truncate">
                {column.header}
              </span>
              {active ? (
                <span className="inline-flex items-center gap-1 text-fg">
                  {direction === "asc" ? (
                    <ArrowUp className="size-3" weight="bold" aria-hidden />
                  ) : (
                    <ArrowDown className="size-3" weight="bold" aria-hidden />
                  )}
                  {sort.length > 1 ? (
                    <span className="body-xs tabular-nums text-fg-muted">
                      {sortIdx + 1}
                    </span>
                  ) : null}
                </span>
              ) : column.sortable !== false && !isActionsCol ? (
                <CaretDown
                  className="size-3 text-fg-subtle opacity-0 group-hover/th:opacity-100"
                  weight="bold"
                  aria-hidden
                />
              ) : null}
            </span>
          )

          return (
            <th
              key={column.id}
              scope="col"
              className={cn(
                "group/th px-3 align-middle",
                isActionsCol && hasActionsColumn ? "w-24" : "",
                column.sticky ? "sticky left-10 z-[1] bg-surface-subtle" : "",
              )}
              style={{
                width:
                  typeof column.width === "number"
                    ? `${column.width}px`
                    : column.width,
                minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
              }}
            >
              {isActionsCol ? (
                <span className="sr-only">Actions</span>
              ) : column.sortable === false ? (
                inner
              ) : (
                <DropdownRoot>
                  <DropdownTrigger asChild>
                    <button
                      type="button"
                      className="w-full outline-none"
                      onClick={(event) => {
                        if (event.shiftKey) {
                          event.preventDefault()
                          onToggleSort(column.id, { append: true })
                        }
                      }}
                    >
                      {inner}
                    </button>
                  </DropdownTrigger>
                  <DropdownContent align="start" sideOffset={4}>
                    <div className="px-2 pb-2 pt-1">
                      <div className="flex h-8 items-center gap-2 rounded-sm border border-line bg-surface px-2 body-sm">
                        <MagnifyingGlass
                          className="size-3.5 text-fg-subtle"
                          aria-hidden
                        />
                        <span className="text-fg-subtle">Search...</span>
                      </div>
                    </div>
                    <DropdownSeparator />
                    {onAiAnalyze ? (
                      <DropdownItem
                        leadingIcon={
                          <Sparkle className="size-3.5 text-accent" weight="fill" />
                        }
                        onSelect={() => onAiAnalyze(column.id)}
                      >
                        AI analyze
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      leadingIcon={<ArrowUp className="size-3.5" weight="bold" />}
                      onSelect={() => onSetSortDirection(column.id, "asc")}
                    >
                      Sort ascending
                    </DropdownItem>
                    <DropdownItem
                      leadingIcon={<ArrowDown className="size-3.5" weight="bold" />}
                      onSelect={() => onSetSortDirection(column.id, "desc")}
                    >
                      Sort descending
                    </DropdownItem>
                    {column.filterable !== false ? (
                      <DropdownItem
                        leadingIcon={<Funnel className="size-3.5" />}
                        onSelect={() => onFilterColumn?.(column.id)}
                      >
                        Filter
                      </DropdownItem>
                    ) : null}
                    <DropdownSeparator />
                    {active ? (
                      <DropdownItem
                        leadingIcon={
                          <ArrowsDownUp className="size-3.5" weight="bold" />
                        }
                        onSelect={() => onSetSortDirection(column.id, null)}
                      >
                        Clear sort
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      leadingIcon={<EyeSlash className="size-3.5" />}
                      onSelect={() => onHideColumn?.(column.id)}
                    >
                      Hide column
                    </DropdownItem>
                  </DropdownContent>
                </DropdownRoot>
              )}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
