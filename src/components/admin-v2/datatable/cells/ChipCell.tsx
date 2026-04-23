"use client"

import * as React from "react"
import { Chip, type ChipVariant } from "../../primitives/Chip"

export type ChipCellProps = {
  label: string
  variant?: ChipVariant
  external?: boolean
  href?: string
  dot?: boolean
}

export const ChipCell = ({ label, variant, external, href, dot }: ChipCellProps) => {
  if (external) {
    return <Chip label={label} variant={variant} external href={href} />
  }
  return <Chip label={label} variant={variant} dot={dot} />
}
