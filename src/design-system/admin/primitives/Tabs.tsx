"use client"

import * as React from "react"
import * as T from "@radix-ui/react-tabs"
import { cn } from "../lib/cn"

export const Tabs = T.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof T.List>,
  React.ComponentPropsWithoutRef<typeof T.List> & {
    variant?: "underline" | "pill" | "segment"
  }
>(({ className, variant = "underline", ...rest }, ref) => {
  const base =
    variant === "pill"
      ? "inline-flex items-center gap-1 bg-[var(--yu3-bg-surface-sunken)] p-1 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)]"
      : variant === "segment"
        ? "inline-flex items-center gap-0 bg-[var(--yu3-bg-surface)] rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)]"
        : "flex items-center gap-1 border-b border-[var(--yu3-line-subtle)]"
  return <T.List ref={ref} className={cn(base, className)} {...rest} />
})
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof T.Trigger>,
  React.ComponentPropsWithoutRef<typeof T.Trigger> & {
    variant?: "underline" | "pill" | "segment"
  }
>(({ className, variant = "underline", ...rest }, ref) => {
  const styles =
    variant === "pill"
      ? "h-8 px-3 rounded-[var(--yu3-r-sm)] text-[13px] font-medium text-[var(--yu3-ink-muted)] data-[state=active]:bg-[var(--yu3-bg-surface)] data-[state=active]:text-[var(--yu3-ink-strong)] data-[state=active]:shadow-[var(--yu3-shadow-sm)]"
      : variant === "segment"
        ? "h-8 px-3 text-[13px] font-medium text-[var(--yu3-ink-muted)] border-r border-[var(--yu3-line)] last:border-r-0 first:rounded-l-[var(--yu3-r-md)] last:rounded-r-[var(--yu3-r-md)] data-[state=active]:bg-[var(--yu3-wine-wash)] data-[state=active]:text-[var(--yu3-wine)] data-[state=active]:font-semibold"
        : "relative h-9 px-3 text-[13px] font-medium text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] data-[state=active]:text-[var(--yu3-ink-strong)] after:absolute after:left-3 after:right-3 after:bottom-[-1px] after:h-[2px] after:bg-[var(--yu3-wine)] after:opacity-0 data-[state=active]:after:opacity-100 after:transition-opacity"
  return (
    <T.Trigger
      ref={ref}
      className={cn("inline-flex items-center gap-1.5 outline-none", styles, className)}
      {...rest}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof T.Content>,
  React.ComponentPropsWithoutRef<typeof T.Content>
>(({ className, ...rest }, ref) => (
  <T.Content
    ref={ref}
    className={cn("outline-none pt-4", className)}
    {...rest}
  />
))
TabsContent.displayName = "TabsContent"
