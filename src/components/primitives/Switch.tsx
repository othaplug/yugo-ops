"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type SwitchProps = React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> & {
  label?: React.ReactNode;
};

export const Switch = forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  SwitchProps
>(function Switch({ className, label, id, ...props }, ref) {
  const control = (
    <RadixSwitch.Root
      ref={ref}
      id={id}
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 items-center rounded-admin-full border transition-colors",
        "border-admin-border bg-admin-neutral-bg",
        "data-[state=checked]:bg-admin-accent data-[state=checked]:border-admin-accent",
        "focus-visible:outline-none focus-visible:shadow-admin-focus",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cn(
          "block h-3.5 w-3.5 rounded-admin-full bg-white shadow-admin-xs",
          "transition-transform duration-[var(--duration-admin-fast)]",
          "translate-x-0.5 data-[state=checked]:translate-x-[18px]",
        )}
      />
    </RadixSwitch.Root>
  );
  if (!label) return control;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-sm select-none">
      {control}
      <span className="text-admin-fg">{label}</span>
    </label>
  );
});
