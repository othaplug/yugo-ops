import type * as React from "react"

export type SortDir = "asc" | "desc"

export type ColumnSort = {
  columnId: string
  direction: SortDir
}

export type ColumnAlign = "left" | "right" | "center"

export type FilterKind = "text" | "select" | "multi-select" | "number" | "date-range" | "boolean"

export type FilterOption = {
  value: string
  label: string
}

export type ColumnFilter = {
  kind: FilterKind
  /** For select / multi-select */
  options?: FilterOption[]
  /** Runtime filter value(s) held by the table */
  value?: unknown
}

export type ColumnDef<Row> = {
  id: string
  header: React.ReactNode
  /** Compact label used in ColumnMenu + hide list */
  shortLabel?: string
  /** Column width in px (auto if omitted). */
  width?: number
  /** Column min width in px. */
  minWidth?: number
  /** Sticky to left (for ID/name columns). */
  sticky?: boolean
  align?: ColumnAlign
  sortable?: boolean
  filterable?: boolean
  filter?: ColumnFilter
  /** Render cell given row. */
  cell: (row: Row) => React.ReactNode
  /** Value used for global search / sort fallback */
  accessor?: (row: Row) => string | number | null | undefined
  /** Hide by default */
  hiddenByDefault?: boolean
  /** When true, the column cannot be hidden. */
  required?: boolean
  /** Suggested for "AI Analyze" menu — summarizes numeric cells. */
  numeric?: boolean
}

export type BulkAction<Row> = {
  id: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: (rows: Row[]) => boolean
  run: (rows: Row[]) => void | Promise<void>
}

export type RowAction<Row> = {
  id: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  run: (row: Row) => void | Promise<void>
}

export type SavedView = {
  id: string
  name: string
  /** Serialized state (sort, filters, hidden columns, search). */
  state: Record<string, unknown>
}

export type ViewMode = "list" | "board" | "pipeline"

export type StageTone =
  | "wine"
  | "forest"
  | "neutral"
  | "warning"
  | "success"
  | "danger"
  | "info"
