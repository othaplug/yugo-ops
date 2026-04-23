"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export const PopoverContent = forwardRef<
  React.ElementRef<typeof RadixPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(function PopoverContent({ className, align = "start", sideOffset = 6, ...props }, ref) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-admin-md border bg-admin-card p-3 shadow-admin-lg",
          "border-admin-border text-admin-fg outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  );
});
