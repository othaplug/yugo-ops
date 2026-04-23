"use client"

import * as React from "react"
import { Checkbox } from "../../primitives/Checkbox"
import { cn } from "../../lib/cn"
import type { ColumnConfig } from "../types"

export type TableRowProps<T> = {
  row: T
  rowId: string
  columns: ColumnConfig<T>[]
  selectable?: boolean
  selected?: boolean
  hiddenColumns?: Set<string>
  onToggleSelect?: (
    id: string,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => void
  onRowClick?: (row: T, event: React.MouseEvent | React.KeyboardEvent) => void
  className?: string
  'data-index'?: number
}

const alignClassFor = (align?: "left" | "right" | "center") =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"

export const TableRow = <T,>({
  row,
  rowId,
  columns,
  selectable = true,
  selected,
  hiddenColumns,
  onToggleSelect,
  onRowClick,
  className,
  ...rest
}: TableRowProps<T>) => {
  const visible = columns.filter((c) => !hiddenColumns || !hiddenColumns.has(c.id))

  const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement
    if (
      target.closest('[data-row-stop="true"]') ||
      target.closest("button, a, input, [role='menu'], [role='menuitem']")
    ) {
      return
    }
    onRowClick?.(row, event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onRowClick?.(row, event)
    }
    if (event.key === " " && selectable) {
      event.preventDefault()
      onToggleSelect?.(rowId, event)
    }
  }

  return (
    <tr
      tabIndex={0}
      aria-selected={selected || undefined}
      data-state={selected ? "selected" : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group/row h-16 border-b border-line outline-none transition-colors",
        "focus-visible:bg-surface-subtle",
        selected
          ? "bg-accent-subtle hover:bg-accent-subtle"
          : "hover:bg-surface-subtle",
        "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {selectable ? (
        <td
          className="w-10 px-3 align-middle"
          data-row-stop="true"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-center">
            <Checkbox
              size="sm"
              checked={Boolean(selected)}
              onCheckedChange={() => {
                const evt = new MouseEvent("click") as unknown as React.MouseEvent
                onToggleSelect?.(rowId, evt)
              }}
              onClick={(event) => {
                event.stopPropagation()
                onToggleSelect?.(
                  rowId,
                  event as unknown as React.MouseEvent,
                )
              }}
              aria-label="Select row"
            />
          </div>
        </td>
      ) : null}

      {visible.map((column) => (
        <td
          key={column.id}
          className={cn(
            "px-3 align-middle",
            alignClassFor(column.align),
            column.sticky
              ? "sticky left-10 z-[1] bg-inherit"
              : "",
          )}
          style={{
            width:
              typeof column.width === "number"
                ? `${column.width}px`
                : column.width,
            minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
          }}
        >
          {column.render(row)}
        </td>
      ))}
    </tr>
  )
}
