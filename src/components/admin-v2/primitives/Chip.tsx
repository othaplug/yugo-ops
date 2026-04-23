"use client"

import * as React from "react"
import { ArrowUpRight } from "@phosphor-icons/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const chipVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-xs px-2 label-sm select-none",
  {
    variants: {
      variant: {
        neutral: "bg-neutral-bg text-neutral",
        brand: "bg-brand-bg text-brand",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        danger: "bg-danger-bg text-danger",
        info: "bg-info-bg text-info",
      },
      interactive: {
        true: "cursor-pointer hover:opacity-80 transition-opacity",
        false: "",
      },
    },
    defaultVariants: {
      variant: "neutral",
      interactive: false,
    },
  },
)

export type ChipVariant = NonNullable<VariantProps<typeof chipVariants>["variant"]>

type BaseProps = {
  label: string
  variant?: ChipVariant
  dot?: boolean
  className?: string
}

type ChipAsSpan = BaseProps & {
  external?: false
  onClick?: never
  href?: never
}

type ChipAsLink = BaseProps & {
  external: true
  onClick?: (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void
  href?: string
}

export type ChipProps = ChipAsSpan | ChipAsLink

export const Chip = (props: ChipProps) => {
  const { label, variant = "neutral", dot, className } = props
  const content = (
    <>
      {dot ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full bg-current"
        />
      ) : null}
      <span className="leading-none tracking-[0.06em]">{label}</span>
      {props.external ? (
        <ArrowUpRight className="size-3 shrink-0" weight="bold" aria-hidden />
      ) : null}
    </>
  )

  if (props.external) {
    if (props.href) {
      return (
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(chipVariants({ variant, interactive: true }), className)}
          onClick={props.onClick}
        >
          {content}
        </a>
      )
    }
    return (
      <button
        type="button"
        className={cn(chipVariants({ variant, interactive: true }), className)}
        onClick={props.onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={cn(chipVariants({ variant }), className)}>{content}</span>
  )
}

export const variantForStatus = (status: string): ChipVariant => {
  const s = status.toLowerCase().trim()
  if (["new"].includes(s)) return "brand"
  if (["pre-sale", "presale", "pending", "quoted", "scheduled", "draft"].includes(s)) return "warning"
  if (["closing", "in-transit", "in transit", "pre-move", "sent"].includes(s)) return "info"
  if (["closed", "booked", "paid", "completed", "delivered", "won"].includes(s)) return "success"
  if (["lost", "cancelled", "canceled", "refund", "refunded", "overdue", "void", "voided"].includes(s)) return "danger"
  return "neutral"
}
