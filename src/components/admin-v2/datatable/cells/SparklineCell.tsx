"use client"

import * as React from "react"
import { Sparkline, type SparklineProps } from "../../composites/Sparkline"

export type SparklineCellProps = Omit<SparklineProps, "data"> & {
  data: number[]
}

export const SparklineCell = (props: SparklineCellProps) => (
  <Sparkline width={96} height={28} {...props} />
)
