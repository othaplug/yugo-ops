"use client"

import { cn } from "@/lib/utils"

import LoaderOne from "./loader-one"

const shellClass: Record<
  "admin" | "crew" | "quote" | "track" | "pay" | "partner" | "default",
  string
> = {
  admin:
    "min-h-[min(60vh,520px)] bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)]",
  crew: "min-h-screen bg-[var(--bg)]",
  quote: "min-h-screen bg-[#FAF7F2]",
  track: "min-h-screen bg-[#FAFAF8]",
  pay: "min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white",
  partner: "min-h-screen bg-[#FAF8F5]",
  default: "min-h-screen bg-background",
}

export type SegmentLoadingVariant = keyof typeof shellClass

export type SegmentLoadingProps = {
  variant?: SegmentLoadingVariant
  className?: string
}

const SegmentLoading = ({
  variant = "default",
  className,
}: SegmentLoadingProps) => (
  <div
    aria-busy="true"
    aria-live="polite"
    className={cn(
      "flex flex-col items-center justify-center gap-3 px-4 py-12",
      shellClass[variant],
      className,
    )}
    role="status"
  >
    <span className="sr-only">Loading</span>
    <LoaderOne />
  </div>
)

export default SegmentLoading
