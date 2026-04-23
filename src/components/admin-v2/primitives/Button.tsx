"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleNotch } from "@phosphor-icons/react"
import { cn } from "../lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors outline-none whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-0",
  {
    variants: {
      variant: {
        primary:
          "bg-fg text-surface hover:bg-fg/90 active:bg-fg/85 shadow-sm",
        accent:
          "bg-accent text-white hover:bg-accent-hover active:bg-accent-hover shadow-sm",
        secondary:
          "bg-surface text-fg border border-line-strong hover:bg-surface-subtle",
        ghost:
          "bg-transparent text-fg hover:bg-surface-subtle",
        destructive:
          "bg-danger text-white hover:bg-danger/90 shadow-sm",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-5 text-[13px]",
        lg: "h-10 px-6 text-sm",
        icon: "h-9 w-9 p-0",
        iconSm: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild,
      loading,
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"
    const isIconOnly = size === "icon" || size === "iconSm"
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <CircleNotch className="size-4 animate-spin" aria-hidden />
        ) : (
          leadingIcon
        )}
        {!isIconOnly && children}
        {!loading && trailingIcon}
      </Comp>
    )
  },
)
Button.displayName = "Button"
