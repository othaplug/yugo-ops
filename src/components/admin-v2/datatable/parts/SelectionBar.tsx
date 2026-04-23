"use client"

import * as React from "react"
import { FloatingActionBar } from "../../layout/FloatingActionBar"
import type { BulkAction } from "../types"

export type SelectionBarProps<T> = {
  moduleLabel: string
  selection: Set<string>
  selectedRows: T[]
  actions: BulkAction<T>[]
  onClear?: () => void
}

export const SelectionBar = <T,>({
  moduleLabel,
  selection,
  selectedRows,
  actions,
  onClear,
}: SelectionBarProps<T>) => {
  const visible = selection.size > 0
  const floatingActions = React.useMemo(
    () =>
      actions.map((action) => ({
        id: action.id,
        label: action.label,
        destructive: action.destructive,
        disabled:
          typeof action.disabled === "function"
            ? action.disabled(selectedRows)
            : action.disabled,
        onClick: () => {
          void action.handler(selectedRows)
        },
      })),
    [actions, selectedRows],
  )

  return (
    <FloatingActionBar
      visible={visible}
      count={selection.size}
      countLabel={selection.size === 1 ? moduleLabel.replace(/s$/, "") : moduleLabel}
      actions={[
        ...floatingActions,
        ...(onClear
          ? [
              {
                id: "__clear__",
                label: "Clear",
                onClick: onClear,
              },
            ]
          : []),
      ]}
    />
  )
}
