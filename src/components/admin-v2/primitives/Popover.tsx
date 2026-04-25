"use client"

import * as React from "react"
import * as RadixPopover from "@radix-ui/react-popover"
import { useYu3PortalContainer } from "@/design-system/admin/layout/Yu3PortalContext"
import { cn } from "../lib/cn"

export const PopoverRoot = RadixPopover.Root
export const PopoverTrigger = RadixPopover.Trigger
export const PopoverAnchor = RadixPopover.Anchor

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ className, align = "start", sideOffset = 6, ...props }, ref) => {
  const portalContainer = useYu3PortalContainer()
  return (
    <RadixPopover.Portal container={portalContainer ?? undefined}>
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md border border-line pointer-events-auto",
          "bg-[var(--color-surface,#ffffff)] p-4 text-fg shadow-md outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  )
})
PopoverContent.displayName = "PopoverContent"
