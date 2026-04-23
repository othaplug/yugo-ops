"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type {
  FilterItem,
  FilterOperator,
  FilterState,
  FilterValue,
  GroupState,
  SortDirection,
  SortState,
  TableState,
  ViewState,
} from "../types"

/**
 * URL serialization format:
 *   ?{key}_sort=column:asc,column2:desc
 *   ?{key}_filter=column|op|value;column|op|value
 *   ?{key}_group=columnId
 *   ?{key}_view=viewId
 *   ?{key}_q=searchString
 *
 * Values are URI-encoded; arrays in filter values use `~` as the inner delimiter.
 * Kept compact enough to avoid ballooning URLs but still human-inspectable.
 */

const SORT_SEP = ","
const FILTER_SEP = ";"
const FILTER_TRIPLE_SEP = "|"
const ARRAY_SEP = "~"

const encodeSort = (sort: SortState): string =>
  sort.map((s) => `${s.columnId}:${s.direction}`).join(SORT_SEP)

const decodeSort = (raw: string | null): SortState => {
  if (!raw) return []
  return raw
    .split(SORT_SEP)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const [columnId, direction] = seg.split(":")
      if (!columnId) return null
      return {
        columnId,
        direction: (direction === "desc" ? "desc" : "asc") as SortDirection,
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
}

const encodeFilterValue = (value: FilterValue): string => {
  if (value === null || value === undefined) return ""
  if (Array.isArray(value)) return value.map(String).join(ARRAY_SEP)
  return String(value)
}

const decodeFilterValue = (raw: string): FilterValue => {
  if (!raw) return null
  if (raw.includes(ARRAY_SEP)) return raw.split(ARRAY_SEP)
  if (raw === "true") return true
  if (raw === "false") return false
  const asNumber = Number(raw)
  if (!Number.isNaN(asNumber) && raw.trim() !== "") return asNumber
  return raw
}

const encodeFilters = (filters: FilterState): string =>
  filters
    .map(
      (f) =>
        `${f.columnId}${FILTER_TRIPLE_SEP}${f.operator}${FILTER_TRIPLE_SEP}${encodeFilterValue(f.value)}`,
    )
    .join(FILTER_SEP)

const decodeFilters = (raw: string | null): FilterState => {
  if (!raw) return []
  return raw
    .split(FILTER_SEP)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg): FilterItem | null => {
      const [columnId, operator, ...rest] = seg.split(FILTER_TRIPLE_SEP)
      if (!columnId || !operator) return null
      const value = decodeFilterValue(rest.join(FILTER_TRIPLE_SEP) ?? "")
      return {
        columnId,
        operator: operator as FilterOperator,
        value,
      }
    })
    .filter((f): f is FilterItem => f !== null)
}

export type UseTableStateOptions = {
  stateKey: string
  defaultSort?: SortState
  defaultFilters?: FilterState
  defaultView?: string | null
  defaultGroup?: GroupState
  urlSync?: boolean
}

export type UseTableStateReturn = {
  state: TableState
  query: string
  setSort: (next: SortState) => void
  toggleSort: (columnId: string, options?: { append?: boolean }) => void
  setSortDirection: (
    columnId: string,
    direction: SortDirection | null,
    options?: { append?: boolean },
  ) => void
  setFilters: (next: FilterState) => void
  addFilter: (filter: FilterItem) => void
  removeFilter: (columnId: string, operator?: FilterOperator) => void
  clearFilters: () => void
  setGroup: (next: GroupState) => void
  setView: (next: ViewState) => void
  setQuery: (next: string) => void
}

const defaultGroupState: GroupState = { enabled: false, columnId: null }
const defaultViewState: ViewState = { id: null }

