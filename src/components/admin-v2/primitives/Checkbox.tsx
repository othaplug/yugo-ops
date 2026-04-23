"use client"

import * as React from "react"
import * as RadixCheckbox from "@radix-ui/react-checkbox"
import { Check, Minus } from "@phosphor-icons/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const checkboxVariants = cva(
  "peer shrink-0 rounded-[4px] border border-line-strong bg-surface transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-white data-[state=indeterminate]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:text-white disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      size: {
        sm: "size-4",
        md: "size-[18px]",
      },
    },
    defaultVariants: { size: "md" },
  },
)

type CheckedState = boolean | "indeterminate"

export type CheckboxProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "checked" | "defaultChecked" | "onCheckedChange" | "onChange"
> &
  VariantProps<typeof checkboxVariants> & {
    checked?: CheckedState
    defaultChecked?: CheckedState
    onCheckedChange?: (checked: CheckedState) => void
    required?: boolean
    name?: string
    value?: string
  }

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, size, ...props }, ref) => (
    <RadixCheckbox.Root
      ref={ref}
      className={cn(checkboxVariants({ size }), className)}
      {...(props as React.ComponentPropsWithoutRef<typeof RadixCheckbox.Root>)}
    >
      <RadixCheckbox.Indicator className="flex size-full items-center justify-center">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" weight="bold" />
        ) : (
          <Check className="size-3" weight="bold" />
        )}
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  ),
)
Checkbox.displayName = "Checkbox"
