import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

export type Badge2Props = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badge2Variants> & { asChild?: boolean }

const badge2Variants = cva(
  "inline-flex items-center justify-center border border-transparent font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:-ms-px [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-transparent border border-border text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        lg: "rounded-md px-2 h-7 min-w-7 gap-1.5 text-xs [&_svg]:size-3.5",
        md: "rounded-md px-[0.45rem] h-6 min-w-6 gap-1.5 text-xs [&_svg]:size-3.5",
        sm: "rounded-sm px-[0.325rem] h-5 min-w-5 gap-1 text-[0.6875rem] leading-[0.75rem] [&_svg]:size-3",
        xs: "rounded-sm px-1 h-4 min-w-4 gap-1 text-[0.625rem] leading-tight [&_svg]:size-3",
      },
      shape: {
        default: "",
        circle: "rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

function Badge2({ className, variant, size, shape, asChild = false, ...props }: Badge2Props) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp
      data-slot="badge-2"
      className={cn(badge2Variants({ variant, size, shape, className }))}
      {...props}
    />
  )
}

export { Badge2, badge2Variants }
