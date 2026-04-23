"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check, Minus } from "@phosphor-icons/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
};

export const Checkbox = forwardRef<
  React.ElementRef<typeof RadixCheckbox.Root>,
  CheckboxProps
>(function Checkbox({ className, label, description, id, ...props }, ref) {
  const inner = (
    <RadixCheckbox.Root
      ref={ref}
      id={id}
      className={cn(
        "peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-admin-xs border transition-colors",
        "border-admin-border bg-admin-card",
        "data-[state=checked]:bg-admin-accent data-[state=checked]:border-admin-accent data-[state=checked]:text-admin-accent-fg",
        "data-[state=indeterminate]:bg-admin-accent data-[state=indeterminate]:border-admin-accent data-[state=indeterminate]:text-admin-accent-fg",
        "focus-visible:outline-none focus-visible:shadow-admin-focus",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center">
        {props.checked === "indeterminate" ? (
          <Minus size={10} weight="bold" />
        ) : (
          <Check size={10} weight="bold" />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
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
