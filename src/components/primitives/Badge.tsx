"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-admin-full text-[10px] font-semibold leading-none",
  {
    variants: {
      variant: {
        accent: "bg-admin-accent text-admin-accent-fg",
        danger: "bg-admin-danger-solid text-white",
        success: "bg-admin-success-solid text-white",
        neutral: "bg-admin-neutral-solid text-white",
      },
      dot: { true: "min-w-[8px] h-2 w-2 p-0", false: "" },
    },
    defaultVariants: { variant: "accent", dot: false },
  },
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badge> & { count?: number; max?: number };

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, dot, count, max = 99, children, ...rest },
  ref,
) {
  const label = count === undefined ? children : count > max ? `${max}+` : count;
  if (count !== undefined && count <= 0 && !children) return null;
  return (
    <span ref={ref} className={cn(badge({ variant, dot }), className)} {...rest}>
      {dot ? null : label}
    </span>
  );
});
