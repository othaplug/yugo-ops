"use client"

import * as React from "react"
import {
  IndicatorBars,
  type IndicatorLevel,
} from "../../composites/IndicatorBars"

export type IndicatorCellProps = {
  level: IndicatorLevel
  label?: string
}

export const IndicatorCell = ({ level, label }: IndicatorCellProps) => (
  <IndicatorBars level={level} label={label} />
)
