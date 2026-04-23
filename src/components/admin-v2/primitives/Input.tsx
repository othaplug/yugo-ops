"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const inputVariants = cva(
  "w-full rounded-sm border bg-surface text-fg placeholder:text-fg-subtle outline-none transition-colors disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      size: {
        sm: "h-8 text-[13px]",
        md: "h-9 text-[13px]",
        lg: "h-10 text-sm",
      },
      state: {
        default:
          "border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/30",
        error:
          "border-danger focus:border-danger focus:ring-2 focus:ring-danger/30",
      },
    },
    defaultVariants: { size: "md", state: "default" },
  },
)

export type InputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> &
  VariantProps<typeof inputVariants> & {
    leadingIcon?: React.ReactNode
    trailingIcon?: React.ReactNode
    containerClassName?: string
    error?: boolean | string
    helper?: React.ReactNode
  }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      size,
      state,
      leadingIcon,
      trailingIcon,
      error,
      helper,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error)
    const resolvedState = hasError ? "error" : state
    const resolvedHelper =
      typeof error === "string" && error.length > 0 ? error : helper
    const padLeft = leadingIcon ? "pl-9" : "pl-3"
    const padRight = trailingIcon ? "pr-9" : "pr-3"
    return (
      <div className={cn("w-full", containerClassName)}>
        <div className="relative">
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            className={cn(
              inputVariants({ size, state: resolvedState }),
              padLeft,
              padRight,
              className,
            )}
            {...props}
          />
          {trailingIcon ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle">
              {trailingIcon}
            </span>
          ) : null}
        </div>
        {resolvedHelper ? (
          <p
            className={cn(
              "mt-1.5 body-xs",
              hasError ? "text-danger" : "text-fg-muted",
            )}
          >
            {resolvedHelper}
          </p>
        ) : null}
      </div>
    )
  },
)
Input.displayName = "Input"
