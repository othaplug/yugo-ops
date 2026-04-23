"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Chip } from "../primitives/Chip"
import { Icon } from "../primitives/Icon"
import { Sparkline } from "./Sparkline"
import { cn } from "../lib/cn"

const metricCardVariants = cva(
  "flex flex-col rounded-lg border bg-surface transition-colors",
  {
    variants: {
      variant: {
        default: "border-line shadow-sm",
        subtle: "border-transparent bg-surface-subtle",
      },
      size: {
        l1: "h-[88px] px-5 py-4",
        l2: "h-[120px] px-5 py-4",
        l3: "h-[160px] px-6 py-5",
        l4: "h-[200px] px-6 py-5",
      },
    },
    defaultVariants: { variant: "default", size: "l1" },
  },
)

export type DeltaDirection = "up" | "down" | "flat"

export type MetricDelta = {
  value: string
  direction: DeltaDirection
}

export type MetricCardProps = VariantProps<typeof metricCardVariants> & {
  label: string
  value: React.ReactNode
  delta?: MetricDelta
  sparkline?: number[]
  className?: string
}

const deltaToneClass: Record<DeltaDirection, string> = {
  up: "bg-success-bg text-success",
  down: "bg-danger-bg text-danger",
  flat: "bg-neutral-bg text-neutral",
}

const DeltaChip = ({ delta }: { delta: MetricDelta }) => {
  const arrow =
    delta.direction === "up"
      ? "arrowUpRight"
      : delta.direction === "down"
        ? "arrowDownRight"
        : "arrowRight"
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-xs px-1.5 label-sm",
        deltaToneClass[delta.direction],
      )}
    >
      <span className="leading-none tracking-[0.02em]">{delta.value}</span>
      <Icon name={arrow} size="xs" />
    </span>
  )
}

export const MetricCard = ({
  label,
  value,
  delta,
  sparkline,
  variant,
  size,
  className,
}: MetricCardProps) => {
  return (
    <div className={cn(metricCardVariants({ variant, size }), className)}>
      <p className="label-sm text-fg-muted">{label}</p>
      <div className="mt-auto flex items-end justify-between gap-3">
        <p className="display-sm text-fg tabular-nums">{value}</p>
        <div className="flex items-center gap-2">
          {delta ? <DeltaChip delta={delta} /> : null}
          {sparkline ? (
            <Sparkline
              data={sparkline}
              tone={
                delta?.direction === "up"
                  ? "up"
                  : delta?.direction === "down"
                    ? "down"
                    : "auto"
              }
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const MetricStrip = ({
  items,
  className,
}: {
  items: MetricCardProps[]
  className?: string
}) => (
  <div
    className={cn(
      "grid gap-4",
      items.length >= 4
        ? "grid-cols-2 md:grid-cols-4"
        : items.length === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2",
      className,
    )}
  >
    {items.map((item, index) => (
      <MetricCard key={`${item.label}-${index}`} {...item} />
    ))}
  </div>
)