export const useTableState = ({
  stateKey,
  defaultSort = [],
  defaultFilters = [],
  defaultView = null,
  defaultGroup = defaultGroupState,
  urlSync = true,
}: UseTableStateOptions): UseTableStateReturn => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const keys = React.useMemo(
    () => ({
      sort: `${stateKey}_sort`,
      filter: `${stateKey}_filter`,
      group: `${stateKey}_group`,
      view: `${stateKey}_view`,
      query: `${stateKey}_q`,
    }),
    [stateKey],
  )

  // Local mirror for non-urlSync mode
  const [local, setLocal] = React.useState<TableState & { query: string }>(
    () => ({
      sort: defaultSort,
      filters: defaultFilters,
      group: defaultGroup,
      view: { id: defaultView ?? null },
      query: "",
    }),
  )

  const state = React.useMemo<TableState & { query: string }>(() => {
    if (!urlSync) return local

    const sortRaw = searchParams.get(keys.sort)
    const filterRaw = searchParams.get(keys.filter)
    const groupRaw = searchParams.get(keys.group)
    const viewRaw = searchParams.get(keys.view)
    const queryRaw = searchParams.get(keys.query) ?? ""

    return {
      sort: sortRaw !== null ? decodeSort(sortRaw) : defaultSort,
      filters: filterRaw !== null ? decodeFilters(filterRaw) : defaultFilters,
      group: groupRaw
        ? { enabled: true, columnId: groupRaw }
        : defaultGroup,
      view: { id: viewRaw || defaultView || null },
      query: queryRaw,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSync, local, searchParams, keys.sort, keys.filter, keys.group, keys.view, keys.query])

  const writeParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      if (!urlSync) {
        setLocal((prev) => {
          const next = { ...prev }
          if (keys.sort in updates) {
            next.sort = updates[keys.sort]
              ? decodeSort(updates[keys.sort])
              : []
          }
          if (keys.filter in updates) {
            next.filters = updates[keys.filter]
              ? decodeFilters(updates[keys.filter])
              : []
          }
          if (keys.group in updates) {
            next.group = updates[keys.group]
              ? { enabled: true, columnId: updates[keys.group] }
              : defaultGroupState
          }
          if (keys.view in updates) {
            next.view = { id: updates[keys.view] ?? null }
          }
          if (keys.query in updates) {
            next.query = updates[keys.query] ?? ""
          }
          return next
        })
        return
      }

      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [urlSync, keys, searchParams, router, pathname],
  )

  const setSort = React.useCallback(
    (next: SortState) => {
      writeParams({ [keys.sort]: next.length ? encodeSort(next) : null })
    },
    [keys.sort, writeParams],
  )

  const toggleSort = React.useCallback(
    (columnId: string, options?: { append?: boolean }) => {
      const append = options?.append ?? false
      const current = state.sort
      const existing = current.find((s) => s.columnId === columnId)

      let next: SortState
      if (append) {
        if (!existing) {
          next = [...current, { columnId, direction: "asc" }]
        } else if (existing.direction === "asc") {
          next = current.map((s) =>
            s.columnId === columnId ? { ...s, direction: "desc" as const } : s,
          )
        } else {
          next = current.filter((s) => s.columnId !== columnId)
        }
      } else {
        if (!existing) next = [{ columnId, direction: "asc" }]
        else if (existing.direction === "asc")
          next = [{ columnId, direction: "desc" }]
        else next = []
      }

      setSort(next)
    },
    [state.sort, setSort],
  )

  const setSortDirection = React.useCallback(
    (
      columnId: string,
      direction: SortDirection | null,
      options?: { append?: boolean },
    ) => {
      const append = options?.append ?? false
      const current = state.sort
      if (direction === null) {
        setSort(current.filter((s) => s.columnId !== columnId))
        return
      }
      if (append) {
        const exists = current.find((s) => s.columnId === columnId)
        const next = exists
          ? current.map((s) =>
              s.columnId === columnId ? { ...s, direction } : s,
            )
          : [...current, { columnId, direction }]
        setSort(next)
      } else {
        setSort([{ columnId, direction }])
      }
    },
    [state.sort, setSort],
  )

  const setFilters = React.useCallback(
    (next: FilterState) => {
      writeParams({ [keys.filter]: next.length ? encodeFilters(next) : null })
    },
    [keys.filter, writeParams],
  )

  const addFilter = React.useCallback(
    (filter: FilterItem) => {
      const exists = state.filters.find(
        (f) => f.columnId === filter.columnId && f.operator === filter.operator,
      )
      const next = exists
        ? state.filters.map((f) => (f === exists ? filter : f))
        : [...state.filters, filter]
      setFilters(next)
    },
    [state.filters, setFilters],
  )

  const removeFilter = React.useCallback(
    (columnId: string, operator?: FilterOperator) => {
      const next = state.filters.filter(
        (f) =>
          !(f.columnId === columnId && (!operator || f.operator === operator)),
      )
      setFilters(next)
    },
    [state.filters, setFilters],
  )

  const clearFilters = React.useCallback(() => setFilters([]), [setFilters])

  const setGroup = React.useCallback(
    (next: GroupState) => {
      writeParams({
        [keys.group]: next.enabled && next.columnId ? next.columnId : null,
      })
    },
    [keys.group, writeParams],
  )

  const setView = React.useCallback(
    (next: ViewState) => {
      writeParams({ [keys.view]: next.id ?? null })
    },
    [keys.view, writeParams],
  )

  const setQuery = React.useCallback(
    (next: string) => {
      writeParams({ [keys.query]: next ? next : null })
    },
    [keys.query, writeParams],
  )

  return {
    state: {
      sort: state.sort,
      filters: state.filters,
      group: state.group,
      view: state.view,
    },
    query: state.query,
    setSort,
    toggleSort,
    setSortDirection,
    setFilters,
    addFilter,
    removeFilter,
    clearFilters,
    setGroup,
    setView,
    setQuery,
  }
}
