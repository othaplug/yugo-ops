"use client"

import * as React from "react"
import * as RadixSwitch from "@radix-ui/react-switch"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const switchRootVariants = cva(
  "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed data-[state=checked]:bg-accent data-[state=unchecked]:bg-line-strong",
  {
    variants: {
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
      },
    },
    defaultVariants: { size: "md" },
  },
)

const switchThumbVariants = cva(
  "pointer-events-none block rounded-full bg-white shadow-sm transition-transform",
  {
    variants: {
      size: {
        sm: "size-4 translate-x-0.5 data-[state=checked]:translate-x-4",
        md: "size-5 translate-x-0.5 data-[state=checked]:translate-x-5",
      },
    },
    defaultVariants: { size: "md" },
  },
)

export type SwitchProps = React.ComponentPropsWithoutRef<typeof RadixSwitch.Root> &
  VariantProps<typeof switchRootVariants>

export const Switch = React.forwardRef<
  React.ElementRef<typeof RadixSwitch.Root>,
  SwitchProps
>(({ className, size, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(switchRootVariants({ size }), className)}
    {...props}
  >
    <RadixSwitch.Thumb className={cn(switchThumbVariants({ size }))} />
  </RadixSwitch.Root>
))
Switch.displayName = "Switch"
