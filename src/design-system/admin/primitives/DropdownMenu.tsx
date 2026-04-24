"use client"

import * as React from "react"
import * as DM from "@radix-ui/react-dropdown-menu"
import { cn } from "../lib/cn"
import { Check } from "../icons"

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group
export const DropdownMenuPortal = DM.Portal
export const DropdownMenuSub = DM.Sub
export const DropdownMenuRadioGroup = DM.RadioGroup

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DM.Content>,
  React.ComponentPropsWithoutRef<typeof DM.Content>
>(({ className, sideOffset = 6, align = "start", ...rest }, ref) => (
  <DM.Portal>
    <DM.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        "z-[var(--yu3-z-drawer)]",
        "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-lg)]",
        "shadow-[var(--yu3-shadow-md)]",
        "min-w-[200px] max-w-[320px] p-1 text-[13px]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        className,
      )}
      {...rest}
    />
  </DM.Portal>
))
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DM.Item>,
  React.ComponentPropsWithoutRef<typeof DM.Item> & {
    icon?: React.ReactNode
    shortcut?: string
    danger?: boolean
  }
>(({ className, icon, shortcut, danger, children, ...rest }, ref) => (
  <DM.Item
    ref={ref}
    className={cn(
      "flex items-center gap-2 h-8 px-2 rounded-[var(--yu3-r-sm)] cursor-pointer select-none",
      "text-[var(--yu3-ink)] outline-none",
      "hover:bg-[var(--yu3-bg-surface-sunken)] focus:bg-[var(--yu3-bg-surface-sunken)]",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      danger && "text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)]",
      className,
    )}
    {...rest}
  >
    {icon ? (
      <span className="flex items-center justify-center h-4 w-4 text-[var(--yu3-ink-muted)]">
        {icon}
      </span>
    ) : null}
    <span className="flex-1 truncate">{children}</span>
    {shortcut ? (
      <span className="text-[11px] text-[var(--yu3-ink-faint)] yu3-num">
        {shortcut}
      </span>
    ) : null}
  </DM.Item>
))
DropdownMenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DM.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DM.CheckboxItem>
>(({ className, children, checked, ...rest }, ref) => (
  <DM.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      "flex items-center gap-2 h-8 px-2 rounded-[var(--yu3-r-sm)] cursor-pointer select-none",
      "text-[var(--yu3-ink)] outline-none",
      "hover:bg-[var(--yu3-bg-surface-sunken)] focus:bg-[var(--yu3-bg-surface-sunken)]",
      "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
      className,
    )}
    {...rest}
  >
    <span className="flex items-center justify-center h-4 w-4 text-[var(--yu3-wine)]">
      <DM.ItemIndicator>
        <Check size={14} weight="bold" />
      </DM.ItemIndicator>
    </span>
    <span className="flex-1 truncate">{children}</span>
  </DM.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem"

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DM.Label>,
  React.ComponentPropsWithoutRef<typeof DM.Label>
>(({ className, ...rest }, ref) => (
  <DM.Label
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--yu3-ink-faint)]",
      className,
    )}
    {...rest}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DM.Separator>,
  React.ComponentPropsWithoutRef<typeof DM.Separator>
>(({ className, ...rest }, ref) => (
  <DM.Separator
    ref={ref}
    className={cn("my-1 h-px bg-[var(--yu3-line-subtle)] -mx-1", className)}
    {...rest}
  />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"
