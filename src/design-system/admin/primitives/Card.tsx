"use client"

import * as React from "react"
import { cn } from "../lib/cn"

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("yu3-card", className)} {...rest} />
}

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-[var(--yu3-line-subtle)]",
        className,
      )}
      {...rest}
    />
  )
}

export function CardTitle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-[14px] font-semibold text-[var(--yu3-ink-strong)]",
        className,
      )}
      {...rest}
    />
  )
}

export function CardEyebrow({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "yu3-t-eyebrow mb-1",
        className,
      )}
      {...rest}
    />
  )
}

export function CardBody({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...rest} />
}

export function CardFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-[var(--yu3-line-subtle)] flex items-center justify-between gap-2",
        className,
      )}
      {...rest}
    />
  )
}

export function Section({
  eyebrow,
  title,
  actions,
  children,
  className,
}: {
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      {(eyebrow || title || actions) && (
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <div className="yu3-t-eyebrow">{eyebrow}</div> : null}
            {title ? (
              <h2 className="yu3-t-title mt-1 truncate">{title}</h2>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}
