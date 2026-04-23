"use client"

import * as React from "react"

export type UseTableSelectionOptions = {
  rowIds: string[]
}

export type HeaderSelectionState = "none" | "some" | "all"

export type UseTableSelectionReturn = {
  selection: Set<string>
  size: number
  isSelected: (id: string) => boolean
  toggle: (id: string, event?: React.MouseEvent | React.KeyboardEvent) => void
  selectAll: () => void
  clear: () => void
  toggleAll: () => void
  headerState: HeaderSelectionState
}

export const useTableSelection = ({
  rowIds,
}: UseTableSelectionOptions): UseTableSelectionReturn => {
  const [selection, setSelection] = React.useState<Set<string>>(
    () => new Set<string>(),
  )
  const lastSelectedRef = React.useRef<string | null>(null)

  const isSelected = React.useCallback(
    (id: string) => selection.has(id),
    [selection],
  )

  const toggle = React.useCallback(
    (id: string, event?: React.MouseEvent | React.KeyboardEvent) => {
      setSelection((prev) => {
        const next = new Set(prev)
        const last = lastSelectedRef.current

        if (event && "shiftKey" in event && event.shiftKey && last) {
          const startIdx = rowIds.indexOf(last)
          const endIdx = rowIds.indexOf(id)
          if (startIdx !== -1 && endIdx !== -1) {
            const [lo, hi] = startIdx < endIdx
              ? [startIdx, endIdx]
              : [endIdx, startIdx]
            const shouldSelect = !prev.has(id)
            for (let i = lo; i <= hi; i++) {
              const rowId = rowIds[i]!
              if (shouldSelect) next.add(rowId)
              else next.delete(rowId)
            }
            lastSelectedRef.current = id
            return next
          }
        }

        if (next.has(id)) next.delete(id)
        else next.add(id)
        lastSelectedRef.current = id
        return next
      })
    },
    [rowIds],
  )

  const selectAll = React.useCallback(() => {
    setSelection(new Set(rowIds))
  }, [rowIds])

  const clear = React.useCallback(() => {
    setSelection(new Set())
    lastSelectedRef.current = null
  }, [])

  const toggleAll = React.useCallback(() => {
    setSelection((prev) => {
      if (prev.size === 0) return new Set(rowIds)
      return new Set()
    })
    lastSelectedRef.current = null
  }, [rowIds])

  const headerState: HeaderSelectionState = React.useMemo(() => {
    if (selection.size === 0) return "none"
    if (rowIds.length > 0 && rowIds.every((id) => selection.has(id))) return "all"
    return "some"
  }, [selection, rowIds])

  // Prune selection when rowIds change (e.g., after filter)
  React.useEffect(() => {
    setSelection((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(rowIds)
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [rowIds])

  return {
    selection,
    size: selection.size,
    isSelected,
    toggle,
    selectAll,
    clear,
    toggleAll,
    headerState,
  }
}
