"use client";

import { CaretRight } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

const chip = cva(
  [
    "inline-flex items-center gap-1 rounded-admin-full font-medium",
    "border transition-colors duration-[var(--duration-admin-fast)]",
  ],
  {
    variants: {
      variant: {
        neutral: "bg-admin-neutral-bg text-admin-neutral-fg border-admin-neutral-border",
        brand: "bg-admin-accent-subtle text-admin-accent border-admin-accent-border",
        success: "bg-admin-success-bg text-admin-success-fg border-admin-success-border",
        warning: "bg-admin-warning-bg text-admin-warning-fg border-admin-warning-border",
        danger: "bg-admin-danger-bg text-admin-danger-fg border-admin-danger-border",
        info: "bg-admin-info-bg text-admin-info-fg border-admin-info-border",
      },
      size: {
        sm: "h-5 px-1.5 text-[11px]",
        md: "h-6 px-2 text-xs",
      },
      interactive: {
        true: "cursor-pointer hover:brightness-95",
        false: "",
      },
    },
    defaultVariants: { variant: "neutral", size: "md", interactive: false },
  },
);

type ChipProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof chip> & {
    leading?: IconProps["icon"];
    trailingArrow?: boolean;
    dot?: boolean;
  };

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { className, variant, size, interactive, leading, trailingArrow, dot, children, ...rest },
  ref,
) {
  return (
    <span ref={ref} className={cn(chip({ variant, size, interactive }), className)} {...rest}>
      {dot && <span className="h-1.5 w-1.5 rounded-admin-full bg-current" aria-hidden />}
      {leading && <Icon icon={leading} size="xs" aria-hidden />}
      <span className="truncate">{children}</span>
      {trailingArrow && <Icon icon={CaretRight} size="xs" aria-hidden />}
    </span>
  );
});
