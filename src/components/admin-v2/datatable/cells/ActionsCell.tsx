"use client"

import * as React from "react"
import { DotsThree } from "@phosphor-icons/react"
import { Button } from "../../primitives/Button"
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../../primitives/Dropdown"
import type { RowAction } from "../types"
import { cn } from "../../lib/cn"

export type ActionsCellProps<T> = {
  row: T
  primary?: Pick<RowAction<T>, "id" | "label" | "handler">
  actions?: RowAction<T>[]
  alwaysVisible?: boolean
  className?: string
}

export const ActionsCell = <T,>({
  row,
  primary,
  actions,
  alwaysVisible,
  className,
}: ActionsCellProps<T>) => {
  if (!primary && (!actions || actions.length === 0)) return null

  const handleClick = (
    event: React.MouseEvent,
    handler: (row: T) => void | Promise<void>,
  ) => {
    event.stopPropagation()
    void handler(row)
  }

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-1",
        alwaysVisible ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity",
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {primary ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={(event) => handleClick(event, primary.handler)}
        >
          {primary.label}
        </Button>
      ) : null}
      {actions && actions.length > 0 ? (
        <DropdownRoot>
          <DropdownTrigger asChild>
            <Button
              size="iconSm"
              variant="ghost"
              aria-label="Row actions"
              onClick={(event) => event.stopPropagation()}
            >
              <DotsThree className="size-4" weight="bold" />
            </Button>
          </DropdownTrigger>
          <DropdownContent align="end">
            {actions.map((action, index) => {
              const divider =
                index > 0 &&
                actions[index - 1]!.destructive !== action.destructive &&
                action.destructive
              return (
                <React.Fragment key={action.id}>
                  {divider ? <DropdownSeparator /> : null}
                  <DropdownItem
                    destructive={action.destructive}
                    leadingIcon={action.leadingIcon}
                    shortcut={action.shortcut}
                    onSelect={(event) => {
                      event.preventDefault()
                      void action.handler(row)
                    }}
                  >
                    {action.label}
                  </DropdownItem>
                </React.Fragment>
              )
            })}
          </DropdownContent>
        </DropdownRoot>
      ) : null}
    </div>
  )
}
