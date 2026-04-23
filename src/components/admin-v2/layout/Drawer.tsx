"use client"

import * as React from "react"
import * as RadixDialog from "@radix-ui/react-dialog"
import { Icon } from "../primitives/Icon"
import { cn } from "../lib/cn"

type DrawerProps = React.ComponentPropsWithoutRef<typeof RadixDialog.Root> & {
  children: React.ReactNode
}

export const Drawer = ({ children, ...props }: DrawerProps) => (
  <RadixDialog.Root {...props}>{children}</RadixDialog.Root>
)

export const DrawerTrigger = RadixDialog.Trigger

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
    widthClass?: string
  }
>(({ className, widthClass, children, ...props }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay
      className={cn(
        "fixed inset-0 z-40 bg-black/60 backdrop-blur-[4px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      )}
    />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex h-dvh flex-col bg-surface shadow-lg outline-none",
        "w-full",
        "sm:w-[560px] lg:w-[480px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
        "duration-200",
        widthClass,
        className,
      )}
      {...props}
    >
      {children}
    </RadixDialog.Content>
  </RadixDialog.Portal>
))
DrawerContent.displayName = "DrawerContent"

export const DrawerHeader = ({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) => (
  <div
    className={cn(
      "flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4",
      className,
    )}
  >
    <div className="min-w-0 flex-1">
      <RadixDialog.Title className="heading-md text-fg truncate">
        {title}
      </RadixDialog.Title>
      {description ? (
        <RadixDialog.Description className="mt-1 body-sm text-fg-muted">
          {description}
        </RadixDialog.Description>
      ) : null}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      {actions}
      <RadixDialog.Close asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-subtle hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
          aria-label="Close drawer"
        >
          <Icon name="close" size="md" />
        </button>
      </RadixDialog.Close>
    </div>
  </div>
)

export const DrawerBody = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex-1 overflow-y-auto px-5 py-5", className)}
    {...props}
  >
    {children}
  </div>
)

export const DrawerTabs = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "shrink-0 border-b border-line px-5",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export const DrawerFooter = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export const DrawerClose = RadixDialog.Close
export const DrawerTitle = RadixDialog.Title
export const DrawerDescription = RadixDialog.Description
