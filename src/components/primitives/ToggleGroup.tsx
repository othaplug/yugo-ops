"use client";

import * as RadixToggleGroup from "@radix-ui/react-toggle-group";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const ToggleGroup = forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Root>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Root>
>(function ToggleGroup({ className, ...props }, ref) {
  return (
    <RadixToggleGroup.Root
      ref={ref}
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 rounded-admin-md border bg-admin-neutral-bg border-admin-border-subtle",
        className,
      )}
      {...props}
    />
  );
});

export const ToggleGroupItem = forwardRef<
  React.ElementRef<typeof RadixToggleGroup.Item>,
  React.ComponentPropsWithoutRef<typeof RadixToggleGroup.Item>
>(function ToggleGroupItem({ className, ...props }, ref) {
  return (
    <RadixToggleGroup.Item
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center h-6 px-2 rounded-admin-sm text-xs font-medium",
        "text-admin-fg-tertiary cursor-pointer outline-none transition-colors",
        "hover:text-admin-fg",
        "data-[state=on]:bg-admin-card data-[state=on]:text-admin-fg data-[state=on]:shadow-admin-xs",
        "focus-visible:shadow-admin-focus disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
});
