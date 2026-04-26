"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-[6px]",
    "font-medium leading-none whitespace-nowrap select-none",
    "transition-[background-color,color,border-color,box-shadow,transform]",
    "duration-[var(--yu3-dur-1)] ease-[var(--yu3-ease-out)]",
    "focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&>svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] border border-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-hover)] hover:border-[var(--yu3-wine-hover)] active:bg-[var(--yu3-wine-press)]",
        accent:
          "bg-[var(--yu3-forest)] text-[var(--yu3-on-forest)] border border-[var(--yu3-forest)] hover:bg-[var(--yu3-forest-hover)] hover:border-[var(--yu3-forest-hover)]",
        secondary:
          "bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] border border-[var(--yu3-line)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:border-[var(--yu3-line-strong)]",
        ghost:
          "bg-transparent text-[var(--yu3-ink)] border border-transparent hover:bg-[var(--yu3-bg-surface-sunken)]",
        destructive:
          "bg-[var(--yu3-bg-surface)] text-[var(--yu3-danger)] border border-[var(--yu3-line)] hover:bg-[var(--yu3-danger-tint)] hover:border-[var(--yu3-danger)]",
        link: "bg-transparent text-[var(--yu3-ink)] border-none p-0 h-auto underline-offset-4 hover:underline hover:text-[var(--yu3-ink-strong)]",
        dark: "bg-[var(--yu3-ink-strong)] text-[var(--yu3-ink-inverse)] border border-[var(--yu3-ink-strong)] hover:bg-[var(--yu3-ink)]",
      },
      size: {
        xs: "h-7 px-2.5 text-[12px] rounded-[var(--yu3-r-sm)]",
        sm: "h-8 px-3 text-[13px] rounded-[var(--yu3-r-md)]",
        md: "h-9 px-3.5 text-[13px] rounded-[var(--yu3-r-md)]",
        lg: "h-10 px-4 text-[14px] rounded-[var(--yu3-r-md)]",
        icon: "h-9 w-9 rounded-[var(--yu3-r-md)]",
        iconSm: "h-8 w-8 rounded-[var(--yu3-r-sm)]",
        iconXs: "h-7 w-7 rounded-[var(--yu3-r-xs)]",
      },
      uppercase: {
        true: "uppercase tracking-[0.12em] font-bold text-[11px]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
      uppercase: false,
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      uppercase,
      asChild = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    if (asChild) {
      // Slot (asChild) must receive a single element child. Do not add spinners, icons, or wrapper spans.
      return (
        <Slot
          ref={ref}
          data-yu3-button=""
          data-loading={loading ? "true" : undefined}
          className={cn(
            buttonStyles({ variant, size, uppercase }),
            (disabled || loading) && "pointer-events-none opacity-50",
            className,
          )}
          aria-disabled={disabled || loading}
          {...rest}
        >
          {children}
        </Slot>
      );
    }
    return (
      <button
        ref={ref}
        data-yu3-button=""
        data-loading={loading ? "true" : undefined}
        className={cn(buttonStyles({ variant, size, uppercase }), className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent animate-spin"
            aria-hidden
          />
        ) : (
          leadingIcon
        )}
        {children ? (
          <span className="inline-flex items-center leading-none">
            {children}
          </span>
        ) : null}
        {trailingIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
