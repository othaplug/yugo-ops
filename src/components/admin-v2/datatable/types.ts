import type * as React from "react"

export type ColumnType =
  | "identity"
  | "chip"
  | "numeric"
  | "sparkline"
  | "indicator"
  | "date"
  | "progress"
  | "text"
  | "actions"

export type ColumnPriority = "p1" | "p2" | "p3"

export type SortDirection = "asc" | "desc"

export type StringOperator = "is" | "contains" | "starts_with"
export type NumberOperator = "eq" | "gt" | "lt" | "between"
export type DateOperator = "is" | "before" | "after" | "between"
export type ChipOperator = "is" | "is_not"
export type BooleanOperator = "is"

export type FilterOperator =
  | StringOperator
  | NumberOperator
  | DateOperator
  | ChipOperator
  | BooleanOperator

export type FilterValue = string | number | boolean | null | Array<string | number>

export type ColumnConfig<T> = {
  id: string
  type: ColumnType
  header: string
  priority: ColumnPriority
  width?: number | string
  minWidth?: number
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  align?: "left" | "right" | "center"
  defaultSort?: SortDirection
  sticky?: boolean
  render: (row: T) => React.ReactNode
  /**
   * Returns the raw value used for sorting, filtering, and grouping.
   * Must be stable and cheap. Defaults to `undefined` which falls back
   * to the first string in `render` output — provide this for anything
   * beyond trivial text columns.
   */
  value?: (row: T) => string | number | boolean | Date | null | undefined
  /**
   * Human-readable options shown in the header filter menu when column is
   * chip-like. If omitted, auto-derived from data.
   */
  options?: Array<{ label: string; value: string }>
}

export type SortItem = {
  columnId: string
  direction: SortDirection
}

export type SortState = SortItem[]

export type FilterItem = {
  columnId: string
  operator: FilterOperator
  value: FilterValue
}

export type FilterState = FilterItem[]

export type GroupState = {
  enabled: boolean
  columnId: string | null
}

export type ViewState = {
  id: string | null
}

export type SelectionState = Set<string>

export type TableState = {
  sort: SortState
  filters: FilterState
  group: GroupState
  view: ViewState
}

export type BulkAction<T> = {
  id: string
  label: string
  destructive?: boolean
  disabled?: boolean | ((rows: T[]) => boolean)
  handler: (rows: T[]) => void | Promise<void>
}

export type RowAction<T> = {
  id: string
  label: string
  destructive?: boolean
  handler: (row: T) => void | Promise<void>
  shortcut?: string
  leadingIcon?: React.ReactNode
}

export type SavedView = {
  id: string
  label: string
  filters: FilterState
  sort: SortState
  group?: GroupState
}

export type GroupedRows<T> = {
  id: string
  label: string
  rows: T[]
}

export type RowKeyFn<T> = (row: T) => string
