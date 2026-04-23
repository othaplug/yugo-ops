"use client"

import * as React from "react"
import * as RadixRadio from "@radix-ui/react-radio-group"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const radioVariants = cva(
  "aspect-square rounded-full border border-line-strong bg-surface text-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none data-[state=checked]:border-accent disabled:opacity-50 disabled:cursor-not-allowed",
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

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadixRadio.Root>,
  React.ComponentPropsWithoutRef<typeof RadixRadio.Root>
>(({ className, ...props }, ref) => (
  <RadixRadio.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
))
RadioGroup.displayName = "RadioGroup"

export type RadioProps = React.ComponentPropsWithoutRef<typeof RadixRadio.Item> &
  VariantProps<typeof radioVariants>

export const Radio = React.forwardRef<
  React.ElementRef<typeof RadixRadio.Item>,
  RadioProps
>(({ className, size, ...props }, ref) => (
  <RadixRadio.Item
    ref={ref}
    className={cn(radioVariants({ size }), className)}
    {...props}
  >
    <RadixRadio.Indicator className="flex size-full items-center justify-center">
      <span className="size-2 rounded-full bg-accent" />
    </RadixRadio.Indicator>
  </RadixRadio.Item>
))
Radio.displayName = "Radio"
