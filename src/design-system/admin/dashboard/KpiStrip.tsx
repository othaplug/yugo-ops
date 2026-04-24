"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { Sparkline } from "../primitives/Sparkline"
import { TrendPill } from "../primitives/Badge"

export type KpiTile = {
  id: string
  label: string
  value: string | number
  hint?: React.ReactNode
  trendPct?: number | null
  spark?: number[] | null
  onClick?: () => void
}

export interface KpiStripProps extends React.HTMLAttributes<HTMLDivElement> {
  tiles: KpiTile[]
  columns?: 2 | 3 | 4 | 5
}

export const KpiStrip = React.forwardRef<HTMLDivElement, KpiStripProps>(
  ({ tiles, columns = 4, className, ...rest }, ref) => {
    const gridCls =
      columns === 5
        ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        : columns === 4
          ? "grid-cols-2 md:grid-cols-2 xl:grid-cols-4"
          : columns === 3
            ? "grid-cols-1 md:grid-cols-3"
            : "grid-cols-1 md:grid-cols-2"

    return (
      <div
        ref={ref}
        className={cn("grid gap-3", gridCls, className)}
        {...rest}
      >
        {tiles.map((tile) => (
          <KpiTileCard key={tile.id} tile={tile} />
        ))}
      </div>
    )
  },
)
KpiStrip.displayName = "KpiStrip"

function KpiTileCard({ tile }: { tile: KpiTile }) {
  const interactive = !!tile.onClick
  const Wrapper: React.ElementType = interactive ? "button" : "div"
  return (
    <Wrapper
      onClick={tile.onClick}
      className={cn(
        "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-[var(--yu3-r-lg)] p-5 md:p-6 flex flex-col gap-2 text-left",
        "transition-colors",
        interactive && "hover:border-[var(--yu3-line-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
      )}
    >
      <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">{tile.label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="yu3-num text-[28px] font-semibold leading-none text-[var(--yu3-ink-strong)] [font-feature-settings:'tnum'_1]">
          {tile.value}
        </div>
        {typeof tile.trendPct === "number" ? <TrendPill delta={tile.trendPct} /> : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-[12px] text-[var(--yu3-ink-muted)] leading-tight">
          {tile.hint}
        </div>
        {tile.spark && tile.spark.length > 1 ? (
          <Sparkline values={tile.spark} width={96} height={28} />
        ) : null}
      </div>
    </Wrapper>
  )
}
