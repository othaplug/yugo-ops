"use client"

import * as React from "react"
import * as RadixTooltip from "@radix-ui/react-tooltip"
import { cn } from "../lib/cn"

export const TooltipProvider = ({ children, delayDuration = 200 }: { children: React.ReactNode; delayDuration?: number }) => (
  <RadixTooltip.Provider delayDuration={delayDuration}>{children}</RadixTooltip.Provider>
)

export const TooltipRoot = RadixTooltip.Root
export const TooltipTrigger = RadixTooltip.Trigger

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-sm bg-fg px-2 py-1 body-xs text-surface shadow-md",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
        className,
      )}
      {...props}
    />
  </RadixTooltip.Portal>
))
TooltipContent.displayName = "TooltipContent"

type TooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentProps<typeof RadixTooltip.Content>["side"]
  align?: React.ComponentProps<typeof RadixTooltip.Content>["align"]
  delay?: number
}

export const Tooltip = ({ content, children, side, align, delay = 200 }: TooltipProps) => (
  <RadixTooltip.Provider delayDuration={delay}>
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  </RadixTooltip.Provider>
)
