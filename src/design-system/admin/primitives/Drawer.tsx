"use client"

import * as React from "react"
import * as D from "@radix-ui/react-dialog"
import { cn } from "../lib/cn"
import { X } from "../icons"
import { useYu3PortalContainer } from "../layout/Yu3PortalContext"

export const Drawer = D.Root
export const DrawerTrigger = D.Trigger
export const DrawerClose = D.Close

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof D.Content>,
  React.ComponentPropsWithoutRef<typeof D.Content> & {
    side?: "right" | "bottom" | "left"
    size?: "sm" | "md" | "lg" | "xl"
    title?: React.ReactNode
    description?: React.ReactNode
  }
>(
  (
    {
      className,
      children,
      side = "right",
      size = "md",
      title,
      description,
      ...rest
    },
    ref,
  ) => {
    const width =
      side === "bottom"
        ? "w-full"
        : size === "sm"
          ? "w-[360px]"
          : size === "lg"
            ? "w-[640px]"
            : size === "xl"
              ? "w-[880px]"
              : "w-[480px]"
    const pos =
      side === "right"
        ? "right-0 top-0 h-full border-l"
        : side === "left"
          ? "left-0 top-0 h-full border-r"
          : "left-0 bottom-0 w-full max-h-[88dvh] border-t rounded-t-[var(--yu3-r-xl)]"
    const anim =
      side === "right"
        ? "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        : side === "left"
          ? "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
          : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
    const portalContainer = useYu3PortalContainer()
    return (
      <D.Portal container={portalContainer ?? undefined}>
        <D.Overlay
          className={cn(
            "fixed inset-0 z-[var(--yu3-z-drawer)] bg-[var(--yu3-bg-overlay)] pointer-events-auto backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          )}
        />
        <D.Content
          ref={ref}
          className={cn(
            "fixed z-[var(--yu3-z-drawer)] pointer-events-auto",
            "bg-[var(--yu3-bg-surface,#ffffff)] text-[var(--yu3-ink,#24201d)] border-[var(--yu3-line,#d4cdbb)]",
            "shadow-[var(--yu3-shadow-lg)]",
            "flex flex-col",
            pos,
            width,
            anim,
            className,
          )}
          {...rest}
        >
          {title || description ? (
            <div className="px-5 pt-5 pb-3 border-b border-[var(--yu3-line-subtle)] flex items-start justify-between gap-4">
              <div className="min-w-0">
                {title ? (
                  <D.Title className="text-[16px] font-semibold text-[var(--yu3-ink-strong)] truncate">
                    {title}
                  </D.Title>
                ) : null}
                {description ? (
                  <D.Description className="text-[13px] text-[var(--yu3-ink-muted)] mt-1">
                    {description}
                  </D.Description>
                ) : null}
              </div>
              <D.Close
                className="inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
                aria-label="Close"
              >
                <X size={16} weight="regular" />
              </D.Close>
            </div>
          ) : (
            <D.Close
              className="absolute right-3 top-3 inline-flex items-center justify-center h-7 w-7 rounded-[var(--yu3-r-sm)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)] z-10"
              aria-label="Close"
            >
              <X size={16} weight="regular" />
            </D.Close>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </D.Content>
      </D.Portal>
    )
  },
)
DrawerContent.displayName = "DrawerContent"
