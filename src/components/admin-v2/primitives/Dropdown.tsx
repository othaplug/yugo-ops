"use client"

import * as React from "react"
import * as RadixMenu from "@radix-ui/react-dropdown-menu"
import { Check } from "@phosphor-icons/react"
import { cn } from "../lib/cn"

export const DropdownRoot = RadixMenu.Root
export const DropdownTrigger = RadixMenu.Trigger
export const DropdownPortal = RadixMenu.Portal

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RadixMenu.Portal>
    <RadixMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[220px] overflow-hidden rounded-md border border-line bg-surface p-1 text-fg shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
        className,
      )}
      {...props}
    />
  </RadixMenu.Portal>
))
DropdownContent.displayName = "DropdownContent"

type DropdownItemProps = React.ComponentPropsWithoutRef<typeof RadixMenu.Item> & {
  leadingIcon?: React.ReactNode
  shortcut?: string
  destructive?: boolean
}

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Item>,
  DropdownItemProps
>(({ className, leadingIcon, shortcut, destructive, children, ...props }, ref) => (
  <RadixMenu.Item
    ref={ref}
    className={cn(
      "relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-3 body-sm outline-none transition-colors data-[highlighted]:bg-surface-subtle",
      destructive ? "text-danger data-[highlighted]:bg-danger-bg/60" : "text-fg",
      className,
    )}
    {...props}
  >
    {leadingIcon ? (
      <span className="flex size-4 items-center justify-center shrink-0">
        {leadingIcon}
      </span>
    ) : null}
    <span className="flex-1 truncate">{children}</span>
    {shortcut ? (
      <span className="ml-auto text-fg-subtle body-xs tracking-wider">
        {shortcut}
      </span>
    ) : null}
  </RadixMenu.Item>
))
DropdownItem.displayName = "DropdownItem"

export const DropdownLabel = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Label>
>(({ className, ...props }, ref) => (
  <RadixMenu.Label
    ref={ref}
    className={cn("px-3 py-1.5 label-md text-fg-muted", className)}
    {...props}
  />
))
DropdownLabel.displayName = "DropdownLabel"

export const DropdownSeparator = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixMenu.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-line", className)}
    {...props}
  />
))
DropdownSeparator.displayName = "DropdownSeparator"

type DropdownCheckboxItemProps = React.ComponentPropsWithoutRef<
  typeof RadixMenu.CheckboxItem
> & {
  leadingIcon?: React.ReactNode
}

export const DropdownCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixMenu.CheckboxItem>,
  DropdownCheckboxItemProps
>(({ className, leadingIcon, children, ...props }, ref) => (
  <RadixMenu.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm pl-8 pr-3 body-sm outline-none data-[highlighted]:bg-surface-subtle",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <RadixMenu.ItemIndicator>
        <Check className="size-3" weight="bold" />
      </RadixMenu.ItemIndicator>
    </span>
    {leadingIcon ? <span className="size-4">{leadingIcon}</span> : null}
    <span className="flex-1 truncate">{children}</span>
  </RadixMenu.CheckboxItem>
))
DropdownCheckboxItem.displayName = "DropdownCheckboxItem"
