"use client"

import * as React from "react"
import * as C from "@radix-ui/react-checkbox"
import { cn } from "../lib/cn"
import { Check } from "../icons"

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof C.Root> {
  indeterminate?: boolean
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof C.Root>,
  CheckboxProps
>(({ className, indeterminate, ...rest }, ref) => (
  <C.Root
    ref={ref}
    className={cn(
      "peer h-[16px] w-[16px] shrink-0 rounded-[4px] border border-[var(--yu3-line-strong)]",
      "bg-[var(--yu3-bg-surface)] text-[var(--yu3-on-wine)]",
      "transition-colors duration-[var(--yu3-dur-1)]",
      "hover:border-[var(--yu3-wine)]",
      "data-[state=checked]:bg-[var(--yu3-wine)] data-[state=checked]:border-[var(--yu3-wine)]",
      "data-[state=indeterminate]:bg-[var(--yu3-wine)] data-[state=indeterminate]:border-[var(--yu3-wine)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      className,
    )}
    checked={indeterminate ? "indeterminate" : rest.checked}
    {...rest}
  >
    <C.Indicator className="flex items-center justify-center">
      {indeterminate ? (
        <span className="block h-[2px] w-[8px] bg-current rounded-sm" />
      ) : (
        <Check size={12} weight="bold" />
      )}
    </C.Indicator>
  </C.Root>
))
Checkbox.displayName = "Checkbox"
