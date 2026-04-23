"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../lib/cn"

export type BreadcrumbSegment = {
  label: string
  href?: string
}

const humanize = (segment: string) =>
  segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const deriveSegmentsFromPath = (pathname: string): BreadcrumbSegment[] => {
  const parts = pathname.split("/").filter(Boolean)
  if (parts.length === 0) return []
  const segments: BreadcrumbSegment[] = []
  let currentHref = ""
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    currentHref += `/${part}`
    const isLast = i === parts.length - 1
    segments.push({
      label: humanize(part),
      href: isLast ? undefined : currentHref,
    })
  }
  return segments
}

export type BreadcrumbProps = {
  segments?: BreadcrumbSegment[]
  className?: string
}

export const Breadcrumb = ({ segments, className }: BreadcrumbProps) => {
  const pathname = usePathname() ?? ""
  const resolvedSegments = segments ?? deriveSegmentsFromPath(pathname)

  if (resolvedSegments.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 body-sm", className)}
    >
      {resolvedSegments.map((segment, index) => {
        const isLast = index === resolvedSegments.length - 1
        return (
          <React.Fragment key={`${segment.label}-${index}`}>
            {index > 0 ? (
              <span className="text-fg-subtle" aria-hidden>
                /
              </span>
            ) : null}
            {segment.href && !isLast ? (
              <Link
                href={segment.href}
                className="text-fg-subtle hover:text-fg transition-colors"
              >
                {segment.label}
              </Link>
            ) : (
              <span
                className={cn(isLast ? "text-fg-muted" : "text-fg-subtle")}
                aria-current={isLast ? "page" : undefined}
              >
                {segment.label}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
