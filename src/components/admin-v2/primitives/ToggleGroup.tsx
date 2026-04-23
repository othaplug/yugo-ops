"use client"

import * as React from "react"
import * as RadixToggleGroup from "@radix-ui/react-toggle-group"
import { cn } from "../lib/cn"

export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Root>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Root>
>(({ className, ...props }, ref) => (
  <RadixToggleGroup.Root
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle p-1",
      className,
    )}
    {...props}
  />
))
ToggleGroup.displayName = "ToggleGroup"

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Item>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Item>
>(({ className, ...props }, ref) => (
  <RadixToggleGroup.Item
    ref={ref}
    className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 body-sm font-medium text-fg-muted transition-colors outline-none",
      "hover:text-fg",
      "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm",
      "focus-visible:ring-2 focus-visible:ring-accent/30",
      className,
    )}
    {...props}
  />
))
ToggleGroupItem.displayName = "ToggleGroupItem"
