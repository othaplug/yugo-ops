"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const cardVariants = cva(
  "rounded-lg border border-line bg-surface shadow-sm",
  {
    variants: {
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: { padding: "md" },
  },
)

export type CardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants>

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ padding }), className)} {...props} />
  ),
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between gap-4", className)}
      {...props}
    />
  ),
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("heading-md text-fg", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

export const CardSubtitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("body-sm text-fg-muted", className)} {...props} />
  ),
)
CardSubtitle.displayName = "CardSubtitle"

export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  ),
)
CardBody.displayName = "CardBody"

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-3 pt-4", className)}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"
