"use client"

import * as React from "react"
import { Funnel, Plus, X } from "@phosphor-icons/react"
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "../../primitives/Popover"
import { Button } from "../../primitives/Button"
import { Input } from "../../primitives/Input"
import { Chip } from "../../primitives/Chip"
import { Badge } from "../../primitives/Badge"
import { cn } from "../../lib/cn"
import type {
  ColumnConfig,
  ColumnType,
  FilterItem,
  FilterOperator,
  FilterState,
  FilterValue,
} from "../types"

const operatorsForType = (
  type: ColumnType,
): { value: FilterOperator; label: string }[] => {
  switch (type) {
    case "numeric":
    case "progress":
    case "sparkline":
      return [
        { value: "eq", label: "Equals" },
        { value: "gt", label: "Greater than" },
        { value: "lt", label: "Less than" },
      ]
    case "date":
      return [
        { value: "is", label: "On" },
        { value: "before", label: "Before" },
        { value: "after", label: "After" },
      ]
    case "chip":
    case "indicator":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
      ]
    case "identity":
    case "text":
    default:
      return [
        { value: "is", label: "Is" },
        { value: "contains", label: "Contains" },
        { value: "starts_with", label: "Starts with" },
      ]
  }
}

export type FilterPopoverProps<T> = {
  columns: ColumnConfig<T>[]
  filters: FilterState
  onChange: (next: FilterState) => void
  onSaveView?: (label: string) => void
  trigger?: React.ReactNode
}

export const FilterPopover = <T,>({
  columns,
  filters,
  onChange,
  onSaveView,
  trigger,
}: FilterPopoverProps<T>) => {
  const filterable = columns.filter((c) => c.filterable !== false && c.type !== "actions")
  const colsById = React.useMemo(
    () => new Map(filterable.map((c) => [c.id, c])),
    [filterable],
  )

  const updateFilter = (index: number, patch: Partial<FilterItem>) => {
    const next = filters.map((f, i) => (i === index ? { ...f, ...patch } : f))
    onChange(next)
  }

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index))
  }

  const addFilter = () => {
    const col = filterable[0]
    if (!col) return
    onChange([
      ...filters,
      {
        columnId: col.id,
        operator: operatorsForType(col.type)[0]!.value,
        value: "",
      },
    ])
  }

  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            variant="secondary"
            leadingIcon={<Funnel className="size-3.5" />}
          >
            Filter
            {filters.length > 0 ? (
              <Badge tone="accent" className="ml-1">
                {filters.length}
              </Badge>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="heading-sm text-fg">Filters</p>
          {filters.length > 0 ? (
            <button
              type="button"
              className="body-xs text-fg-muted hover:text-fg"
              onClick={() => onChange([])}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {filters.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="body-sm text-fg-muted">No filters applied.</p>
          </div>
        ) : (
          <div className="max-h-[360px] space-y-2 overflow-y-auto px-4 py-3">
            {filters.map((filter, index) => {
              const column = colsById.get(filter.columnId) ?? filterable[0]!
              const operators = operatorsForType(column.type)
              return (
                <div key={index} className="flex items-center gap-2">
                  <select
                    value={filter.columnId}
                    onChange={(event) => {
                      const nextCol = colsById.get(event.target.value)
                      if (!nextCol) return
                      const ops = operatorsForType(nextCol.type)
                      updateFilter(index, {
                        columnId: nextCol.id,
                        operator: ops[0]!.value,
                        value: "",
                      })
                    }}
                    className="h-8 rounded-sm border border-line-strong bg-surface px-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    {filterable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.header}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(event) =>
                      updateFilter(index, {
                        operator: event.target.value as FilterOperator,
                      })
                    }
                    className="h-8 rounded-sm border border-line-strong bg-surface px-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    size="sm"
                    className="flex-1"
                    value={String(filter.value ?? "")}
                    onChange={(event) =>
                      updateFilter(index, {
                        value: coerceValue(event.target.value, column.type),
                      })
                    }
                    placeholder="Value"
                  />
                  <button
                    type="button"
                    aria-label="Remove filter"
                    className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-surface-subtle hover:text-fg"
                    onClick={() => removeFilter(index)}
                  >
                    <X className="size-3.5" weight="bold" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Plus className="size-3.5" weight="bold" />}
            onClick={addFilter}
          >
            Add filter
          </Button>
          {onSaveView && filters.length > 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const label = window.prompt("Save view as")
                if (label) onSaveView(label)
              }}
            >
              Save as view
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </PopoverRoot>
  )
}

const coerceValue = (raw: string, type: ColumnType): FilterValue => {
  if (type === "numeric" || type === "progress" || type === "sparkline") {
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
  }
  return raw
}

export const ActiveFilterChips = <T,>({
  filters,
  columns,
  onRemove,
}: {
  filters: FilterState
  columns: ColumnConfig<T>[]
  onRemove: (index: number) => void
}) => {
  if (!filters.length) return null
  const colsById = new Map(columns.map((c) => [c.id, c]))
  return (
    <div className={cn("flex flex-wrap items-center gap-2")}>
      {filters.map((f, index) => {
        const column = colsById.get(f.columnId)
        const label = column
          ? `${column.header} ${f.operator.replace(/_/g, " ")} ${String(f.value)}`
          : `${f.columnId} ${f.operator} ${String(f.value)}`
        return (
          <button
            key={`${f.columnId}-${f.operator}-${index}`}
            type="button"
            onClick={() => onRemove(index)}
            className="inline-flex items-center"
          >
            <Chip label={label.toUpperCase()} variant="neutral" />
            <span className="sr-only">Remove filter</span>
          </button>
        )
      })}
    </div>
  )
}
