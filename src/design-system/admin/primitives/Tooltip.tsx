"use client"

import * as React from "react"
import * as T from "@radix-ui/react-tooltip"
import { cn } from "../lib/cn"

export const TooltipProvider = T.Provider
export const TooltipRoot = T.Root
export const TooltipTrigger = T.Trigger

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof T.Content>,
  React.ComponentPropsWithoutRef<typeof T.Content>
>(({ className, sideOffset = 6, ...rest }, ref) => (
  <T.Portal>
    <T.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[var(--yu3-z-palette)]",
        "bg-[var(--yu3-ink-strong)] text-[var(--yu3-ink-inverse)]",
        "rounded-[var(--yu3-r-sm)] px-2 py-1 text-[12px] leading-none",
        "shadow-[var(--yu3-shadow-md)]",
        "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
        "data-[state=delayed-open]:fade-in-0 data-[state=closed]:fade-out-0",
        className,
      )}
      {...rest}
    />
  </T.Portal>
))
TooltipContent.displayName = "TooltipContent"

export function Tooltip({
  content,
  children,
  side = "top",
  delayDuration = 200,
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  delayDuration?: number
}) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  )
}
