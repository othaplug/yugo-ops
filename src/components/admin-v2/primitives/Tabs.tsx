"use client"

import * as React from "react"
import * as RadixTabs from "@radix-ui/react-tabs"
import {
  VercelRadixTabsList,
  vercelRadixTabTriggerClassName,
} from "@/components/ui/vercel-radix-tabs-list"

import { cn } from "../lib/cn"

type TabsVariant = "underline" | "pills"

const TabsVariantContext = React.createContext<TabsVariant>("underline")

export const Tabs = ({
  variant = "underline",
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Root> & {
  variant?: TabsVariant
}) => (
  <TabsVariantContext.Provider value={variant}>
    <RadixTabs.Root className={cn("w-full", className)} {...props} />
  </TabsVariantContext.Provider>
)

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  if (variant === "pills") {
    return (
      <RadixTabs.List
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-line bg-surface-subtle p-1",
          className,
        )}
        {...props}
      />
    )
  }
  return <VercelRadixTabsList ref={ref} className={className} {...props} />
})
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  if (variant === "pills") {
    return (
      <RadixTabs.Trigger
        ref={ref}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-sm px-3 body-sm font-medium text-fg-muted transition-colors outline-none",
          "hover:text-fg",
          "data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-accent/30",
          className,
        )}
        {...props}
      />
    )
  }
  return (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        vercelRadixTabTriggerClassName,
        "focus-visible:ring-accent/30",
        className,
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = RadixTabs.Content
