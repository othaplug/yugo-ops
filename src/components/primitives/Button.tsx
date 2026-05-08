"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

const button = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-admin-md font-medium",
    "transition-colors duration-[var(--duration-admin-fast)] ease-[var(--ease-admin-standard)]",
    "focus-visible:outline-none focus-visible:shadow-admin-focus",
    "disabled:opacity-50 disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-admin-accent text-admin-accent-fg hover:bg-admin-accent-hover active:bg-admin-accent-active",
        secondary:
          "bg-admin-card text-admin-fg border border-admin-border hover:bg-admin-hover",
        ghost: "bg-transparent text-admin-fg hover:bg-admin-hover",
        danger:
          "bg-admin-danger-solid text-white hover:opacity-90 focus-visible:shadow-admin-focus-danger",
        subtle:
          "bg-admin-accent-subtle text-admin-accent hover:bg-admin-accent-subtle-hover",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3 text-sm",
        lg: "h-10 px-4 text-md",
        icon: "h-8 w-8 p-0",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
);

type ButtonBase = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "size"> &
  VariantProps<typeof button> & {
    asChild?: boolean;
    leading?: IconProps["icon"];
    trailing?: IconProps["icon"];
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonBase>(function Button(
  { className, variant, size, full, asChild, leading, trailing, loading, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const iconSize = size === "lg" ? "md" : "sm";
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size, full }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {leading && <Icon icon={leading} size={iconSize} aria-hidden />}
      {children}
      {trailing && <Icon icon={trailing} size={iconSize} aria-hidden />}
    </Comp>
  );
});
