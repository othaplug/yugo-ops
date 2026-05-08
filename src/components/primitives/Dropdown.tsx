"use client";

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check, Circle } from "@phosphor-icons/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

export const Dropdown = RadixMenu.Root;
export const DropdownTrigger = RadixMenu.Trigger;
export const DropdownGroup = RadixMenu.Group;
export const DropdownRadioGroup = RadixMenu.RadioGroup;
export const DropdownSub = RadixMenu.Sub;
export const DropdownSubTrigger = RadixMenu.SubTrigger;

export const DropdownContent = forwardRef<
  React.ElementRef<typeof RadixMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Content>
>(function DropdownContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[200px] overflow-hidden rounded-admin-md border bg-admin-card p-1",
          "border-admin-border shadow-admin-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </RadixMenu.Portal>
  );
});

type ItemProps = React.ComponentPropsWithoutRef<typeof RadixMenu.Item> & {
  leading?: IconProps["icon"];
  shortcut?: string;
  destructive?: boolean;
};

export const DropdownItem = forwardRef<
  React.ElementRef<typeof RadixMenu.Item>,
  ItemProps
>(function DropdownItem({ className, leading, shortcut, destructive, children, ...props }, ref) {
  return (
    <RadixMenu.Item
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-admin-sm px-2 py-1.5 text-sm cursor-pointer select-none outline-none",
        "text-admin-fg data-[highlighted]:bg-admin-hover",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        destructive && "text-admin-danger-fg data-[highlighted]:bg-admin-danger-bg",
        className,
      )}
      {...props}
    >
      {leading && <Icon icon={leading} size="sm" aria-hidden />}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="ml-auto text-xs text-admin-fg-tertiary tracking-wide">{shortcut}</span>
      )}
    </RadixMenu.Item>
  );
});

export const DropdownLabel = forwardRef<
  React.ElementRef<typeof RadixMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Label>
>(function DropdownLabel({ className, ...props }, ref) {
  return (
    <RadixMenu.Label
      ref={ref}
      className={cn(
        "px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-admin-fg-tertiary",
        className,
      )}
      {...props}
    />
  );
});

export const DropdownSeparator = forwardRef<
  React.ElementRef<typeof RadixMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Separator>
>(function DropdownSeparator({ className, ...props }, ref) {
  return (
    <RadixMenu.Separator
      ref={ref}
      className={cn("-mx-1 my-1 h-px bg-admin-border-subtle", className)}
      {...props}
    />
  );
});

export const DropdownCheckboxItem = forwardRef<
  React.ElementRef<typeof RadixMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.CheckboxItem>
>(function DropdownCheckboxItem({ className, children, checked, ...props }, ref) {
  return (
    <RadixMenu.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(
        "relative flex items-center gap-2 rounded-admin-sm pl-7 pr-2 py-1.5 text-sm cursor-pointer select-none outline-none",
        "text-admin-fg data-[highlighted]:bg-admin-hover",
        "data-[disabled]:opacity-50 data-[disabled]:pointer-events-none",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <RadixMenu.ItemIndicator>
          <Check size={12} weight="bold" />
        </RadixMenu.ItemIndicator>
      </span>
      {children}
    </RadixMenu.CheckboxItem>
  );
});

export const DropdownRadioItem = forwardRef<
  React.ElementRef<typeof RadixMenu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.RadioItem>
>(function DropdownRadioItem({ className, children, ...props }, ref) {
  return (
    <RadixMenu.RadioItem
      ref={ref}
      className={cn(
        "relative flex items-center gap-2 rounded-admin-sm pl-7 pr-2 py-1.5 text-sm cursor-pointer select-none outline-none",
        "text-admin-fg data-[highlighted]:bg-admin-hover",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <RadixMenu.ItemIndicator>
          <Circle size={6} weight="fill" />
        </RadixMenu.ItemIndicator>
      </span>
      {children}
    </RadixMenu.RadioItem>
  );
});
