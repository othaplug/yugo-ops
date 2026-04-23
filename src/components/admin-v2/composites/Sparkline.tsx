"use client"

import * as React from "react"
import { Line, LineChart, ResponsiveContainer } from "recharts"
import { cn } from "../lib/cn"

type SparklineTone = "auto" | "up" | "down" | "neutral" | "accent"

export type SparklineProps = {
  data: number[]
  tone?: SparklineTone
  width?: number | string
  height?: number
  strokeWidth?: number
  className?: string
}

const toneToVar: Record<Exclude<SparklineTone, "auto">, string> = {
  up: "var(--color-graph-green)",
  down: "var(--color-graph-red)",
  neutral: "var(--color-fg-subtle)",
  accent: "var(--color-accent)",
}

const resolveColor = (tone: SparklineTone, data: number[]) => {
  if (tone !== "auto") return toneToVar[tone]
  if (data.length < 2) return toneToVar.neutral
  const first = data[0] ?? 0
  const last = data[data.length - 1] ?? 0
  if (last > first) return toneToVar.up
  if (last < first) return toneToVar.down
  return toneToVar.neutral
}

export const Sparkline = ({
  data,
  tone = "auto",
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className,
}: SparklineProps) => {
  const color = resolveColor(tone, data)
  const chartData = React.useMemo(() => data.map((value, index) => ({ index, value })), [data])

  return (
    <div className={cn("shrink-0", className)} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
