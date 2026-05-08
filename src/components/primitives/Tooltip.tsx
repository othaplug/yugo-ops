"use client";

import * as RadixTooltip from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const TooltipProvider = ({
  children,
  delayDuration = 200,
}: {
  children: React.ReactNode;
  delayDuration?: number;
}) => (
  <RadixTooltip.Provider delayDuration={delayDuration} skipDelayDuration={100}>
    {children}
  </RadixTooltip.Provider>
);

type TooltipProps = {
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
};

export function Tooltip({
  content,
  side = "top",
  align = "center",
  delayDuration,
  open,
  onOpenChange,
  children,
  className,
}: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={delayDuration} open={open} onOpenChange={onOpenChange}>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 px-2 py-1 rounded-admin-sm bg-[#101828] text-white text-xs leading-tight shadow-admin-md",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out fade-in-0 zoom-in-95",
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-[#101828]" width={8} height={4} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipContent = forwardRef<
  React.ElementRef<typeof RadixTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(function TooltipContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 px-2 py-1 rounded-admin-sm bg-[#101828] text-white text-xs leading-tight shadow-admin-md",
          className,
        )}
        {...props}
      />
    </RadixTooltip.Portal>
  );
});
