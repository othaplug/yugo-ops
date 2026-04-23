"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { createContext, forwardRef, useContext } from "react";
import { cn } from "@/lib/cn";

type Variant = "underline" | "pills";
const VariantCtx = createContext<Variant>("underline");

export const Tabs = forwardRef<
  React.ElementRef<typeof RadixTabs.Root>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Root> & { variant?: Variant }
>(function Tabs({ className, variant = "underline", ...props }, ref) {
  return (
    <VariantCtx.Provider value={variant}>
      <RadixTabs.Root ref={ref} className={cn("flex flex-col gap-3", className)} {...props} />
    </VariantCtx.Provider>
  );
});

const list = cva("inline-flex items-center", {
  variants: {
    variant: {
      underline: "gap-4 border-b border-admin-border-subtle",
      pills: "gap-1 p-1 rounded-admin-md bg-admin-neutral-bg",
    },
  },
  defaultVariants: { variant: "underline" },
});

export const TabsList = forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List> & VariantProps<typeof list>
>(function TabsList({ className, variant, ...props }, ref) {
  const ctx = useContext(VariantCtx);
  return <RadixTabs.List ref={ref} className={cn(list({ variant: variant ?? ctx }), className)} {...props} />;
});

const trigger = cva(
  "inline-flex items-center gap-1.5 font-medium text-sm transition-colors cursor-pointer outline-none focus-visible:shadow-admin-focus",
  {
    variants: {
      variant: {
        underline: [
          "h-9 px-0 border-b-2 border-transparent text-admin-fg-tertiary",
          "hover:text-admin-fg",
          "data-[state=active]:text-admin-fg data-[state=active]:border-admin-accent",
        ],
        pills: [
          "h-7 px-3 rounded-admin-sm text-admin-fg-tertiary",
          "hover:text-admin-fg",
          "data-[state=active]:bg-admin-card data-[state=active]:text-admin-fg data-[state=active]:shadow-admin-xs",
        ],
      },
    },
    defaultVariants: { variant: "underline" },
  },
);

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> & VariantProps<typeof trigger>
>(function TabsTrigger({ className, variant, ...props }, ref) {
  const ctx = useContext(VariantCtx);
  return <RadixTabs.Trigger ref={ref} className={cn(trigger({ variant: variant ?? ctx }), className)} {...props} />;
});

export const TabsContent = forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <RadixTabs.Content
      ref={ref}
      className={cn("outline-none focus-visible:shadow-admin-focus", className)}
      {...props}
    />
  );
});
