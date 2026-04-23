"use client"

import * as React from "react"
import { Breadcrumb, type BreadcrumbSegment } from "./Breadcrumb"
import { cn } from "../lib/cn"

export type PageHeaderProps = {
  title: string
  description?: string
  breadcrumb?: BreadcrumbSegment[]
  showBreadcrumb?: boolean
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}

export const PageHeader = ({
  title,
  description,
  breadcrumb,
  showBreadcrumb = false,
  actions,
  meta,
  className,
}: PageHeaderProps) => {
  return (
    <header className={cn("flex flex-col gap-3 pb-6", className)}>
      {showBreadcrumb || breadcrumb ? (
        <Breadcrumb segments={breadcrumb} />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="display-md text-fg truncate">{title}</h1>
          {description ? (
            <p className="mt-1 body-sm text-fg-muted">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {meta ? <div className="flex flex-wrap items-center gap-3">{meta}</div> : null}
    </header>
  )
}
