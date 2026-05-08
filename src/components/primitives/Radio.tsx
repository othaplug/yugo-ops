"use client";

import * as RadixRadio from "@radix-ui/react-radio-group";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export const RadioGroup = forwardRef<
  React.ElementRef<typeof RadixRadio.Root>,
  React.ComponentPropsWithoutRef<typeof RadixRadio.Root>
>(function RadioGroup({ className, ...props }, ref) {
  return <RadixRadio.Root ref={ref} className={cn("grid gap-2", className)} {...props} />;
});

type RadioProps = React.ComponentPropsWithoutRef<typeof RadixRadio.Item> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
};

export const Radio = forwardRef<
  React.ElementRef<typeof RadixRadio.Item>,
  RadioProps
>(function Radio({ className, label, description, id, ...props }, ref) {
  const inner = (
    <RadixRadio.Item
      ref={ref}
      id={id}
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-admin-full border transition-colors",
        "border-admin-border bg-admin-card",
        "data-[state=checked]:border-admin-accent",
        "focus-visible:outline-none focus-visible:shadow-admin-focus",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <RadixRadio.Indicator className="flex items-center justify-center">
        <span className="h-1.5 w-1.5 rounded-admin-full bg-admin-accent" />
      </RadixRadio.Indicator>
    </RadixRadio.Item>
  );
  if (!label && !description) return inner;
  return (
    <label htmlFor={id} className="inline-flex items-start gap-2 cursor-pointer select-none">
      {inner}
      <span className="flex flex-col text-sm leading-tight">
        {label && <span className="text-admin-fg">{label}</span>}
        {description && <span className="text-admin-fg-tertiary text-xs">{description}</span>}
      </span>
    </label>
  );
});
