import type {
  ColumnConfig,
  FilterItem,
  FilterState,
  GroupedRows,
  SortState,
} from "./types"

const toComparable = (value: unknown): number | string | null => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value === "number") return value
  return String(value).toLowerCase()
}

const readValue = <T>(row: T, column: ColumnConfig<T> | undefined) => {
  if (!column) return undefined
  if (column.value) return column.value(row)
  return undefined
}

export const applySort = <T>(
  rows: T[],
  sort: SortState,
  columns: ColumnConfig<T>[],
): T[] => {
  if (!sort.length) return rows
  const colsById = new Map(columns.map((c) => [c.id, c]))
  const withIndex = rows.map((row, index) => ({ row, index }))

  withIndex.sort((a, b) => {
    for (const { columnId, direction } of sort) {
      const column = colsById.get(columnId)
      if (!column) continue
      const av = toComparable(readValue(a.row, column))
      const bv = toComparable(readValue(b.row, column))
      if (av === bv) continue
      if (av === null) return 1
      if (bv === null) return -1
      const cmp = av < bv ? -1 : 1
      return direction === "asc" ? cmp : -cmp
    }
    return a.index - b.index
  })

  return withIndex.map((item) => item.row)
}

const matchesFilterItem = <T>(
  row: T,
  filter: FilterItem,
  column: ColumnConfig<T> | undefined,
): boolean => {
  if (!column) return true
  const raw = readValue(row, column)
  const value = filter.value

  switch (filter.operator) {
    case "is": {
      if (raw === null || raw === undefined) return value === null
      if (value instanceof Array) return value.includes(String(raw))
      return String(raw).toLowerCase() === String(value).toLowerCase()
    }
    case "is_not": {
      if (raw === null || raw === undefined) return value !== null
      if (value instanceof Array) return !value.includes(String(raw))
      return String(raw).toLowerCase() !== String(value).toLowerCase()
    }
    case "contains":
      if (raw === null || raw === undefined) return false
      return String(raw).toLowerCase().includes(String(value).toLowerCase())
    case "starts_with":
      if (raw === null || raw === undefined) return false
      return String(raw).toLowerCase().startsWith(String(value).toLowerCase())
    case "eq":
      return Number(raw) === Number(value)
    case "gt":
      return Number(raw) > Number(value)
    case "lt":
      return Number(raw) < Number(value)
    case "between": {
      if (!Array.isArray(value) || value.length !== 2) return true
      const [lo, hi] = value as [number, number]
      const n = Number(raw)
      return n >= Number(lo) && n <= Number(hi)
    }
    case "before":
    case "after": {
      const rawTs =
        raw instanceof Date
          ? raw.getTime()
          : raw
            ? new Date(raw as string).getTime()
            : NaN
      const target =
        value instanceof Date
          ? value.getTime()
          : value
            ? new Date(value as string).getTime()
            : NaN
      if (Number.isNaN(rawTs) || Number.isNaN(target)) return false
      return filter.operator === "before" ? rawTs < target : rawTs > target
    }
    default:
      return true
  }
}

export const applyFilters = <T>(
  rows: T[],
  filters: FilterState,
  columns: ColumnConfig<T>[],
): T[] => {
  if (!filters.length) return rows
  const colsById = new Map(columns.map((c) => [c.id, c]))
  return rows.filter((row) =>
    filters.every((f) => matchesFilterItem(row, f, colsById.get(f.columnId))),
  )
}

export const applySearch = <T>(
  rows: T[],
  query: string,
  columns: ColumnConfig<T>[],
): T[] => {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  const searchableColumns = columns.filter(
    (c) => c.type !== "actions" && c.type !== "sparkline" && c.type !== "indicator",
  )
  return rows.filter((row) =>
    searchableColumns.some((col) => {
      const v = col.value ? col.value(row) : undefined
      if (v === null || v === undefined) return false
      return String(v).toLowerCase().includes(q)
    }),
  )
}

export const applyGroup = <T>(
  rows: T[],
  columnId: string | null,
  columns: ColumnConfig<T>[],
): GroupedRows<T>[] | null => {
  if (!columnId) return null
  const column = columns.find((c) => c.id === columnId)
  if (!column) return null
  const map = new Map<string, { label: string; rows: T[] }>()
  for (const row of rows) {
    const raw = readValue(row, column)
    const key = raw === null || raw === undefined ? "__none__" : String(raw)
    const label = key === "__none__" ? "Ungrouped" : String(raw)
    const entry = map.get(key)
    if (entry) {
      entry.rows.push(row)
    } else {
      map.set(key, { label, rows: [row] })
    }
  }
  return Array.from(map.entries()).map(([id, { label, rows }]) => ({
    id,
    label,
    rows,
  }))
}
